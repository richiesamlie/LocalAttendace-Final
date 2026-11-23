using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace TeacherAssistant
{
    static class Program
    {
        private const string AppGuid = "Local\\TeacherAssistant_Tray_SingleInstance_App";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            AppDomain.CurrentDomain.UnhandledException += (s, e) =>
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tray-error.log"),
                        DateTime.Now.ToString("s") + " [AppDomain] " + e.ExceptionObject + Environment.NewLine
                    );
                }
                catch { }
            };
            Application.ThreadException += (s, e) =>
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tray-error.log"),
                        DateTime.Now.ToString("s") + " [Thread] " + e.Exception + Environment.NewLine
                    );
                }
                catch { }
            };

            bool isFirstInstance = true;
            Mutex mutex = null;
            try
            {
                mutex = new Mutex(true, AppGuid, out isFirstInstance);
            }
            catch
            {
                isFirstInstance = true;
            }

            if (!isFirstInstance)
            {
                // If already running, simply open browser and exit
                try
                {
                    Process.Start(new ProcessStartInfo("http://127.0.0.1:3000") { UseShellExecute = true });
                }
                catch { }
                return;
            }

            try
            {
                Application.Run(new TrayApplicationContext(args));
            }
            finally
            {
                if (mutex != null)
                {
                    try { mutex.ReleaseMutex(); } catch { }
                    mutex.Dispose();
                }
            }
        }
    }

    public class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon notifyIcon;
        private Process nodeProcess;
        private string appUrl = "http://127.0.0.1:3000";
        private bool isNetworkMode = false;
        private bool isStartupMode = false;
        private string baseDir;
        private ToolStripMenuItem statusMenuItem;
        private ToolStripMenuItem modeToggleItem;
        private ToolStripMenuItem copyItem;
        private SynchronizationContext syncContext;
        private int currentEpoch = 0;
        private volatile bool isStopping = false;
        private int consecutiveCrashCount = 0;
        private DateTime lastStartTime = DateTime.MinValue;
        private const int MaxAutoRestarts = 3;
        private readonly object logLock = new object();

        public TrayApplicationContext(string[] args)
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            syncContext = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();

            foreach (var arg in args)
            {
                if (arg.Equals("--network", StringComparison.OrdinalIgnoreCase))
                {
                    isNetworkMode = true;
                }
                else if (arg.Equals("--startup", StringComparison.OrdinalIgnoreCase) || arg.Equals("--silent", StringComparison.OrdinalIgnoreCase))
                {
                    isStartupMode = true;
                }
            }

            if (isNetworkMode)
            {
                string localIp = GetLocalIPAddress();
                appUrl = "http://" + localIp + ":3000";
            }

            // Hook system shutdown/logoff to clean up child process
            SystemEvents.SessionEnding += (s, e) => StopServer();
            Application.ApplicationExit += (s, e) => StopServer();

            InitializeTray();
            int startEpoch = StartServer();

            // Wait for server health in background and optionally open browser
            WaitForServerHealth(!isStartupMode, startEpoch);
        }

        private void InitializeTray()
        {
            var menu = new ContextMenuStrip();

            var openItem = new ToolStripMenuItem("🌐 Open Teacher Assistant", null, (s, e) => OpenBrowser());
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            menu.Items.Add(openItem);

            copyItem = new ToolStripMenuItem("📋 Copy Link (" + appUrl + ")", null, (s, e) => {
                try
                {
                    Clipboard.SetText(appUrl);
                    notifyIcon.ShowBalloonTip(2000, "Link Copied", appUrl + " copied to clipboard.", ToolTipIcon.Info);
                }
                catch { }
            });
            menu.Items.Add(copyItem);

            menu.Items.Add(new ToolStripSeparator());

            statusMenuItem = new ToolStripMenuItem("⏳ Server: Starting...", null);
            statusMenuItem.Enabled = false;
            menu.Items.Add(statusMenuItem);

            modeToggleItem = new ToolStripMenuItem(
                isNetworkMode ? "🔒 Switch to Local Mode (This PC Only)" : "📡 Switch to Classroom Wi-Fi Mode",
                null,
                (s, e) => ToggleNetworkMode()
            );
            menu.Items.Add(modeToggleItem);

            var restartItem = new ToolStripMenuItem("🔄 Restart Server", null, (s, e) => RestartServer());
            menu.Items.Add(restartItem);

            menu.Items.Add(new ToolStripSeparator());

            var exitItem = new ToolStripMenuItem("❌ Exit Teacher Assistant", null, (s, e) => Exit());
            menu.Items.Add(exitItem);

            notifyIcon = new NotifyIcon
            {
                ContextMenuStrip = menu,
                Visible = true
            };

            // Load application icon
            string iconPath = Path.Combine(baseDir, @"public\icon.ico");
            if (File.Exists(iconPath))
            {
                try { notifyIcon.Icon = new Icon(iconPath); }
                catch { notifyIcon.Icon = SystemIcons.Application; }
            }
            else
            {
                notifyIcon.Icon = SystemIcons.Application;
            }

            UpdateTrayText("Teacher Assistant: Starting...");

            notifyIcon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    OpenBrowser();
                }
            };
            notifyIcon.DoubleClick += (s, e) => OpenBrowser();
            notifyIcon.BalloonTipClicked += (s, e) => OpenBrowser();
        }

        private void ToggleNetworkMode()
        {
            isNetworkMode = !isNetworkMode;
            UpdateModeUI();

            statusMenuItem.Text = "⏳ Server: Switching mode...";
            consecutiveCrashCount = 0;
            StopServer();
            int startEpoch = StartServer();
            WaitForServerHealth(true, startEpoch);

            try
            {
                string switchMsg = isNetworkMode
                    ? "Switched to Classroom Wi-Fi Mode.\nAccessible at: " + appUrl
                    : "Switched to Local Mode.\nPrivate to this computer: " + appUrl;
                notifyIcon.ShowBalloonTip(2500, "Teacher Assistant", switchMsg, ToolTipIcon.Info);
            }
            catch { }
        }

        private void UpdateModeUI()
        {
            if (isNetworkMode)
            {
                string localIp = GetLocalIPAddress();
                appUrl = "http://" + localIp + ":3000";
                if (modeToggleItem != null)
                {
                    modeToggleItem.Text = "🔒 Switch to Local Mode (This PC Only)";
                }
            }
            else
            {
                appUrl = "http://127.0.0.1:3000";
                if (modeToggleItem != null)
                {
                    modeToggleItem.Text = "📡 Switch to Classroom Wi-Fi Mode";
                }
            }

            if (copyItem != null)
            {
                copyItem.Text = "📋 Copy Link (" + appUrl + ")";
            }

            UpdateTrayText("Teacher Assistant: " + (isNetworkMode ? "Wi-Fi" : "Local") + "\n" + appUrl);
        }

        private void UpdateTrayText(string text)
        {
            if (notifyIcon == null) return;
            if (text.Length > 63)
            {
                text = text.Substring(0, 63);
            }
            notifyIcon.Text = text;
        }

        private int StartServer()
        {
            int startEpoch = Interlocked.Increment(ref currentEpoch);
            isStopping = false;

            try
            {
                // Kill any lingering process on port 3000 and wait until port is free
                KillProcessOnPort(3000);
                WaitForPortRelease(3000, 3000);

                RotateLogIfLarge("server-stdout.log", 5 * 1024 * 1024);
                RotateLogIfLarge("server-stderr.log", 5 * 1024 * 1024);

                string nodeExe = Path.Combine(baseDir, @"node\node.exe");
                if (!File.Exists(nodeExe))
                {
                    nodeExe = Path.Combine(baseDir, @"node-portable\node.exe");
                }
                if (!File.Exists(nodeExe))
                {
                    nodeExe = "node";
                }

                string serverScript = Path.Combine(baseDir, @"dist-server\index.cjs");
                string args = "\"" + serverScript + "\"";
                if (isNetworkMode)
                {
                    args += " --network";
                }

                // Dev fallback if not pre-bundled
                if (!File.Exists(serverScript))
                {
                    nodeExe = "cmd.exe";
                    args = "/c npx tsx server.ts" + (isNetworkMode ? " --network" : "");
                }

                var psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = args,
                    WorkingDirectory = baseDir,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8,
                    StandardErrorEncoding = System.Text.Encoding.UTF8
                };

                psi.EnvironmentVariables["COOKIE_SECURE"] = "false";
                psi.EnvironmentVariables["NODE_ENV"] = "production";

                var startedProc = new Process();
                startedProc.StartInfo = psi;
                startedProc.EnableRaisingEvents = true;

                startedProc.OutputDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        AppendLog("server-stdout.log", e.Data);
                    }
                };
                startedProc.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        AppendLog("server-stderr.log", e.Data);
                    }
                };
                startedProc.Exited += (s, e) => OnNodeProcessExited(startedProc, startEpoch);

                lastStartTime = DateTime.UtcNow;
                startedProc.Start();
                startedProc.BeginOutputReadLine();
                startedProc.BeginErrorReadLine();
                nodeProcess = startedProc;
            }
            catch (Exception ex)
            {
                AppendLog("tray-error.log", DateTime.Now.ToString("s") + " [StartServer] " + ex);
                MessageBox.Show("Failed to start Teacher Assistant backend:\n" + ex.Message,
                    "Teacher Assistant Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }

            return startEpoch;
        }

        private void OnNodeProcessExited(Process proc, int epoch)
        {
            if (isStopping || epoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
            {
                return;
            }

            int exitCode = -1;
            try { exitCode = proc.ExitCode; } catch { }

            AppendLog("tray-error.log", DateTime.Now.ToString("s") + " [ProcessExited] Server exited unexpectedly with code " + exitCode);

            syncContext.Post(__ =>
            {
                if (isStopping || epoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
                {
                    return;
                }

                if ((DateTime.UtcNow - lastStartTime).TotalSeconds >= 60)
                {
                    consecutiveCrashCount = 0;
                }
                consecutiveCrashCount++;

                try
                {
                    if (consecutiveCrashCount <= MaxAutoRestarts)
                    {
                        statusMenuItem.Text = "⏳ Server: Recovering (" + consecutiveCrashCount + "/" + MaxAutoRestarts + ")...";
                        UpdateTrayText("Teacher Assistant: Restarting...");
                        notifyIcon.ShowBalloonTip(3000, "Teacher Assistant",
                            "Server stopped unexpectedly (code " + exitCode + "). Restarting automatically...", ToolTipIcon.Warning);

                        ThreadPool.QueueUserWorkItem(___ =>
                        {
                            Thread.Sleep(2000);
                            if (isStopping || epoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
                            {
                                return;
                            }
                            syncContext.Post(____ =>
                            {
                                if (isStopping || epoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
                                {
                                    return;
                                }
                                int nextEpoch = StartServer();
                                WaitForServerHealth(false, nextEpoch);
                            }, null);
                        });
                    }
                    else
                    {
                        statusMenuItem.Text = "⚠️ Server: Stopped (crashed)";
                        UpdateTrayText("Teacher Assistant: Stopped");
                        notifyIcon.ShowBalloonTip(5000, "Teacher Assistant",
                            "Server crashed repeatedly (exit code " + exitCode + "). Check server-stderr.log or server-error.log, then right-click tray icon to restart.", ToolTipIcon.Error);
                    }
                }
                catch { }
            }, null);
        }

        private void WaitForServerHealth(bool openBrowserOnSuccess, int expectedEpoch)
        {
            int myEpoch = expectedEpoch;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    var deadline = DateTime.Now.AddSeconds(60);
                    bool healthy = false;

                    while (DateTime.Now < deadline)
                    {
                        if (myEpoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
                        {
                            return;
                        }

                        if (nodeProcess != null && nodeProcess.HasExited)
                        {
                            break;
                        }

                        try
                        {
                            var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3000/api/health");
                            req.Timeout = 1500;
                            using (var resp = (HttpWebResponse)req.GetResponse())
                            {
                                if (resp.StatusCode == HttpStatusCode.OK)
                                {
                                    healthy = true;
                                    break;
                                }
                            }
                        }
                        catch { }

                        Thread.Sleep(1000);
                    }

                    if (myEpoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
                    {
                        return;
                    }

                    syncContext.Post(__ =>
                    {
                        if (myEpoch != Interlocked.CompareExchange(ref currentEpoch, 0, 0))
                        {
                            return;
                        }

                        try
                        {
                            if (healthy)
                            {
                                statusMenuItem.Text = isNetworkMode
                                    ? "🟢 Server: Wi-Fi (" + appUrl.Replace("http://", "") + ")"
                                    : "🟢 Server: Running (Local)";
                                UpdateTrayText("Teacher Assistant: " + (isNetworkMode ? "Wi-Fi" : "Local") + "\n" + appUrl);

                                string tipTitle = isNetworkMode ? "Classroom Wi-Fi Mode Ready" : "Teacher Assistant is Ready";
                                string tipBody = isNetworkMode
                                    ? "Available on Wi-Fi at:\n" + appUrl + "\nClick icon to open in browser."
                                    : "Running at " + appUrl + "\nClick icon to open in browser.";

                                notifyIcon.ShowBalloonTip(3000, tipTitle, tipBody, ToolTipIcon.Info);

                                if (openBrowserOnSuccess)
                                {
                                    OpenBrowser();
                                }
                            }
                            else if (nodeProcess == null || !nodeProcess.HasExited)
                            {
                                statusMenuItem.Text = "⚠️ Server: Failed / Stopped";
                                UpdateTrayText("Teacher Assistant: Stopped");

                                notifyIcon.ShowBalloonTip(4000, "Teacher Assistant",
                                    "Server failed to respond on port 3000.\nRight-click tray icon to restart.", ToolTipIcon.Warning);
                            }
                        }
                        catch { }
                    }, null);
                }
                catch (Exception ex)
                {
                    AppendLog("tray-error.log", DateTime.Now.ToString("s") + " [HealthCheck] " + ex);
                }
            });
        }

        private void RestartServer()
        {
            statusMenuItem.Text = "⏳ Server: Restarting...";
            consecutiveCrashCount = 0;
            StopServer();
            int startEpoch = StartServer();
            WaitForServerHealth(false, startEpoch);
            try
            {
                notifyIcon.ShowBalloonTip(2000, "Teacher Assistant", "Server is restarting...", ToolTipIcon.Info);
            }
            catch { }
        }

        private void StopServer()
        {
            isStopping = true;
            Interlocked.Increment(ref currentEpoch);

            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.Kill();
                    nodeProcess.WaitForExit(3000);
                }
            }
            catch { }

            KillProcessOnPort(3000);
            WaitForPortRelease(3000, 3000);
        }

        private void WaitForPortRelease(int port, int timeoutMs)
        {
            var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (DateTime.UtcNow < deadline && IsPortInUse(port))
            {
                Thread.Sleep(100);
            }
        }

        private void AppendLog(string filename, string line)
        {
            try
            {
                string logPath = Path.Combine(baseDir, filename);
                lock (logLock)
                {
                    File.AppendAllText(logPath, line + Environment.NewLine, System.Text.Encoding.UTF8);
                }
            }
            catch { }
        }

        private void RotateLogIfLarge(string filename, long maxBytes)
        {
            try
            {
                string logPath = Path.Combine(baseDir, filename);
                lock (logLock)
                {
                    if (File.Exists(logPath))
                    {
                        var info = new FileInfo(logPath);
                        if (info.Length > maxBytes)
                        {
                            string oldPath = logPath + ".old";
                            if (File.Exists(oldPath))
                            {
                                File.Delete(oldPath);
                            }
                            File.Move(logPath, oldPath);
                        }
                    }
                }
            }
            catch { }
        }

        private bool IsPortInUse(int port)
        {
            try
            {
                var listeners = System.Net.NetworkInformation.IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners();
                foreach (var endpoint in listeners)
                {
                    if (endpoint.Port == port) return true;
                }
            }
            catch { }
            return false;
        }

        private void KillProcessOnPort(int port)
        {
            if (!IsPortInUse(port)) return;

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -Command \"try { $c = Get-NetTCPConnection -LocalPort " + port + " -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } } catch {}\"",
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false
                };
                using (var p = Process.Start(psi))
                {
                    p.WaitForExit(4000);
                }
            }
            catch { }
        }

        private void OpenBrowser()
        {
            try
            {
                Process.Start(new ProcessStartInfo(appUrl) { UseShellExecute = true });
            }
            catch { }
        }

        private string GetLocalIPAddress()
        {
            try
            {
                using (var socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0))
                {
                    socket.Connect("8.8.8.8", 65530);
                    var endPoint = socket.LocalEndPoint as IPEndPoint;
                    if (endPoint != null) return endPoint.Address.ToString();
                }
            }
            catch { }

            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    {
                        return ip.ToString();
                    }
                }
            }
            catch { }

            return "127.0.0.1";
        }

        private void Exit()
        {
            StopServer();
            if (notifyIcon != null)
            {
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
            }
            Application.Exit();
        }
    }
}

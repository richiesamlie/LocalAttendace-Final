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
        private const string AppGuid = "Global\\TeacherAssistant_Tray_SingleInstance_App";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool isFirstInstance;
            using (var mutex = new Mutex(true, AppGuid, out isFirstInstance))
            {
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

                Application.Run(new TrayApplicationContext(args));
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

        public TrayApplicationContext(string[] args)
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;

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
            StartServer();

            // Wait for server health in background and optionally open browser
            WaitForServerHealth();
        }

        private void InitializeTray()
        {
            var menu = new ContextMenuStrip();

            var openItem = new ToolStripMenuItem("🌐 Open Teacher Assistant", null, (s, e) => OpenBrowser());
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            menu.Items.Add(openItem);

            var copyItem = new ToolStripMenuItem("📋 Copy Link (" + appUrl + ")", null, (s, e) => {
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

            var modeItem = new ToolStripMenuItem(isNetworkMode ? "📡 Mode: Network / Intra-Site" : "🔒 Mode: Local Loopback", null);
            modeItem.Enabled = false;
            menu.Items.Add(modeItem);

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

            notifyIcon.DoubleClick += (s, e) => OpenBrowser();
            notifyIcon.BalloonTipClicked += (s, e) => OpenBrowser();
        }

        private void UpdateTrayText(string text)
        {
            if (text.Length > 63)
            {
                text = text.Substring(0, 63);
            }
            notifyIcon.Text = text;
        }

        private void StartServer()
        {
            try
            {
                // Kill any lingering process on port 3000
                KillProcessOnPort(3000);

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
                    nodeExe = "npx";
                    args = "tsx server.ts" + (isNetworkMode ? " --network" : "");
                }

                var psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = args,
                    WorkingDirectory = baseDir,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false
                };

                psi.EnvironmentVariables["COOKIE_SECURE"] = "false";
                psi.EnvironmentVariables["NODE_ENV"] = "production";

                nodeProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to start Teacher Assistant backend:\n" + ex.Message,
                    "Teacher Assistant Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void WaitForServerHealth()
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                var deadline = DateTime.Now.AddSeconds(60);
                bool healthy = false;

                while (DateTime.Now < deadline)
                {
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

                if (healthy)
                {
                    if (notifyIcon != null && notifyIcon.ContextMenuStrip != null)
                    {
                        notifyIcon.ContextMenuStrip.Invoke((Action)(() =>
                        {
                            statusMenuItem.Text = "🟢 Server: Running (Port 3000)";
                            UpdateTrayText("Teacher Assistant: Running\n" + appUrl);

                            notifyIcon.ShowBalloonTip(3000, "Teacher Assistant is Ready",
                                "Running at " + appUrl + "\nClick icon to open in browser.", ToolTipIcon.Info);
                        }));
                    }

                    // If not started in silent background startup mode, open browser automatically
                    if (!isStartupMode)
                    {
                        OpenBrowser();
                    }
                }
                else
                {
                    if (notifyIcon != null && notifyIcon.ContextMenuStrip != null)
                    {
                        notifyIcon.ContextMenuStrip.Invoke((Action)(() =>
                        {
                            statusMenuItem.Text = "⚠️ Server: Starting or Error";
                        }));
                    }
                }
            });
        }

        private void RestartServer()
        {
            statusMenuItem.Text = "⏳ Server: Restarting...";
            StopServer();
            StartServer();
            WaitForServerHealth();
            notifyIcon.ShowBalloonTip(2000, "Teacher Assistant", "Server is restarting...", ToolTipIcon.Info);
        }

        private void StopServer()
        {
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
        }

        private void KillProcessOnPort(int port)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-NoProfile -Command \"try { $c = Get-NetTCPConnection -LocalPort " + port + " -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } } catch {}\"",
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

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace TeacherAssistant
{
    internal class InstallRequestDto
    {
        public string mode { get; set; }
    }

    internal class ConfigRequestDto
    {
        public object autoCheckEnabled { get; set; }
    }

    public sealed class LocalControlServer : IDisposable
    {
        private const int MaxHeaderBytes = 16 * 1024;
        private const int MaxBodyBytes = 64 * 1024;

        private readonly string controlToken;
        private readonly UpdateManager updateManager;
        private readonly Action<string> logError;
        private readonly TcpListener listener;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private volatile bool disposed = false;

        public int Port { get; private set; }

        public LocalControlServer(string controlToken, UpdateManager updateManager, Action<string> logError)
        {
            this.controlToken = controlToken;
            this.updateManager = updateManager;
            this.logError = logError;

            this.listener = new TcpListener(IPAddress.Loopback, 0);
            this.listener.Start();
            this.Port = ((IPEndPoint)this.listener.LocalEndpoint).Port;

            var acceptThread = new Thread(AcceptLoop);
            acceptThread.IsBackground = true;
            acceptThread.Start();
        }

        private void AcceptLoop()
        {
            while (!disposed)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(delegate { HandleClient(client); });
                }
                catch (SocketException)
                {
                    if (disposed) break;
                }
                catch (ObjectDisposedException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    if (!disposed && logError != null)
                    {
                        logError(DateTime.Now.ToString("s") + " [LocalControl] Accept error: " + ex.Message);
                    }
                }
            }
        }

        private void HandleClient(TcpClient client)
        {
            using (client)
            {
                try
                {
                    client.ReceiveTimeout = 5000;
                    client.SendTimeout = 5000;

                    using (NetworkStream stream = client.GetStream())
                    {
                        string method;
                        string path;
                        Dictionary<string, string> headers;
                        string bodyText;
                        if (!TryReadHttpRequest(stream, out method, out path, out headers, out bodyText))
                        {
                            WriteJsonResponse(stream, 400, "Bad Request", "{\"error\":\"Malformed HTTP request\"}");
                            return;
                        }

                        string providedToken;
                        headers.TryGetValue("x-tray-token", out providedToken);
                        if (!FixedTimeEquals(providedToken, controlToken))
                        {
                            WriteJsonResponse(stream, 403, "Forbidden", "{\"error\":\"Forbidden\"}");
                            return;
                        }

                        if (method == "GET" && path == "/status")
                        {
                            WriteJsonResponse(stream, 200, "OK", json.Serialize(updateManager.GetStatus()));
                            return;
                        }

                        if (method == "POST" && path == "/check")
                        {
                            updateManager.StartCheckAsync(true);
                            WriteJsonResponse(stream, 202, "Accepted", json.Serialize(updateManager.GetStatus()));
                            return;
                        }

                        if (method == "POST" && path == "/install")
                        {
                            InstallRequestDto reqDto = null;
                            try
                            {
                                reqDto = string.IsNullOrEmpty(bodyText)
                                    ? null
                                    : json.Deserialize<InstallRequestDto>(bodyText);
                            }
                            catch { }

                            string mode = reqDto != null && reqDto.mode != null ? reqDto.mode.Trim() : "";
                            if (mode != "now" && mode != "on-exit")
                            {
                                WriteJsonResponse(stream, 400, "Bad Request", "{\"error\":\"mode must be 'now' or 'on-exit'\"}");
                                return;
                            }

                            bool started = updateManager.TryStartInstallAsync(mode == "on-exit");
                            if (!started)
                            {
                                WriteJsonResponse(stream, 409, "Conflict", "{\"error\":\"No update available or update already in progress\"}");
                                return;
                            }

                            WriteJsonResponse(stream, 202, "Accepted", json.Serialize(updateManager.GetStatus()));
                            return;
                        }

                        if (method == "POST" && path == "/config")
                        {
                            ConfigRequestDto cfgDto = null;
                            try
                            {
                                cfgDto = string.IsNullOrEmpty(bodyText)
                                    ? null
                                    : json.Deserialize<ConfigRequestDto>(bodyText);
                            }
                            catch { }

                            if (cfgDto == null || !(cfgDto.autoCheckEnabled is bool))
                            {
                                WriteJsonResponse(stream, 400, "Bad Request", "{\"error\":\"autoCheckEnabled boolean is required\"}");
                                return;
                            }

                            UpdateStatus updated = updateManager.SetAutoCheckEnabled((bool)cfgDto.autoCheckEnabled);
                            WriteJsonResponse(stream, 200, "OK", json.Serialize(updated));
                            return;
                        }

                        WriteJsonResponse(stream, 404, "Not Found", "{\"error\":\"Not found\"}");
                    }
                }
                catch { }
            }
        }

        private static bool TryReadHttpRequest(
            NetworkStream stream,
            out string method,
            out string path,
            out Dictionary<string, string> headers,
            out string bodyText)
        {
            method = null;
            path = null;
            headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            bodyText = "";

            byte[] buffer = new byte[4096];
            using (var ms = new MemoryStream())
            {
                int headerEndIdx = -1;
                while (ms.Length < MaxHeaderBytes)
                {
                    int read = stream.Read(buffer, 0, buffer.Length);
                    if (read <= 0) break;
                    ms.Write(buffer, 0, read);
                    byte[] arr = ms.ToArray();
                    headerEndIdx = FindHeaderTerminator(arr);
                    if (headerEndIdx >= 0) break;
                }

                if (headerEndIdx < 0)
                {
                    return false;
                }

                byte[] allBytes = ms.ToArray();
                string headerSection = Encoding.ASCII.GetString(allBytes, 0, headerEndIdx);
                string[] lines = headerSection.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length == 0)
                {
                    return false;
                }

                string[] reqParts = lines[0].Split(' ');
                if (reqParts.Length < 2)
                {
                    return false;
                }
                method = reqParts[0].Trim().ToUpperInvariant();
                string rawTarget = reqParts[1].Trim();
                int qIdx = rawTarget.IndexOf('?');
                path = qIdx >= 0 ? rawTarget.Substring(0, qIdx) : rawTarget;

                for (int i = 1; i < lines.Length; i++)
                {
                    string line = lines[i];
                    int colonIdx = line.IndexOf(':');
                    if (colonIdx > 0)
                    {
                        string hName = line.Substring(0, colonIdx).Trim().ToLowerInvariant();
                        string hVal = line.Substring(colonIdx + 1).Trim();
                        headers[hName] = hVal;
                    }
                }

                int contentLength = 0;
                string clStr;
                if (headers.TryGetValue("content-length", out clStr))
                {
                    if (!int.TryParse(clStr, out contentLength) || contentLength < 0 || contentLength > MaxBodyBytes)
                    {
                        return false;
                    }
                }

                if (contentLength > 0)
                {
                    int bodyStart = headerEndIdx + 4;
                    int alreadyHave = allBytes.Length - bodyStart;
                    byte[] bodyBytes = new byte[contentLength];
                    int copied = Math.Min(alreadyHave, contentLength);
                    if (copied > 0)
                    {
                        Buffer.BlockCopy(allBytes, bodyStart, bodyBytes, 0, copied);
                    }
                    int offset = copied;
                    while (offset < contentLength)
                    {
                        int read = stream.Read(bodyBytes, offset, contentLength - offset);
                        if (read <= 0)
                        {
                            return false;
                        }
                        offset += read;
                    }
                    bodyText = Encoding.UTF8.GetString(bodyBytes);
                }

                return true;
            }
        }

        private static int FindHeaderTerminator(byte[] bytes)
        {
            for (int i = 0; i <= bytes.Length - 4; i++)
            {
                if (bytes[i] == 13 && bytes[i + 1] == 10 && bytes[i + 2] == 13 && bytes[i + 3] == 10)
                {
                    return i;
                }
            }
            return -1;
        }

        private static void WriteJsonResponse(NetworkStream stream, int statusCode, string reasonPhrase, string jsonBody)
        {
            byte[] bodyBytes = Encoding.UTF8.GetBytes(jsonBody ?? "{}");
            string header =
                "HTTP/1.1 " + statusCode + " " + reasonPhrase + "\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + bodyBytes.Length + "\r\n" +
                "Cache-Control: no-store\r\n" +
                "Connection: close\r\n\r\n";
            byte[] headerBytes = Encoding.ASCII.GetBytes(header);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(bodyBytes, 0, bodyBytes.Length);
            stream.Flush();
        }

        private static bool FixedTimeEquals(string a, string b)
        {
            if (a == null || b == null) return false;
            byte[] ba = Encoding.UTF8.GetBytes(a);
            byte[] bb = Encoding.UTF8.GetBytes(b);
            if (ba.Length != bb.Length) return false;
            int diff = 0;
            for (int i = 0; i < ba.Length; i++)
            {
                diff |= ba[i] ^ bb[i];
            }
            return diff == 0;
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            try { listener.Stop(); } catch { }
        }
    }
}

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32;

namespace TeacherAssistant
{
    public class UpdateConfig
    {
        public bool autoCheckEnabled { get; set; }
        public string lastCheckedUtc { get; set; }
        public string skippedVersion { get; set; }

        public UpdateConfig()
        {
            autoCheckEnabled = true;
            lastCheckedUtc = null;
            skippedVersion = null;
        }
    }

    public class UpdateStatus
    {
        public string currentVersion { get; set; }
        public string currentRuntimeHash { get; set; }
        public string installType { get; set; }
        public bool managedByTray { get; set; }
        public bool canSelfUpdate { get; set; }
        public string state { get; set; }
        public bool autoCheckEnabled { get; set; }
        public string lastCheckedAt { get; set; }
        public string availableVersion { get; set; }
        public string releaseNotesUrl { get; set; }
        public string updateKind { get; set; }
        public long downloadSizeBytes { get; set; }
        public int downloadProgress { get; set; }
        public bool signatureVerified { get; set; }
        public bool signatureRequired { get; set; }
        public bool installOnExit { get; set; }
        public string lastError { get; set; }

        public UpdateStatus Clone()
        {
            var copy = new UpdateStatus();
            copy.currentVersion = currentVersion;
            copy.currentRuntimeHash = currentRuntimeHash;
            copy.installType = installType;
            copy.managedByTray = managedByTray;
            copy.canSelfUpdate = canSelfUpdate;
            copy.state = state;
            copy.autoCheckEnabled = autoCheckEnabled;
            copy.lastCheckedAt = lastCheckedAt;
            copy.availableVersion = availableVersion;
            copy.releaseNotesUrl = releaseNotesUrl;
            copy.updateKind = updateKind;
            copy.downloadSizeBytes = downloadSizeBytes;
            copy.downloadProgress = downloadProgress;
            copy.signatureVerified = signatureVerified;
            copy.signatureRequired = signatureRequired;
            copy.installOnExit = installOnExit;
            copy.lastError = lastError;
            return copy;
        }
    }

    internal class ManifestAssetDto
    {
        public string filename { get; set; }
        public string url { get; set; }
        public string sha256 { get; set; }
        public long size { get; set; }
    }

    internal class ManifestAssetsDto
    {
        public ManifestAssetDto appBundle { get; set; }
        public ManifestAssetDto portable { get; set; }
        public ManifestAssetDto installer { get; set; }
    }

    internal class UpdateManifestDto
    {
        public int schemaVersion { get; set; }
        public string version { get; set; }
        public string publishedAt { get; set; }
        public string runtimeHash { get; set; }
        public string releaseNotesUrl { get; set; }
        public ManifestAssetsDto assets { get; set; }
    }

    internal class VersionFileDto
    {
        public string version { get; set; }
        public string runtimeHash { get; set; }
    }

    public sealed class UpdateManager
    {
        private const string DefaultManifestUrl = "https://github.com/richiesamlie/LocalAttendace-Final/releases/latest/download/update-manifest.json";
        private static readonly string[] AllowedHosts = new string[]
        {
            "github.com",
            "api.github.com",
            "objects.githubusercontent.com",
            "release-assets.githubusercontent.com"
        };

        private static readonly string[] ProtectedExactPaths = new string[]
        {
            "database.sqlite",
            "database.sqlite-wal",
            "database.sqlite-shm",
            ".env",
            "update-config.json",
            "server-error.log",
            "server-stdout.log",
            "server-stderr.log",
            "tray-error.log"
        };

        private readonly string baseDir;
        private readonly Func<bool> isNetworkModeGetter;
        private readonly Func<bool> isStartupModeGetter;
        private readonly Action stopServer;
        private readonly Func<int> startServer;
        private readonly Action requestTrayExit;
        private readonly Action<string> logError;
        private readonly object syncLock = new object();
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();

        private readonly string manifestUrl;
        private readonly bool allowLocalTestHttp;
        private readonly bool signatureRequired;

        private UpdateConfig config;
        private UpdateStatus status;
        private ManifestAssetDto selectedAsset;
        private string stagedFilePath;
        private string stagedUpdateKind;
        private string stagedVersion;
        private bool operationInProgress;

        public event Action<UpdateStatus> StatusChanged;
        public event Action<string, string, bool> NotifyUser;

        public UpdateManager(
            string baseDir,
            Func<bool> isNetworkModeGetter,
            Func<bool> isStartupModeGetter,
            Action stopServer,
            Func<int> startServer,
            Action requestTrayExit,
            Action<string> logError)
        {
            this.baseDir = baseDir;
            this.isNetworkModeGetter = isNetworkModeGetter;
            this.isStartupModeGetter = isStartupModeGetter;
            this.stopServer = stopServer;
            this.startServer = startServer;
            this.requestTrayExit = requestTrayExit;
            this.logError = logError;

            // .NET Framework 4.x does not enable TLS 1.2 by default; GitHub requires TLS 1.2+.
            try
            {
                ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072;
            }
            catch { }

            string envUrl = Environment.GetEnvironmentVariable("TEACHER_ASSISTANT_UPDATE_URL");
            Uri envUri;
            if (!string.IsNullOrEmpty(envUrl) && Uri.TryCreate(envUrl.Trim(), UriKind.Absolute, out envUri))
            {
                if (envUri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) &&
                    envUri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
                {
                    this.manifestUrl = envUri.ToString();
                    this.allowLocalTestHttp = true;
                }
                else if (IsAllowedGitHubUri(envUri))
                {
                    this.manifestUrl = envUri.ToString();
                    this.allowLocalTestHttp = false;
                }
                else
                {
                    this.manifestUrl = DefaultManifestUrl;
                    this.allowLocalTestHttp = false;
                }
            }
            else
            {
                this.manifestUrl = DefaultManifestUrl;
                this.allowLocalTestHttp = false;
            }

            string pubKey = BuildMeta.UpdatePublicKeyXml;
            this.signatureRequired = pubKey != null && pubKey.Trim().Length > 0;

            this.config = LoadConfig();
            this.status = new UpdateStatus();
            this.status.managedByTray = true;
            this.status.canSelfUpdate = true;
            this.status.state = "idle";
            this.status.updateKind = "";
            this.status.autoCheckEnabled = this.config.autoCheckEnabled;
            this.status.lastCheckedAt = this.config.lastCheckedUtc;
            this.status.signatureRequired = this.signatureRequired;
            this.status.installType = DetectInstallType();
            LoadVersionInfoIntoStatus();
        }

        public string CurrentVersion
        {
            get
            {
                lock (syncLock)
                {
                    return status.currentVersion;
                }
            }
        }

        public bool AutoCheckEnabled
        {
            get
            {
                lock (syncLock)
                {
                    return status.autoCheckEnabled;
                }
            }
        }

        public bool IsApplyingUpdate
        {
            get
            {
                lock (syncLock)
                {
                    return status.state == "applying" || status.state == "restarting";
                }
            }
        }

        public UpdateStatus GetStatus()
        {
            lock (syncLock)
            {
                return status.Clone();
            }
        }

        public bool ShouldRunScheduledAutoCheck()
        {
            lock (syncLock)
            {
                if (!config.autoCheckEnabled || operationInProgress)
                {
                    return false;
                }
                if (status.state == "downloading" || status.state == "applying" || status.state == "restarting")
                {
                    return false;
                }
                if (string.IsNullOrEmpty(config.lastCheckedUtc))
                {
                    return true;
                }
                DateTime last;
                if (DateTime.TryParse(config.lastCheckedUtc, null, System.Globalization.DateTimeStyles.RoundtripKind, out last))
                {
                    return (DateTime.UtcNow - last.ToUniversalTime()).TotalHours >= 24.0;
                }
                return true;
            }
        }

        public UpdateStatus SetAutoCheckEnabled(bool enabled)
        {
            UpdateStatus snapshot;
            lock (syncLock)
            {
                config.autoCheckEnabled = enabled;
                status.autoCheckEnabled = enabled;
                SaveConfig(config);
                snapshot = status.Clone();
            }
            RaiseStatusChanged(snapshot);
            return snapshot;
        }

        public void StartCheckAsync(bool userInitiated)
        {
            lock (syncLock)
            {
                if (operationInProgress)
                {
                    return;
                }
                operationInProgress = true;
                status.state = "checking";
                status.lastError = null;
            }
            RaiseStatusChanged(GetStatus());

            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    PerformCheck(userInitiated);
                }
                finally
                {
                    lock (syncLock)
                    {
                        operationInProgress = false;
                    }
                }
            });
        }

        public bool TryStartInstallAsync(bool onExit)
        {
            lock (syncLock)
            {
                if (operationInProgress)
                {
                    return false;
                }
                if (status.state != "available" || selectedAsset == null || string.IsNullOrEmpty(status.availableVersion))
                {
                    return false;
                }
                operationInProgress = true;
                status.state = "downloading";
                status.downloadProgress = 0;
                status.lastError = null;
            }
            RaiseStatusChanged(GetStatus());

            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    PerformDownloadAndMaybeApply(onExit);
                }
                finally
                {
                    lock (syncLock)
                    {
                        operationInProgress = false;
                    }
                }
            });
            return true;
        }

        public bool HasPendingExitUpdate()
        {
            lock (syncLock)
            {
                return status.installOnExit && !string.IsNullOrEmpty(stagedFilePath) && File.Exists(stagedFilePath);
            }
        }

        public void ApplyPendingExitUpdateBlocking()
        {
            string localPath;
            string localKind;
            string localVer;
            lock (syncLock)
            {
                if (!status.installOnExit || string.IsNullOrEmpty(stagedFilePath) || !File.Exists(stagedFilePath))
                {
                    return;
                }
                localPath = stagedFilePath;
                localKind = stagedUpdateKind;
                localVer = stagedVersion;
                status.installOnExit = false;
                status.state = "applying";
            }

            try
            {
                ApplyStagedFile(localPath, localKind, localVer, false);
            }
            catch (Exception ex)
            {
                Log("ApplyPendingExitUpdate error: " + ex);
            }
        }

        private void PerformCheck(bool userInitiated)
        {
            string prevAvailableVersion;
            lock (syncLock)
            {
                prevAvailableVersion = status.availableVersion;
            }

            try
            {
                byte[] manifestBytes = FetchBytesWithAllowlist(manifestUrl, 8000, 262144);
                bool verified = false;

                if (signatureRequired)
                {
                    string sigUrl = manifestUrl + ".sig";
                    byte[] sigRaw = FetchBytesWithAllowlist(sigUrl, 8000, 16384);
                    string sigBase64 = Encoding.UTF8.GetString(sigRaw).Trim();
                    byte[] sigBytes = Convert.FromBase64String(sigBase64);

                    using (var rsa = new RSACryptoServiceProvider())
                    {
                        rsa.FromXmlString(BuildMeta.UpdatePublicKeyXml);
                        verified = rsa.VerifyData(manifestBytes, CryptoConfig.MapNameToOID("SHA256"), sigBytes);
                    }

                    if (!verified)
                    {
                        throw new InvalidOperationException("Update signature verification failed.");
                    }
                }

                string manifestJson = Encoding.UTF8.GetString(manifestBytes);
                UpdateManifestDto manifest = json.Deserialize<UpdateManifestDto>(manifestJson);
                if (manifest == null || manifest.schemaVersion != 1 || string.IsNullOrEmpty(manifest.version) || manifest.assets == null)
                {
                    throw new InvalidOperationException("Unsupported update manifest format.");
                }

                string remoteVersion = StripLeadingV(manifest.version);
                string checkedUtc = DateTime.UtcNow.ToString("o");

                lock (syncLock)
                {
                    config.lastCheckedUtc = checkedUtc;
                    SaveConfig(config);
                    status.lastCheckedAt = checkedUtc;
                    status.signatureVerified = verified;
                }

                bool isNewer = CompareSemver(remoteVersion, CurrentVersion) > 0;
                if (!isNewer)
                {
                    lock (syncLock)
                    {
                        selectedAsset = null;
                        stagedFilePath = null;
                        stagedUpdateKind = null;
                        stagedVersion = null;
                        status.installOnExit = false;
                        status.availableVersion = null;
                        status.releaseNotesUrl = null;
                        status.updateKind = "";
                        status.downloadSizeBytes = 0;
                        status.downloadProgress = 0;
                        status.state = "up-to-date";
                        status.lastError = null;
                    }
                    RaiseStatusChanged(GetStatus());
                    if (userInitiated)
                    {
                        RaiseNotify("Teacher Assistant", "You are on the latest version (v" + CurrentVersion + ").", false);
                    }
                    return;
                }

                string chosenKind;
                ManifestAssetDto chosenAsset = SelectAsset(manifest, out chosenKind);
                if (chosenAsset == null || string.IsNullOrEmpty(chosenAsset.url) || !IsValidSha256Hex(chosenAsset.sha256))
                {
                    throw new InvalidOperationException("Update manifest does not contain a valid verified download asset.");
                }

                Uri assetUri;
                if (!Uri.TryCreate(chosenAsset.url, UriKind.Absolute, out assetUri) || !IsAllowedUrl(assetUri))
                {
                    throw new InvalidOperationException("Blocked update asset URL outside allowlisted GitHub hosts.");
                }

                string notesUrl = "https://github.com/richiesamlie/LocalAttendace-Final/releases/tag/v" + remoteVersion;
                Uri notesUri;
                if (!string.IsNullOrEmpty(manifest.releaseNotesUrl) &&
                    Uri.TryCreate(manifest.releaseNotesUrl, UriKind.Absolute, out notesUri) &&
                    IsAllowedUrl(notesUri))
                {
                    notesUrl = notesUri.ToString();
                }

                lock (syncLock)
                {
                    if (!string.Equals(stagedVersion, remoteVersion, StringComparison.OrdinalIgnoreCase))
                    {
                        stagedFilePath = null;
                        stagedUpdateKind = null;
                        stagedVersion = null;
                        status.installOnExit = false;
                    }
                    selectedAsset = chosenAsset;
                    status.availableVersion = remoteVersion;
                    status.releaseNotesUrl = notesUrl;
                    status.updateKind = chosenKind;
                    status.downloadSizeBytes = chosenAsset.size;
                    status.downloadProgress = 0;
                    status.state = "available";
                    status.lastError = null;
                }

                RaiseStatusChanged(GetStatus());
                if (userInitiated || !string.Equals(prevAvailableVersion, remoteVersion, StringComparison.OrdinalIgnoreCase))
                {
                    RaiseNotify(
                        "Update Available: v" + remoteVersion,
                        "Teacher Assistant v" + remoteVersion + " is ready. Right-click the tray icon or open Settings to update.",
                        false);
                }
            }
            catch (Exception ex)
            {
                Log("CheckForUpdates error: " + ex);
                lock (syncLock)
                {
                    if (userInitiated)
                    {
                        status.state = "error";
                        status.lastError = ex.Message;
                    }
                    else
                    {
                        status.state = string.IsNullOrEmpty(status.availableVersion) ? "idle" : "available";
                    }
                }
                RaiseStatusChanged(GetStatus());
                if (userInitiated)
                {
                    RaiseNotify("Update Check Failed", ex.Message, true);
                }
            }
        }

        private ManifestAssetDto SelectAsset(UpdateManifestDto manifest, out string chosenKind)
        {
            string localRuntimeHash;
            string localInstallType;
            lock (syncLock)
            {
                localRuntimeHash = status.currentRuntimeHash;
                localInstallType = status.installType;
            }

            if (!string.IsNullOrEmpty(localRuntimeHash) &&
                !string.IsNullOrEmpty(manifest.runtimeHash) &&
                string.Equals(localRuntimeHash.Trim(), manifest.runtimeHash.Trim(), StringComparison.OrdinalIgnoreCase) &&
                manifest.assets.appBundle != null)
            {
                chosenKind = "app-bundle";
                return manifest.assets.appBundle;
            }

            if (localInstallType == "installed" && manifest.assets.installer != null)
            {
                chosenKind = "full-installer";
                return manifest.assets.installer;
            }

            if (manifest.assets.portable != null)
            {
                chosenKind = "full-portable";
                return manifest.assets.portable;
            }

            if (manifest.assets.installer != null)
            {
                chosenKind = "full-installer";
                return manifest.assets.installer;
            }

            chosenKind = "";
            return null;
        }

        private void PerformDownloadAndMaybeApply(bool onExit)
        {
            ManifestAssetDto asset;
            string targetVersion;
            string kind;
            lock (syncLock)
            {
                asset = selectedAsset;
                targetVersion = status.availableVersion;
                kind = status.updateKind;
            }

            try
            {
                string safeFileName = Path.GetFileName(asset.filename);
                if (string.IsNullOrEmpty(safeFileName))
                {
                    throw new InvalidOperationException("Invalid update asset filename.");
                }

                string tempDir = Path.Combine(Path.GetTempPath(), "TeacherAssistant-Update", targetVersion);
                Directory.CreateDirectory(tempDir);

                string finalPath = Path.Combine(tempDir, safeFileName);
                string partPath = finalPath + ".part";

                if (!File.Exists(finalPath) || !string.Equals(ComputeFileSha256(finalPath), asset.sha256.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    if (File.Exists(partPath))
                    {
                        File.Delete(partPath);
                    }
                    if (File.Exists(finalPath))
                    {
                        File.Delete(finalPath);
                    }

                    int lastReported = -1;
                    DownloadFileWithAllowlist(asset.url, partPath, 120000, delegate(int pct)
                    {
                        if (pct != lastReported && (pct == 100 || pct - lastReported >= 2))
                        {
                            lastReported = pct;
                            lock (syncLock)
                            {
                                status.downloadProgress = pct;
                            }
                            RaiseStatusChanged(GetStatus());
                        }
                    });

                    string actualSha = ComputeFileSha256(partPath);
                    if (!string.Equals(actualSha, asset.sha256.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        try { File.Delete(partPath); } catch { }
                        throw new InvalidOperationException("Downloaded update failed SHA-256 integrity verification.");
                    }

                    File.Move(partPath, finalPath);
                }

                if (onExit)
                {
                    lock (syncLock)
                    {
                        stagedFilePath = finalPath;
                        stagedUpdateKind = kind;
                        stagedVersion = targetVersion;
                        status.installOnExit = true;
                        status.downloadProgress = 100;
                        status.state = "available";
                        status.lastError = null;
                    }
                    RaiseStatusChanged(GetStatus());
                    RaiseNotify(
                        "Update Ready for Exit",
                        "Teacher Assistant v" + targetVersion + " is downloaded and will install automatically when you exit.",
                        false);
                    return;
                }

                lock (syncLock)
                {
                    stagedFilePath = finalPath;
                    stagedUpdateKind = kind;
                    stagedVersion = targetVersion;
                    status.downloadProgress = 100;
                    status.state = "applying";
                    status.lastError = null;
                }
                RaiseStatusChanged(GetStatus());

                ApplyStagedFile(finalPath, kind, targetVersion, true);
            }
            catch (Exception ex)
            {
                Log("Download/Apply update error: " + ex);
                lock (syncLock)
                {
                    status.state = "error";
                    status.lastError = ex.Message;
                    status.downloadProgress = 0;
                }
                RaiseStatusChanged(GetStatus());
                RaiseNotify("Update Failed", ex.Message, true);
            }
        }

        private void ApplyStagedFile(string filePath, string kind, string targetVersion, bool relaunchAfter)
        {
            stopServer();
            CreatePreUpdateBackup();

            if (kind == "app-bundle")
            {
                ApplyAppBundle(filePath, targetVersion, relaunchAfter);
            }
            else if (kind == "full-installer")
            {
                ApplyFullInstaller(filePath, targetVersion, relaunchAfter);
            }
            else if (kind == "full-portable")
            {
                ApplyFullPortable(filePath, targetVersion, relaunchAfter);
            }
            else
            {
                throw new InvalidOperationException("Unknown update kind: " + kind);
            }
        }

        private void ApplyAppBundle(string zipPath, string targetVersion, bool relaunchAfter)
        {
            string stagingDir = Path.Combine(baseDir, "_update_staging");
            string rollbackDir = Path.Combine(baseDir, "_update_rollback");

            DeleteDirectorySafe(stagingDir);
            DeleteDirectorySafe(rollbackDir);
            Directory.CreateDirectory(rollbackDir);

            ExtractZipSafely(zipPath, stagingDir);

            var movedBackups = new List<string>();
            var placedItems = new List<string>();

            try
            {
                string[] stagedDirs = Directory.GetDirectories(stagingDir);
                foreach (string srcDir in stagedDirs)
                {
                    string name = Path.GetFileName(srcDir);
                    if (IsProtectedRelativePath(name))
                    {
                        continue;
                    }
                    string liveDir = Path.Combine(baseDir, name);
                    string bakDir = Path.Combine(rollbackDir, name);
                    if (Directory.Exists(liveDir))
                    {
                        Directory.Move(liveDir, bakDir);
                        movedBackups.Add(name);
                    }
                    Directory.Move(srcDir, liveDir);
                    placedItems.Add(name);
                }

                string[] stagedFiles = Directory.GetFiles(stagingDir);
                foreach (string srcFile in stagedFiles)
                {
                    string name = Path.GetFileName(srcFile);
                    if (IsProtectedRelativePath(name))
                    {
                        continue;
                    }
                    string liveFile = Path.Combine(baseDir, name);
                    string bakFile = Path.Combine(rollbackDir, name);
                    if (File.Exists(liveFile))
                    {
                        File.Move(liveFile, bakFile);
                        movedBackups.Add(name);
                    }
                    File.Move(srcFile, liveFile);
                    placedItems.Add(name);
                }
            }
            catch (Exception swapEx)
            {
                Log("App-bundle file swap failed, restoring rollback: " + swapEx);
                RestoreRollbackItems(rollbackDir, movedBackups, placedItems);
                DeleteDirectorySafe(stagingDir);
                DeleteDirectorySafe(rollbackDir);
                if (relaunchAfter)
                {
                    startServer();
                }
                throw;
            }

            if (!relaunchAfter)
            {
                DeleteDirectorySafe(stagingDir);
                DeleteDirectorySafe(rollbackDir);
                lock (syncLock)
                {
                    LoadVersionInfoIntoStatus();
                    status.availableVersion = null;
                    status.releaseNotesUrl = null;
                    status.updateKind = "";
                    status.state = "up-to-date";
                    status.lastError = null;
                }
                return;
            }

            lock (syncLock)
            {
                status.state = "restarting";
            }
            RaiseStatusChanged(GetStatus());

            startServer();
            bool healthy = WaitForLocalHealth(25000);
            if (healthy)
            {
                DeleteDirectorySafe(stagingDir);
                DeleteDirectorySafe(rollbackDir);
                lock (syncLock)
                {
                    LoadVersionInfoIntoStatus();
                    selectedAsset = null;
                    stagedFilePath = null;
                    stagedUpdateKind = null;
                    stagedVersion = null;
                    status.installOnExit = false;
                    status.availableVersion = null;
                    status.releaseNotesUrl = null;
                    status.updateKind = "";
                    status.downloadSizeBytes = 0;
                    status.downloadProgress = 0;
                    status.state = "up-to-date";
                    status.lastError = null;
                }
                RaiseStatusChanged(GetStatus());
                RaiseNotify("Update Complete", "Teacher Assistant updated to v" + targetVersion + "!", false);
            }
            else
            {
                Log("New version v" + targetVersion + " failed /api/health after update; rolling back.");
                stopServer();
                RestoreRollbackItems(rollbackDir, movedBackups, placedItems);
                DeleteDirectorySafe(stagingDir);
                DeleteDirectorySafe(rollbackDir);
                startServer();

                lock (syncLock)
                {
                    LoadVersionInfoIntoStatus();
                    status.state = "rolled-back";
                    status.lastError = "New version failed health check and was rolled back.";
                }
                RaiseStatusChanged(GetStatus());
                RaiseNotify("Update Rolled Back", "The new version failed to start and was rolled back safely.", true);
            }
        }

        private void RestoreRollbackItems(string rollbackDir, List<string> movedBackups, List<string> placedItems)
        {
            foreach (string item in placedItems)
            {
                if (IsProtectedRelativePath(item))
                {
                    continue;
                }
                string livePath = Path.Combine(baseDir, item);
                try
                {
                    if (Directory.Exists(livePath))
                    {
                        Directory.Delete(livePath, true);
                    }
                    else if (File.Exists(livePath))
                    {
                        File.Delete(livePath);
                    }
                }
                catch { }
            }

            foreach (string item in movedBackups)
            {
                if (IsProtectedRelativePath(item))
                {
                    continue;
                }
                string bakPath = Path.Combine(rollbackDir, item);
                string livePath = Path.Combine(baseDir, item);
                try
                {
                    if (Directory.Exists(bakPath))
                    {
                        Directory.Move(bakPath, livePath);
                    }
                    else if (File.Exists(bakPath))
                    {
                        File.Move(bakPath, livePath);
                    }
                }
                catch { }
            }
        }

        private void ApplyFullInstaller(string setupExePath, string targetVersion, bool relaunchAfter)
        {
            string tempDir = Path.GetDirectoryName(setupExePath);
            string scriptPath = Path.Combine(tempDir, "apply-installer.ps1");
            int parentPid = Process.GetCurrentProcess().Id;
            string cleanBaseDir = baseDir.TrimEnd('\\', '/');
            string exePath = Path.Combine(cleanBaseDir, "TeacherAssistant.exe");
            string launchArgs = BuildLaunchArgs();

            var sb = new StringBuilder();
            sb.AppendLine("$ErrorActionPreference = 'Stop'");
            sb.AppendLine("$parentPid = " + parentPid);
            sb.AppendLine("$setupExe = " + PsQuote(setupExePath));
            sb.AppendLine("$installDir = " + PsQuote(cleanBaseDir));
            sb.AppendLine("$exePath = " + PsQuote(exePath));
            sb.AppendLine("$launchArgs = " + PsQuote(launchArgs));
            sb.AppendLine("$relaunch = " + (relaunchAfter ? "$true" : "$false"));
            sb.AppendLine("for ($i = 0; $i -lt 30; $i++) {");
            sb.AppendLine("  if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }");
            sb.AppendLine("  Start-Sleep -Milliseconds 500");
            sb.AppendLine("}");
            sb.AppendLine("$proc = Start-Process -FilePath $setupExe -ArgumentList ('/S /D=' + $installDir) -Wait -PassThru");
            sb.AppendLine("if ($relaunch -and $proc.ExitCode -eq 0 -and (Test-Path $exePath)) {");
            sb.AppendLine("  if ($launchArgs) { Start-Process -FilePath $exePath -ArgumentList $launchArgs }");
            sb.AppendLine("  else { Start-Process -FilePath $exePath }");
            sb.AppendLine("}");

            File.WriteAllText(scriptPath, sb.ToString(), new UTF8Encoding(false));
            SpawnDetachedPowerShell(scriptPath);
            if (relaunchAfter)
            {
                requestTrayExit();
            }
        }

        private void ApplyFullPortable(string zipPath, string targetVersion, bool relaunchAfter)
        {
            string tempDir = Path.GetDirectoryName(zipPath);
            string extractedDir = Path.Combine(tempDir, "extracted");
            ExtractZipSafely(zipPath, extractedDir);

            string scriptPath = Path.Combine(tempDir, "apply-portable.ps1");
            int parentPid = Process.GetCurrentProcess().Id;
            string cleanBaseDir = baseDir.TrimEnd('\\', '/');
            string exePath = Path.Combine(cleanBaseDir, "TeacherAssistant.exe");
            string launchArgs = BuildLaunchArgs();

            var sb = new StringBuilder();
            sb.AppendLine("$ErrorActionPreference = 'Stop'");
            sb.AppendLine("$parentPid = " + parentPid);
            sb.AppendLine("$baseDir = " + PsQuote(cleanBaseDir));
            sb.AppendLine("$extractedDir = " + PsQuote(extractedDir));
            sb.AppendLine("$tempUpdateDir = " + PsQuote(tempDir));
            sb.AppendLine("$exePath = " + PsQuote(exePath));
            sb.AppendLine("$launchArgs = " + PsQuote(launchArgs));
            sb.AppendLine("$relaunch = " + (relaunchAfter ? "$true" : "$false"));
            sb.AppendLine("function Test-ProtectedName([string]$name) {");
            sb.AppendLine("  $n = $name.ToLowerInvariant()");
            sb.AppendLine("  if ($n -eq 'database.sqlite' -or $n -eq 'database.sqlite-wal' -or $n -eq 'database.sqlite-shm' -or $n -eq '.env' -or $n -eq 'backups' -or $n -eq 'update-config.json' -or $n -eq '_update_rollback' -or $n -eq '_update_staging') { return $true }");
            sb.AppendLine("  if ($n.EndsWith('.log')) { return $true }");
            sb.AppendLine("  return $false");
            sb.AppendLine("}");
            sb.AppendLine("for ($i = 0; $i -lt 30; $i++) {");
            sb.AppendLine("  if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }");
            sb.AppendLine("  Start-Sleep -Milliseconds 500");
            sb.AppendLine("}");
            sb.AppendLine("Get-Process -Name 'node','TeacherAssistant' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($baseDir, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }");
            sb.AppendLine("Start-Sleep -Milliseconds 500");
            sb.AppendLine("$rollbackDir = Join-Path $baseDir '_update_rollback'");
            sb.AppendLine("if (Test-Path $rollbackDir) { Remove-Item $rollbackDir -Recurse -Force }");
            sb.AppendLine("New-Item -ItemType Directory -Path $rollbackDir -Force | Out-Null");
            sb.AppendLine("$moved = @()");
            sb.AppendLine("$placed = @()");
            sb.AppendLine("foreach ($entry in (Get-ChildItem -Path $extractedDir -Force)) {");
            sb.AppendLine("  if (Test-ProtectedName $entry.Name) { continue }");
            sb.AppendLine("  $live = Join-Path $baseDir $entry.Name");
            sb.AppendLine("  $bak = Join-Path $rollbackDir $entry.Name");
            sb.AppendLine("  if (Test-Path $live) { Move-Item -Path $live -Destination $bak -Force; $moved += $entry.Name }");
            sb.AppendLine("  Copy-Item -Path $entry.FullName -Destination $live -Recurse -Force");
            sb.AppendLine("  $placed += $entry.Name");
            sb.AppendLine("}");
            sb.AppendLine("if (-not $relaunch) {");
            sb.AppendLine("  Remove-Item $rollbackDir -Recurse -Force -ErrorAction SilentlyContinue");
            sb.AppendLine("  Remove-Item $tempUpdateDir -Recurse -Force -ErrorAction SilentlyContinue");
            sb.AppendLine("  exit 0");
            sb.AppendLine("}");
            sb.AppendLine("if (Test-Path $exePath) {");
            sb.AppendLine("  if ($launchArgs) { Start-Process -FilePath $exePath -ArgumentList $launchArgs }");
            sb.AppendLine("  else { Start-Process -FilePath $exePath }");
            sb.AppendLine("}");
            sb.AppendLine("$healthy = $false");
            sb.AppendLine("for ($j = 0; $j -lt 30; $j++) {");
            sb.AppendLine("  Start-Sleep -Seconds 1");
            sb.AppendLine("  try {");
            sb.AppendLine("    $req = [System.Net.WebRequest]::Create('http://127.0.0.1:3000/api/health')");
            sb.AppendLine("    $req.Timeout = 1500");
            sb.AppendLine("    $resp = $req.GetResponse()");
            sb.AppendLine("    if ([int]$resp.StatusCode -eq 200) { $healthy = $true; $resp.Close(); break }");
            sb.AppendLine("    $resp.Close()");
            sb.AppendLine("  } catch {}");
            sb.AppendLine("}");
            sb.AppendLine("if ($healthy) {");
            sb.AppendLine("  Remove-Item $rollbackDir -Recurse -Force -ErrorAction SilentlyContinue");
            sb.AppendLine("  Remove-Item $tempUpdateDir -Recurse -Force -ErrorAction SilentlyContinue");
            sb.AppendLine("} else {");
            sb.AppendLine("  Get-Process -Name 'node','TeacherAssistant' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($baseDir, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }");
            sb.AppendLine("  Start-Sleep -Milliseconds 500");
            sb.AppendLine("  foreach ($p in $placed) { $lp = Join-Path $baseDir $p; if (Test-Path $lp) { Remove-Item $lp -Recurse -Force -ErrorAction SilentlyContinue } }");
            sb.AppendLine("  foreach ($m in $moved) { $bp = Join-Path $rollbackDir $m; $lp = Join-Path $baseDir $m; if (Test-Path $bp) { Move-Item -Path $bp -Destination $lp -Force } }");
            sb.AppendLine("  Remove-Item $rollbackDir -Recurse -Force -ErrorAction SilentlyContinue");
            sb.AppendLine("  if (Test-Path $exePath) {");
            sb.AppendLine("    if ($launchArgs) { Start-Process -FilePath $exePath -ArgumentList $launchArgs }");
            sb.AppendLine("    else { Start-Process -FilePath $exePath }");
            sb.AppendLine("  }");
            sb.AppendLine("}");

            File.WriteAllText(scriptPath, sb.ToString(), new UTF8Encoding(false));
            SpawnDetachedPowerShell(scriptPath);
            if (relaunchAfter)
            {
                requestTrayExit();
            }
        }

        private string BuildLaunchArgs()
        {
            var parts = new List<string>();
            if (isNetworkModeGetter != null && isNetworkModeGetter())
            {
                parts.Add("--network");
            }
            if (isStartupModeGetter != null && isStartupModeGetter())
            {
                parts.Add("--startup");
            }
            return string.Join(" ", parts.ToArray());
        }

        private static string PsQuote(string value)
        {
            return "'" + (value ?? "").Replace("'", "''") + "'";
        }

        private static void SpawnDetachedPowerShell(string scriptPath)
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + scriptPath + "\"",
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                UseShellExecute = false
            };
            Process.Start(psi);
        }

        private bool WaitForLocalHealth(int timeoutMs)
        {
            DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3000/api/health");
                    req.Timeout = 1500;
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    {
                        if (resp.StatusCode == HttpStatusCode.OK)
                        {
                            return true;
                        }
                    }
                }
                catch { }
                Thread.Sleep(500);
            }
            return false;
        }

        private void CreatePreUpdateBackup()
        {
            try
            {
                string dbPath = Path.Combine(baseDir, "database.sqlite");
                if (!File.Exists(dbPath))
                {
                    return;
                }
                string backupDir = Path.Combine(baseDir, "backups");
                Directory.CreateDirectory(backupDir);
                string stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
                string backupName = "pre-update-v" + CurrentVersion + "-" + stamp + ".sqlite";
                File.Copy(dbPath, Path.Combine(backupDir, backupName), true);
            }
            catch (Exception ex)
            {
                Log("Pre-update database backup warning: " + ex.Message);
            }
        }

        private void ExtractZipSafely(string zipPath, string destDir)
        {
            DeleteDirectorySafe(destDir);
            Directory.CreateDirectory(destDir);
            string destFull = Path.GetFullPath(destDir);
            string destWithSep = destFull.EndsWith(Path.DirectorySeparatorChar.ToString())
                ? destFull
                : destFull + Path.DirectorySeparatorChar;

            using (ZipArchive archive = ZipFile.OpenRead(zipPath))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    if (IsProtectedRelativePath(entry.FullName))
                    {
                        continue;
                    }
                    string normalizedRel = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    string targetPath = Path.GetFullPath(Path.Combine(destFull, normalizedRel));
                    if (!targetPath.StartsWith(destWithSep, StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(targetPath, destFull, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("Blocked unsafe path in update archive: " + entry.FullName);
                    }

                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(targetPath);
                    }
                    else
                    {
                        string parent = Path.GetDirectoryName(targetPath);
                        if (!string.IsNullOrEmpty(parent))
                        {
                            Directory.CreateDirectory(parent);
                        }
                        entry.ExtractToFile(targetPath, true);
                    }
                }
            }
        }

        private static bool IsProtectedRelativePath(string relPath)
        {
            if (string.IsNullOrEmpty(relPath)) return true;
            string norm = relPath.Replace('\\', '/').Trim().TrimStart('/').ToLowerInvariant();
            if (string.IsNullOrEmpty(norm)) return true;
            if (norm == "backups" || norm.StartsWith("backups/")) return true;
            if (norm == "_update_staging" || norm.StartsWith("_update_staging/")) return true;
            if (norm == "_update_rollback" || norm.StartsWith("_update_rollback/")) return true;
            if (norm.EndsWith(".log")) return true;
            foreach (string p in ProtectedExactPaths)
            {
                if (norm == p) return true;
            }
            return false;
        }

        private static void DeleteDirectorySafe(string dirPath)
        {
            try
            {
                if (Directory.Exists(dirPath))
                {
                    Directory.Delete(dirPath, true);
                }
            }
            catch { }
        }

        private void LoadVersionInfoIntoStatus()
        {
            string ver = StripLeadingV(BuildMeta.Version);
            string rtHash = "";

            try
            {
                string versionPath = Path.Combine(baseDir, "version.json");
                if (File.Exists(versionPath))
                {
                    VersionFileDto dto = json.Deserialize<VersionFileDto>(File.ReadAllText(versionPath, Encoding.UTF8));
                    if (dto != null)
                    {
                        if (!string.IsNullOrEmpty(dto.version))
                        {
                            ver = StripLeadingV(dto.version);
                        }
                        if (!string.IsNullOrEmpty(dto.runtimeHash))
                        {
                            rtHash = dto.runtimeHash.Trim();
                        }
                    }
                }
                else
                {
                    string pkgPath = Path.Combine(baseDir, "package.json");
                    if (File.Exists(pkgPath))
                    {
                        VersionFileDto dto = json.Deserialize<VersionFileDto>(File.ReadAllText(pkgPath, Encoding.UTF8));
                        if (dto != null && !string.IsNullOrEmpty(dto.version))
                        {
                            ver = StripLeadingV(dto.version);
                        }
                    }
                }
            }
            catch { }

            status.currentVersion = string.IsNullOrEmpty(ver) ? "1.0.0" : ver;
            status.currentRuntimeHash = rtHash;
        }

        private string DetectInstallType()
        {
            try
            {
                if (File.Exists(Path.Combine(baseDir, "Uninstall.exe")))
                {
                    return "installed";
                }
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\TeacherAssistant"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("InstallDir");
                        if (val != null)
                        {
                            string regDir = Path.GetFullPath(val.ToString()).TrimEnd('\\', '/');
                            string curDir = Path.GetFullPath(baseDir).TrimEnd('\\', '/');
                            if (string.Equals(regDir, curDir, StringComparison.OrdinalIgnoreCase))
                            {
                                return "installed";
                            }
                        }
                    }
                }
            }
            catch { }
            return "portable";
        }

        private UpdateConfig LoadConfig()
        {
            try
            {
                string cfgPath = Path.Combine(baseDir, "update-config.json");
                if (File.Exists(cfgPath))
                {
                    UpdateConfig loaded = json.Deserialize<UpdateConfig>(File.ReadAllText(cfgPath, Encoding.UTF8));
                    if (loaded != null)
                    {
                        return loaded;
                    }
                }
            }
            catch { }
            return new UpdateConfig();
        }

        private void SaveConfig(UpdateConfig cfg)
        {
            try
            {
                string cfgPath = Path.Combine(baseDir, "update-config.json");
                File.WriteAllText(cfgPath, json.Serialize(cfg), new UTF8Encoding(false));
            }
            catch (Exception ex)
            {
                Log("Failed to save update-config.json: " + ex.Message);
            }
        }

        private bool IsAllowedUrl(Uri uri)
        {
            if (uri == null) return false;
            if (allowLocalTestHttp &&
                uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) &&
                uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            return IsAllowedGitHubUri(uri);
        }

        private static bool IsAllowedGitHubUri(Uri uri)
        {
            if (uri == null || !uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            foreach (string host in AllowedHosts)
            {
                if (uri.Host.Equals(host, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private byte[] FetchBytesWithAllowlist(string url, int timeoutMs, int maxBytes)
        {
            string currentUrl = url;
            for (int hop = 0; hop <= 5; hop++)
            {
                Uri uri;
                if (!Uri.TryCreate(currentUrl, UriKind.Absolute, out uri) || !IsAllowedUrl(uri))
                {
                    throw new InvalidOperationException("Blocked disallowed update URL: " + currentUrl);
                }

                var req = (HttpWebRequest)WebRequest.Create(uri);
                req.AllowAutoRedirect = false;
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                req.UserAgent = "TeacherAssistant/" + CurrentVersion;

                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    int code = (int)resp.StatusCode;
                    if (code >= 300 && code < 400)
                    {
                        string loc = resp.Headers["Location"];
                        if (string.IsNullOrEmpty(loc))
                        {
                            throw new InvalidOperationException("Redirect response missing Location header.");
                        }
                        currentUrl = new Uri(uri, loc).ToString();
                        continue;
                    }

                    if (code < 200 || code >= 300)
                    {
                        throw new InvalidOperationException("Update server returned HTTP " + code);
                    }

                    using (Stream stream = resp.GetResponseStream())
                    using (var ms = new MemoryStream())
                    {
                        byte[] buf = new byte[8192];
                        int read;
                        int total = 0;
                        while ((read = stream.Read(buf, 0, buf.Length)) > 0)
                        {
                            total += read;
                            if (total > maxBytes)
                            {
                                throw new InvalidOperationException("Update response exceeded maximum allowed size.");
                            }
                            ms.Write(buf, 0, read);
                        }
                        return ms.ToArray();
                    }
                }
            }

            throw new InvalidOperationException("Too many redirects while fetching update metadata.");
        }

        private void DownloadFileWithAllowlist(string url, string destPath, int timeoutMs, Action<int> onProgress)
        {
            string currentUrl = url;
            for (int hop = 0; hop <= 5; hop++)
            {
                Uri uri;
                if (!Uri.TryCreate(currentUrl, UriKind.Absolute, out uri) || !IsAllowedUrl(uri))
                {
                    throw new InvalidOperationException("Blocked disallowed download URL: " + currentUrl);
                }

                var req = (HttpWebRequest)WebRequest.Create(uri);
                req.AllowAutoRedirect = false;
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                req.UserAgent = "TeacherAssistant/" + CurrentVersion;

                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    int code = (int)resp.StatusCode;
                    if (code >= 300 && code < 400)
                    {
                        string loc = resp.Headers["Location"];
                        if (string.IsNullOrEmpty(loc))
                        {
                            throw new InvalidOperationException("Redirect response missing Location header.");
                        }
                        currentUrl = new Uri(uri, loc).ToString();
                        continue;
                    }

                    if (code < 200 || code >= 300)
                    {
                        throw new InvalidOperationException("Download server returned HTTP " + code);
                    }

                    long contentLength = resp.ContentLength;
                    using (Stream stream = resp.GetResponseStream())
                    using (var fs = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        byte[] buf = new byte[32768];
                        int read;
                        long totalRead = 0;
                        while ((read = stream.Read(buf, 0, buf.Length)) > 0)
                        {
                            fs.Write(buf, 0, read);
                            totalRead += read;
                            if (contentLength > 0 && onProgress != null)
                            {
                                int pct = (int)((totalRead * 100L) / contentLength);
                                if (pct > 100) pct = 100;
                                onProgress(pct);
                            }
                        }
                    }
                    if (onProgress != null)
                    {
                        onProgress(100);
                    }
                    return;
                }
            }

            throw new InvalidOperationException("Too many redirects while downloading update package.");
        }

        private static string ComputeFileSha256(string filePath)
        {
            using (var sha = SHA256.Create())
            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                byte[] hash = sha.ComputeHash(stream);
                var sb = new StringBuilder(hash.Length * 2);
                foreach (byte b in hash)
                {
                    sb.Append(b.ToString("x2"));
                }
                return sb.ToString();
            }
        }

        private static bool IsValidSha256Hex(string value)
        {
            if (string.IsNullOrEmpty(value)) return false;
            string s = value.Trim();
            if (s.Length != 64) return false;
            foreach (char c in s)
            {
                bool isHex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
                if (!isHex) return false;
            }
            return true;
        }

        private static string StripLeadingV(string ver)
        {
            if (string.IsNullOrEmpty(ver)) return "";
            string trimmed = ver.Trim();
            if (trimmed.StartsWith("v", StringComparison.OrdinalIgnoreCase))
            {
                return trimmed.Substring(1);
            }
            return trimmed;
        }

        private static int CompareSemver(string a, string b)
        {
            int[] pa = ParseSemverParts(a);
            int[] pb = ParseSemverParts(b);
            for (int i = 0; i < 3; i++)
            {
                if (pa[i] > pb[i]) return 1;
                if (pa[i] < pb[i]) return -1;
            }
            return 0;
        }

        private static int[] ParseSemverParts(string input)
        {
            string s = StripLeadingV(input);
            int dashIdx = s.IndexOf('-');
            if (dashIdx >= 0) s = s.Substring(0, dashIdx);
            int plusIdx = s.IndexOf('+');
            if (plusIdx >= 0) s = s.Substring(0, plusIdx);

            string[] segs = s.Split('.');
            int[] result = new int[3];
            for (int i = 0; i < 3 && i < segs.Length; i++)
            {
                int val;
                if (int.TryParse(segs[i], out val) && val >= 0)
                {
                    result[i] = val;
                }
            }
            return result;
        }

        private void RaiseStatusChanged(UpdateStatus snapshot)
        {
            Action<UpdateStatus> handler = StatusChanged;
            if (handler != null)
            {
                try { handler(snapshot); } catch { }
            }
        }

        private void RaiseNotify(string title, string body, bool isError)
        {
            Action<string, string, bool> handler = NotifyUser;
            if (handler != null)
            {
                try { handler(title, body, isError); } catch { }
            }
        }

        private void Log(string msg)
        {
            if (logError != null)
            {
                logError(DateTime.Now.ToString("s") + " [Updater] " + msg);
            }
        }
    }
}

import { useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { api, ApiError, type UpdateStatus } from '../lib/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatInstallType(installType: UpdateStatus['installType']): string {
  if (installType === 'installed') return 'Windows Installer';
  if (installType === 'portable') return 'Portable';
  return 'Standalone';
}

function formatUpdateKind(kind: UpdateStatus['updateKind']): string {
  if (kind === 'app-bundle') return 'Fast App Update';
  if (kind === 'full-installer' || kind === 'full-portable') return 'Full Desktop Update';
  return 'Update';
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export default function UpdateCard() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [waitingForRestart, setWaitingForRestart] = useState(false);
  const sawServerDownRef = useRef(false);
  const preUpdateVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await api.getUpdateStatus();
        if (!cancelled) {
          setStatus(next);
          setActionError(null);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setHidden(true);
        } else {
          setActionError(err instanceof Error ? err.message : 'Could not load update status.');
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentState = status?.state;

  useEffect(() => {
    const isActiveOperation =
      currentState === 'checking' ||
      currentState === 'downloading' ||
      currentState === 'applying' ||
      currentState === 'restarting' ||
      waitingForRestart;

    if (!isActiveOperation) return;

    let cancelled = false;
    let healthAttempts = 0;

    const timer = window.setInterval(async () => {
      if (cancelled) return;

      if (waitingForRestart) {
        healthAttempts += 1;
        try {
          const res = await fetch('/api/health', { cache: 'no-store' });
          if (!res.ok) {
            sawServerDownRef.current = true;
          } else if (sawServerDownRef.current) {
            window.location.reload();
            return;
          } else {
            try {
              const latest = await api.getUpdateStatus();
              if (cancelled) return;
              setStatus(latest);
              if (
                latest.state === 'up-to-date' &&
                preUpdateVersionRef.current &&
                latest.currentVersion !== preUpdateVersionRef.current
              ) {
                window.location.reload();
                return;
              }
              if (latest.state === 'rolled-back' || latest.state === 'error') {
                setWaitingForRestart(false);
                return;
              }
            } catch {
              sawServerDownRef.current = true;
            }
          }
        } catch {
          sawServerDownRef.current = true;
        }
        if (healthAttempts >= 40) {
          if (!cancelled) {
            setWaitingForRestart(false);
            setActionError('Server restart timed out. Please check the system tray icon.');
          }
        }
        return;
      }

      try {
        const next = await api.getUpdateStatus();
        if (cancelled) return;
        setStatus(next);
        if (next.state === 'restarting') {
          setWaitingForRestart(true);
        } else if (
          next.state === 'up-to-date' &&
          preUpdateVersionRef.current &&
          next.currentVersion !== preUpdateVersionRef.current
        ) {
          window.location.reload();
        }
      } catch {
        if (cancelled) return;
        if (currentState === 'downloading' || currentState === 'applying' || currentState === 'restarting') {
          sawServerDownRef.current = true;
          setWaitingForRestart(true);
        }
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentState, waitingForRestart]);

  if (hidden) {
    return null;
  }

  const isBusy =
    loading ||
    waitingForRestart ||
    status?.state === 'checking' ||
    status?.state === 'downloading' ||
    status?.state === 'applying' ||
    status?.state === 'restarting';

  const isLocalhost = status?.isLocalhost !== false;
  const managedByTray = Boolean(status?.managedByTray);

  const handleCheck = async () => {
    setActionError(null);
    setConfirmRestart(false);
    try {
      const next = await api.checkForUpdates();
      setStatus(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to check for updates.');
    }
  };

  const handleInstall = async (mode: 'now' | 'on-exit') => {
    setActionError(null);
    setConfirmRestart(false);
    if (mode === 'now') {
      preUpdateVersionRef.current = status?.currentVersion ?? null;
      sawServerDownRef.current = false;
    }
    try {
      const next = await api.installUpdate(mode);
      setStatus(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start update.');
    }
  };

  const handleToggleAutoCheck = async () => {
    if (!status) return;
    setActionError(null);
    try {
      const next = await api.setUpdateConfig(!status.autoCheckEnabled);
      setStatus(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save update setting.');
    }
  };

  const sizeLabel = status ? formatBytes(status.downloadSizeBytes) : '';
  const hasAvailableUpdate = status?.state === 'available' && Boolean(status.availableVersion);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center shrink-0">
          <RefreshCw className={`w-6 h-6 text-emerald-600 dark:text-emerald-400 ${isBusy ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Application Updates</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                Keep Teacher Assistant up to date while preserving all local attendance data.
              </p>
            </div>
            {status && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  v{status.currentVersion}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                  {formatInstallType(status.installType)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Last checked: {status ? formatTimestamp(status.lastCheckedAt) : 'Checking...'}
            </span>

            {managedByTray && isLocalhost && status && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={status.autoCheckEnabled}
                  disabled={isBusy}
                  onChange={handleToggleAutoCheck}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Auto-check daily when online</span>
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={isBusy || !isLocalhost}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-medium hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
            >
              <RefreshCw className={`w-4 h-4 ${status?.state === 'checking' ? 'animate-spin' : ''}`} />
              {status?.state === 'checking' ? 'Checking...' : 'Check for Updates'}
            </button>

            {!isLocalhost && (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Open Teacher Assistant on the host computer to check or install updates.
              </span>
            )}
          </div>

          {status?.state === 'downloading' && (
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                <span>Downloading v{status.availableVersion}...</span>
                <span>{status.downloadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, status.downloadProgress))}%` }}
                />
              </div>
            </div>
          )}

          {(waitingForRestart || status?.state === 'applying' || status?.state === 'restarting') && (
            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  Applying Update &amp; Restarting Server
                </h4>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                  Your database was backed up safely. This page will reload automatically once the new version is ready.
                </p>
              </div>
            </div>
          )}

          {hasAvailableUpdate && status && !waitingForRestart && (
            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Update Available: v{status.availableVersion}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    {formatUpdateKind(status.updateKind)}
                    {sizeLabel ? ` (${sizeLabel})` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {status.signatureVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                  {status.releaseNotesUrl && (
                    <a
                      href={status.releaseNotesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 dark:text-emerald-200 hover:underline"
                    >
                      Release Notes
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {managedByTray && isLocalhost && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {!confirmRestart ? (
                    <button
                      type="button"
                      onClick={() => setConfirmRestart(true)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-ring"
                    >
                      <Download className="w-4 h-4" />
                      Update &amp; Restart Now
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInstall('now')}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition-colors focus-ring"
                      >
                        Confirm Update &amp; Restart
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestart(false)}
                        className="inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus-ring"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {status.installOnExit ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Scheduled: will install when you exit
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInstall('on-exit')}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors focus-ring"
                    >
                      Install When I Exit
                    </button>
                  )}
                </div>
              )}

              {!managedByTray && status.releaseNotesUrl && (
                <div className="pt-1">
                  <a
                    href={status.releaseNotesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors focus-ring"
                  >
                    <Download className="w-4 h-4" />
                    Download from GitHub Releases
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          )}

          {status?.state === 'up-to-date' && (
            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Teacher Assistant v{status.currentVersion} is up to date.
              </p>
            </div>
          )}

          {status?.state === 'rolled-back' && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">Update Rolled Back</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {status.lastError || 'The new version did not pass startup health checks and was safely restored to the previous version.'}
                </p>
              </div>
            </div>
          )}

          {(actionError || status?.state === 'error') && (
            <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-rose-800 dark:text-rose-300">Update Check Error</h4>
                <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">
                  {actionError || status?.lastError || 'Could not reach the update service.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

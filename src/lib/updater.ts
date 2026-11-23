import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

export const DEFAULT_UPDATE_MANIFEST_URL =
  'https://github.com/richiesamlie/LocalAttendace-Final/releases/latest/download/update-manifest.json';

export const ALLOWED_UPDATE_HOSTS = new Set<string>([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

export type InstallType = 'installed' | 'portable' | 'standalone';

export type UpdateLifecycleState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'applying'
  | 'restarting'
  | 'error'
  | 'rolled-back';

export type UpdateKind = 'app-bundle' | 'full-installer' | 'full-portable' | '';

export interface UpdateStatus {
  currentVersion: string;
  currentRuntimeHash: string;
  installType: InstallType;
  managedByTray: boolean;
  canSelfUpdate: boolean;
  state: UpdateLifecycleState;
  autoCheckEnabled: boolean;
  lastCheckedAt: string | null;
  availableVersion: string | null;
  releaseNotesUrl: string | null;
  updateKind: UpdateKind;
  downloadSizeBytes: number;
  downloadProgress: number;
  signatureVerified: boolean;
  signatureRequired: boolean;
  installOnExit: boolean;
  lastError: string | null;
  isLocalhost?: boolean;
}

interface UpdateManifestAsset {
  filename: string;
  url: string;
  sha256: string;
  size: number;
}

interface UpdateManifest {
  schemaVersion: number;
  version: string;
  publishedAt?: string;
  runtimeHash?: string;
  releaseNotesUrl?: string;
  assets?: {
    appBundle?: UpdateManifestAsset;
    portable?: UpdateManifestAsset;
    installer?: UpdateManifestAsset;
  };
}

export class UpdaterUnavailableError extends Error {
  public readonly statusCode = 501;
  constructor(message: string) {
    super(message);
    this.name = 'UpdaterUnavailableError';
  }
}

export class TrayControlError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'TrayControlError';
    this.statusCode = statusCode;
  }
}

export function isAllowedUpdateHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_UPDATE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isLoopbackAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const trimmed = remoteAddress.trim();
  return trimmed === '127.0.0.1' || trimmed === '::1' || trimmed === '::ffff:127.0.0.1';
}

function parseSemverParts(input: string): [number, number, number] {
  const cleaned = input.trim().replace(/^[vV]/, '').split(/[-+]/)[0] || '0.0.0';
  const segments = cleaned.split('.');
  const major = Number.parseInt(segments[0] || '0', 10);
  const minor = Number.parseInt(segments[1] || '0', 10);
  const patch = Number.parseInt(segments[2] || '0', 10);
  return [
    Number.isFinite(major) && major >= 0 ? major : 0,
    Number.isFinite(minor) && minor >= 0 ? minor : 0,
    Number.isFinite(patch) && patch >= 0 ? patch : 0,
  ];
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

let cachedVersionInfo: { version: string; runtimeHash: string } | null = null;

export function resetVersionCacheForTest(): void {
  cachedVersionInfo = null;
  standaloneCache = null;
}

export async function getCurrentVersionInfo(): Promise<{ version: string; runtimeHash: string }> {
  if (cachedVersionInfo) return cachedVersionInfo;

  const cwd = process.cwd();
  try {
    const versionRaw = await fs.promises.readFile(path.join(cwd, 'version.json'), 'utf8');
    const parsed = JSON.parse(versionRaw) as { version?: unknown; runtimeHash?: unknown };
    if (typeof parsed.version === 'string' && parsed.version.trim()) {
      cachedVersionInfo = {
        version: parsed.version.trim().replace(/^[vV]/, ''),
        runtimeHash: typeof parsed.runtimeHash === 'string' ? parsed.runtimeHash.trim() : '',
      };
      return cachedVersionInfo;
    }
  } catch {
    // Fall back to package.json when version.json is not present (e.g. dev / Docker)
  }

  try {
    const pkgRaw = await fs.promises.readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as { version?: unknown };
    const version = typeof pkg.version === 'string' && pkg.version.trim()
      ? pkg.version.trim().replace(/^[vV]/, '')
      : '1.0.0';
    cachedVersionInfo = { version, runtimeHash: '' };
    return cachedVersionInfo;
  } catch {
    cachedVersionInfo = { version: '1.0.0', runtimeHash: '' };
    return cachedVersionInfo;
  }
}

export function isTrayManaged(): boolean {
  const port = Number(process.env.TRAY_CONTROL_PORT);
  return Number.isInteger(port) && port > 0 && port <= 65535 && Boolean(process.env.TRAY_CONTROL_TOKEN);
}

export async function callTrayControl<T>(
  method: 'GET' | 'POST',
  reqPath: string,
  body?: unknown,
): Promise<T> {
  const port = Number(process.env.TRAY_CONTROL_PORT);
  const token = process.env.TRAY_CONTROL_TOKEN || '';

  if (!Number.isInteger(port) || port <= 0 || !token) {
    throw new UpdaterUnavailableError('Tray control bridge is not configured');
  }

  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const headers: Record<string, string | number> = {
    'X-Tray-Token': token,
  };
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload, 'utf8');
  }

  return new Promise<T>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers,
        timeout: 5000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 500;
          let parsed: unknown;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            return reject(new TrayControlError('Invalid JSON response from Tray control server', 502));
          }
          if (status >= 400) {
            const errMsg =
              typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
                ? (parsed as { error: string }).error
                : `Tray control error (${status})`;
            return reject(new TrayControlError(errMsg, status));
          }
          return resolve(parsed as T);
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('Tray control request timed out'));
    });

    req.on('error', (err) => {
      reject(new TrayControlError(err.message || 'Failed to contact Tray control server', 502));
    });

    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

let standaloneCache: {
  state: UpdateLifecycleState;
  lastCheckedAt: string | null;
  availableVersion: string | null;
  releaseNotesUrl: string | null;
  downloadSizeBytes: number;
  lastError: string | null;
} | null = null;

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_REDIRECTS = 5;

async function fetchJsonWithAllowlist(urlStr: string, redirectsLeft = MAX_REDIRECTS): Promise<UpdateManifest> {
  if (!isAllowedUpdateHost(urlStr)) {
    throw new Error('Blocked update manifest URL outside allowlisted GitHub hosts');
  }

  return new Promise<UpdateManifest>((resolve, reject) => {
    const req = https.request(
      urlStr,
      {
        method: 'GET',
        timeout: 6000,
        headers: {
          'User-Agent': 'TeacherAssistant-Server-Updater',
          Accept: 'application/json',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          if (redirectsLeft <= 0) {
            return reject(new Error('Too many redirects while checking for updates'));
          }
          let nextUrl: string;
          try {
            nextUrl = new URL(location, urlStr).toString();
          } catch {
            return reject(new Error('Invalid redirect URL'));
          }
          fetchJsonWithAllowlist(nextUrl, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`GitHub update check returned HTTP ${status}`));
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_MANIFEST_BYTES) {
            req.destroy(new Error('Update manifest exceeds size limit'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as UpdateManifest;
            resolve(parsed);
          } catch {
            reject(new Error('Invalid update manifest JSON'));
          }
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('Update check timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

function buildStandaloneStatus(
  versionInfo: { version: string; runtimeHash: string },
  isLocalhost: boolean,
): UpdateStatus {
  return {
    currentVersion: versionInfo.version,
    currentRuntimeHash: versionInfo.runtimeHash,
    installType: 'standalone',
    managedByTray: false,
    canSelfUpdate: false,
    state: standaloneCache?.state ?? 'idle',
    autoCheckEnabled: false,
    lastCheckedAt: standaloneCache?.lastCheckedAt ?? null,
    availableVersion: standaloneCache?.availableVersion ?? null,
    releaseNotesUrl: standaloneCache?.releaseNotesUrl ?? null,
    updateKind: '',
    downloadSizeBytes: standaloneCache?.downloadSizeBytes ?? 0,
    downloadProgress: 0,
    signatureVerified: false,
    signatureRequired: false,
    installOnExit: false,
    lastError: standaloneCache?.lastError ?? null,
    isLocalhost,
  };
}

export async function getUpdateStatus(isLocalhost: boolean): Promise<UpdateStatus> {
  if (isTrayManaged()) {
    const status = await callTrayControl<UpdateStatus>('GET', '/status');
    return { ...status, isLocalhost };
  }
  const versionInfo = await getCurrentVersionInfo();
  return buildStandaloneStatus(versionInfo, isLocalhost);
}

export async function triggerUpdateCheck(isLocalhost: boolean): Promise<UpdateStatus> {
  if (isTrayManaged()) {
    const status = await callTrayControl<UpdateStatus>('POST', '/check');
    return { ...status, isLocalhost };
  }

  const versionInfo = await getCurrentVersionInfo();
  const checkedAt = new Date().toISOString();
  try {
    const manifest = await fetchJsonWithAllowlist(DEFAULT_UPDATE_MANIFEST_URL);
    if (!manifest || manifest.schemaVersion !== 1 || typeof manifest.version !== 'string') {
      throw new Error('Unsupported update manifest format');
    }
    const remoteVersion = manifest.version.trim().replace(/^[vV]/, '');
    const isNewer = compareSemver(remoteVersion, versionInfo.version) > 0;
    const preferredAsset = manifest.assets?.installer || manifest.assets?.portable || manifest.assets?.appBundle;

    standaloneCache = {
      state: isNewer ? 'available' : 'up-to-date',
      lastCheckedAt: checkedAt,
      availableVersion: isNewer ? remoteVersion : null,
      releaseNotesUrl: typeof manifest.releaseNotesUrl === 'string' && isAllowedUpdateHost(manifest.releaseNotesUrl)
        ? manifest.releaseNotesUrl
        : `https://github.com/richiesamlie/LocalAttendace-Final/releases/tag/v${remoteVersion}`,
      downloadSizeBytes: isNewer && preferredAsset ? Number(preferredAsset.size) || 0 : 0,
      lastError: null,
    };
  } catch (err) {
    standaloneCache = {
      state: 'error',
      lastCheckedAt: checkedAt,
      availableVersion: null,
      releaseNotesUrl: null,
      downloadSizeBytes: 0,
      lastError: err instanceof Error ? err.message : 'Failed to check for updates',
    };
  }

  return buildStandaloneStatus(versionInfo, isLocalhost);
}

export async function triggerUpdateInstall(mode: 'now' | 'on-exit'): Promise<UpdateStatus> {
  if (!isTrayManaged()) {
    throw new UpdaterUnavailableError('Self-updating requires the Windows Desktop app (System Tray runner).');
  }
  const status = await callTrayControl<UpdateStatus>('POST', '/install', { mode });
  return { ...status, isLocalhost: true };
}

export async function updateAutoCheckConfig(autoCheckEnabled: boolean): Promise<UpdateStatus> {
  if (!isTrayManaged()) {
    throw new UpdaterUnavailableError('Auto-check configuration requires the Windows Desktop app (System Tray runner).');
  }
  const status = await callTrayControl<UpdateStatus>('POST', '/config', { autoCheckEnabled });
  return { ...status, isLocalhost: true };
}

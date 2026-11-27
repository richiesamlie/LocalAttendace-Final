import os from 'node:os';

export const DEFAULT_LOCAL_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'] as const;

export interface ResolveAllowedOriginsOptions {
  allowedOriginsEnv?: string;
  isNetworkMode?: boolean;
  port?: number;
  interfaces?: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
}

/**
 * Resolve allowed WebSocket/CORS origins.
 * Explicit `ALLOWED_ORIGINS` always wins; otherwise defaults to localhost and,
 * when running in `--network` classroom Wi-Fi mode, appends local IPv4 LAN origins.
 */
export function resolveAllowedOrigins(options: ResolveAllowedOriginsOptions = {}): string[] {
  const {
    allowedOriginsEnv,
    isNetworkMode = false,
    port = 3000,
    interfaces,
  } = options;

  const trimmedEnv = allowedOriginsEnv?.trim();
  if (trimmedEnv) {
    return trimmedEnv
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const origins = new Set<string>(DEFAULT_LOCAL_ORIGINS);
  if (isNetworkMode) {
    const netIfaces = interfaces ?? os.networkInterfaces();
    for (const entries of Object.values(netIfaces)) {
      for (const iface of entries || []) {
        if ((iface.family === 'IPv4' || (iface.family as unknown) === 4) && !iface.internal && iface.address) {
          origins.add(`http://${iface.address}:${port}`);
        }
      }
    }
  }

  return Array.from(origins);
}

export interface SameHostNetworkOriginOptions {
  allowedOriginsEnv?: string;
  isNetworkMode: boolean;
}

/**
 * Allow same-host origins when running in `--network` mode without an explicit
 * `ALLOWED_ORIGINS` override (e.g., Docker containers accessed via host LAN IP).
 */
export function isSameHostNetworkOrigin(
  origin: string | undefined,
  hostHeader: string | undefined,
  options: SameHostNetworkOriginOptions,
): boolean {
  if (!options.isNetworkMode) return false;
  if (options.allowedOriginsEnv?.trim()) return false;
  if (!origin || !hostHeader) return false;

  const host = hostHeader.trim();
  if (!host || /\s|[\\/@]/.test(host)) return false;

  return origin === `http://${host}` || origin === `https://${host}`;
}

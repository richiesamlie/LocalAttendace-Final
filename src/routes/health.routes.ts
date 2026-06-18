import express from 'express';

export const healthRouter = express.Router();

const HEALTH_RESPONSE_DELAY_MS = 50;

/**
 * F-024: Public health endpoint.
 *
 * Intentionally returns a fixed-shape response in constant time.
 * Does NOT query the database or any external service, so the
 * response time cannot be used as an oracle for service state.
 *
 * The `database` field has been removed (was a minor info leak
 * about backend type). If operators need detailed status, see
 * internalHealthCheck() below.
 *
 * Constant-time behavior: the response is sent AFTER a fixed delay
 * (HEALTH_RESPONSE_DELAY_MS) regardless of any internal work. This
 * prevents an attacker from using response timing to fingerprint
 * server state. The delay is small enough to not impact real
 * load-balancer health checks (which typically poll every 5-30s).
 */
healthRouter.get('/health', (_req, res) => {
  const body = JSON.stringify({ status: 'ok' });
  const sendAfterDelay = () => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.status(200).send(body);
  };
  // Always pad to the fixed delay — this is the whole point of F-024.
  setTimeout(sendAfterDelay, HEALTH_RESPONSE_DELAY_MS);
});

/**
 * Internal/operator-only health check with real DB ping.
 *
 * Not currently wired to any HTTP route. Intended for ops dashboards
 * or k8s liveness probes that need an actual DB reachability signal.
 * When wired, MUST be gated by:
 *   - admin auth OR network-level allowlist (NOT exposed publicly)
 *   - separate route from the public /health (the LB health probe
 *     should keep using /health, not /health/internal)
 */
export const internalHealthCheck = async (): Promise<{ status: 'ok' | 'degraded'; dbReachable: boolean }> => {
  try {
    // Lazy require to avoid loading DB at module init time
    const db = (await import('../db')).default;
    db.prepare('SELECT 1 AS ok').get();
    return { status: 'ok', dbReachable: true };
  } catch {
    return { status: 'degraded', dbReachable: false };
  }
};
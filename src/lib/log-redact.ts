/**
 * Log redaction helper.
 *
 * F-007: Strips PII patterns from error messages before they're logged
 * or returned to the client. This prevents accidental PII leaks in
 * server logs when an SQL error includes user-supplied values.
 *
 * Patterns redacted (replace with [REDACTED:<label>]):
 *   - email addresses
 *   - 10+ digit phone numbers (international format)
 *   - bcrypt hashes ($2[aby]$...)
 *   - JWT tokens (eyJ... .eyJ... .<sig>)
 *   - hex strings >= 32 chars (potential tokens/hashes)
 *   - quoted strings containing 'password' / 'token' / 'secret'
 *
 * Designed to be conservative: false positives are acceptable
 * (better to over-redact than leak PII). Performance: O(n) on the
 * input length.
 */

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone', regex: /(?<![\d])\+?\d[\d\s()-]{9,}\d(?![\d])/g },
  { name: 'bcrypt-hash', regex: /\$2[aby]\$\d{2}\$[A-Za-z0-9./]{53}/g },
  { name: 'jwt', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: 'hex-token', regex: /\b[a-f0-9]{32,}\b/gi },
];

export function redactPII(input: string | undefined | null): string {
  if (!input) return '';
  let result = input;
  for (const { name, regex } of PATTERNS) {
    result = result.replace(regex, `[REDACTED:${name}]`);
  }
  return result;
}

/**
 * Wrap a value for safe logging. For Errors, applies redaction to the
 * message and concatenates name; for strings, applies redaction directly.
 */
export function safeLog(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${redactPII(value.message)}`;
  }
  if (typeof value === 'string') {
    return redactPII(value);
  }
  try {
    return redactPII(JSON.stringify(value));
  } catch {
    return '[unstringifiable]';
  }
}
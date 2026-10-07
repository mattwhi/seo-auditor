export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs?: number;
}

export interface FetchAttemptResult {
  response: Response;
  attempts: number;
  retriesExhausted: boolean;
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export function isRetryableStatus(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.has(statusCode);
}

export function parseRetryAfter(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  // Retry-After delay-seconds must be one or more decimal digits.
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  // HTTP-date values must resemble an RFC 7231 IMF-fixdate.
  // This prevents Date.parse() from accepting ambiguous values such as "-1".
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(trimmed)) {
    return null;
  }

  const dateMs = Date.parse(trimmed);

  if (!Number.isFinite(dateMs)) {
    return null;
  }

  return Math.max(0, dateMs - nowMs);
}

export function calculateRetryDelay(
  retryNumber: number,
  options: RetryOptions,
  retryAfter: string | null = null,
): number {
  const retryAfterMs = parseRetryAfter(retryAfter);
  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, options.maxDelayMs);
  }

  const exponentialDelay = options.baseDelayMs * 2 ** Math.max(0, retryNumber - 1);
  return Math.min(exponentialDelay, options.maxDelayMs);
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions,
): Promise<FetchAttemptResult> {
  if (!Number.isInteger(options.maxRetries) || options.maxRetries < 0) {
    throw new RangeError('maxRetries must be a non-negative integer');
  }
  if (!Number.isFinite(options.baseDelayMs) || options.baseDelayMs < 0) {
    throw new RangeError('baseDelayMs must be a non-negative number');
  }
  if (!Number.isFinite(options.maxDelayMs) || options.maxDelayMs < options.baseDelayMs) {
    throw new RangeError('maxDelayMs must be greater than or equal to baseDelayMs');
  }

  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const response = await fetch(url, {
        ...init,
        signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : init.signal,
      });
      const retryable = isRetryableStatus(response.status);

      if (!retryable || attempt > options.maxRetries) {
        return {
          response,
          attempts: attempt,
          retriesExhausted: retryable,
        };
      }

      const delayMs = calculateRetryDelay(attempt, options, response.headers.get('retry-after'));
      if (delayMs > 0) await sleep(delayMs);
    } catch (error) {
      if (attempt > options.maxRetries) throw error;

      const delayMs = calculateRetryDelay(attempt, options);
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}

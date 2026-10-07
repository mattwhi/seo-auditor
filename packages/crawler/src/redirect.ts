import type { RetryOptions } from './retry.js';
import { fetchWithRetry } from './retry.js';
import { normalizeUrl } from './url.js';

export interface RedirectHop {
  url: string;
  statusCode: number;
  location: string;
  targetUrl: string;
}

export interface RedirectResult {
  response: Response;
  finalUrl: string;
  hops: RedirectHop[];
  attempts: number;
  retriesExhausted: boolean;
}

export interface RedirectOptions {
  maxRedirects: number;
}

export class RedirectError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly hops: RedirectHop[],
    public readonly reason: 'loop' | 'max-redirects' | 'missing-location' | 'invalid-location',
  ) {
    super(message);
    this.name = 'RedirectError';
  }
}

export function isRedirectStatus(statusCode: number): boolean {
  return [301, 302, 303, 307, 308].includes(statusCode);
}

export function resolveRedirectLocation(location: string, currentUrl: string): string {
  return normalizeUrl(location, currentUrl);
}


export async function fetchWithRedirects(
  startUrl: string,
  init: RequestInit,
  retryOptions: RetryOptions,
  redirectOptions: RedirectOptions,
): Promise<RedirectResult> {
  if (!Number.isInteger(redirectOptions.maxRedirects) || redirectOptions.maxRedirects < 0) {
    throw new RangeError('maxRedirects must be a non-negative integer');
  }

  let currentUrl = normalizeUrl(startUrl);
  const visited = new Set<string>([currentUrl]);
  const hops: RedirectHop[] = [];
  let totalAttempts = 0;

  while (true) {
    const result = await fetchWithRetry(
      currentUrl,
      { ...init, redirect: 'manual' },
      retryOptions,
    );
    totalAttempts += result.attempts;

    if (!isRedirectStatus(result.response.status)) {
      return {
        response: result.response,
        finalUrl: currentUrl,
        hops,
        attempts: totalAttempts,
        retriesExhausted: result.retriesExhausted,
      };
    }

    const location = result.response.headers.get('location');
    if (!location) {
      throw new RedirectError(
        `HTTP ${result.response.status} redirect is missing a Location header`,
        currentUrl,
        hops,
        'missing-location',
      );
    }

    let targetUrl: string;
    try {
      targetUrl = resolveRedirectLocation(location, currentUrl);
    } catch {
      throw new RedirectError(
        `HTTP ${result.response.status} redirect has an invalid Location header`,
        currentUrl,
        hops,
        'invalid-location',
      );
    }

    const hop: RedirectHop = {
      url: currentUrl,
      statusCode: result.response.status,
      location,
      targetUrl,
    };
    hops.push(hop);

    if (visited.has(targetUrl)) {
      throw new RedirectError(`Redirect loop detected at ${targetUrl}`, targetUrl, hops, 'loop');
    }

    if (hops.length > redirectOptions.maxRedirects) {
      throw new RedirectError(
        `Maximum redirect count of ${redirectOptions.maxRedirects} exceeded`,
        targetUrl,
        hops,
        'max-redirects',
      );
    }

    visited.add(targetUrl);
    currentUrl = targetUrl;
  }
}

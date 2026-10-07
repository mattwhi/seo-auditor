const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new TypeError(`Unsupported URL protocol: ${url.protocol}`);
  }

  url.hash = '';

  return url.href;
}

export function isSameOrigin(url: string, origin: string): boolean {
  return new URL(url).origin === origin;
}

export function isSupportedUrl(rawUrl: string, baseUrl?: string): boolean {
  try {
    normalizeUrl(rawUrl, baseUrl);
    return true;
  } catch {
    return false;
  }
}

export interface HttpResponseMetadata {
  contentLength: number | null;
  contentEncoding: string | null;
  contentLanguage: string | null;
  cacheControl: string | null;
  etag: string | null;
  lastModified: string | null;
  xRobotsTag: string[];
}

function cleanHeader(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseContentLength(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function extractHttpResponseMetadata(headers: Headers): HttpResponseMetadata {
  const xRobotsTag = (headers.get('x-robots-tag') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return {
    contentLength: parseContentLength(headers.get('content-length')),
    contentEncoding: cleanHeader(headers.get('content-encoding')),
    contentLanguage: cleanHeader(headers.get('content-language')),
    cacheControl: cleanHeader(headers.get('cache-control')),
    etag: cleanHeader(headers.get('etag')),
    lastModified: cleanHeader(headers.get('last-modified')),
    xRobotsTag,
  };
}

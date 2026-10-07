import { isSameOrigin, normalizeUrl } from './url.js';

export interface SitemapFetchOptions {
  userAgent: string;
  timeoutMs: number;
  maxSitemaps?: number;
}

export interface SitemapDocument {
  type: 'urlset' | 'sitemapindex' | 'unknown';
  locations: string[];
}

const DEFAULT_MAX_SITEMAPS = 50;

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function parseSitemapXml(xml: string): SitemapDocument {
  const rootMatch = xml.match(/<\s*(?:[\w-]+:)?(urlset|sitemapindex)\b/i);
  const type = rootMatch?.[1]?.toLowerCase();
  const locations: string[] = [];
  const locPattern = /<\s*(?:[\w-]+:)?loc\b[^>]*>([\s\S]*?)<\s*\/\s*(?:[\w-]+:)?loc\s*>/gi;

  for (const match of xml.matchAll(locPattern)) {
    const value = decodeXml(match[1]?.trim() ?? '');
    if (value) locations.push(value);
  }

  return {
    type: type === 'urlset' || type === 'sitemapindex' ? type : 'unknown',
    locations,
  };
}

export function extractSitemapUrlsFromRobots(content: string, robotsUrl: string): string[] {
  const discovered = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.slice(0, rawLine.indexOf('#') === -1 ? undefined : rawLine.indexOf('#')).trim();
    const match = line.match(/^sitemap\s*:\s*(.+)$/i);
    if (!match?.[1]) continue;

    try {
      discovered.add(normalizeUrl(match[1].trim(), robotsUrl));
    } catch {
      // Ignore malformed or unsupported sitemap URLs.
    }
  }

  return [...discovered];
}

async function fetchText(url: string, options: SitemapFetchOptions): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': options.userAgent },
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function discoverSitemapUrls(
  origin: string,
  robotsContent: string | null,
  options: SitemapFetchOptions,
): Promise<string[]> {
  const normalizedOrigin = new URL(origin).origin;
  const robotsUrl = new URL('/robots.txt', normalizedOrigin).href;
  const seeds = robotsContent
    ? extractSitemapUrlsFromRobots(robotsContent, robotsUrl)
    : [];

  if (seeds.length === 0) {
    seeds.push(new URL('/sitemap.xml', normalizedOrigin).href);
  }

  const sitemapQueue = [
    ...new Set(
      seeds.filter((url) => {
        try {
          return isSameOrigin(url, normalizedOrigin);
        } catch {
          return false;
        }
      }),
    ),
  ];
  const seenSitemaps = new Set<string>();
  const pageUrls = new Set<string>();
  const maxSitemaps = options.maxSitemaps ?? DEFAULT_MAX_SITEMAPS;

  while (sitemapQueue.length > 0 && seenSitemaps.size < maxSitemaps) {
    const sitemapUrl = sitemapQueue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;

    seenSitemaps.add(sitemapUrl);
    const xml = await fetchText(sitemapUrl, options);
    if (!xml) continue;

    const document = parseSitemapXml(xml);

    if (document.type === 'sitemapindex') {
      for (const location of document.locations) {
        try {
          const normalized = normalizeUrl(location, sitemapUrl);
          if (
            isSameOrigin(normalized, normalizedOrigin) &&
            !seenSitemaps.has(normalized) &&
            !sitemapQueue.includes(normalized)
          ) {
            sitemapQueue.push(normalized);
          }
        } catch {
          // Ignore malformed child sitemap URLs.
        }
      }
      continue;
    }

    if (document.type === 'urlset') {
      for (const location of document.locations) {
        try {
          const normalized = normalizeUrl(location, sitemapUrl);
          if (isSameOrigin(normalized, normalizedOrigin)) pageUrls.add(normalized);
        } catch {
          // Ignore malformed or unsupported page URLs.
        }
      }
    }
  }

  return [...pageUrls];
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type RemediationMode = 'auto' | 'approval' | 'manual' | 'unsupported';
export type RemediationRisk = 'low' | 'medium' | 'high';
export type RemediationPlatform = 'generic' | 'wordpress' | 'woocommerce' | 'rank-math' | 'yoast' | 'aioseo' | 'shopify';

export interface RemediationDefinition {
  supported: boolean;
  risk: RemediationRisk;
  mode: RemediationMode;
  platforms: RemediationPlatform[];
  action?: string;
}

export interface HreflangReference {
  lang: string;
  href: string;
}


export type RuleCategory =
  | 'crawlability'
  | 'indexability'
  | 'metadata'
  | 'headings'
  | 'content'
  | 'images'
  | 'links'
  | 'schema'
  | 'performance';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export interface PageImage {
  src: string;
  alt: string | null;
}

export interface PageLink {
  href: string;
  text: string | null;
  internal: boolean;
}

export interface PageFacts {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  responseTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string[];
  h1: string[];
  h2: string[];
  wordCount: number;
  images: PageImage[];
  links: PageLink[];
  schemaTypes: string[];
  hreflang?: HreflangReference[];
  jsonLdBlocks?: number;
  jsonLdErrors?: number;
  contentHash?: string | null;
  contentLength?: number | null;
  contentEncoding?: string | null;
  contentLanguage?: string | null;
  cacheControl?: string | null;
  etag?: string | null;
  lastModified?: string | null;
  xRobotsTag?: string[];
  crawlDepth?: number;
  redirectCount?: number;
  fetchAttempts?: number;
  redirectHops?: Array<{
    url: string;
    statusCode: number;
    location: string;
    targetUrl: string;
  }>;
}

export interface RuleFinding {
  ruleId: string;
  severity: Severity;
  category: RuleCategory;
  message: string;
  evidence?: JsonValue;
}

export interface SeoRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  remediation?: RemediationDefinition;
  evaluate(page: PageFacts): RuleFinding[];
}

export interface CrawlJob {
  auditId: string;
  projectId: string;
  startUrl: string;
  maxUrls: number;
}

export type CrawlFailureType = 'timeout' | 'network' | 'http' | 'redirect';

export interface CrawlFailure {
  url: string;
  type: CrawlFailureType;
  message: string;
  statusCode?: number;
  attempts: number;
  redirectHops?: Array<{
    url: string;
    statusCode: number;
    location: string;
    targetUrl: string;
  }>;
}

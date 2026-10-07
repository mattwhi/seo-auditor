export interface RobotsRule {
  directive: 'allow' | 'disallow';
  path: string;
}

interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

export interface RobotsPolicy {
  url: string;
  groups: RobotsGroup[];
  content: string;
}

export interface RobotsFetchOptions {
  userAgent: string;
  timeoutMs: number;
}

function stripComment(line: string): string {
  const commentIndex = line.indexOf('#');
  return (commentIndex === -1 ? line : line.slice(0, commentIndex)).trim();
}

function parseDirective(line: string): { name: string; value: string } | null {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) return null;

  const name = line.slice(0, separatorIndex).trim().toLowerCase();
  const value = line.slice(separatorIndex + 1).trim();
  return name ? { name, value } : null;
}

export function parseRobotsTxt(content: string, robotsUrl: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let currentGroup: RobotsGroup | null = null;
  let rulesStarted = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line) continue;

    const directive = parseDirective(line);
    if (!directive) continue;

    if (directive.name === 'user-agent') {
      if (!directive.value) continue;

      if (!currentGroup || rulesStarted) {
        currentGroup = { userAgents: [], rules: [] };
        groups.push(currentGroup);
        rulesStarted = false;
      }

      currentGroup.userAgents.push(directive.value.toLowerCase());
      continue;
    }

    if (currentGroup && (directive.name === 'allow' || directive.name === 'disallow')) {
      rulesStarted = true;
      if (!directive.value) continue;
      currentGroup.rules.push({ directive: directive.name, path: directive.value });
    }
  }

  return { url: robotsUrl, groups, content };
}

function getProductToken(userAgent: string): string {
  const product = userAgent.trim().split(/\s+/)[0] ?? '';
  return product.split('/')[0]?.toLowerCase() ?? '';
}

function selectRules(policy: RobotsPolicy, userAgent: string): RobotsRule[] {
  const productToken = getProductToken(userAgent);
  const specificGroups = policy.groups.filter((group) =>
    group.userAgents.some((agent) => agent !== '*' && productToken.includes(agent)),
  );

  if (specificGroups.length > 0) {
    return specificGroups.flatMap((group) => group.rules);
  }

  return policy.groups
    .filter((group) => group.userAgents.includes('*'))
    .flatMap((group) => group.rules);
}

function robotsPatternMatches(path: string, pattern: string): boolean {
  if (!pattern) return false;

  const anchoredAtEnd = pattern.endsWith('$');
  const patternWithoutAnchor = anchoredAtEnd ? pattern.slice(0, -1) : pattern;
  const escaped = patternWithoutAnchor.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}${anchoredAtEnd ? '$' : ''}`).test(path);
}

export function isAllowedByRobots(
  targetUrl: string,
  policy: RobotsPolicy,
  userAgent: string,
): boolean {
  const url = new URL(targetUrl);
  const path = `${url.pathname}${url.search}`;
  const rules = selectRules(policy, userAgent);
  let bestRule: RobotsRule | null = null;
  let bestLength = -1;

  for (const rule of rules) {
    if (!robotsPatternMatches(path, rule.path)) continue;

    const ruleLength = rule.path.replace(/\*|\$/g, '').length;
    if (
      ruleLength > bestLength ||
      (ruleLength === bestLength &&
        rule.directive === 'allow' &&
        bestRule?.directive === 'disallow')
    ) {
      bestRule = rule;
      bestLength = ruleLength;
    }
  }

  return bestRule?.directive !== 'disallow';
}

export async function fetchRobotsPolicy(
  origin: string,
  options: RobotsFetchOptions,
): Promise<RobotsPolicy | null> {
  const robotsUrl = new URL('/robots.txt', origin).href;

  try {
    const response = await fetch(robotsUrl, {
      headers: { 'user-agent': options.userAgent },
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    if (!response.ok) return null;
    return parseRobotsTxt(await response.text(), robotsUrl);
  } catch {
    return null;
  }
}

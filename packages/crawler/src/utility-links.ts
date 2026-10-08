/** Known non-content utility routes are not navigable SEO pages. */
export function isNonContentUtilityUrl(value: string): boolean {
  try {
    return new URL(value).pathname.replace(/\/$/, '') === '/cdn-cgi/l/email-protection';
  } catch {
    return false;
  }
}

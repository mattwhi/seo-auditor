import type { PageFacts, RuleFinding, SeoRule } from '@seo-auditor/types';

const RULE_ID_PATTERN = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?\.[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/;

export class RuleRegistry {
  readonly #rules: readonly SeoRule[];
  readonly #byId: ReadonlyMap<string, SeoRule>;

  constructor(rules: readonly SeoRule[]) {
    const byId = new Map<string, SeoRule>();

    for (const rule of rules) {
      if (!RULE_ID_PATTERN.test(rule.id)) {
        throw new Error(`Invalid SEO rule ID: ${rule.id}`);
      }

      if (byId.has(rule.id)) {
        throw new Error(`Duplicate SEO rule ID: ${rule.id}`);
      }

      byId.set(rule.id, rule);
    }

    this.#rules = Object.freeze([...rules]);
    this.#byId = byId;
  }

  list(): readonly SeoRule[] {
    return this.#rules;
  }

  get(ruleId: string): SeoRule | undefined {
    return this.#byId.get(ruleId);
  }
}

function assertFindingMatchesRule(rule: SeoRule, finding: RuleFinding): void {
  if (finding.ruleId !== rule.id) {
    throw new Error(`Rule ${rule.id} returned finding for ${finding.ruleId}`);
  }

  if (finding.severity !== rule.severity) {
    throw new Error(`Rule ${rule.id} returned finding with mismatched severity`);
  }

  if (finding.category !== rule.category) {
    throw new Error(`Rule ${rule.id} returned finding with mismatched category`);
  }
}

export class RuleEngine {
  constructor(private readonly registry: RuleRegistry) {}

  evaluatePage(page: PageFacts): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const rule of this.registry.list()) {
      const ruleFindings = rule.evaluate(page);

      for (const finding of ruleFindings) {
        assertFindingMatchesRule(rule, finding);
        findings.push(finding);
      }
    }

    return findings;
  }
}

# SEO Auditor

SEO Auditor is an open-source, self-hosted technical SEO crawling, auditing and monitoring platform.

The project is being built as a scalable alternative for developers, SEO professionals and site owners who want transparent, programmable SEO auditing without being locked into a proprietary platform.

> **Project status:** Pre-alpha — v0.2 crawler

SEO Auditor is under active development and is not yet intended for production SEO auditing.

## Goals

SEO Auditor is designed around a few core principles:

- Open source and self-hostable
- API-first architecture
- Deterministic and explainable SEO rules
- Stable rule identifiers
- Horizontally scalable crawling
- Responsible crawling and rate limiting
- Site-agnostic core analysis
- Extensible rule packs and integrations
- Automation and CI/CD friendly
- Suitable for both small sites and large crawls

## Architecture

SEO Auditor uses a monorepo architecture with separate web, API and worker applications.

    User / API client
           |
           v
       Web / API
           |
           v
     Redis / BullMQ
           |
           v
         Worker
           |
           +----> Crawler
           |
           +----> Analyzer
           |
           +----> SEO Rules
           |
           +----> Scoring
           |
           v
       PostgreSQL

The crawler gathers objective facts about pages.

The analyzer converts HTML responses into structured page data.

Independent SEO rules evaluate those facts and produce findings using stable rule IDs such as:

    title.missing
    title.duplicate
    heading.h1-missing
    indexability.noindex

This separation allows crawling, analysis and SEO recommendations to evolve independently.

## Repository Structure

    apps/
      api/          HTTP API
      web/          Web interface
      worker/       Background audit worker

    packages/
      analyzer/     HTML analysis
      config/       Shared configuration
      crawler/      Website crawler
      database/     Prisma/PostgreSQL data layer
      logger/       Structured logging
      queue/        BullMQ queue infrastructure
      rules/        SEO rule engine
      scoring/      Audit scoring
      types/        Shared TypeScript contracts

    docs/           Architecture and project documentation
    .github/        CI and contribution templates

## Requirements

For local development:

- Node.js 22
- pnpm 10.18.x
- Docker
- Docker Compose

The repository includes an `.nvmrc` configured for Node.js 22.

## Quick Start

Clone the repository and install dependencies:

    pnpm install --frozen-lockfile

Create the local environment file:

    cp .env.example .env

Start PostgreSQL and Redis:

    docker compose up -d postgres redis

Generate the Prisma client:

    pnpm --filter @seo-auditor/database db:generate

Start development:

    pnpm dev

Alternatively, run the complete stack using Docker:

    docker compose up --build

The services are available at:

- Web interface: `http://localhost:3000`
- API: `http://localhost:4000`
- API health check: `http://localhost:4000/health`
- API readiness check: `http://localhost:4000/ready`

## Development

Before submitting changes, run:

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

All checks must pass before a pull request is merged.

## SEO Rule Design

SEO rules are intentionally independent from the crawler.

Each rule should:

- Have a stable namespaced identifier
- Evaluate structured page facts
- Produce deterministic findings
- Include an appropriate severity
- Include evidence where useful
- Include automated tests

Rule IDs should not be renamed casually because they will eventually be used for audit history, reporting, API consumers and integrations.

Examples:

    title.missing
    title.duplicate
    heading.h1-missing
    indexability.noindex

## Responsible Crawling

SEO Auditor is being designed to behave as a responsible crawler.

Planned crawler controls include:

- robots.txt support
- Configurable crawl limits
- Configurable concurrency
- Request timeouts
- Rate limiting
- Redirect handling
- Retry policies
- Crawl depth limits
- URL normalization

Do not use SEO Auditor to crawl systems you are not authorized to access.

## Roadmap

### v0.1 — Foundation

- Monorepo architecture
- Web, API and worker services
- PostgreSQL
- Redis/BullMQ
- Prisma
- Shared types
- Initial crawler/analyzer boundaries
- SEO rule contracts
- Scoring foundation
- Docker development environment
- Linting, type checking, tests and CI

### v0.2 — Crawler

- robots.txt
- Sitemap discovery
- URL normalization
- Crawl depth
- Crawl budgets
- Rate limiting
- Redirect tracking
- Failure persistence
- Retry policies
- Expanded crawler tests

### v0.3 — SEO Rule Engine

Expanded deterministic technical and on-page SEO auditing.

### v0.4 — Audit Platform

Audit history, page exploration, filtering, issue drill-down and reporting.

### v0.5 — Advanced Technical SEO

Internal-link graph analysis, crawl-depth/orphan signals, duplicate metadata/content, canonical clusters, hreflang, structured-data validation and remediation-capable rule metadata.

### v0.6 — Performance

Performance and page-experience auditing.

### v0.7 — Integrations

Search Console, analytics and the restricted WordPress connection framework.

### v0.8 — Platform-specific packs

WordPress, WooCommerce and SEO-plugin rule/remediation packs, with preview, approval, verification and rollback architecture. Shopify can later use the same connector abstraction.

### v0.9 — CLI / API / CI

Automation-oriented CLI, API and CI workflows.

### v1.0 — Public release

Stable public release after the pre-release milestones are validated.

## Documentation

Additional documentation is available in the `docs` directory:

- `architecture.md`
- `rules.md`
- `validation.md`

## Contributing

Contributions will be welcome as the project matures.

Please read `CONTRIBUTING.md` before opening a pull request.

## Security

Do not report security vulnerabilities through public GitHub issues.

See `SECURITY.md` for the project's security reporting policy.

## License

SEO Auditor is licensed under the Apache License 2.0.

See `LICENSE` for details.


## v0.4 Audit Platform

The v0.4 release candidate adds continuous audit-platform capabilities on top of the v0.3 crawler and rule engine: audit comparison and finding lifecycle detection, project trends, automated daily/weekly/monthly schedules, regression classification, cancellation, retention and stale-run recovery. The API remains the source of truth so these workflows can later be reused by CLI, CI and integrations.


## v0.5 Advanced Technical SEO (development)

The v0.5 development line expands audit-wide deterministic analysis while keeping crawling and remediation separated. Rules can now describe future remediation support, risk, approval mode, supported platforms and a restricted action identifier. This metadata does not grant write access: external modification remains deferred to the v0.7 connection framework and v0.8 platform packs. The long-term workflow is Crawl → Understand → Recommend → Fix → Verify → Monitor.

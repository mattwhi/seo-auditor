export default function Home() {
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">OPEN SOURCE · PRE-ALPHA</span>
          <h1>SEO Auditor</h1>
          <p>Self-hosted technical SEO crawling, auditing and regression monitoring.</p>
        </div>
        <div className="score">v0.2.1</div>
      </header>
      <section className="grid">
        <article>
          <b>API-first</b>
          <span>Versioned `/api/v1` contracts</span>
        </article>
        <article>
          <b>Distributed</b>
          <span>Redis-backed crawl workers</span>
        </article>
        <article>
          <b>Extensible</b>
          <span>Stable, testable SEO rules</span>
        </article>
        <article>
          <b>Observable</b>
          <span>Health and readiness endpoints</span>
        </article>
      </section>
      <section className="panel">
        <h2>Crawler milestone</h2>
        <p>
          The responsible crawler is running with robots.txt enforcement, sitemap discovery, crawl
          budgets, rate limiting, retries, redirect tracking and persisted crawl evidence. Next
          milestone: the SEO Rule Engine.
        </p>
        <code>docker compose up --build</code>
      </section>
    </main>
  );
}

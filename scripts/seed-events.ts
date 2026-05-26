#!/usr/bin/env tsx
/**
 * project_events producer for the Confluent Streaming Agent demo.
 *
 * Publishes JSON-shaped project events (auth bugs, CI failures, security
 * tickets, …) to a Confluent Cloud Kafka topic via the Kafka REST Proxy v3.
 * No native deps, no kafkajs — just fetch() + Basic Auth.
 *
 * Required env (put in .env at repo root):
 *   KAFKA_REST_ENDPOINT   e.g. https://pkc-xxxx.us-east-2.aws.confluent.cloud:443
 *   KAFKA_CLUSTER_ID      e.g. lkc-xxxxx
 *   KAFKA_API_KEY         cluster API key
 *   KAFKA_API_SECRET      cluster API secret
 *   KAFKA_TOPIC           default: project_events
 *
 * Usage:
 *   npx tsx scripts/seed-events.ts                       # steady mix, 2/s
 *   npx tsx scripts/seed-events.ts --spike auth          # 10 auth events fast, then stop
 *   npx tsx scripts/seed-events.ts --spike testing --count 8
 *   npx tsx scripts/seed-events.ts --once                # one event, then exit
 *   npx tsx scripts/seed-events.ts --dry-run             # print events, don't post
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ─── .env loader (avoid dotenv dep) ────────────────────────────────────

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnvFile();

// ─── CLI parsing ────────────────────────────────────────────────────────

interface Args {
  spike?: string;
  count: number;
  rateMs: number;
  once: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { count: 10, rateMs: 500, once: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--spike") args.spike = argv[++i];
    else if (a === "--count") args.count = parseInt(argv[++i], 10);
    else if (a === "--rate-ms") args.rateMs = parseInt(argv[++i], 10);
    else if (a === "--once") args.once = true;
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

// ─── Event fixtures ─────────────────────────────────────────────────────

const CATEGORIES = ["auth", "testing", "security", "performance", "database"] as const;
type Category = (typeof CATEGORIES)[number];

const FIXTURES: Record<Category, Array<{
  source: "github" | "jira" | "ci";
  type: "issue" | "pr_comment" | "ci_failure" | "ticket";
  title: string;
  body: string;
  labels: string[];
}>> = {
  auth: [
    {
      source: "jira",
      type: "ticket",
      title: "OAuth callback fails on expired token",
      body: "Users are getting logged out during refresh. Repro: leave app idle 30min, click any action → 401, redirected to login.",
      labels: ["bug", "auth"],
    },
    {
      source: "ci",
      type: "ci_failure",
      title: "Auth middleware test failing in CI",
      body: "Token refresh integration test failed 3 builds in a row. Mock OAuth provider seems flaky.",
      labels: ["test-failure", "auth"],
    },
    {
      source: "github",
      type: "pr_comment",
      title: "Session token storage looks insecure",
      body: "We're putting raw JWTs in localStorage. Should be httpOnly cookies. Filed sec ticket.",
      labels: ["security", "auth"],
    },
    {
      source: "github",
      type: "issue",
      title: "Login redirects loop on Safari",
      body: "Cross-site cookie behavior changed in Safari 17. Our OAuth redirect bounces twice then errors.",
      labels: ["bug", "auth", "safari"],
    },
    {
      source: "jira",
      type: "ticket",
      title: "Add MFA to admin login",
      body: "Compliance requirement. Need TOTP, recovery codes, and per-user enforcement flag.",
      labels: ["feature", "auth", "compliance"],
    },
  ],
  testing: [
    {
      source: "ci",
      type: "ci_failure",
      title: "Playwright flake: checkout flow test",
      body: "Test 'completes purchase end-to-end' has failed 7 of last 20 builds. Likely race condition on cart update.",
      labels: ["flaky-test", "ci"],
    },
    {
      source: "ci",
      type: "ci_failure",
      title: "Jest snapshot drift in components/Header",
      body: "Snapshot updated unexpectedly. No source change. Likely env-dependent (date formatting).",
      labels: ["test-failure", "snapshot"],
    },
    {
      source: "github",
      type: "issue",
      title: "Coverage dropped below 80% threshold",
      body: "PR #1234 added 200 lines without tests. CI passes but coverage gate triggered.",
      labels: ["coverage", "ci"],
    },
    {
      source: "github",
      type: "pr_comment",
      title: "These tests don't actually assert anything",
      body: "Reviewer noted three tests in /api/users only call the function and inspect logs. No real assertions.",
      labels: ["code-review", "testing"],
    },
  ],
  security: [
    {
      source: "github",
      type: "issue",
      title: "Dependabot: high-severity vuln in lodash",
      body: "CVE-2024-12345. Prototype pollution. Upgrade required, no breaking changes expected.",
      labels: ["security", "dependency"],
    },
    {
      source: "jira",
      type: "ticket",
      title: "API endpoint returns full stack trace on 500",
      body: "Customer reported. /api/orders/:id returns Python traceback to client. Info leak.",
      labels: ["security", "info-leak"],
    },
    {
      source: "github",
      type: "pr_comment",
      title: "Don't log the raw request body — contains PII",
      body: "Found logger.info(req.body) in middleware. Body includes credit card numbers in payment flow.",
      labels: ["security", "pii"],
    },
  ],
  performance: [
    {
      source: "jira",
      type: "ticket",
      title: "Checkout latency increased after payment update",
      body: "P95 went from 800ms to 2200ms after the Stripe upgrade. Users complaining.",
      labels: ["performance", "payments"],
    },
    {
      source: "github",
      type: "issue",
      title: "N+1 query in /api/orders endpoint",
      body: "Spotted in DB dashboard — 1 request to /api/orders → 350 SELECT statements.",
      labels: ["performance", "database"],
    },
    {
      source: "ci",
      type: "ci_failure",
      title: "k6 load test exceeded latency budget",
      body: "Smoke test p99 hit 5s, budget is 2s. Likely the new search ranking code.",
      labels: ["performance", "ci"],
    },
  ],
  database: [
    {
      source: "github",
      type: "issue",
      title: "Migration 0042 failed in staging",
      body: "ALTER TABLE users ADD COLUMN took 45min on the staging table. Production has 50x rows.",
      labels: ["database", "migration"],
    },
    {
      source: "jira",
      type: "ticket",
      title: "DB connection pool exhaustion under load",
      body: "Pool size 20, load test hits 40+ concurrent connections. App hangs.",
      labels: ["database", "performance"],
    },
    {
      source: "github",
      type: "pr_comment",
      title: "This query scans the whole orders table",
      body: "Missing index on (customer_id, created_at). Spotted in slow query log.",
      labels: ["database", "performance"],
    },
  ],
};

const REPOS = ["demo-org/demo-app", "demo-org/checkout-svc", "demo-org/auth-svc"];

// ─── Build one event ────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildEvent(forced?: Category) {
  const category: Category = forced ?? pick(CATEGORIES);
  const fixture = pick(FIXTURES[category]);
  return {
    source: fixture.source,
    type: fixture.type,
    title: fixture.title,
    body: fixture.body,
    repo: pick(REPOS),
    labels: fixture.labels,
    category,
    timestamp: new Date().toISOString(),
  };
}

// ─── Kafka REST Proxy v3 client ────────────────────────────────────────

function checkEnv(): {
  endpoint: string;
  clusterId: string;
  topic: string;
  basicAuth: string;
} {
  const endpoint = process.env.KAFKA_REST_ENDPOINT;
  const clusterId = process.env.KAFKA_CLUSTER_ID;
  const apiKey = process.env.KAFKA_API_KEY;
  const apiSecret = process.env.KAFKA_API_SECRET;
  const topic = process.env.KAFKA_TOPIC ?? "project_events";
  const missing: string[] = [];
  if (!endpoint) missing.push("KAFKA_REST_ENDPOINT");
  if (!clusterId) missing.push("KAFKA_CLUSTER_ID");
  if (!apiKey) missing.push("KAFKA_API_KEY");
  if (!apiSecret) missing.push("KAFKA_API_SECRET");
  if (missing.length > 0) {
    console.error(
      `Missing env vars: ${missing.join(", ")}. Set them in .env or use --dry-run.`
    );
    process.exit(1);
  }
  return {
    endpoint: endpoint!.replace(/\/$/, ""),
    clusterId: clusterId!,
    topic,
    basicAuth: Buffer.from(`${apiKey}:${apiSecret}`).toString("base64"),
  };
}

async function produceOne(event: ReturnType<typeof buildEvent>, dryRun: boolean) {
  if (dryRun) {
    console.log(JSON.stringify(event));
    return;
  }
  const cfg = checkEnv();
  const url = `${cfg.endpoint}/kafka/v3/clusters/${cfg.clusterId}/topics/${cfg.topic}/records`;
  const body = {
    key: { type: "STRING", data: `${event.repo}:${event.category}` },
    value: { type: "JSON", data: event },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${cfg.basicAuth}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST Proxy ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.spike) {
    const cat = args.spike as Category;
    if (!CATEGORIES.includes(cat)) {
      console.error(`Unknown spike category: ${args.spike}. One of: ${CATEGORIES.join(", ")}`);
      process.exit(1);
    }
    console.log(`Spiking ${args.count} '${cat}' events at ${args.rateMs}ms intervals…`);
    for (let i = 0; i < args.count; i++) {
      const ev = buildEvent(cat);
      try {
        await produceOne(ev, args.dryRun);
        console.log(`  [${i + 1}/${args.count}] ${ev.category} · ${ev.source} · ${ev.title}`);
      } catch (err: any) {
        console.error(`  [${i + 1}/${args.count}] FAILED: ${err.message}`);
      }
      if (i < args.count - 1) await new Promise((r) => setTimeout(r, args.rateMs));
    }
    console.log("Done.");
    return;
  }

  if (args.once) {
    const ev = buildEvent();
    await produceOne(ev, args.dryRun);
    console.log(`Produced: ${ev.category} · ${ev.source} · ${ev.title}`);
    return;
  }

  // Steady mix mode: produce continuously until SIGINT
  console.log(`Producing mixed events every ${args.rateMs}ms — Ctrl-C to stop`);
  let n = 0;
  while (true) {
    const ev = buildEvent();
    try {
      await produceOne(ev, args.dryRun);
      n++;
      if (n % 10 === 0) console.log(`  produced ${n} events…`);
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, args.rateMs));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

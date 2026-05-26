# agent-discovery × Confluent Streaming Agents

This directory contains everything needed to run the Confluent Cloud
Streaming Agent that watches for project pain-point surges and proposes
team changes for the agent-discovery-assembled AI team.

## Architecture

```
[seed-events.ts]  →  Kafka topic project_events  →  Flink: category_surges  →
  CREATE AGENT team_evaluator (calls MCP tools on agent-discovery via HTTP)
  → team_eval_outcomes table + proposals/<eval_id>/*.proposed files
```

## Prerequisites (pre-clock — already done)

- `uv run deploy` ran for LAB1 on your Confluent Cloud account
- Azure OpenAI model registered as `llm_textgen_model` (LAB1 deploys this)
- `orders`, `customers`, `products` tables exist (LAB1 datagen) — we don't
  need them. Optionally drop them before starting.

## Setup (the 2-hour clock)

### 1. Start the HTTP MCP server locally

```bash
cd <repo-root>
cp .env.example .env
# In .env, set:
#   MCP_BEARER_TOKEN=$(openssl rand -hex 32)
#   (Kafka REST vars come later, in step 3)

npm install
npm run start:http-mcp
# Server listens on :3000, exposes POST /mcp (bearer auth) and /healthz
```

### 2. Expose it via ngrok

```bash
# In a new terminal:
ngrok http 3000
# Copy the https://….ngrok-free.app URL — that's our MCP endpoint.
```

Quick verification — should return 200:

```bash
curl https://<ngrok-url>/healthz
```

### 3. Drop LAB1's tables and create the Confluent topic + connection

In the Flink SQL workspace:

```sql
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS enriched_orders;
DROP TABLE IF EXISTS price_match_results;
```

Create the Kafka topic via Confluent Cloud UI:
- Topics → Add topic → name: `project_events`, partitions: 1 (demo scale).

Create a cluster API key for the producer (Data Integration → API Keys →
Create key with permissions for `project_events`).

Then put those creds into `.env`:

```
KAFKA_REST_ENDPOINT=https://pkc-xxxx.us-east-2.aws.confluent.cloud:443
KAFKA_CLUSTER_ID=lkc-xxxxx
KAFKA_API_KEY=…
KAFKA_API_SECRET=…
KAFKA_TOPIC=project_events
```

Create the Flink MCP connection. Exact CLI may vary by your Confluent CLI
version — confirm with `confluent flink connection create --help`. The
shape is:

```bash
confluent flink connection create agent-discovery-mcp-connection \
  --cloud aws \
  --region <your-flink-region> \
  --environment <env-id> \
  --type mcp_server \
  --endpoint https://<ngrok-host>/mcp \
  --api-key "<MCP_BEARER_TOKEN-value>"
```

If your CLI uses different flag names, the underlying Terraform resource
is `confluent_flink_connection` with fields `type = "mcp_server"`,
`endpoint`, and an auth token. Adjust accordingly.

### 4. Author the Flink pipeline

In the Flink SQL workspace, run each file in order:

```
flink/01-project-events-table.sql    -- Kafka source over project_events topic
flink/02-category-surges.sql         -- Windowed surge filter (count >= 3 per 1m)
flink/03-create-tool-and-agent.sql   -- CREATE TOOL + CREATE AGENT
flink/04-run-agent.sql               -- AI_RUN_AGENT continuous job
```

### 5. Trigger the demo

```bash
# In a third terminal, with the producer:
npx tsx scripts/seed-events.ts --spike auth --count 5 --rate-ms 200
```

Within ~1 minute (next window close) the Flink pipeline:
1. Counts ≥3 `auth`-category events → row appears in `category_surges`
2. AI_RUN_AGENT fires `team_evaluator`
3. Agent calls our MCP tools (you'll see ngrok logs)
4. Files appear in `proposals/<eval_id>/`:
   - `apm.yml.proposed`
   - `apm.yml.diff`
   - `AGENTS.md.proposed`
   - `summary.json`
5. Outcome row appears in `team_eval_outcomes`

Verify in Flink:

```sql
SELECT * FROM team_eval_outcomes;
```

Verify locally:

```bash
ls proposals/
cat proposals/eval-*/AGENTS.md.proposed | head -40
```

## Demo cheat-sheet

Terminals:

1. `npm run start:http-mcp` — MCP server (and a tail of its logs)
2. `ngrok http 3000` — public tunnel
3. The Flink SQL workspace in your browser
4. `npx tsx scripts/seed-events.ts --spike <category> --count 5` — trigger

Categories to spike:
- `auth` → expect a security-flavored agent in proposed team
- `testing` → expect a testing/test-coverage agent
- `security` → security review agent
- `performance` → performance review agent
- `database` → database/migration agent

## Troubleshooting

- **Agent fires but tool calls fail with 401:** bearer token mismatch
  between `.env` and the Confluent connection's `api-key` field.
- **No surges fire:** lower threshold in `02-category-surges.sql` to
  `HAVING COUNT(*) >= 2` and/or shrink window to `INTERVAL '30' SECOND`.
- **ngrok URL changed:** drop and recreate the Flink connection with the
  new URL (free-tier ngrok rotates on restart).
- **Agent's tool calls 404:** ngrok URL is missing `/mcp` suffix in the
  connection endpoint.
- **`ML_PREDICT` errors:** see LAB1's troubleshooting (Azure quota or
  model deploy issue).

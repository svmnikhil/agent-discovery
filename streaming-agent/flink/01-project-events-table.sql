-- ───────────────────────────────────────────────────────────────────────
-- project_events: auto-exposed by Confluent Cloud Flink because the
-- Kafka topic has a registered JSON Schema in Schema Registry.
--
-- We DO NOT issue `CREATE TABLE project_events WITH ('connector'='kafka',…)`
-- — Confluent Flink does that for us. The auto-mapped table has all our
-- schema columns plus an implicit `$rowtime` (TIMESTAMP_LTZ(3)) event-time
-- column, with a default watermark already attached.
--
-- This file just sanity-checks the auto-mapped table.
-- ───────────────────────────────────────────────────────────────────────

-- Confirm the table exists and looks right:
DESCRIBE EXTENDED `project_events`;

-- Confirm rows are flowing (assumes you've produced at least one event):
SELECT * FROM `project_events` LIMIT 5;

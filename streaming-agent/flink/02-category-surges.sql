-- ───────────────────────────────────────────────────────────────────────
-- category_surges: simple windowed filter that fires when a category
-- crosses a threshold inside a tumbling window. This is the trigger
-- table the streaming agent consumes from.
--
-- We use the auto-injected `$rowtime` (Kafka event time) for windowing,
-- so we don't need to ALTER TABLE / parse the `timestamp` string column.
--
-- Threshold + window chosen so the demo fires within ~1 min of a spike:
--   • 30-second tumbling window
--   • HAVING COUNT(*) >= 3
-- Adjust to taste.
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE category_surges
WITH ('changelog.mode' = 'append')
AS
SELECT
    `category`,
    `repo`,
    window_start,
    window_end,
    CAST(COUNT(*) AS BIGINT) AS event_count,
    -- A few sample titles so the agent has concrete context to cite:
    LISTAGG(`title`, ' | ')  AS sample_titles,
    LISTAGG(`source`, ',')   AS sample_sources
FROM TABLE(
    TUMBLE(TABLE `project_events`, DESCRIPTOR(`$rowtime`), INTERVAL '30' SECOND)
)
GROUP BY `category`, `repo`, window_start, window_end
HAVING COUNT(*) >= 3;

-- Sanity check (run AFTER spiking events with seed-events.ts):
-- SELECT * FROM category_surges;

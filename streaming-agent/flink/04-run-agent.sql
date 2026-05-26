-- ───────────────────────────────────────────────────────────────────────
-- AI_RUN_AGENT — continuous Flink job that fires the agent for each
-- surge row.
--
-- The agent's response is captured in `team_eval_outcomes` for audit.
-- Open the proposals/ directory on your machine to see the per-eval
-- apm.yml.proposed and AGENTS.md.proposed files the agent wrote via
-- propose_team_change.
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE team_eval_outcomes
WITH ('changelog.mode' = 'append')
AS
SELECT
    s.`category`               AS trigger_category,
    s.event_count,
    s.window_start,
    s.window_end,
    s.repo,
    s.sample_titles,
    agent_result.status        AS agent_status,
    agent_result.response      AS agent_response
FROM category_surges s,
LATERAL TABLE(
  AI_RUN_AGENT(
    `team_evaluator`,
    CONCAT(
      'A surge of ''', s.`category`, ''' events was detected in repo ',
      s.repo,
      ' with ', CAST(s.event_count AS STRING), ' events in window ',
      CAST(s.window_start AS STRING), ' → ', CAST(s.window_end AS STRING),
      '. Sample event titles (pipe-separated): ', s.sample_titles, '. ',
      'repo_path is: ', s.repo, '. ',
      'Follow your tool-driven workflow now.'
    )
  )
) AS agent_result(status, response);

-- Watch outcomes stream in:
-- SELECT * FROM team_eval_outcomes;

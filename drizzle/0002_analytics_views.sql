DROP MATERIALIZED VIEW IF EXISTS analytics_content_performance_daily;
DROP MATERIALIZED VIEW IF EXISTS analytics_ai_usage_daily;

CREATE MATERIALIZED VIEW analytics_content_performance_daily AS
WITH view_stats AS (
  SELECT
    cg.user_id,
    cv.content_id,
    DATE_TRUNC('day', cv.created_at)::date AS day,
    COUNT(*) AS total_views,
    COUNT(DISTINCT COALESCE(cv.session_id, cv.user_id::text)) AS unique_viewers,
    COALESCE(AVG(cv.time_spent), 0)::double precision AS avg_time_spent,
    COALESCE(SUM(cv.time_spent), 0) AS total_time_spent
  FROM content_views AS cv
  JOIN content_generations AS cg ON cg.id = cv.content_id
  GROUP BY cg.user_id, cv.content_id, DATE_TRUNC('day', cv.created_at)::date
),
social_stats AS (
  SELECT
    cg.user_id,
    sm.content_id,
    DATE_TRUNC('day', sm.created_at)::date AS day,
    COALESCE(SUM(sm.views), 0) AS social_views,
    COALESCE(SUM(sm.likes), 0) AS likes,
    COALESCE(SUM(sm.comments), 0) AS comments,
    COALESCE(SUM(sm.shares), 0) AS shares
  FROM social_metrics AS sm
  JOIN content_generations AS cg ON cg.id = sm.content_id
  GROUP BY cg.user_id, sm.content_id, DATE_TRUNC('day', sm.created_at)::date
),
combined AS (
  SELECT user_id, content_id, day FROM view_stats
  UNION
  SELECT user_id, content_id, day FROM social_stats
)
SELECT
  cg.user_id,
  cg.id AS content_id,
  cg.platform,
  cg.subreddit,
  COALESCE(cg.titles ->> 0, 'Untitled') AS primary_title,
  combined.day,
  COALESCE(vs.total_views, 0) AS total_views,
  COALESCE(vs.unique_viewers, 0) AS unique_viewers,
  COALESCE(vs.avg_time_spent, 0)::double precision AS avg_time_spent,
  COALESCE(vs.total_time_spent, 0) AS total_time_spent,
  COALESCE(ss.social_views, 0) AS social_views,
  COALESCE(ss.likes, 0) AS likes,
  COALESCE(ss.comments, 0) AS comments,
  COALESCE(ss.shares, 0) AS shares,
  CASE
    WHEN COALESCE(vs.total_views, 0) = 0 THEN 0::double precision
    ELSE ((COALESCE(ss.likes, 0) + COALESCE(ss.comments, 0) + COALESCE(ss.shares, 0))::double precision / GREATEST(COALESCE(vs.total_views, 0), 1)) * 100
  END AS engagement_rate
FROM combined
JOIN content_generations AS cg ON cg.id = combined.content_id
LEFT JOIN view_stats AS vs ON vs.content_id = combined.content_id AND vs.day = combined.day
LEFT JOIN social_stats AS ss ON ss.content_id = combined.content_id AND ss.day = combined.day;

CREATE UNIQUE INDEX analytics_content_performance_daily_idx
  ON analytics_content_performance_daily (user_id, content_id, day);

CREATE MATERIALIZED VIEW analytics_ai_usage_daily AS
WITH model_counts AS (
  SELECT
    user_id,
    DATE_TRUNC('day', created_at)::date AS day,
    model,
    COUNT(*) AS generation_count
  FROM ai_generations
  GROUP BY user_id, DATE_TRUNC('day', created_at)::date, model
)
SELECT
  user_id,
  day,
  SUM(generation_count) AS generation_count,
  COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT('model', model, 'count', generation_count)
      ORDER BY model
    ),
    '[]'::jsonb
  ) AS model_breakdown
FROM model_counts
GROUP BY user_id, day;

CREATE UNIQUE INDEX analytics_ai_usage_daily_idx
  ON analytics_ai_usage_daily (user_id, day);

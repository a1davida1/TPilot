-- Normalize reddit_communities enum-like columns to canonical values
-- Ensures data aligns with application-level enums after removing legacy values

UPDATE reddit_communities
SET competition_level = CASE
    WHEN competition_level IS NULL THEN NULL
    WHEN lower(competition_level) IN ('low', 'medium', 'high') THEN lower(competition_level)
    WHEN lower(competition_level) = 'very_high' THEN 'high'
    WHEN lower(competition_level) = 'very_low' THEN 'low'
    WHEN competition_level ILIKE '%high%' THEN 'high'
    WHEN competition_level ILIKE '%low%' THEN 'low'
    ELSE 'medium'
  END,
    mod_activity = CASE
    WHEN mod_activity IS NULL THEN NULL
    WHEN lower(mod_activity) IN ('low', 'medium', 'high', 'unknown') THEN lower(mod_activity)
    WHEN lower(mod_activity) = 'very_high' THEN 'high'
    WHEN lower(mod_activity) = 'very_low' THEN 'low'
    WHEN mod_activity ILIKE '%high%' THEN 'high'
    WHEN mod_activity ILIKE '%medium%' THEN 'medium'
    WHEN mod_activity ILIKE '%low%' THEN 'low'
    ELSE 'unknown'
  END;
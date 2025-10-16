## Lint Fixes: 2025-10-14

- removed unused drizzle imports from `server/routes/scheduled-posts.ts`
- dropped unused metrics and trending imports from `server/routes/subreddit-recommender.ts`
- re-parsed request body to omit unused `nsfw` field in recommender route
- verified both files with `npx eslint server/routes/scheduled-posts.ts server/routes/subreddit-recommender.ts`

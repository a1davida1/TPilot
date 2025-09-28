// Database connection stub for testing

export const db = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([])
      })
    })
  }),
  query: {
    users: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([])
    },
    subredditRules: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([])
    },
    creatorAccounts: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([])
    },
    postRateLimits: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([])
    },
    redditCommunities: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([])
    }
  },
  insert: () => ({
    values: () => Promise.resolve({ success: true })
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve({ success: true })
    })
  }),
  delete: () => ({
    where: () => Promise.resolve({ success: true })
  })
};

export default db;
const { Client } = require('pg');

const q = `
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(q);
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
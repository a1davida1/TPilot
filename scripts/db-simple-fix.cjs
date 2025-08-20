const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('🔧 Starting simplified database fixes...\n');

  try {
    // Step 1: Drop empty user_samples if it exists and is empty
    console.log('Step 1: Checking user_samples...');
    const userSamplesCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_samples' AND table_schema = 'public'
      ) as exists,
      CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_samples' AND table_schema = 'public')
        THEN (SELECT count(*) FROM user_samples)
        ELSE 0
      END as count
    `);
    
    if (userSamplesCheck.rows[0].exists && userSamplesCheck.rows[0].count === '0') {
      await client.query('DROP TABLE user_samples CASCADE');
      console.log('✅ Dropped empty user_samples table');
    } else if (userSamplesCheck.rows[0].exists) {
      console.log(`⚠️ user_samples has ${userSamplesCheck.rows[0].count} rows, keeping it`);
    } else {
      console.log('✅ user_samples does not exist');
    }

    // Step 2: Check feature_flags status
    console.log('\nStep 2: Checking feature_flags...');
    const featureFlagsCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'feature_flags' AND table_schema = 'public'
      ) as exists
    `);
    
    if (featureFlagsCheck.rows[0].exists) {
      const count = await client.query('SELECT count(*) as count FROM feature_flags');
      console.log(`✅ feature_flags exists with ${count.rows[0].count} rows`);
    } else {
      console.log('⚠️ feature_flags does not exist, will be created by drizzle-kit push');
    }

    // Step 3: Check saved_content status
    console.log('\nStep 3: Checking saved_content...');
    const savedContentCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'saved_content' AND table_schema = 'public'
      ) as exists
    `);
    
    if (savedContentCheck.rows[0].exists) {
      console.log('⚠️ saved_content table exists - consider manual review');
    } else {
      console.log('✅ saved_content does not exist');
    }

    // Final verification
    console.log('\n--- FINAL TABLE STATUS ---');
    const tables = await client.query(`
      SELECT tablename, 
             (SELECT count(*) FROM pg_catalog.pg_class c2 
              WHERE pg_tables.tablename = c2.relname)::int as estimated_rows
      FROM pg_tables 
      WHERE schemaname='public' 
        AND tablename IN ('user_samples','feature_flags','saved_content')
      ORDER BY tablename
    `);
    
    if (tables.rows.length > 0) {
      console.table(tables.rows);
    } else {
      console.log('No relevant tables found');
    }

    console.log('\n✅ Database fixes completed!');
    console.log('\n📌 Next step: Run "npx drizzle-kit push" to sync schema');

  } catch (error) {
    console.error('❌ Error during database fixes:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((e) => { 
  console.error('Fatal error:', e); 
  process.exit(1); 
});
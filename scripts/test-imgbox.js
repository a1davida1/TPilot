#!/usr/bin/env node

// Test script to debug Imgbox token extraction

async function testImgbox() {
  console.log('Fetching Imgbox homepage to find token...\n');
  
  try {
    const response = await fetch('https://imgbox.com', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
      return;
    }

    const html = await response.text();
    console.log(`Fetched HTML (${html.length} bytes)\n`);

    // Try various token patterns
    const patterns = [
      /var\s+token\s*=\s*'([^']+)'/,
      /var\s+token\s*=\s*"([^"]+)"/,
      /data-token\s*=\s*['"]([^'"]+)['"]/,
      /token['"]?\s*:\s*['"]([^'"]+)['"]/,
      /"token"\s*:\s*"([^"]+)"/,
      /name="token"\s+value="([^"]+)"/,
      /id="token"\s+value="([^"]+)"/,
      /csrf_token['"]\s*:\s*['"]([^'"]+)['"]/,
      /authenticity_token['"]\s*:\s*['"]([^'"]+)['"]/,
      /_token['"]\s*:\s*['"]([^'"]+)['"]/,
    ];

    console.log('Testing patterns:\n');
    let found = false;
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        console.log(`✅ FOUND with pattern: ${pattern.source}`);
        console.log(`   Token: ${match[1]}\n`);
        found = true;
      }
    }

    if (!found) {
      console.log('❌ No token found with any pattern\n');
      
      // Look for any script tags or forms
      console.log('Looking for clues in HTML:\n');
      
      // Check for forms with hidden inputs
      const formInputs = html.match(/<input[^>]*type="hidden"[^>]*>/gi);
      if (formInputs) {
        console.log('Hidden form inputs found:');
        formInputs.slice(0, 5).forEach(input => {
          console.log(`  ${input}`);
        });
        console.log('');
      }
      
      // Check for script variables
      const scriptVars = html.match(/var\s+\w+\s*=\s*['"][^'"]{20,}['"]/g);
      if (scriptVars) {
        console.log('Script variables found:');
        scriptVars.slice(0, 5).forEach(v => {
          console.log(`  ${v.substring(0, 80)}...`);
        });
        console.log('');
      }
      
      // Show first 1000 chars of HTML
      console.log('First 1000 chars of HTML:');
      console.log(html.substring(0, 1000));
      console.log('\n...\n');
      
      // Search for "token" anywhere
      const tokenIndex = html.toLowerCase().indexOf('token');
      if (tokenIndex !== -1) {
        console.log('Found "token" at position', tokenIndex);
        console.log('Context:');
        console.log(html.substring(Math.max(0, tokenIndex - 100), tokenIndex + 200));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testImgbox();

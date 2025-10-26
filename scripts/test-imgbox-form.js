#!/usr/bin/env node

// Find all form fields on Imgbox upload form

async function findFormFields() {
  console.log('Fetching Imgbox to analyze upload form...\n');
  
  try {
    const response = await fetch('https://imgbox.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    
    // Find the upload form
    const formMatch = html.match(/<form[^>]*upload[^>]*>([\s\S]*?)<\/form>/i);
    if (formMatch) {
      console.log('Found upload form!\n');
      const formHtml = formMatch[1];
      
      // Extract all input fields
      const inputs = formHtml.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/gi);
      console.log('Form inputs:');
      for (const input of inputs) {
        console.log(`  - ${input[1]}`);
        // Try to get value if it's a hidden field
        const valueMatch = input[0].match(/value="([^"]*)"/);
        if (valueMatch && input[0].includes('type="hidden"')) {
          console.log(`    Value: ${valueMatch[1] || '(empty)'}`);
        }
      }
      
      // Check form action
      const actionMatch = formMatch[0].match(/action="([^"]+)"/);
      if (actionMatch) {
        console.log(`\nForm action: ${actionMatch[1]}`);
      }
      
      // Check form method
      const methodMatch = formMatch[0].match(/method="([^"]+)"/i);
      if (methodMatch) {
        console.log(`Form method: ${methodMatch[1]}`);
      }
      
      // Check enctype
      const enctypeMatch = formMatch[0].match(/enctype="([^"]+)"/i);
      if (enctypeMatch) {
        console.log(`Form enctype: ${enctypeMatch[1]}`);
      }
      
    } else {
      console.log('No upload form found. Looking for any forms...\n');
      
      const allForms = html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi);
      let formCount = 0;
      for (const form of allForms) {
        formCount++;
        const actionMatch = form[0].match(/action="([^"]+)"/);
        const action = actionMatch ? actionMatch[1] : 'no action';
        console.log(`Form ${formCount}: ${action}`);
        
        // If it looks like upload-related
        if (form[0].includes('file') || form[0].includes('upload') || form[0].includes('image')) {
          console.log('  ^ This might be the upload form!');
          console.log('  Form HTML preview:');
          console.log(form[0].substring(0, 500));
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findFormFields();

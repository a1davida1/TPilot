const fetch = require('node-fetch');

async function testAdminLogin() {
  try {
    // Get the admin password from environment
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set');
      process.exit(1);
    }
    
    console.log('Testing login with admin user...');
    console.log('Username: admin');
    console.log('Password length:', adminPassword.length);
    
    // Test login
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: adminPassword
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('User:', data.user);
    } else {
      console.log('❌ Login failed:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testAdminLogin();
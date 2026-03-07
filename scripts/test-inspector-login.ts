async function testInspectorLogin() {
  try {
    console.log('🔐 Testing Inspector Login...\n');

    // Test login
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'inspector1@beswp.com',
        password: 'Test@123'
      })
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      console.error('❌ Login failed!');
      console.error('Error:', loginData);
      process.exit(1);
    }

    console.log('✅ Login successful!');
    console.log(`Role: ${loginData.data.user.role}`);
    console.log(`Token: ${loginData.data.token.substring(0, 50)}...\n`);

    const token = loginData.data.token;

    // Test Dashboard API
    console.log('📊 Testing Dashboard API...');
    try {
      const dashboardResponse = await fetch('http://localhost:3000/api/inspector/v1/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const dashboardData = await dashboardResponse.json();

      if (!dashboardResponse.ok) {
        console.error('❌ Dashboard API failed!');
        console.error('Status:', dashboardResponse.status);
        console.error('Error:', dashboardData);
      } else {
        console.log('✅ Dashboard API works!');
        console.log('Data:', JSON.stringify(dashboardData, null, 2));
      }
    } catch (error: any) {
      console.error('❌ Dashboard API error!');
      console.error('Error:', error.message);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testInspectorLogin();

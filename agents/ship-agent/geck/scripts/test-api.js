// Test API endpoints locally
const axios = require('axios');

const API_BASE = 'http://localhost:9000/.netlify/functions';

async function testAPI() {
  console.log('Testing API endpoints...\n');
  
  const endpoints = [
    { name: 'Contexts', url: `${API_BASE}/contexts` },
    { name: 'Programs', url: `${API_BASE}/programs` },
    { name: 'Operations', url: `${API_BASE}/operations` },
    { name: 'Activity', url: `${API_BASE}/activity` },
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const response = await axios.get(endpoint.url);
      const data = Array.isArray(response.data) ? response.data : [response.data];
      console.log(`✓ ${endpoint.name}: ${data.length} items`);
      
      if (data.length > 0 && endpoint.name === 'Contexts') {
        const first = data[0];
        console.log('  Sample:', {
          id: first._id,
          name: first.customerName || first.name || 'N/A',
          industry: first.industry || 'N/A'
        });
      }
    } catch (error) {
      console.log(`✗ ${endpoint.name}: ${error.message}`);
    }
  }
  
  // Test authentication
  console.log('\nTesting Authentication...');
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@geck.local',
      password: 'dev'
    });
    
    if (loginResponse.data.token) {
      console.log('✓ Login successful!');
      console.log('  User:', loginResponse.data.user.name);
      console.log('  Role:', loginResponse.data.user.role);
    }
  } catch (error) {
    console.log(`✗ Login failed: ${error.message}`);
  }
}

// Wait a moment for server to be ready
setTimeout(testAPI, 2000);
// Quick API test script
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

async function testAPI() {
  console.log('🧪 Testing Admin Master Screens API\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Endpoint...');
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('   ✅ Status:', healthResponse.data.status);
    console.log('   ✅ Uptime:', Math.floor(healthResponse.data.uptime), 'seconds\n');

    // Test 2: Login (get token)
    console.log('2️⃣ Testing Login...');
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        username: 'admin',
        password: 'admin123' // Use your actual admin password
      });

      const token = loginResponse.data.token;
      console.log('   ✅ Login successful');
      console.log('   ✅ Token received\n');

      // Test 3: Get Trading Partners (without auth - should fail)
      console.log('3️⃣ Testing Trading Partners Without Auth (should fail)...');
      try {
        await axios.get(`${API_BASE}/trading-partners`);
        console.log('   ❌ Should have failed!\n');
      } catch (error) {
        console.log('   ✅ Correctly rejected:', error.response?.data?.error || error.message);
        console.log('   ✅ Status:', error.response?.status, '\n');
      }

      // Test 4: Get Trading Partners (with auth)
      console.log('4️⃣ Testing Trading Partners With Auth...');
      const tpResponse = await axios.get(`${API_BASE}/trading-partners`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('   ✅ Retrieved', tpResponse.data.tradingPartners.length, 'trading partners');
      tpResponse.data.tradingPartners.forEach(tp => {
        console.log(`      - ${tp.trading_partner_id}: ${tp.partner_name} (${tp.direction})`);
      });
      console.log('   ✅ Pagination:', JSON.stringify(tpResponse.data.pagination), '\n');

      // Test 5: Get Single Trading Partner
      console.log('5️⃣ Testing Get Single Trading Partner...');
      const singleTP = await axios.get(`${API_BASE}/trading-partners/TP0001`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Retrieved:', singleTP.data.partner_name);
      console.log('   ✅ Type:', singleTP.data.partner_type);
      console.log('   ✅ Channel:', singleTP.data.channel_type);
      console.log('   ✅ Status:', singleTP.data.status, '\n');

      // Test 6: Export to CSV
      console.log('6️⃣ Testing CSV Export...');
      const csvResponse = await axios.get(`${API_BASE}/trading-partners/export/csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ CSV export successful');
      console.log('   ✅ Size:', csvResponse.data.length, 'bytes');
      console.log('   ✅ First 100 chars:', csvResponse.data.substring(0, 100), '...\n');

    } catch (loginError) {
      console.log('   ❌ Login failed:', loginError.response?.data?.error || loginError.message);
      console.log('   ℹ️  Note: Update the admin password in test_api.js if different\n');
    }

    console.log('✅ API Testing Complete!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

testAPI();

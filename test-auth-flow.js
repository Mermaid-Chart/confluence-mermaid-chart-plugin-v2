#!/usr/bin/env node
import https from 'https';
import http from 'http';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.data) {
      req.write(options.data);
    }
    
    req.end();
  });
}

async function testMermaidChartAPI() {
  const baseUrl = process.argv[2] || 'https://confluence-mermaid-chart-plugin-git-add-logs-to-89da3a-mc-prod.vercel.app';
  
  console.log('🧪 Testing Mermaid Chart authentication flow...');
  console.log(`Base URL: ${baseUrl}\n`);
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await makeRequest(`${baseUrl}/health`);
    console.log(`✅ Health: ${healthResponse.status}`);
    
    try {
      const healthData = JSON.parse(healthResponse.data);
      console.log(`   Environment: ${healthData.environment}`);
      console.log(`   Base URL: ${healthData.baseUrl}`);
    } catch (e) {
      console.log('   Could not parse health response');
    }
    
    console.log('');
    
    // Test editor endpoint (this should show the login flow)
    console.log('2. Testing editor endpoint...');
    const editorResponse = await makeRequest(`${baseUrl}/editor`);
    console.log(`✅ Editor: ${editorResponse.status}`);
    
    if (editorResponse.status === 200) {
      // Look for login URL in the response
      if (editorResponse.data.includes('Connect to MermaidChart')) {
        console.log('   ✅ Login page served correctly');
      } else if (editorResponse.data.includes('mcAccessToken')) {
        console.log('   ✅ Authenticated user detected');
      } else {
        console.log('   ⚠️  Unknown editor state');
      }
    }
    
    console.log('');
    
    // Test atlassian-connect.json
    console.log('3. Testing descriptor...');
    const descriptorResponse = await makeRequest(`${baseUrl}/atlassian-connect.json`);
    console.log(`✅ Descriptor: ${descriptorResponse.status}`);
    
    if (descriptorResponse.status === 200) {
      try {
        const descriptor = JSON.parse(descriptorResponse.data);
        console.log(`   Base URL: ${descriptor.baseUrl}`);
        console.log(`   Key: ${descriptor.key}`);
        console.log(`   Installation endpoint: ${descriptor.lifecycle?.installed}`);
      } catch (e) {
        console.log('   Could not parse descriptor');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n🏁 Authentication flow test completed!');
  console.log('\nNext steps:');
  console.log('1. Install the app in Confluence using the descriptor URL');
  console.log('2. Try to insert/edit a diagram');
  console.log('3. Check the Vercel function logs for detailed authentication flow');
}

testMermaidChartAPI();

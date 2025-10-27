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

async function testEndpoint(url, options = {}) {
  try {
    console.log(`Testing: ${url}`);
    const response = await makeRequest(url, options);
    console.log(`✅ Status: ${response.status}`);
    
    if (options.method === 'POST') {
      console.log('Response:', response.data);
    } else {
      try {
        const parsed = JSON.parse(response.data);
        console.log('JSON Response:', JSON.stringify(parsed, null, 2));
      } catch {
        console.log('Response:', response.data.substring(0, 200) + '...');
      }
    }
    
    return response;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  let baseUrl = process.argv[2] || 'https://confluencetest.mermaidchart.com';
  
  // Remove trailing slash to avoid double slashes
  baseUrl = baseUrl.replace(/\/$/, '');
  
  console.log('🧪 Testing endpoints...');
  console.log(`Base URL: ${baseUrl}\n`);
  
  // Test health
  await testEndpoint(`${baseUrl}/health`);
  console.log('');
  
  // Test descriptor
  await testEndpoint(`${baseUrl}/atlassian-connect.json`);
  console.log('');
  
  // Test installation
  const installationData = JSON.stringify({
    clientKey: 'test-client-key-' + Date.now(),
    publicKey: 'test-public-key',
    sharedSecret: 'test-shared-secret-very-long-string-for-jwt-signing',
    serverVersion: '1000.0.0',
    pluginsVersion: '1000.0.0',
    baseUrl: 'https://test-confluence.atlassian.net',
    productType: 'confluence',
    description: 'Test Confluence Installation',
    eventType: 'installed'
  });
  
  await testEndpoint(`${baseUrl}/installed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(installationData),
      'User-Agent': 'Atlassian-Connect/1.0'
    },
    data: installationData
  });
  
  console.log('\n🏁 Tests completed!');
}

runTests();

#!/usr/bin/env node
import axios from 'axios';

// Test installation endpoint
async function testInstallation() {
  const baseUrl = process.argv[2] || 'https://confluencetest.mermaidchart.com';
  
  console.log(`Testing installation endpoint: ${baseUrl}/installed`);
  
  // Mock installation payload similar to what Confluence would send
  const installationPayload = {
    clientKey: 'test-client-key-' + Date.now(),
    publicKey: 'test-public-key',
    sharedSecret: 'test-shared-secret-very-long-string-for-jwt-signing',
    serverVersion: '1000.0.0',
    pluginsVersion: '1000.0.0',
    baseUrl: 'https://test-confluence.atlassian.net',
    productType: 'confluence',
    description: 'Test Confluence Installation',
    eventType: 'installed'
  };
  
  try {
    console.log('Sending installation request...');
    console.log('Payload:', JSON.stringify(installationPayload, null, 2));
    
    const response = await axios.post(`${baseUrl}/installed`, installationPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Atlassian-Connect/1.0'
      },
      timeout: 30000
    });
    
    console.log('✅ Installation successful!');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data:', response.data);
    
  } catch (error) {
    console.log('❌ Installation failed!');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      console.log('No response received:');
      console.log('Request:', error.request);
    } else {
      console.log('Error:', error.message);
    }
    console.log('Full error:', error);
  }
}

// Test health endpoint
async function testHealth() {
  const baseUrl = process.argv[2] || 'https://confluencetest.mermaidchart.com';
  
  console.log(`\nTesting health endpoint: ${baseUrl}/health`);
  
  try {
    const response = await axios.get(`${baseUrl}/health`, {
      timeout: 10000
    });
    
    console.log('✅ Health check successful!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Health check failed!');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test atlassian-connect.json
async function testDescriptor() {
  const baseUrl = process.argv[2] || 'https://confluencetest.mermaidchart.com';
  
  console.log(`\nTesting descriptor endpoint: ${baseUrl}/atlassian-connect.json`);
  
  try {
    const response = await axios.get(`${baseUrl}/atlassian-connect.json`, {
      timeout: 10000
    });
    
    console.log('✅ Descriptor fetch successful!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Descriptor fetch failed!');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

console.log('🧪 Starting endpoint tests...');
console.log('Usage: node test-installation.js [BASE_URL]');
console.log('Default BASE_URL: https://confluencetest.mermaidchart.com\n');

await testHealth();
await testDescriptor();
await testInstallation();

console.log('\n🏁 Tests completed!');

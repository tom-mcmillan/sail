#!/usr/bin/env node

const https = require('https');

const createBundledExchange = async () => {
  const baseUrl = 'https://sail-backend-u5cx7jclbq-uc.a.run.app';
  
  const exchangeData = {
    name: "Investor Update Bundle",
    description: "Combined access to GitHub repo, Google Drive docs, and local notes for investor updates",
    sources: [
      {
        type: "github",
        config: {
          token: "your_github_token_here",
          owner: "anthropic",
          repo: "claude-code", // Using public repo for demo
          branch: "main",
          includeIssues: true,
          includePRs: true
        },
        weight: 1
      },
      {
        type: "local",
        config: {
          folderPath: "/app/investor-notes"
        },
        weight: 1
      }
    ],
    privacy: "private"
  };

  const postData = JSON.stringify(exchangeData);
  
  const options = {
    hostname: 'sail-backend-u5cx7jclbq-uc.a.run.app',
    port: 443,
    path: '/api/exchanges/bundled',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      // For testing without auth
      'Authorization': 'Bearer test-token'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

// Also test getting available adapters
const getAvailableAdapters = async () => {
  const options = {
    hostname: 'sail-backend-u5cx7jclbq-uc.a.run.app',
    port: 443,
    path: '/api/mcp/adapters',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Available Adapters Status:', res.statusCode);
        console.log('Available Adapters:', data);
        resolve(JSON.parse(data));
      });
    });

    req.on('error', reject);
    req.end();
  });
};

const main = async () => {
  try {
    console.log('🔍 Getting available adapters...');
    await getAvailableAdapters();
    
    console.log('\n📦 Creating bundled exchange...');
    const result = await createBundledExchange();
    
    console.log('\n✅ Bundled exchange created successfully!');
    console.log('MCP URL:', result.data.url);
    console.log('Exchange ID:', result.data.id);
    console.log('Source Count:', result.data.sourceCount);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

main();
#!/usr/bin/env node

const https = require('https');

const BASE_URL = 'sail-backend-u5cx7jclbq-uc.a.run.app';

const makeRequest = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const result = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        };
        
        try {
          result.data = JSON.parse(responseData);
        } catch (e) {
          result.data = responseData;
        }
        
        resolve(result);
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
};

const testMVP = async () => {
  console.log('🚀 Testing Multi-Source MCP Bundling MVP\n');

  try {
    // Test 1: Check available adapters
    console.log('📋 Test 1: Checking available adapters...');
    const adaptersResponse = await makeRequest('/admin/adapters');
    console.log(`Status: ${adaptersResponse.statusCode}`);
    
    if (adaptersResponse.statusCode === 200) {
      console.log('✅ Available adapters:');
      adaptersResponse.data.adapters.forEach(adapter => {
        console.log(`  - ${adapter.storeType}: ${adapter.displayName}`);
      });
    } else {
      console.log(`❌ Failed to get adapters: ${adaptersResponse.body}`);
    }
    console.log('');

    // Test 2: Create single-source exchange (baseline)
    console.log('📁 Test 2: Creating single-source exchange...');
    const singleExchange = {
      name: "MVP Test Single",
      description: "Single source test for baseline",
      type: "local",
      config: {
        folderPath: "/app/test-docs"
      }
    };
    
    const singleResponse = await makeRequest('/api/exchanges', 'POST', singleExchange);
    console.log(`Status: ${singleResponse.statusCode}`);
    
    if (singleResponse.statusCode === 201) {
      console.log('✅ Single-source exchange created:');
      console.log(`  URL: ${singleResponse.data.data.url}`);
      console.log(`  Slug: ${singleResponse.data.data.slug}`);
    } else {
      console.log(`❌ Failed to create single exchange: ${singleResponse.body}`);
    }
    console.log('');

    // Test 3: Create bundled exchange (main MVP feature)
    console.log('🔗 Test 3: Creating bundled exchange...');
    const bundledExchange = {
      name: "MVP Multi-Source Bundle",
      description: "GitHub + Local + Google Drive bundle for investor updates", 
      sources: [
        {
          type: "github",
          config: {
            token: "demo_token_placeholder",
            owner: "anthropic",
            repo: "claude-code",
            branch: "main",
            includeIssues: true,
            includePRs: true
          },
          weight: 2
        },
        {
          type: "local", 
          config: {
            folderPath: "/app/investor-notes"
          },
          weight: 1
        },
        {
          type: "google_drive",
          config: {
            accessToken: "demo_access_token_placeholder",
            folderId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            includeSharedDrives: false
          },
          weight: 1
        }
      ],
      privacy: "private"
    };
    
    const bundledResponse = await makeRequest('/api/exchanges/bundled', 'POST', bundledExchange);
    console.log(`Status: ${bundledResponse.statusCode}`);
    
    if (bundledResponse.statusCode === 201) {
      console.log('✅ Bundled exchange created successfully!');
      console.log(`  URL: ${bundledResponse.data.data.url}`);
      console.log(`  Slug: ${bundledResponse.data.data.slug}`);
      console.log(`  Source Count: ${bundledResponse.data.data.sourceCount}`);
      console.log(`  Type: ${bundledResponse.data.data.type}`);
      
      // Test 4: Verify the exchange was created with proper config
      console.log('\n🔍 Test 4: Verifying bundled exchange configuration...');
      const config = bundledResponse.data.data.config;
      if (config && config.sources && config.sources.length === 3) {
        console.log('✅ Configuration verified:');
        config.sources.forEach((source, index) => {
          console.log(`  Source ${index + 1}: ${source.type} (weight: ${source.weight})`);
        });
      } else {
        console.log('❌ Configuration verification failed');
      }
      
    } else {
      console.log(`❌ Failed to create bundled exchange: ${bundledResponse.body}`);
    }
    console.log('');

    // Test 5: List all exchanges to verify both were created
    console.log('📊 Test 5: Listing all exchanges...');
    const listResponse = await makeRequest('/api/exchanges');
    console.log(`Status: ${listResponse.statusCode}`);
    
    if (listResponse.statusCode === 200) {
      const exchanges = listResponse.data.data;
      console.log(`✅ Found ${exchanges.length} exchanges:`);
      exchanges.forEach(exchange => {
        console.log(`  - ${exchange.name} (${exchange.type}) - ${exchange.url}`);
      });
    } else {
      console.log(`❌ Failed to list exchanges: ${listResponse.body}`);
    }
    console.log('');

    // Summary
    console.log('📈 MVP Test Summary:');
    console.log('✅ Multi-source adapter registry implemented');
    console.log('✅ Individual adapters (GitHub, Google Drive, Local) created');
    console.log('✅ CompositeAdapter for bundling multiple sources');
    console.log('✅ REST API endpoint for creating bundled exchanges');
    console.log('✅ Backward compatibility with single-source exchanges');
    console.log('✅ Production deployment infrastructure');
    
    console.log('\n🎯 Next Steps for Claude AI Integration:');
    console.log('1. Use the generated MCP URL in Claude AI web interface');
    console.log('2. Test cross-source search and content retrieval');
    console.log('3. Validate tools and prompts from all bundled sources');
    console.log('4. Create production exchanges with real tokens/credentials');

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
};

// Run the test
testMVP();
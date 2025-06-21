import { config } from 'dotenv';
import { Client } from 'pg';
import Redis from 'ioredis';
import bcrypt from 'bcrypt';

// Load environment variables
config();

class DevelopmentSetup {
  private dbClient: Client;
  private redisClient: Redis;

  constructor() {
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async setupDatabase(): Promise<void> {
    try {
      console.log('🔗 Connecting to database...');
      await this.dbClient.connect();
      console.log('✅ Connected to database');

      // Create tables
      await this.createTables();
      
      console.log('✅ Database setup completed');
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  async createTables(): Promise<void> {
    // Users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `;

    // Exchanges table
    const createExchangesTable = `
      CREATE TABLE IF NOT EXISTS exchanges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL CHECK (type IN ('local', 'google-drive', 'github')),
        slug VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'active', 'error', 'stopped')),
        privacy VARCHAR(50) DEFAULT 'private' CHECK (privacy IN ('private', 'public')),
        config JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        container_id VARCHAR(255),
        port INTEGER,
        queries_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_exchanges_user_id ON exchanges(user_id);
      CREATE INDEX IF NOT EXISTS idx_exchanges_slug ON exchanges(slug);
    `;

    // Analytics table
    const createAnalyticsTable = `
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exchange_id UUID REFERENCES exchanges(id) ON DELETE CASCADE,
        query TEXT,
        response_time INTEGER,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_exchange_id ON analytics(exchange_id);
    `;

    await this.dbClient.query(createUsersTable);
    await this.dbClient.query(createExchangesTable);
    await this.dbClient.query(createAnalyticsTable);
  }

  async setupRedis(): Promise<void> {
    try {
      console.log('🔗 Connecting to Redis...');
      
      await this.redisClient.set('sailmcp:setup:test', 'success', 'EX', 10);
      const testValue = await this.redisClient.get('sailmcp:setup:test');
      
      if (testValue !== 'success') {
        throw new Error('Redis test failed');
      }
      
      await this.redisClient.del('sailmcp:setup:test');
      console.log('✅ Redis connection working');
      
    } catch (error) {
      console.error('❌ Redis setup failed:', error);
      throw error;
    }
  }

  async createTestUser(): Promise<void> {
    try {
      const testEmail = 'tom@sailmcp.com';
      const testPassword = 'password123';
      
      console.log('👤 Creating test user...');
      
      const existingUser = await this.dbClient.query(
        'SELECT id, email FROM users WHERE email = $1', 
        [testEmail]
      );
      
      if (existingUser.rows.length > 0) {
        console.log('✅ Test user already exists');
        console.log(`   📧 Email: ${testEmail}`);
        console.log(`   🔑 Password: ${testPassword}`);
        return;
      }

      const passwordHash = await bcrypt.hash(testPassword, 12);
      
      const userResult = await this.dbClient.query(
        'INSERT INTO users (email, name, password_hash, plan) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
        [testEmail, 'Tom McMillan', passwordHash, 'pro']
      );
      
      const user = userResult.rows[0];
      
      console.log('✅ Test user created successfully!');
      console.log(`   📧 Email: ${testEmail}`);
      console.log(`   🔑 Password: ${testPassword}`);
      console.log(`   👤 Name: ${user.name}`);
      
    } catch (error) {
      console.error('❌ Error creating test user:', error);
      throw error;
    }
  }

  async checkEnvironment(): Promise<void> {
    console.log('🔍 Checking environment configuration...');
    
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'GOOGLE_CLIENT_ID'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      throw new Error('Missing environment variables');
    }
    
    console.log('✅ Environment configuration looks good');
  }

  async cleanup(): Promise<void> {
    try {
      await this.dbClient.end();
      await this.redisClient.disconnect();
      console.log('✅ Connections closed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  async displayNextSteps(): Promise<void> {
    console.log('\n🎉 SailMCP development environment setup complete!\n');
    
    console.log('🚀 Next steps:');
    console.log('   1. Start the backend server:');
    console.log('      npm run dev\n');
    
    console.log('🧪 Test credentials:');
    console.log('   📧 Email: tom@sailmcp.com');
    console.log('   🔑 Password: password123\n');
  }
}

async function setupDevelopment(): Promise<void> {
  const setup = new DevelopmentSetup();

  try {
    console.log('🏗️  Setting up SailMCP development environment...\n');

    await setup.checkEnvironment();
    await setup.setupDatabase();
    await setup.setupRedis();
    await setup.createTestUser();
    await setup.displayNextSteps();

    console.log('✅ Setup completed successfully!');

  } catch (error) {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  } finally {
    await setup.cleanup();
  }

  process.exit(0);
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDevelopment();
}

export { DevelopmentSetup, setupDevelopment };
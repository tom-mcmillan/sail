import { config } from 'dotenv';
import { Client } from 'pg';

// Load environment variables
config();

class DatabaseMigrator {
  private client: Client;

  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log('✅ Connected to database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.end();
      console.log('✅ Disconnected from database');
    } catch (error) {
      console.error('❌ Failed to disconnect from database:', error);
    }
  }

  async createTables(): Promise<void> {
    console.log('Creating database tables...');

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
      CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
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
      CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);
      CREATE INDEX IF NOT EXISTS idx_exchanges_privacy ON exchanges(privacy);
      CREATE INDEX IF NOT EXISTS idx_exchanges_type ON exchanges(type);
      CREATE INDEX IF NOT EXISTS idx_exchanges_queries_count ON exchanges(queries_count);
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
      CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_ip_address ON analytics(ip_address);
    `;

    // Sessions table (for future use)
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `;

    // API Keys table (for future API access)
    const createApiKeysTable = `
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        permissions JSONB DEFAULT '{}',
        last_used TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
    `;

    try {
      // Execute table creation queries
      await this.client.query(createUsersTable);
      console.log('✅ Users table created');

      await this.client.query(createExchangesTable);
      console.log('✅ Exchanges table created');

      await this.client.query(createAnalyticsTable);
      console.log('✅ Analytics table created');

      await this.client.query(createSessionsTable);
      console.log('✅ Sessions table created');

      await this.client.query(createApiKeysTable);
      console.log('✅ API Keys table created');

    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  async createTriggers(): Promise<void> {
    console.log('Creating database triggers...');

    // Trigger to update updated_at timestamp
    const createUpdatedAtTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_exchanges_updated_at ON exchanges;
      CREATE TRIGGER update_exchanges_updated_at
        BEFORE UPDATE ON exchanges
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    // Trigger to clean up expired sessions
    const createCleanupTrigger = `
      CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
      RETURNS void AS $$
      BEGIN
        DELETE FROM sessions WHERE expires_at < NOW();
      END;
      $$ language 'plpgsql';
    `;

    try {
      await this.client.query(createUpdatedAtTrigger);
      console.log('✅ Updated_at triggers created');

      await this.client.query(createCleanupTrigger);
      console.log('✅ Cleanup functions created');

    } catch (error) {
      console.error('❌ Error creating triggers:', error);
      throw error;
    }
  }

  async insertSampleData(): Promise<void> {
    console.log('Inserting sample data (if not exists)...');

    // Check if we're in development mode
    if (process.env.NODE_ENV !== 'development') {
      console.log('⏭️  Skipping sample data insertion (not in development mode)');
      return;
    }

    try {
      // Check if sample data already exists
      const existingUsers = await this.client.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(existingUsers.rows[0].count);

      if (userCount > 0) {
        console.log('⏭️  Sample data already exists, skipping insertion');
        return;
      }

      // Insert sample user (only in development)
      const sampleUserQuery = `
        INSERT INTO users (email, name, password_hash, plan)
        VALUES ('demo@sailmcp.com', 'Demo User', '$2b$12$demo.hash.for.development.only', 'pro')
        RETURNING id;
      `;

      const userResult = await this.client.query(sampleUserQuery);
      const userId = userResult.rows[0].id;

      console.log('✅ Sample user created');

      // Insert sample exchange
      const sampleExchangeQuery = `
        INSERT INTO exchanges (
          user_id, name, description, type, slug, status, privacy, 
          config, metadata, queries_count
        )
        VALUES (
          $1, 
          'Demo Knowledge Base', 
          'A sample knowledge base for demonstration purposes',
          'local',
          'demo-knowledge-base-sample',
          'active',
          'public',
          '{"files": []}',
          '{"file_count": 0, "total_size": 0}',
          42
        );
      `;

      await this.client.query(sampleExchangeQuery, [userId]);
      console.log('✅ Sample exchange created');

    } catch (error) {
      console.error('❌ Error inserting sample data:', error);
      // Don't throw here, sample data is optional
    }
  }

  async checkDatabaseVersion(): Promise<void> {
    try {
      const versionResult = await this.client.query('SELECT version()');
      console.log('📊 Database version:', versionResult.rows[0].version.split(' ')[0] + ' ' + versionResult.rows[0].version.split(' ')[1]);

      // Check if we have UUID extension
      const uuidResult = await this.client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')"
      );

      if (!uuidResult.rows[0].exists) {
        console.log('📦 Creating uuid-ossp extension...');
        await this.client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('✅ UUID extension created');
      }

    } catch (error) {
      console.error('❌ Error checking database version:', error);
      throw error;
    }
  }

  async validateTables(): Promise<void> {
    console.log('Validating table structure...');

    const tables = ['users', 'exchanges', 'analytics', 'sessions', 'api_keys'];
    
    for (const table of tables) {
      try {
        const result = await this.client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        if (result.rows.length === 0) {
          throw new Error(`Table ${table} does not exist`);
        }

        console.log(`✅ Table '${table}' validated (${result.rows.length} columns)`);
      } catch (error) {
        console.error(`❌ Error validating table '${table}':`, error);
        throw error;
      }
    }
  }
}

async function migrate(): Promise<void> {
  const migrator = new DatabaseMigrator();

  try {
    console.log('🚀 Starting database migration...\n');

    await migrator.connect();
    await migrator.checkDatabaseVersion();
    await migrator.createTables();
    await migrator.createTriggers();
    await migrator.validateTables();
    await migrator.insertSampleData();

    console.log('\n✅ Database migration completed successfully!');
    console.log('🎉 Your database is ready for SailMCP!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrator.disconnect();
  }

  process.exit(0);
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

export { DatabaseMigrator, migrate };
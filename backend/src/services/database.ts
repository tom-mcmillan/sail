import { Client, Pool } from 'pg';
import { config } from 'dotenv';

config();

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getClient() {
    return this.pool.connect();
  }

  async createTables() {
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

    const createOAuthTables = `
      -- OAuth Clients table
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id VARCHAR(255) PRIMARY KEY,
        secret VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        redirect_uris TEXT NOT NULL,
        scopes TEXT[] NOT NULL,
        is_public BOOLEAN DEFAULT false,
        pkce_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- OAuth Authorization Codes table
      CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
        code VARCHAR(255) PRIMARY KEY,
        client_id VARCHAR(255) REFERENCES oauth_clients(id) ON DELETE CASCADE,
        user_id UUID,
        redirect_uri TEXT NOT NULL,
        scopes TEXT[] NOT NULL,
        code_challenge VARCHAR(255),
        code_challenge_method VARCHAR(10),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- OAuth Access Tokens table
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        token TEXT PRIMARY KEY,
        client_id VARCHAR(255) REFERENCES oauth_clients(id) ON DELETE CASCADE,
        user_id UUID,
        scopes TEXT[] NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_client_id ON oauth_authorization_codes(client_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires_at ON oauth_authorization_codes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);
    `;

    try {
      await this.query(createUsersTable);
      console.log('✅ Users table created');

      await this.query(createExchangesTable);
      console.log('✅ Exchanges table created');

      await this.query(createAnalyticsTable);
      console.log('✅ Analytics table created');

      await this.query(createSessionsTable);
      console.log('✅ Sessions table created');

      await this.query(createApiKeysTable);
      console.log('✅ API Keys table created');

      await this.query(createOAuthTables);
      console.log('✅ OAuth tables created');

    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

export const db = new DatabaseService();
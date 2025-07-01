import { Pool } from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
  appliedAt?: Date;
}

export class MigrationService {
  private pool: Pool;
  private migrationsPath: string;

  constructor(pool: Pool, migrationsPath: string = 'migrations') {
    this.pool = pool;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize the migrations table
   */
  async initializeMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      )
    `);
  }

  /**
   * Get all applied migrations from database
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    const result = await this.pool.query(`
      SELECT version, name, applied_at
      FROM schema_migrations
      ORDER BY version ASC
    `);
    
    return result.rows.map(row => ({
      version: row.version,
      name: row.name,
      appliedAt: row.applied_at,
      up: '',
      down: ''
    }));
  }

  /**
   * Get all available migrations from filesystem
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    try {
      const files = await readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (!match) continue;

        const version = parseInt(match[1]);
        const name = match[2];
        const content = await readFile(join(this.migrationsPath, file), 'utf8');

        // Split content by -- ROLLBACK marker
        const parts = content.split('-- ROLLBACK');
        const up = parts[0].trim();
        const down = parts[1]?.trim() || '';

        migrations.push({
          version,
          name,
          up,
          down
        });
      }

      return migrations;
    } catch (error) {
      console.warn('Migrations directory not found, using empty list');
      return [];
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const available = await this.getAvailableMigrations();
    
    const appliedVersions = new Set(applied.map(m => m.version));
    
    return available.filter(migration => !appliedVersions.has(migration.version));
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration
      if (migration.up) {
        await client.query(migration.up);
      }
      
      // Generate checksum
      const checksum = this.generateChecksum(migration.up);
      
      // Record in migrations table
      await client.query(`
        INSERT INTO schema_migrations (version, name, checksum)
        VALUES ($1, $2, $3)
      `, [migration.version, migration.name, checksum]);
      
      await client.query('COMMIT');
      console.log(`✅ Applied migration ${migration.version}: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed to apply migration ${migration.version}: ${migration.name}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rollback a single migration
   */
  async rollbackMigration(migration: Migration): Promise<void> {
    if (!migration.down) {
      throw new Error(`No rollback script found for migration ${migration.version}`);
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the rollback
      await client.query(migration.down);
      
      // Remove from migrations table
      await client.query(`
        DELETE FROM schema_migrations
        WHERE version = $1
      `, [migration.version]);
      
      await client.query('COMMIT');
      console.log(`✅ Rolled back migration ${migration.version}: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed to rollback migration ${migration.version}: ${migration.name}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    await this.initializeMigrationsTable();
    
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📝 Found ${pending.length} pending migrations`);
    
    for (const migration of pending) {
      await this.applyMigration(migration);
    }
    
    console.log('✅ All migrations completed');
  }

  /**
   * Rollback to a specific version
   */
  async rollbackTo(targetVersion: number): Promise<void> {
    const applied = await this.getAppliedMigrations();
    const available = await this.getAvailableMigrations();
    
    // Find migrations to rollback (in reverse order)
    const toRollback = applied
      .filter(m => m.version > targetVersion)
      .sort((a, b) => b.version - a.version);
    
    if (toRollback.length === 0) {
      console.log(`✅ Already at or below version ${targetVersion}`);
      return;
    }

    console.log(`📝 Rolling back ${toRollback.length} migrations to version ${targetVersion}`);
    
    for (const appliedMigration of toRollback) {
      // Find the corresponding available migration for rollback script
      const availableMigration = available.find(m => m.version === appliedMigration.version);
      if (!availableMigration) {
        throw new Error(`Migration file not found for version ${appliedMigration.version}`);
      }
      
      await this.rollbackMigration({
        ...appliedMigration,
        down: availableMigration.down
      });
    }
    
    console.log(`✅ Rollback to version ${targetVersion} completed`);
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
    currentVersion: number | null;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    const currentVersion = applied.length > 0 
      ? Math.max(...applied.map(m => m.version))
      : null;

    return {
      applied,
      pending,
      currentVersion
    };
  }

  /**
   * Generate a simple checksum for migration content
   */
  private generateChecksum(content: string): string {
    // Simple hash function for content verification
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
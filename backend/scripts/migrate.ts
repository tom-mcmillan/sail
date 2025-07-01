#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { Pool } from 'pg';
import { MigrationService } from '../src/services/migrations';
import { join } from 'path';

// Load environment variables
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationService = new MigrationService(
  pool, 
  join(__dirname, '..', 'migrations')
);

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await migrationService.migrate();
        break;

      case 'down':
        if (!arg) {
          console.error('Please specify target version: npm run migrate down <version>');
          process.exit(1);
        }
        await migrationService.rollbackTo(parseInt(arg));
        break;

      case 'status':
        const status = await migrationService.getStatus();
        console.log('\n📊 Migration Status:');
        console.log(`Current Version: ${status.currentVersion || 'None'}`);
        console.log(`Applied Migrations: ${status.applied.length}`);
        console.log(`Pending Migrations: ${status.pending.length}`);
        
        if (status.applied.length > 0) {
          console.log('\n✅ Applied:');
          status.applied.forEach(m => {
            console.log(`  ${m.version}: ${m.name} (${m.appliedAt?.toISOString()})`);
          });
        }
        
        if (status.pending.length > 0) {
          console.log('\n⏳ Pending:');
          status.pending.forEach(m => {
            console.log(`  ${m.version}: ${m.name}`);
          });
        }
        break;

      case 'create':
        if (!arg) {
          console.error('Please specify migration name: npm run migrate create <name>');
          process.exit(1);
        }
        await createMigration(arg);
        break;

      default:
        console.log(`
Usage: npm run migrate <command> [args]

Commands:
  up, migrate         Run all pending migrations
  down <version>      Rollback to specific version
  status              Show migration status
  create <name>       Create new migration file

Examples:
  npm run migrate up
  npm run migrate down 1
  npm run migrate status
  npm run migrate create add_user_preferences
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function createMigration(name: string): Promise<void> {
  const { writeFile } = await import('fs/promises');
  const { join } = await import('path');
  
  // Get next version number
  const status = await migrationService.getStatus();
  const nextVersion = (status.currentVersion || 0) + 1;
  
  // Format version with leading zeros
  const versionStr = nextVersion.toString().padStart(3, '0');
  const filename = `${versionStr}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.sql`;
  const filepath = join(__dirname, '..', 'migrations', filename);
  
  const template = `-- ${name}
-- Description: Add description of what this migration does

-- Add your migration SQL here


-- ROLLBACK
-- Add rollback SQL here (this will undo the migration)

`;

  await writeFile(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
}

if (require.main === module) {
  main();
}
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Config {
  dbName: string;
  dbUser: string;
  dbHost: string;
  dbPort: string;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    dbName: 'teacher_assistant',
    dbUser: 'postgres',
    dbHost: 'localhost',
    dbPort: '5432',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db-name' && args[i + 1]) config.dbName = args[i + 1];
    if (args[i] === '--db-user' && args[i + 1]) config.dbUser = args[i + 1];
    if (args[i] === '--db-host' && args[i + 1]) config.dbHost = args[i + 1];
    if (args[i] === '--db-port' && args[i + 1]) config.dbPort = args[i + 1];
  }

  return config;
}

async function main() {
  console.log('=== PostgreSQL Setup for Teacher Assistant ===\n');
  
  const config = parseArgs();
  const { dbName, dbUser, dbHost, dbPort } = config;
  
  console.log('Configuration:');
  console.log(`  Database: ${dbName}`);
  console.log(`  User: ${dbUser}`);
  console.log(`  Host: ${dbHost}:${dbPort}`);
  console.log();

  const pool = new Pool({
    user: dbUser,
    host: dbHost,
    port: parseInt(dbPort),
    database: 'postgres', // Connect to default db first
  });

  try {
    // Create database
    console.log(`Creating database '${dbName}'...`);
    try {
      await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await pool.query(`CREATE DATABASE ${dbName}`);
      console.log('Database created successfully.\n');
    } catch (err) {
      console.error(`Error creating database: ${(err as Error).message}`);
      console.log('Trying to create database without dropping...');
      await pool.query(`CREATE DATABASE ${dbName}`).catch(() => {});
      console.log('Database ready.\n');
    }

    // Close original pool and connect to new database
    await pool.end();
    
    const appPool = new Pool({
      user: dbUser,
      host: dbHost,
      port: parseInt(dbPort),
      database: dbName,
    });

    // Run schema
    console.log('Running database schema...');
    const schemaPath = path.join(__dirname, '..', 'src', 'repositories', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await appPool.query(schema);
    console.log('Schema applied successfully.\n');
    
    // Check for SQLite migration
    const sqlitePath = path.join(__dirname, '..', 'database.sqlite');
    if (fs.existsSync(sqlitePath)) {
      console.log('Found SQLite database.');
      const response = await new Promise<string>((resolve) => {
        process.stdout.write('Migrate data to PostgreSQL? (y/n): ');
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim().toLowerCase());
        });
      });
      
      if (response === 'y' || response === 'yes') {
        console.log('Migrating data from SQLite to PostgreSQL...');
        await appPool.end();
        // Run migrate script directly
        const { execSync } = await import('child_process');
        execSync('npx tsx src/repositories/migrate.ts', { stdio: 'inherit' });
        console.log('Migration complete.\n');
      }
    }

    // Create .env file
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
      console.log('Creating .env file...');
      const envContent = `# Database (PostgreSQL)
DATABASE_URL=postgresql://${dbUser}@${dbHost}:${dbPort}/${dbName}

# Optional: JWT Secret (a default is used if not set)
# JWT_SECRET=your_secret_key_here
`;
      fs.writeFileSync(envPath, envContent);
      console.log('.env file created.\n');
    }

    await appPool.end();

    console.log('=== Setup Complete! ===\n');
    console.log('To start the app with PostgreSQL:');
    console.log('  npm run dev');
    console.log();
    console.log('Or manually:');
    console.log(`  DATABASE_URL=postgresql://${dbUser}@${dbHost}:${dbPort}/${dbName} npm run dev`);

  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
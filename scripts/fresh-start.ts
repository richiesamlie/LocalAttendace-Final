import fs from 'fs';

const DB_PATH = './database.sqlite';
const DATA_DIR = './data';

interface FreshStartOptions {
  deleteDb?: boolean;
  deleteDataDir?: boolean;
}

async function freshStart(options: FreshStartOptions = {}) {
  const { deleteDb = true, deleteDataDir = false } = options;
  
  console.log('\n🗑️  Fresh start - clearing application data\n');
  
  if (deleteDb) {
    const dbFiles = [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm'];
    for (const file of dbFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`  ✓ Deleted ${file}`);
        } catch (e) {
          console.log(`  ⚠ Could not delete ${file} (may be locked)`);
        }
      }
    }
  }
  
  if (deleteDataDir) {
    if (fs.existsSync(DATA_DIR)) {
      try {
        fs.rmSync(DATA_DIR, { recursive: true, force: true });
        console.log(`  ✓ Deleted ${DATA_DIR}`);
      } catch (e) {
        console.log(`  ⚠ Could not delete ${DATA_DIR}`);
      }
    }
  }
  
  console.log('\n✅ Application data cleared.');
  console.log('\n📝 To start fresh:');
  console.log('   npm run dev');
  console.log('\n   Login with: admin / teacher123');
}

const args = process.argv.slice(2);
if (args.includes('--full')) {
  freshStart({ deleteDb: true, deleteDataDir: true });
} else if (args.includes('--help')) {
  console.log('Usage: npx tsx scripts/fresh-start.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  --full     Delete both database and data directory');
  console.log('  --help      Show this help message');
  console.log('');
  console.log('Default: Delete database files only');
} else {
  freshStart();
}
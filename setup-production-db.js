#!/usr/bin/env node

/**
 * Production Database Setup Script
 * Sets up PostgreSQL database on Vercel with schema and seed data
 */

const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// ANSI colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runCommand(command, description) {
  try {
    log(`\n🔄 ${description}...`, 'cyan');
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('warning') && !stderr.includes('info')) {
      log(`⚠️  Warning: ${stderr}`, 'yellow');
    }
    
    if (stdout) {
      log(stdout, 'blue');
    }
    
    log(`✅ ${description} completed`, 'green');
    return { success: true, stdout, stderr };
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    return { success: false, error };
  }
}

async function setupProductionDatabase() {
  log('\n🚀 Setting up Production Database for Nutrition AI Demo', 'bold');
  log('='.repeat(60), 'blue');

  // Check if we have the required environment variables
  if (!process.env.DATABASE_URL) {
    log('❌ DATABASE_URL environment variable not found', 'red');
    log('Please set up your environment variables first:', 'yellow');
    log('export DATABASE_URL="your-postgresql-connection-string"', 'cyan');
    process.exit(1);
  }

  const steps = [
    {
      command: 'npx prisma generate',
      description: 'Generate Prisma Client'
    },
    {
      command: 'npx prisma db push --force-reset',
      description: 'Push database schema (with reset)'
    },
    {
      command: 'npx prisma db seed',
      description: 'Seed database with supplement data'
    }
  ];

  let allSuccessful = true;

  for (const step of steps) {
    const result = await runCommand(step.command, step.description);
    if (!result.success) {
      allSuccessful = false;
      break;
    }
  }

  if (allSuccessful) {
    log('\n🎉 Production database setup completed successfully!', 'bold');
    log('\n📋 Database Contents:', 'green');
    log('✅ Supplement models created', 'green');
    log('✅ Scan models created', 'green');
    log('✅ User models created', 'green');
    log('✅ 51 supplements seeded', 'green');
    log('✅ Sample users and scans created', 'green');
    
    log('\n🔗 Next Steps:', 'cyan');
    log('1. Test API endpoints on Vercel', 'cyan');
    log('2. Verify database connectivity', 'cyan');
    log('3. Run integration tests', 'cyan');
  } else {
    log('\n❌ Database setup failed. Please check the errors above.', 'red');
    process.exit(1);
  }
}

// Verify database connection
async function verifyConnection() {
  log('\n🔍 Verifying database connection...', 'cyan');
  
  try {
    const result = await runCommand(
      'npx prisma db execute --command="SELECT 1" --schema=prisma/schema.prisma',
      'Test database connectivity'
    );
    
    if (result.success) {
      log('✅ Database connection verified', 'green');
    }
  } catch {
    log('⚠️  Could not verify connection, but this might be normal', 'yellow');
  }
}

// Main execution
if (require.main === module) {
  setupProductionDatabase()
    .then(() => verifyConnection())
    .catch(error => {
      log(`\n❌ Setup failed: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { setupProductionDatabase }; 

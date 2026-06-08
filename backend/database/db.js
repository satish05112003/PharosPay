const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharospay';

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

// Dynamic models registry
const models = {};

function initModels(db) {
  const modelsDir = path.join(__dirname, 'models');
  if (fs.existsSync(modelsDir)) {
    const files = fs.readdirSync(modelsDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const modelName = path.basename(file, '.js');
        const ModelClass = require(path.join(modelsDir, file));
        models[modelName.charAt(0).toLowerCase() + modelName.slice(1) + 's'] = new ModelClass(db);
        if (modelName === 'AuditLog') {
          models['auditLogs'] = models['auditLogs'] || new ModelClass(db);
        } else if (modelName === 'SettlementEvent') {
          models['settlementEvents'] = models['settlementEvents'] || new ModelClass(db);
        } else if (modelName === 'ProviderTransaction') {
          models['providerTransactions'] = models['providerTransactions'] || new ModelClass(db);
        } else if (modelName === 'Beneficiary') {
          models['beneficiaries'] = models['beneficiaries'] || new ModelClass(db);
        } else if (modelName === 'SupportTicket') {
          models['supportTickets'] = models['supportTickets'] || new ModelClass(db);
        }
      }
    }
  }
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('PharosPay Database: Running migrations...');
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn('Migrations directory not found');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir).sort();
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(migrationsDir, file);
        console.log(`Executing migration: ${file}`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
      }
    }
    console.log('PharosPay Database: Migrations completed successfully.');
  } catch (err) {
    console.error('PharosPay Database: Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

const db = {
  pool,
  query: (text, params) => pool.query(text, params),
  runMigrations,
  models
};

initModels(db);
Object.assign(db, models);

module.exports = db;

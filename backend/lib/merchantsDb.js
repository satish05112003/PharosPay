const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'merchantsDb.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({}), 'utf8');
      return {};
    }
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading merchants database:', err);
    return {};
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing merchants database:', err);
    return false;
  }
}

function getMerchant(merchantId) {
  const db = readDb();
  return db[merchantId] || null;
}

function saveMerchant(merchantId, merchantData) {
  const db = readDb();
  db[merchantId] = {
    ...merchantData,
    merchantId,
    createdAt: merchantData.createdAt || new Date().toISOString(),
  };
  writeDb(db);
  return db[merchantId];
}

function getAllMerchants() {
  const db = readDb();
  return Object.values(db);
}

module.exports = {
  getMerchant,
  saveMerchant,
  getAllMerchants,
};

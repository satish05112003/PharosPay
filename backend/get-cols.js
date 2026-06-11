const {Pool} = require('pg'); 
const pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharospay'}); 
pool.query("SELECT * FROM payments LIMIT 1").then(res => { 
  if (res.rows.length > 0) {
    console.log(Object.keys(res.rows[0])); 
  } else {
    console.log("No rows");
  }
  process.exit(0); 
}).catch(e => { console.error(e); process.exit(1); });

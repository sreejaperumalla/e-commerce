require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => {
    console.log("Neon PostgreSQL Connected");
  })
  .catch((err) => {
    console.log(err);
  });

module.exports = pool;
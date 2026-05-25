const pool = require("./config/db");

async function testDB() {

  try {

    const result = await pool.query("SELECT NOW()");

    console.log("Database Connected Successfully");

    console.log(result.rows);

  } catch (error) {

    console.log(error);

  } finally {

    await pool.end();

  }

}

testDB();
const pool = require("../config/db");
require("dotenv").config();
async function updateStock() {

  try {

    await pool.query(`
      UPDATE products
      SET stock = 10
      WHERE stock = 0
    `);

    console.log("Stock updated successfully");

    process.exit();

  } catch (error) {

    console.log(error);

    process.exit(1);

  }

}

updateStock();
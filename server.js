const jwt = require("jsonwebtoken");
const authMiddleware = require("./middleware/auth");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const adminMiddleware = require("./middleware/adminMiddleware");
const upload = require("./middleware/upload");

dotenv.config();

const passport = require("./config/passport");
const session = require("express-session");
const pool = require("./config/db");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());

app.use(passport.session());

app.get("/", (req, res) => {
  res.send("Backend + PostgreSQL running");
});

// ================= ADMIN LOGIN =================

app.post("/admin/login", (req, res) => {

  const { username, password } = req.body;

  if (
    username === "admin" &&
    password === "admin123"
  ) {

    const token = jwt.sign(
      {
        username: "admin",
        role: "admin",
      },

      process.env.JWT_SECRET || "mysecretkey",

      {
        expiresIn: "1h",
      }
    );

    return res.json({
      message: "Admin Login Successful",
      token,
      username: "admin",
    });

  } else {

    return res.status(401).json({
      message: "Invalid admin credentials",
    });

  }

});

// ================= REGISTER =================

app.post("/register", async (req, res) => {

  try {

    const {
      username,
      email,
      password
    } = req.body;

    if (!username || !email || !password) {

      return res.status(400).json({
        message:
          "Username, email, and password are required",
      });

    }

    const result = await pool.query(

      `INSERT INTO users
      (name, email, password)

      VALUES ($1, $2, $3)

      RETURNING id, name, email`,

      [
        username.trim(),
        email.trim().toLowerCase(),
        password,
      ]

    );

    return res.status(201).json({
      message: "User Registered Successfully",
      user: result.rows[0],
    });

  } catch (error) {

    console.error("Registration failed:", error);

    if (error.code === "23505") {

      return res.status(409).json({
        message:
          "An account with this email already exists",
      });

    }

    return res.status(500).json({
      message: "Failed to register user",
    });

  }

});

// ================= LOGIN =================

app.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {

      return res.status(401).json({
        message: "User not found",
      });

    }

    const user = result.rows[0];

    const validPassword =
      password === user.password;

    if (!validPassword) {

      return res.status(401).json({
        message: "Invalid password",
      });

    }

    const token = jwt.sign(

      {
        id: user.id,
        email: user.email,
      },

      process.env.JWT_SECRET || "mysecretkey",

      {
        expiresIn: "1h",
      }

    );

    res.json({

      message: "Login successful",

      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Login failed",
    });

  }

});

// ================= GOOGLE OAUTH =================

app.get(

  "/auth/google",

  passport.authenticate("google", {
    scope: ["profile", "email"],
  })

);

app.get(

  "/auth/google/callback",

  passport.authenticate("google", {
    failureRedirect: "/",
  }),

  (req, res) => {

    const token = jwt.sign(

      {
        id: req.user.id,
        name: req.user.displayName,
      },

      process.env.JWT_SECRET || "mysecretkey",

      {
        expiresIn: "1h",
      }

    );

    res.redirect(
      `https://ecommerce-frontend-five-beryl.vercel.app/oauth-callback?token=${token}&name=${encodeURIComponent(req.user.displayName)}`
    );

  }

);

// ================= PROFILE =================

app.get(

  "/profile",

  authMiddleware,

  (req, res) => {

    res.json({
      message: "Protected profile route",
      user: req.user,
    });

  }

);

// ================= PRODUCTS =================

app.get("/products", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM products ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to fetch products",
    });

  }

});

// ================= ADD PRODUCT =================

app.post(
  "/products",
  adminMiddleware,
  upload.single("image"),
  async (req, res) => {

    try {

      const {
        name,
        category,
        price,
        description,
        stock
      } = req.body;

      const image = req.file.path;

      const result = await pool.query(

        `INSERT INTO products
        (name, category, price, image, description, stock)

        VALUES ($1, $2, $3, $4, $5, $6)

        RETURNING *`,

        [
          name,
          category,
          price,
          image,
          description,
          stock
        ]

      );

      res.json(result.rows[0]);

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: error.message,
      });

    }

  }

);

// ================= UPDATE PRODUCT =================

app.put("/products/:id", adminMiddleware, async (req, res) => {

  try {

    const { id } = req.params;

    const {
      name,
      category,
      price,
      image,
      description,
      stock
    } = req.body;

    const result = await pool.query(

      `UPDATE products

      SET
      name = $1,
      category = $2,
      price = $3,
      image = $4,
      description = $5,
      stock = $6

      WHERE id = $7

      RETURNING *`,

      [
        name,
        category,
        price,
        image,
        description,
        stock,
        id,
      ]

    );

    res.json(result.rows[0]);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to update product",
    });

  }

});

// ================= DELETE PRODUCT =================

app.delete("/products/:id", adminMiddleware, async (req, res) => {

  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM products WHERE id = $1",
      [id]
    );

    res.json({
      message: "Product deleted successfully",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to delete product",
    });

  }

});

// ================= PLACE ORDER =================

app.post("/orders", authMiddleware, async (req, res) => {

  try {

    const {
      products,
      totalAmount,
      paymentMethod
    } = req.body;

    const orderResult = await pool.query(

      `INSERT INTO orders
      (user_id, total_amount, payment_method)

      VALUES ($1, $2, $3)

      RETURNING *`,

      [
        req.user.id,
        totalAmount,
        paymentMethod
      ]

    );

    const orderId = orderResult.rows[0].id;

    for (const item of products) {

      await pool.query(

        `INSERT INTO order_items
        (order_id, product_id, quantity, price)

        VALUES ($1, $2, $3, $4)`,

        [
          orderId,
          item.id,
          item.quantity,
          item.price
        ]

      );

      await pool.query(

        `UPDATE products

        SET stock = stock - $1

        WHERE id = $2`,

        [
          item.quantity,
          item.id
        ]

      );

    }

    res.status(201).json({

      message: "Order placed successfully",

      orderId

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      message: "Failed to place order"

    });

  }

});

// ================= GET ALL ORDERS =================

app.get("/orders", authMiddleware, async (req, res) => {

  try {

    const userId = req.user.id;

    const result = await pool.query(`

      SELECT 
        o.id,
        o.total_amount as amount,
        o.payment_method as method,
        o.status,
        o.created_at as date,
        COUNT(oi.id) as items_count

      FROM orders o

      LEFT JOIN order_items oi
      ON o.id = oi.order_id

      WHERE o.user_id = $1

      GROUP BY o.id

      ORDER BY o.created_at DESC

    `, [userId]);

    const orders = result.rows.map(order => ({

      id: `#${order.id}`,

      amount:
        `₹${Number(order.amount).toLocaleString('en-IN')}`,

      method:
        order.method === 'cod'
          ? 'COD'
          : 'ONLINE',

      status: order.status,

      date:
        new Date(order.date).toLocaleString('en-IN'),

    }));

    res.json(orders);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to fetch orders"
    });

  }

});

// ================= GET ORDER DETAILS =================

app.get("/orders/:id", authMiddleware, async (req, res) => {

  try {

    const { id } = req.params;

    const userId = req.user.id;

    const orderResult = await pool.query(`

      SELECT * FROM orders 

      WHERE id = $1
      AND user_id = $2

    `, [id, userId]);

    if (orderResult.rows.length === 0) {

      return res.status(404).json({
        message: "Order not found"
      });

    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(`

      SELECT 
        oi.*,
        p.name,
        p.image,
        p.category

      FROM order_items oi

      JOIN products p
      ON oi.product_id = p.id

      WHERE oi.order_id = $1

    `, [id]);

    const items = itemsResult.rows.map(item => ({

      id: item.product_id,

      name: item.name,

      price: Number(item.price),

      quantity: item.quantity,

      image: item.image,

      category: item.category

    }));

    res.json({

      orderId: `#${order.id}`,

      date:
        new Date(order.created_at).toLocaleString('en-IN'),

      totalAmount:
        Number(order.total_amount),

      shipping: 0,

      items: items,

      status: order.status,

      paymentMethod: order.payment_method

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to fetch order details"
    });

  }

});

// ================= ORDER ANALYTICS =================

app.get("/orders/stats/summary", authMiddleware, async (req, res) => {

  try {

    const userId = req.user.id;

    const totalOrdersResult = await pool.query(`

      SELECT COUNT(*) FROM orders

      WHERE user_id = $1

    `, [userId]);

    const totalRevenueResult = await pool.query(`

      SELECT
      COALESCE(SUM(total_amount), 0) as total

      FROM orders

      WHERE user_id = $1

    `, [userId]);

    const codOrdersResult = await pool.query(`

      SELECT COUNT(*) FROM orders

      WHERE user_id = $1
      AND payment_method = 'cod'

    `, [userId]);

    const onlineOrdersResult = await pool.query(`

      SELECT COUNT(*) FROM orders

      WHERE user_id = $1
      AND payment_method = 'online'

    `, [userId]);

    res.json({

      totalOrders:
        parseInt(totalOrdersResult.rows[0].count),

      totalRevenue:
        parseInt(totalRevenueResult.rows[0].total),

      codOrders:
        parseInt(codOrdersResult.rows[0].count),

      onlineOrders:
        parseInt(onlineOrdersResult.rows[0].count)

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to fetch order analytics"
    });

  }

});

// ================= ADMIN ANALYTICS =================

app.get("/admin/analytics", adminMiddleware, async (req, res) => {

  try {

    const totalProducts = await pool.query(
      "SELECT COUNT(*) FROM products"
    );

    const totalOrders = await pool.query(
      "SELECT COUNT(*) FROM orders"
    );

    const totalRevenue = await pool.query(
      "SELECT SUM(total_amount) FROM orders"
    );

    const outOfStock = await pool.query(
      "SELECT COUNT(*) FROM products WHERE stock = 0"
    );

    const lowStock = await pool.query(
      "SELECT COUNT(*) FROM products WHERE stock <= 5 AND stock > 0"
    );

    res.json({

      totalProducts:
        totalProducts.rows[0].count,

      totalOrders:
        totalOrders.rows[0].count,

      totalRevenue:
        totalRevenue.rows[0].sum,

      outOfStock:
        outOfStock.rows[0].count,

      lowStock:
        lowStock.rows[0].count

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      message: "Failed to fetch analytics"

    });

  }

});

// ================= ADMIN ORDERS =================

app.get("/admin/orders", adminMiddleware, async (req, res) => {

  try {

    const result = await pool.query(`

      SELECT *

      FROM orders

      ORDER BY id DESC

    `);

    res.json(result.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message
    });

  }

});

// ================= TEST ROUTE =================

app.get("/test", (req, res) => {

  res.send("TEST ROUTE WORKING");

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {

  console.log(`Server running on port ${PORT}`);

});
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306'),
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASS || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        logo_url TEXT,
        about_text TEXT,
        phone VARCHAR(50),
        address TEXT,
        instagram_url TEXT,
        facebook_url TEXT,
        website_url TEXT,
        opening_hours VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_subcategories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        restaurant_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        category_id INT,
        subcategory_id INT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'TRY',
        is_new TINYINT(1) DEFAULT 0,
        allergens TEXT,
        image_url TEXT,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS restaurant_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        about_text TEXT,
        UNIQUE KEY uq_rest_lang (restaurant_id, language_code)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_category_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        UNIQUE KEY uq_cat_lang (category_id, language_code)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_subcategory_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subcategory_id INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        UNIQUE KEY uq_sub_lang (subcategory_id, language_code)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_item_translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        menu_item_id INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        UNIQUE KEY uq_item_lang (menu_item_id, language_code)
      )
    `);

    // Ensure restaurant_id column exists on menu_items (for older DBs)
    try {
      await conn.query(`ALTER TABLE menu_items ADD COLUMN restaurant_id INT NOT NULL DEFAULT 0`);
      console.log('✅ Added restaurant_id to menu_items');
    } catch (e) {
      // Column already exists — that's fine
    }

    // Ensure category_id column exists on menu_items
    try {
      await conn.query(`ALTER TABLE menu_items ADD COLUMN category_id INT DEFAULT NULL`);
      console.log('✅ Added category_id to menu_items');
    } catch (e) {}

    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    conn.release();
  }
}

pool.getConnection()
  .then(async conn => {
    console.log('✅ MySQL connected to Railway database:', process.env.DB_HOST || process.env.MYSQLHOST);
    conn.release();
    await runMigrations();
  })
  .catch(err => {
    console.error('❌ MySQL connection error:', err.message);
  });

module.exports = pool;

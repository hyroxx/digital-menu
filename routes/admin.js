const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { translateText } = require('../utils/translate');
const upload = require('../middleware/upload');
const path = require('path');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const LANGUAGES = ['tr', 'en', 'es', 'fr', 'ga'];

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'unauthorized' });
}

// ─── Serve Admin UI ──────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Hatalı şifre' });
  }
});

router.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/api/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ─── Auto-Translate ───────────────────────────────────────────────────────────

router.post('/api/translate', requireAuth, async (req, res) => {
  const { text, sourceLang } = req.body;
  if (!text || !text.trim()) return res.json({ translations: {} });

  const results = {};
  const targets = LANGUAGES.filter(l => l !== sourceLang);

  await Promise.all(targets.map(async (lang) => {
    results[lang] = await translateText(text, lang, sourceLang || 'auto');
  }));
  results[sourceLang || 'tr'] = text;

  res.json({ translations: results });
});

// ─── Restaurants ─────────────────────────────────────────────────────────────

router.get('/api/restaurants', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM restaurants ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/api/restaurants', requireAuth, async (req, res) => {
  try {
    const { name, slug, logo_url, about_text, phone, address,
            instagram_url, facebook_url, website_url, opening_hours, translations } = req.body;

    const [result] = await pool.query(
      `INSERT INTO restaurants (name, slug, logo_url, about_text, phone, address,
        instagram_url, facebook_url, website_url, opening_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, slug, logo_url || null, about_text || null, phone || null,
       address || null, instagram_url || null, facebook_url || null,
       website_url || null, opening_hours || null]
    );

    const restaurantId = result.insertId;
    if (translations) await saveRestaurantTranslations(restaurantId, translations);

    res.json({ success: true, id: restaurantId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/api/restaurants/:id', requireAuth, async (req, res) => {
  try {
    const { name, slug, logo_url, about_text, phone, address,
            instagram_url, facebook_url, website_url, opening_hours, translations } = req.body;

    await pool.query(
      `UPDATE restaurants SET name=?, slug=?, logo_url=?, about_text=?, phone=?,
        address=?, instagram_url=?, facebook_url=?, website_url=?, opening_hours=?
       WHERE id=?`,
      [name, slug, logo_url || null, about_text || null, phone || null,
       address || null, instagram_url || null, facebook_url || null,
       website_url || null, opening_hours || null, req.params.id]
    );

    if (translations) await saveRestaurantTranslations(req.params.id, translations);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/api/restaurants/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query('DELETE FROM restaurant_translations WHERE restaurant_id=?', [id]);
    const [cats] = await pool.query('SELECT id FROM menu_categories WHERE restaurant_id=?', [id]);
    for (const cat of cats) {
      const [subs] = await pool.query('SELECT id FROM menu_subcategories WHERE category_id=?', [cat.id]);
      for (const sub of subs) {
        await pool.query('DELETE FROM menu_subcategory_translations WHERE subcategory_id=?', [sub.id]);
      }
      await pool.query('DELETE FROM menu_subcategories WHERE category_id=?', [cat.id]);
      await pool.query('DELETE FROM menu_category_translations WHERE category_id=?', [cat.id]);
    }
    await pool.query('DELETE FROM menu_categories WHERE restaurant_id=?', [id]);
    const [items] = await pool.query('SELECT id FROM menu_items WHERE restaurant_id=?', [id]);
    for (const item of items) {
      await pool.query('DELETE FROM menu_item_translations WHERE menu_item_id=?', [item.id]);
    }
    await pool.query('DELETE FROM menu_items WHERE restaurant_id=?', [id]);
    await pool.query('DELETE FROM restaurants WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function saveRestaurantTranslations(restaurantId, translations) {
  for (const [lang, aboutText] of Object.entries(translations)) {
    if (aboutText) {
      await pool.query(
        `INSERT INTO restaurant_translations (restaurant_id, language_code, about_text)
         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE about_text=VALUES(about_text)`,
        [restaurantId, lang, aboutText]
      );
    }
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────

router.get('/api/restaurants/:id/categories', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM menu_categories WHERE restaurant_id=? ORDER BY display_order ASC, id ASC',
      [req.params.id]
    );
    for (const cat of rows) {
      const [trans] = await pool.query(
        'SELECT language_code, name FROM menu_category_translations WHERE category_id=?', [cat.id]
      );
      cat.translations = {};
      trans.forEach(t => { cat.translations[t.language_code] = t.name; });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/api/restaurants/:id/categories', requireAuth, async (req, res) => {
  try {
    const { name, display_order, translations } = req.body;
    const [result] = await pool.query(
      'INSERT INTO menu_categories (restaurant_id, name, display_order) VALUES (?, ?, ?)',
      [req.params.id, name, display_order || 0]
    );
    const catId = result.insertId;
    if (translations) await saveCategoryTranslations(catId, translations);
    res.json({ success: true, id: catId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const { name, display_order, translations } = req.body;
    await pool.query(
      'UPDATE menu_categories SET name=?, display_order=? WHERE id=?',
      [name, display_order || 0, req.params.id]
    );
    if (translations) await saveCategoryTranslations(req.params.id, translations);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [subs] = await pool.query('SELECT id FROM menu_subcategories WHERE category_id=?', [id]);
    for (const sub of subs) {
      await pool.query('DELETE FROM menu_subcategory_translations WHERE subcategory_id=?', [sub.id]);
    }
    await pool.query('DELETE FROM menu_subcategories WHERE category_id=?', [id]);
    await pool.query('DELETE FROM menu_category_translations WHERE category_id=?', [id]);
    const [items] = await pool.query('SELECT id FROM menu_items WHERE category_id=?', [id]);
    for (const item of items) {
      await pool.query('DELETE FROM menu_item_translations WHERE menu_item_id=?', [item.id]);
    }
    await pool.query('DELETE FROM menu_items WHERE category_id=?', [id]);
    await pool.query('DELETE FROM menu_categories WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function saveCategoryTranslations(catId, translations) {
  for (const [lang, name] of Object.entries(translations)) {
    if (name) {
      await pool.query(
        `INSERT INTO menu_category_translations (category_id, language_code, name)
         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [catId, lang, name]
      );
    }
  }
}

// ─── Subcategories ────────────────────────────────────────────────────────────

router.get('/api/categories/:id/subcategories', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM menu_subcategories WHERE category_id=? ORDER BY display_order ASC, id ASC',
      [req.params.id]
    );
    for (const sub of rows) {
      const [trans] = await pool.query(
        'SELECT language_code, name FROM menu_subcategory_translations WHERE subcategory_id=?', [sub.id]
      );
      sub.translations = {};
      trans.forEach(t => { sub.translations[t.language_code] = t.name; });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/api/categories/:id/subcategories', requireAuth, async (req, res) => {
  try {
    const { name, display_order, translations, restaurant_id } = req.body;
    const [result] = await pool.query(
      'INSERT INTO menu_subcategories (category_id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)',
      [req.params.id, restaurant_id, name, display_order || 0]
    );
    const subId = result.insertId;
    if (translations) await saveSubcategoryTranslations(subId, translations);
    res.json({ success: true, id: subId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/api/subcategories/:id', requireAuth, async (req, res) => {
  try {
    const { name, display_order, translations } = req.body;
    await pool.query(
      'UPDATE menu_subcategories SET name=?, display_order=? WHERE id=?',
      [name, display_order || 0, req.params.id]
    );
    if (translations) await saveSubcategoryTranslations(req.params.id, translations);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/api/subcategories/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM menu_subcategory_translations WHERE subcategory_id=?', [req.params.id]);
    await pool.query('DELETE FROM menu_subcategories WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function saveSubcategoryTranslations(subId, translations) {
  for (const [lang, name] of Object.entries(translations)) {
    if (name) {
      await pool.query(
        `INSERT INTO menu_subcategory_translations (subcategory_id, language_code, name)
         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [subId, lang, name]
      );
    }
  }
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

router.get('/api/restaurants/:id/items', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM menu_items WHERE restaurant_id=? ORDER BY display_order ASC, id ASC',
      [req.params.id]
    );
    for (const item of rows) {
      const [trans] = await pool.query(
        'SELECT language_code, name, description FROM menu_item_translations WHERE menu_item_id=?',
        [item.id]
      );
      item.translations = {};
      trans.forEach(t => { item.translations[t.language_code] = { name: t.name, description: t.description }; });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/api/restaurants/:id/items', requireAuth, async (req, res) => {
  try {
    const { category_id, subcategory_id, name, description, price, currency,
            is_new, allergens, image_url, display_order, translations } = req.body;

    const [result] = await pool.query(
      `INSERT INTO menu_items
        (restaurant_id, category_id, subcategory_id, name, description,
         price, currency, is_new, allergens, image_url, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, category_id || null, subcategory_id || null,
       name, description || null, price, currency || 'TRY',
       is_new ? 1 : 0, allergens || null, image_url || null, display_order || 0]
    );

    const itemId = result.insertId;
    if (translations) await saveItemTranslations(itemId, translations);
    res.json({ success: true, id: itemId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/api/items/:id', requireAuth, async (req, res) => {
  try {
    const { category_id, subcategory_id, name, description, price, currency,
            is_new, allergens, image_url, display_order, translations } = req.body;

    await pool.query(
      `UPDATE menu_items SET category_id=?, subcategory_id=?, name=?, description=?,
        price=?, currency=?, is_new=?, allergens=?, image_url=?, display_order=?
       WHERE id=?`,
      [category_id || null, subcategory_id || null, name, description || null,
       price, currency || 'TRY', is_new ? 1 : 0, allergens || null,
       image_url || null, display_order || 0, req.params.id]
    );

    if (translations) await saveItemTranslations(req.params.id, translations);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/api/items/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM menu_item_translations WHERE menu_item_id=?', [req.params.id]);
    await pool.query('DELETE FROM menu_items WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function saveItemTranslations(itemId, translations) {
  for (const [lang, data] of Object.entries(translations)) {
    if (data && (data.name || data.description)) {
      await pool.query(
        `INSERT INTO menu_item_translations (menu_item_id, language_code, name, description)
         VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
        [itemId, lang, data.name || null, data.description || null]
      );
    }
  }
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

router.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { translateText } = require('../utils/translate');

router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const lang = req.query.lang || 'en';

  try {
    const [restaurantRows] = await pool.query(
      `SELECT r.id, r.name, r.slug, r.logo_url, r.about_text, r.phone, r.address,
              r.instagram_url, r.facebook_url, r.website_url, r.opening_hours,
              rt.about_text AS about_text_translated
       FROM restaurants r
       LEFT JOIN restaurant_translations rt
         ON rt.restaurant_id = r.id AND rt.language_code = ?
       WHERE r.slug = ? LIMIT 1`,
      [lang, slug]
    );

    if (!restaurantRows || restaurantRows.length === 0) {
      return res.status(404).json({ error: 'restaurant_not_found', slug });
    }

    const restaurant = restaurantRows[0];

    if (!restaurant.about_text_translated && restaurant.about_text && lang !== 'en') {
      try {
        const translated = await translateText(restaurant.about_text, lang);
        if (translated && translated !== restaurant.about_text) {
          restaurant.about_text_translated = translated;
          pool.query(
            `INSERT INTO restaurant_translations (restaurant_id, language_code, about_text)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE about_text = VALUES(about_text)`,
            [restaurant.id, lang, translated]
          ).catch(err => console.error('Cache translation error:', err.message));
        }
      } catch (err) {
        console.error('Auto-translate error:', err.message);
      }
    }

    restaurant.about_text_display = restaurant.about_text_translated || restaurant.about_text;
    delete restaurant.about_text_translated;

    const [categoryRows] = await pool.query(
      `SELECT c.id, c.restaurant_id, c.display_order,
              COALESCE(ct.name, c.name) AS name
       FROM menu_categories c
       LEFT JOIN menu_category_translations ct
         ON ct.category_id = c.id AND ct.language_code = ?
       WHERE c.restaurant_id = ?
       ORDER BY c.display_order ASC, c.id ASC`,
      [lang, restaurant.id]
    );

    const [subcategoryRows] = await pool.query(
      `SELECT s.id, s.restaurant_id, s.category_id, s.display_order,
              COALESCE(st.name, s.name) AS name
       FROM menu_subcategories s
       LEFT JOIN menu_subcategory_translations st
         ON st.subcategory_id = s.id AND st.language_code = ?
       WHERE s.restaurant_id = ?
       ORDER BY s.display_order ASC, s.id ASC`,
      [lang, restaurant.id]
    );

    const [itemRows] = await pool.query(
      `SELECT i.id, i.restaurant_id, i.category_id, i.subcategory_id,
              i.price, i.currency, i.is_new, i.allergens, i.image_url,
              i.display_order, i.created_at,
              COALESCE(it.name, i.name) AS name,
              COALESCE(it.description, i.description) AS description
       FROM menu_items i
       LEFT JOIN menu_item_translations it
         ON it.menu_item_id = i.id AND it.language_code = ?
       WHERE i.restaurant_id = ?
       ORDER BY i.display_order ASC, i.id ASC`,
      [lang, restaurant.id]
    );

    res.json({
      restaurant,
      categories: categoryRows,
      subcategories: subcategoryRows,
      items: itemRows,
    });
  } catch (err) {
    console.error('❌ Restaurant error:', err);
    res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

router.post('/:slug/translations', async (req, res) => {
  const { slug } = req.params;
  const { language_code, about_text } = req.body;

  if (!language_code || !about_text) {
    return res.status(400).json({ error: 'language_code and about_text are required' });
  }

  try {
    const [restaurantRows] = await pool.query(
      'SELECT id FROM restaurants WHERE slug = ? LIMIT 1',
      [slug]
    );

    if (!restaurantRows || restaurantRows.length === 0) {
      return res.status(404).json({ error: 'restaurant_not_found' });
    }

    await pool.query(
      `INSERT INTO restaurant_translations (restaurant_id, language_code, about_text)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE about_text = VALUES(about_text)`,
      [restaurantRows[0].id, language_code, about_text]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Translation save error:', err);
    res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

module.exports = router;

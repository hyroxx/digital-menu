const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('../config/db'); // Initialize MySQL connection

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API Routes
app.use('/api/restaurant', require('../routes/restaurants'));
app.use('/api/qrcode', require('../routes/qrcode'));

// Get all restaurants
const pool = require('../config/db');
app.get('/api/restaurants', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, slug, name, logo_url FROM restaurants ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Restaurants list error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Image upload
const upload = require('../middleware/upload');
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve SPA for restaurant routes
app.get('/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/:slug/menu', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
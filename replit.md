# E2 Digital Solutions — QR Menu Platform

A multi-restaurant QR menu system. Each restaurant gets a unique slug-based URL. Customers scan a QR code and see the restaurant's full menu with multilingual support.

## Architecture

- **Backend**: Node.js + Express (`src/server.js`)
- **Database**: MySQL on Railway (`config/db.js`)
- **Frontend**: Vanilla JS SPA (`public/app.js`, `public/index.html`, `public/styles.css`)
- **Port**: 5000

## Routes

- `GET /:slug` → Homepage for the restaurant
- `GET /:slug/menu` → Menu page
- `GET /api/restaurant/:slug?lang=en` → Restaurant data (with translations)
- `POST /api/restaurant/:slug/translations` → Save restaurant about_text translations
- `GET /api/restaurants` → List all restaurants
- `GET /api/qrcode/:restaurantId` → Generate QR code
- `POST /api/upload` → Upload an image (stored in `public/uploads/`)

## Database Tables

- `restaurants` — Core restaurant data
- `restaurant_translations` — Per-language `about_text` (auto-created on startup)
- `menu_categories` + `menu_category_translations`
- `menu_subcategories` + `menu_subcategory_translations`
- `menu_items` + `menu_item_translations`

## Languages Supported

Turkish (tr), English (en), Spanish (es), French (fr), Irish/Gaeilge (ga)

## Key Features

- **Initial menu page**: Shows only items marked `is_new = true` below the category list
- **Full translation**: Category, subcategory, item names/descriptions, restaurant about_text all translate per language
- **Language switcher**: Persisted to localStorage and URL query param `?lang=`
- **QR code generation**: Per-restaurant, links to `BASE_URL/:slug`
- **Image uploads**: Stored in `public/uploads/`, max 5MB, images only

## Environment Variables

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL user |
| `DB_PASS` | MySQL password (secret) |
| `DB_NAME` | MySQL database name |
| `PORT` | Server port (5000) |
| `BASE_URL` | Public URL for QR code generation |

## Admin Panel

Accessible at `/admin`. Protected by password (default: `admin123`, change via `ADMIN_PASSWORD` env var).

Features:
- Add/edit/delete restaurants with logo upload
- Manage categories and subcategories per restaurant
- Add/edit/delete menu items with image upload
- Auto-translate (⚡ button) for names, descriptions, about text — translates to all 5 languages
- QR code view and download per restaurant
- Session-based authentication (24h)

## Deployment

- Target: Autoscale
- Run: `node src/server.js`

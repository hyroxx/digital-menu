// ─── State ────────────────────────────────────────────────────────────────────
const S = {
  restaurants: [],
  currentRestaurant: null,
  categories: [],
  items: [],
  editingRestId: null,
  editingCatId: null,
  editingSubId: null,
  editingSubCatId: null,
  editingItemId: null,
  currentTab: 'categories',
};

const LANGS = ['tr', 'en', 'es', 'fr', 'ga'];
const BASE_URL = window.location.origin;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const { isAdmin } = await api('GET', '/admin/api/me');
  if (isAdmin) showApp();
  else showLogin();
}

function showLogin() {
  show('login-screen');
  hide('app');
}

function showApp() {
  hide('login-screen');
  show('app');
  loadRestaurants();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('login-password').value;
  try {
    await api('POST', '/admin/api/login', { password });
    showApp();
  } catch {
    show('login-error');
  }
});

$('btn-logout').addEventListener('click', async () => {
  await api('POST', '/admin/api/logout');
  showLogin();
});

// ─── API Helper ───────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── Restaurants ──────────────────────────────────────────────────────────────
async function loadRestaurants() {
  try {
    S.restaurants = await api('GET', '/admin/api/restaurants');
    renderRestaurantList();
  } catch (err) {
    toast('Restoranlar yüklenemedi: ' + err.message, 'error');
  }
}

function renderRestaurantList() {
  const list = $('restaurant-list');
  list.innerHTML = '';

  if (S.restaurants.length === 0) {
    list.innerHTML = '<p class="loading-text">Henüz restoran yok. Ekleyin!</p>';
    return;
  }

  S.restaurants.forEach(r => {
    const item = document.createElement('button');
    item.className = 'restaurant-item' + (S.currentRestaurant?.id === r.id ? ' active' : '');
    item.innerHTML = `
      <div class="rest-avatar">
        ${r.logo_url ? `<img src="${r.logo_url}" alt="" onerror="this.style.display='none'">` : '🍽️'}
      </div>
      <div class="rest-info">
        <span class="rest-name">${esc(r.name)}</span>
        <span class="rest-slug">/${r.slug}</span>
      </div>
    `;
    item.onclick = () => selectRestaurant(r);
    list.appendChild(item);
  });
}

async function selectRestaurant(r) {
  S.currentRestaurant = r;
  S.currentTab = 'categories';
  renderRestaurantList();
  hide('empty-state');
  show('rest-detail');

  $('detail-name').textContent = r.name;
  $('btn-view-site').onclick = () => window.open(`${BASE_URL}/${r.slug}`, '_blank');
  $('btn-view-qr').onclick = () => showQR(r);
  $('btn-edit-rest').onclick = () => openRestaurantModal(r);
  $('btn-delete-rest').onclick = () => deleteRestaurant(r);

  switchTab('categories');
  await Promise.all([loadCategories(), loadItems()]);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function switchTab(tabName) {
  S.currentTab = tabName;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  hide('tab-categories'); hide('tab-items');
  show(`tab-${tabName}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────
async function loadCategories() {
  if (!S.currentRestaurant) return;
  try {
    S.categories = await api('GET', `/admin/api/restaurants/${S.currentRestaurant.id}/categories`);
    renderCategoryList();
    populateCategoryDropdowns();
  } catch (err) {
    toast('Kategoriler yüklenemedi', 'error');
  }
}

function renderCategoryList() {
  const container = $('category-list');
  container.innerHTML = '';

  if (S.categories.length === 0) {
    container.innerHTML = '<p class="loading-text text-secondary">Henüz kategori yok. Ekleyin!</p>';
    return;
  }

  S.categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card category-card';

    card.innerHTML = `
      <div class="category-header" onclick="toggleCategory(this)">
        <span class="category-name">${esc(cat.name)}</span>
        <div style="display:flex;gap:0.25rem;align-items:center">
          <button class="btn-icon" onclick="event.stopPropagation();openCategoryModal(${cat.id})" title="Düzenle">✏️</button>
          <button class="btn-icon danger" onclick="event.stopPropagation();deleteCategory(${cat.id})" title="Sil">🗑️</button>
          <span class="category-toggle">▼</span>
        </div>
      </div>
      <div class="category-body">
        <div class="subcategory-list" id="subs-${cat.id}">
          <p class="loading-text text-sm">Yükleniyor...</p>
        </div>
        <button class="btn btn-ghost btn-sm mt-1" onclick="openSubcategoryModal(null, ${cat.id})">+ Alt Kategori Ekle</button>
      </div>
    `;

    container.appendChild(card);
    loadSubcategories(cat.id);
  });
}

async function loadSubcategories(catId) {
  try {
    const subs = await api('GET', `/admin/api/categories/${catId}/subcategories`);
    const container = $(`subs-${catId}`);
    if (!container) return;
    container.innerHTML = '';

    if (subs.length === 0) {
      container.innerHTML = '<p class="text-sm text-secondary" style="padding:0.25rem 0">Alt kategori yok.</p>';
      return;
    }

    subs.forEach(sub => {
      const row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML = `
        <span class="row-item-name">${esc(sub.name)}</span>
        <div class="row-item-actions">
          <button class="btn-icon" onclick="openSubcategoryModal(${sub.id}, ${catId})" title="Düzenle">✏️</button>
          <button class="btn-icon danger" onclick="deleteSubcategory(${sub.id})" title="Sil">🗑️</button>
        </div>
      `;
      container.appendChild(row);
    });
  } catch {}
}

function toggleCategory(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.category-toggle');
  const isOpen = body.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
}

$('btn-add-category').addEventListener('click', () => openCategoryModal(null));

// ─── Category Modal ───────────────────────────────────────────────────────────
async function openCategoryModal(catId) {
  S.editingCatId = catId;
  $('modal-cat-title').textContent = catId ? 'Kategoriyi Düzenle' : 'Kategori Ekle';
  clearCatForm();

  if (catId) {
    const cat = S.categories.find(c => c.id === catId);
    if (cat) {
      $('cat-name').value = cat.name;
      $('cat-order').value = cat.display_order || 0;
      LANGS.forEach(l => {
        const el = $(`cat-trans-${l}`);
        if (el) el.value = cat.translations?.[l] || '';
      });
    }
  }

  openModal('modal-category');
}

function clearCatForm() {
  $('cat-name').value = '';
  $('cat-order').value = '0';
  LANGS.forEach(l => { const el = $(`cat-trans-${l}`); if (el) el.value = ''; });
}

$('btn-translate-cat').addEventListener('click', async () => {
  const text = $('cat-name').value.trim();
  if (!text) return toast('Önce kategori adını girin', 'error');
  const sourceLang = $('cat-source-lang').value;
  $('btn-translate-cat').disabled = true;
  $('btn-translate-cat').textContent = '⏳ Çevriliyor...';
  try {
    const { translations } = await api('POST', '/admin/api/translate', { text, sourceLang });
    LANGS.forEach(l => { const el = $(`cat-trans-${l}`); if (el && translations[l]) el.value = translations[l]; });
    openTranslations('cat-translations');
    toast('Çeviri tamamlandı!');
  } catch { toast('Çeviri hatası', 'error'); }
  finally { $('btn-translate-cat').disabled = false; $('btn-translate-cat').textContent = '⚡ Otomatik Çevir'; }
});

$('btn-save-category').addEventListener('click', async () => {
  const name = $('cat-name').value.trim();
  if (!name) return toast('Kategori adı zorunludur', 'error');

  const translations = {};
  LANGS.forEach(l => { const v = $(`cat-trans-${l}`)?.value.trim(); if (v) translations[l] = v; });

  try {
    $('btn-save-category').disabled = true;
    if (S.editingCatId) {
      await api('PUT', `/admin/api/categories/${S.editingCatId}`, { name, display_order: +$('cat-order').value, translations });
    } else {
      await api('POST', `/admin/api/restaurants/${S.currentRestaurant.id}/categories`, { name, display_order: +$('cat-order').value, translations });
    }
    closeModal('modal-category');
    toast('Kategori kaydedildi!');
    await loadCategories();
    populateCategoryDropdowns();
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
  finally { $('btn-save-category').disabled = false; }
});

async function deleteCategory(catId) {
  if (!confirm('Bu kategori ve içindeki tüm veriler silinecek. Emin misiniz?')) return;
  try {
    await api('DELETE', `/admin/api/categories/${catId}`);
    toast('Kategori silindi');
    await Promise.all([loadCategories(), loadItems()]);
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
}

// ─── Subcategory Modal ────────────────────────────────────────────────────────
async function openSubcategoryModal(subId, catId) {
  S.editingSubId = subId;
  S.editingSubCatId = catId;
  $('modal-sub-title').textContent = subId ? 'Alt Kategoriyi Düzenle' : 'Alt Kategori Ekle';
  clearSubForm();

  if (subId) {
    const subs = await api('GET', `/admin/api/categories/${catId}/subcategories`);
    const sub = subs.find(s => s.id === subId);
    if (sub) {
      $('sub-name').value = sub.name;
      $('sub-order').value = sub.display_order || 0;
      LANGS.forEach(l => { const el = $(`sub-trans-${l}`); if (el) el.value = sub.translations?.[l] || ''; });
    }
  }

  openModal('modal-subcategory');
}

function clearSubForm() {
  $('sub-name').value = '';
  $('sub-order').value = '0';
  LANGS.forEach(l => { const el = $(`sub-trans-${l}`); if (el) el.value = ''; });
}

$('btn-translate-sub').addEventListener('click', async () => {
  const text = $('sub-name').value.trim();
  if (!text) return toast('Önce alt kategori adını girin', 'error');
  const sourceLang = $('sub-source-lang').value;
  $('btn-translate-sub').disabled = true;
  $('btn-translate-sub').textContent = '⏳ Çevriliyor...';
  try {
    const { translations } = await api('POST', '/admin/api/translate', { text, sourceLang });
    LANGS.forEach(l => { const el = $(`sub-trans-${l}`); if (el && translations[l]) el.value = translations[l]; });
    openTranslations('sub-translations');
    toast('Çeviri tamamlandı!');
  } catch { toast('Çeviri hatası', 'error'); }
  finally { $('btn-translate-sub').disabled = false; $('btn-translate-sub').textContent = '⚡ Otomatik Çevir'; }
});

$('btn-save-subcategory').addEventListener('click', async () => {
  const name = $('sub-name').value.trim();
  if (!name) return toast('Alt kategori adı zorunludur', 'error');

  const translations = {};
  LANGS.forEach(l => { const v = $(`sub-trans-${l}`)?.value.trim(); if (v) translations[l] = v; });

  try {
    $('btn-save-subcategory').disabled = true;
    if (S.editingSubId) {
      await api('PUT', `/admin/api/subcategories/${S.editingSubId}`, { name, display_order: +$('sub-order').value, translations });
    } else {
      await api('POST', `/admin/api/categories/${S.editingSubCatId}/subcategories`, {
        name, display_order: +$('sub-order').value, translations,
        restaurant_id: S.currentRestaurant.id,
      });
    }
    closeModal('modal-subcategory');
    toast('Alt kategori kaydedildi!');
    await loadSubcategories(S.editingSubCatId);
    populateCategoryDropdowns();
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
  finally { $('btn-save-subcategory').disabled = false; }
});

async function deleteSubcategory(subId) {
  if (!confirm('Bu alt kategori silinecek. Emin misiniz?')) return;
  try {
    await api('DELETE', `/admin/api/subcategories/${subId}`);
    toast('Alt kategori silindi');
    await loadCategories();
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
}

// ─── Items ────────────────────────────────────────────────────────────────────
async function loadItems() {
  if (!S.currentRestaurant) return;
  try {
    S.items = await api('GET', `/admin/api/restaurants/${S.currentRestaurant.id}/items`);
    renderItemList();
  } catch { toast('Ürünler yüklenemedi', 'error'); }
}

function populateCategoryDropdowns() {
  const filterSel = $('item-filter-cat');
  const savedFilter = filterSel.value;
  filterSel.innerHTML = '<option value="">Tüm Kategoriler</option>';
  S.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    filterSel.appendChild(opt);
  });
  filterSel.value = savedFilter;
  renderItemList();
}

$('item-filter-cat').addEventListener('change', renderItemList);

function renderItemList() {
  const container = $('item-list');
  container.innerHTML = '';
  const filterCat = $('item-filter-cat').value;

  let items = S.items;
  if (filterCat) items = items.filter(i => String(i.category_id) === filterCat);

  $('items-count').textContent = `${items.length} ürün`;

  if (items.length === 0) {
    container.innerHTML = '<p class="loading-text text-secondary">Bu kategoride ürün yok.</p>';
    return;
  }

  items.forEach(item => {
    const cat = S.categories.find(c => c.id === item.category_id);
    const row = document.createElement('div');
    row.className = 'item-card';
    row.innerHTML = `
      <div class="item-thumb">
        ${item.image_url ? `<img src="${esc(item.image_url)}" alt="" onerror="this.style.display='none'">` : '🍴'}
      </div>
      <div class="item-info">
        <div class="item-name-row">
          <span class="item-name">${esc(item.name)}</span>
          ${item.is_new ? '<span class="new-pill">YENİ</span>' : ''}
        </div>
        ${item.description ? `<p class="item-desc">${esc(item.description)}</p>` : ''}
        ${cat ? `<span class="item-cat text-sm text-secondary">${esc(cat.name)}</span>` : ''}
      </div>
      <span class="item-price">${parseFloat(item.price).toFixed(2)} ${item.currency || ''}</span>
      <div class="item-actions">
        <button class="btn-icon" onclick="openItemModal(${item.id})" title="Düzenle">✏️</button>
        <button class="btn-icon danger" onclick="deleteItem(${item.id})" title="Sil">🗑️</button>
      </div>
    `;
    container.appendChild(row);
  });
}

$('btn-add-item').addEventListener('click', () => openItemModal(null));

// ─── Item Modal ───────────────────────────────────────────────────────────────
async function openItemModal(itemId) {
  S.editingItemId = itemId;
  $('modal-item-title').textContent = itemId ? 'Ürünü Düzenle' : 'Ürün Ekle';
  clearItemForm();
  populateItemCategorySelects();

  if (itemId) {
    const item = S.items.find(i => i.id === itemId);
    if (item) {
      $('item-name').value = item.name || '';
      $('item-desc').value = item.description || '';
      $('item-price').value = item.price || '';
      $('item-currency').value = item.currency || 'TRY';
      $('item-category').value = item.category_id || '';
      onItemCategoryChange();
      $('item-subcategory').value = item.subcategory_id || '';
      $('item-allergens').value = item.allergens || '';
      $('item-image-url').value = item.image_url || '';
      $('item-is-new').checked = !!item.is_new;
      $('item-order').value = item.display_order || 0;

      if (item.image_url) {
        const prev = $('item-img-preview');
        prev.src = item.image_url;
        prev.classList.remove('hidden');
      }

      LANGS.forEach(l => {
        const n = $(`item-trans-name-${l}`);
        const d = $(`item-trans-desc-${l}`);
        if (n) n.value = item.translations?.[l]?.name || '';
        if (d) d.value = item.translations?.[l]?.description || '';
      });
    }
  }

  openModal('modal-item');
}

function clearItemForm() {
  ['item-name','item-desc','item-price','item-allergens','item-image-url'].forEach(id => { $(id).value = ''; });
  $('item-currency').value = 'TRY';
  $('item-is-new').checked = false;
  $('item-order').value = '0';
  $('item-img-preview').classList.add('hidden');
  $('item-img-preview').src = '';
  LANGS.forEach(l => {
    const n = $(`item-trans-name-${l}`); if (n) n.value = '';
    const d = $(`item-trans-desc-${l}`); if (d) d.value = '';
  });
}

function populateItemCategorySelects() {
  const catSel = $('item-category');
  catSel.innerHTML = '<option value="">— Seçin —</option>';
  S.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSel.appendChild(opt);
  });
  $('item-subcategory').innerHTML = '<option value="">— Seçin —</option>';
}

$('item-category').addEventListener('change', onItemCategoryChange);

async function onItemCategoryChange() {
  const catId = $('item-category').value;
  const subSel = $('item-subcategory');
  subSel.innerHTML = '<option value="">— Seçin —</option>';
  if (!catId) return;

  try {
    const subs = await api('GET', `/admin/api/categories/${catId}/subcategories`);
    subs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      subSel.appendChild(opt);
    });
  } catch {}
}

$('btn-translate-item').addEventListener('click', async () => {
  const name = $('item-name').value.trim();
  const desc = $('item-desc').value.trim();
  if (!name) return toast('Önce ürün adını girin', 'error');
  const sourceLang = $('item-source-lang').value;
  $('btn-translate-item').disabled = true;
  $('btn-translate-item').textContent = '⏳ Çevriliyor...';
  try {
    const [nameRes, descRes] = await Promise.all([
      api('POST', '/admin/api/translate', { text: name, sourceLang }),
      desc ? api('POST', '/admin/api/translate', { text: desc, sourceLang }) : Promise.resolve({ translations: {} }),
    ]);
    LANGS.forEach(l => {
      const n = $(`item-trans-name-${l}`);
      const d = $(`item-trans-desc-${l}`);
      if (n && nameRes.translations[l]) n.value = nameRes.translations[l];
      if (d && descRes.translations[l]) d.value = descRes.translations[l];
    });
    openTranslations('item-translations');
    toast('Çeviri tamamlandı!');
  } catch { toast('Çeviri hatası', 'error'); }
  finally { $('btn-translate-item').disabled = false; $('btn-translate-item').textContent = '⚡ Otomatik Çevir'; }
});

$('btn-save-item').addEventListener('click', async () => {
  const name = $('item-name').value.trim();
  const price = parseFloat($('item-price').value);
  if (!name) return toast('Ürün adı zorunludur', 'error');
  if (isNaN(price) || price < 0) return toast('Geçerli bir fiyat girin', 'error');

  const translations = {};
  LANGS.forEach(l => {
    const n = $(`item-trans-name-${l}`)?.value.trim();
    const d = $(`item-trans-desc-${l}`)?.value.trim();
    if (n || d) translations[l] = { name: n || '', description: d || '' };
  });

  const body = {
    name,
    description: $('item-desc').value.trim() || null,
    price,
    currency: $('item-currency').value,
    category_id: $('item-category').value || null,
    subcategory_id: $('item-subcategory').value || null,
    allergens: $('item-allergens').value.trim() || null,
    image_url: $('item-image-url').value.trim() || null,
    is_new: $('item-is-new').checked,
    display_order: +$('item-order').value,
    translations,
  };

  try {
    $('btn-save-item').disabled = true;
    if (S.editingItemId) {
      await api('PUT', `/admin/api/items/${S.editingItemId}`, body);
    } else {
      await api('POST', `/admin/api/restaurants/${S.currentRestaurant.id}/items`, body);
    }
    closeModal('modal-item');
    toast('Ürün kaydedildi!');
    await loadItems();
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
  finally { $('btn-save-item').disabled = false; }
});

async function deleteItem(itemId) {
  if (!confirm('Bu ürün silinecek. Emin misiniz?')) return;
  try {
    await api('DELETE', `/admin/api/items/${itemId}`);
    toast('Ürün silindi');
    await loadItems();
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
}

// ─── Restaurant Modal ─────────────────────────────────────────────────────────
$('btn-add-restaurant').addEventListener('click', () => openRestaurantModal(null));

async function openRestaurantModal(restaurant) {
  S.editingRestId = restaurant?.id || null;
  $('modal-rest-title').textContent = restaurant ? 'Restoranı Düzenle' : 'Restoran Ekle';
  clearRestForm();

  if (restaurant) {
    $('rest-name').value = restaurant.name || '';
    $('rest-slug').value = restaurant.slug || '';
    $('rest-logo').value = restaurant.logo_url || '';
    $('rest-about').value = restaurant.about_text || '';
    $('rest-phone').value = restaurant.phone || '';
    $('rest-hours').value = restaurant.opening_hours || '';
    $('rest-address').value = restaurant.address || '';
    $('rest-instagram').value = restaurant.instagram_url || '';
    $('rest-facebook').value = restaurant.facebook_url || '';
    $('rest-website').value = restaurant.website_url || '';

    if (restaurant.logo_url) {
      const prev = $('rest-logo-preview');
      prev.src = restaurant.logo_url;
      prev.classList.remove('hidden');
    }

    try {
      const pool = await fetch(`/admin/api/me`);
      const translations = {};
      for (const lang of LANGS) {
        const r = await fetch(`/api/restaurant/${restaurant.slug}?lang=${lang}`);
        if (r.ok) {
          const d = await r.json();
          translations[lang] = d.restaurant?.about_text_display || '';
        }
      }
      LANGS.forEach(l => { const el = $(`rest-trans-${l}`); if (el) el.value = translations[l] || ''; });
    } catch {}
  }

  openModal('modal-restaurant');
}

function clearRestForm() {
  ['rest-name','rest-slug','rest-logo','rest-about','rest-phone','rest-hours',
   'rest-address','rest-instagram','rest-facebook','rest-website'].forEach(id => { $(id).value = ''; });
  $('rest-logo-preview').classList.add('hidden');
  $('rest-logo-preview').src = '';
  LANGS.forEach(l => { const el = $(`rest-trans-${l}`); if (el) el.value = ''; });
}

$('rest-name').addEventListener('input', () => {
  if (!S.editingRestId) {
    $('rest-slug').value = $('rest-name').value.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  }
});

$('btn-translate-about').addEventListener('click', async () => {
  const text = $('rest-about').value.trim();
  if (!text) return toast('Önce hakkımızda metnini girin', 'error');
  const sourceLang = $('rest-source-lang').value;
  $('btn-translate-about').disabled = true;
  $('btn-translate-about').textContent = '⏳ Çevriliyor...';
  try {
    const { translations } = await api('POST', '/admin/api/translate', { text, sourceLang });
    LANGS.forEach(l => { const el = $(`rest-trans-${l}`); if (el && translations[l]) el.value = translations[l]; });
    openTranslations('rest-about-translations');
    toast('Çeviri tamamlandı!');
  } catch { toast('Çeviri hatası', 'error'); }
  finally { $('btn-translate-about').disabled = false; $('btn-translate-about').textContent = '⚡ Otomatik Çevir'; }
});

$('btn-save-restaurant').addEventListener('click', async () => {
  const name = $('rest-name').value.trim();
  const slug = $('rest-slug').value.trim();
  if (!name || !slug) return toast('Ad ve slug zorunludur', 'error');

  const translations = {};
  LANGS.forEach(l => { const v = $(`rest-trans-${l}`)?.value.trim(); if (v) translations[l] = v; });

  const body = {
    name, slug,
    logo_url: $('rest-logo').value.trim() || null,
    about_text: $('rest-about').value.trim() || null,
    phone: $('rest-phone').value.trim() || null,
    opening_hours: $('rest-hours').value.trim() || null,
    address: $('rest-address').value.trim() || null,
    instagram_url: $('rest-instagram').value.trim() || null,
    facebook_url: $('rest-facebook').value.trim() || null,
    website_url: $('rest-website').value.trim() || null,
    translations,
  };

  try {
    $('btn-save-restaurant').disabled = true;
    if (S.editingRestId) {
      await api('PUT', `/admin/api/restaurants/${S.editingRestId}`, body);
    } else {
      await api('POST', '/admin/api/restaurants', body);
    }
    closeModal('modal-restaurant');
    toast('Restoran kaydedildi!');
    await loadRestaurants();

    if (S.editingRestId && S.currentRestaurant?.id === S.editingRestId) {
      S.currentRestaurant = S.restaurants.find(r => r.id === S.editingRestId) || S.currentRestaurant;
      $('detail-name').textContent = S.currentRestaurant.name;
    }
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
  finally { $('btn-save-restaurant').disabled = false; }
});

async function deleteRestaurant(r) {
  if (!confirm(`"${r.name}" restoranı ve tüm verileri silinecek. Emin misiniz?`)) return;
  try {
    await api('DELETE', `/admin/api/restaurants/${r.id}`);
    toast('Restoran silindi');
    S.currentRestaurant = null;
    hide('rest-detail');
    show('empty-state');
    await loadRestaurants();
  } catch (err) { toast('Hata: ' + err.message, 'error'); }
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────
async function showQR(restaurant) {
  try {
    const { qrCode } = await api('GET', `/api/qrcode/${restaurant.id}`);
    $('qr-img').src = qrCode;
    $('qr-url').textContent = `${BASE_URL}/${restaurant.slug}`;
    $('qr-download').href = qrCode;
    openModal('modal-qr');
  } catch { toast('QR kodu oluşturulamadı', 'error'); }
}

// ─── Image Upload ─────────────────────────────────────────────────────────────
function setupUploadArea(areaId, fileInputId, previewId, urlInputId) {
  const area = $(areaId);
  const input = $(fileInputId);
  const preview = $(previewId);

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.style.borderColor = 'var(--primary)'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', (e) => { e.preventDefault(); area.style.borderColor = ''; if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0], preview, urlInputId); });
  input.addEventListener('change', () => { if (input.files[0]) handleUpload(input.files[0], preview, urlInputId); });
}

async function handleUpload(file, previewEl, urlInputId) {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch('/admin/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const { imageUrl } = await res.json();
    if (urlInputId) $(urlInputId).value = imageUrl;
    previewEl.src = imageUrl;
    previewEl.classList.remove('hidden');
    toast('Görsel yüklendi!');
  } catch { toast('Görsel yüklenemedi', 'error'); }
}

setupUploadArea('rest-logo-upload-area', 'rest-logo-file', 'rest-logo-preview', 'rest-logo');
setupUploadArea('item-img-upload-area', 'item-img-file', 'item-img-preview', 'item-image-url');

// ─── Modal Helpers ────────────────────────────────────────────────────────────
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

function toggleTranslations(blockId) {
  const content = document.querySelector(`#${blockId} .translation-content`);
  if (content) content.classList.toggle('open');
}

function openTranslations(blockId) {
  const content = document.querySelector(`#${blockId} .translation-content`);
  if (content) content.classList.add('open');
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
  }
});

init();

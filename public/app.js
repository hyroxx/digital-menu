// Global State
let state = {
  restaurant: null,
  categories: [],
  subcategories: [],
  items: [],
  currentLang: 'en',
  selectedCategory: null,
  selectedSubcategory: null,
};

const LANG_FLAGS = {
  tr: '🇹🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  ga: '🇮🇪',
};

const TRANSLATIONS = {
  en: {
    viewMenu: 'View Menu',
    ourStory: 'Our Story',
    categories: 'Categories',
    backHome: 'Back to Home',
    price: 'Price',
    allergens: 'Allergens',
    noItems: 'No items found in this category.',
    contact: 'Contact',
    about: 'About',
    followUs: 'Follow Us',
    notFound: 'Restaurant Not Found',
    notFoundMsg: "The restaurant you're looking for doesn't exist.",
    newItems: 'New Items',
    noNewItems: 'No new items at the moment.',
  },
  tr: {
    viewMenu: 'Menüyü Gör',
    ourStory: 'Hikayemiz',
    categories: 'Kategoriler',
    backHome: 'Ana Sayfaya Dön',
    price: 'Fiyat',
    allergens: 'Alerjenler',
    noItems: 'Bu kategoride ürün bulunamadı.',
    contact: 'İletişim',
    about: 'Hakkımızda',
    followUs: 'Bizi Takip Edin',
    notFound: 'Restoran Bulunamadı',
    notFoundMsg: 'Aradığınız restoran mevcut değil.',
    newItems: 'Yeni Ürünler',
    noNewItems: 'Şu an yeni ürün bulunmuyor.',
  },
  es: {
    viewMenu: 'Ver Menú',
    ourStory: 'Nuestra Historia',
    categories: 'Categorías',
    backHome: 'Volver al Inicio',
    price: 'Precio',
    allergens: 'Alérgenos',
    noItems: 'No se encontraron artículos en esta categoría.',
    contact: 'Contacto',
    about: 'Acerca de',
    followUs: 'Síguenos',
    notFound: 'Restaurante No Encontrado',
    notFoundMsg: 'El restaurante que buscas no existe.',
    newItems: 'Novedades',
    noNewItems: 'No hay novedades en este momento.',
  },
  fr: {
    viewMenu: 'Voir le Menu',
    ourStory: 'Notre Histoire',
    categories: 'Catégories',
    backHome: "Retour à l'Accueil",
    price: 'Prix',
    allergens: 'Allergènes',
    noItems: 'Aucun article trouvé dans cette catégorie.',
    contact: 'Contact',
    about: 'À Propos',
    followUs: 'Suivez-Nous',
    notFound: 'Restaurant Non Trouvé',
    notFoundMsg: "Le restaurant que vous cherchez n'existe pas.",
    newItems: 'Nouveautés',
    noNewItems: "Pas de nouveautés pour l'instant.",
  },
  ga: {
    viewMenu: 'Féach ar an Roghchlár',
    ourStory: 'Ár Scéal',
    categories: 'Catagóirí',
    backHome: 'Ar Ais go dtí an Baile',
    price: 'Praghas',
    allergens: 'Alairgéiní',
    noItems: 'Níl aon mhír sa chatagóir seo.',
    contact: 'Teagmháil',
    about: 'Fúinn',
    followUs: 'Lean Sinn',
    notFound: 'Ní Bhfuarthas an Bialann',
    notFoundMsg: 'Níl an bhialann atá á lorg agat ann.',
    newItems: 'Míreanna Nua',
    noNewItems: 'Níl aon mhír nua faoi láthair.',
  },
};

function t(key) {
  return (TRANSLATIONS[state.currentLang] && TRANSLATIONS[state.currentLang][key])
    || TRANSLATIONS.en[key]
    || key;
}

async function init() {
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);

  const urlLang = urlParams.get('lang');
  const savedLang = localStorage.getItem('preferredLanguage');
  state.currentLang = urlLang || savedLang || 'en';

  updateLanguageSwitcher();

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length === 0) {
    showError();
    return;
  }

  const slug = pathParts[0];
  const isMenuPage = pathParts[1] === 'menu';

  state.selectedCategory = urlParams.get('category') ? parseInt(urlParams.get('category')) : null;
  state.selectedSubcategory = urlParams.get('subcategory') ? parseInt(urlParams.get('subcategory')) : null;

  await fetchRestaurantData(slug);

  if (isMenuPage) {
    showMenuPage();
  } else {
    showHomepage();
  }
}

async function fetchRestaurantData(slug) {
  try {
    showLoading();
    const response = await fetch(`/api/restaurant/${slug}?lang=${state.currentLang}`);

    if (!response.ok) {
      throw new Error('Restaurant not found');
    }

    const data = await response.json();
    state.restaurant = data.restaurant;
    state.categories = data.categories;
    state.subcategories = data.subcategories;
    state.items = data.items;

    hideLoading();
  } catch (error) {
    console.error('Error fetching data:', error);
    hideLoading();
    showError();
  }
}

function showLoading() {
  document.body.style.cursor = 'wait';
}

function hideLoading() {
  document.body.style.cursor = 'default';
}

function showHomepage() {
  hideAllPages();
  const homepage = document.getElementById('homepage');
  homepage.classList.remove('hidden');
  renderHomepage();
}

function showMenuPage() {
  hideAllPages();
  const menuPage = document.getElementById('menu-page');
  menuPage.classList.remove('hidden');
  renderMenuPage();
}

function showError() {
  hideAllPages();
  const errorPage = document.getElementById('error-page');
  errorPage.classList.remove('hidden');
  document.getElementById('error-title').textContent = t('notFound');
  document.getElementById('error-message').textContent = t('notFoundMsg');
}

function hideAllPages() {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
}

function renderHomepage() {
  const { restaurant } = state;

  document.getElementById('restaurant-name').textContent = restaurant.name;

  const heroImage = document.getElementById('hero-image');
  if (restaurant.logo_url) {
    heroImage.style.backgroundImage = `url(${restaurant.logo_url})`;
  }

  if (restaurant.logo_url) {
    const logo = document.getElementById('restaurant-logo');
    logo.src = restaurant.logo_url;
    logo.classList.remove('hidden');
  }

  document.getElementById('story-title').textContent = t('ourStory');
  // Use translated about_text if available, fall back to original
  document.getElementById('restaurant-about').textContent = restaurant.about_text_display || restaurant.about_text || '';

  document.getElementById('view-menu-text').textContent = t('viewMenu');

  renderFooter('footer');

  document.getElementById('view-menu-btn').onclick = () => {
    const slug = state.restaurant.slug;
    window.location.href = `/${slug}/menu?lang=${state.currentLang}`;
  };
}

function renderMenuPage() {
  const { restaurant } = state;

  document.getElementById('header-restaurant-name').textContent = restaurant.name;

  document.getElementById('back-home-btn').onclick = () => {
    window.location.href = `/${restaurant.slug}?lang=${state.currentLang}`;
  };

  renderBreadcrumbs();

  if (!state.selectedCategory) {
    renderCategoryFilters();
    document.getElementById('subcategory-filters').classList.add('hidden');
    renderNewItems();
  } else {
    document.getElementById('category-filters').innerHTML = '';
    const subs = state.subcategories.filter(s => s.category_id === state.selectedCategory);
    if (subs.length > 0 && !state.selectedSubcategory) {
      renderSubcategoryFilters(subs);
    } else {
      document.getElementById('subcategory-filters').classList.add('hidden');
    }
    renderMenuItems();
  }

  renderFooter('menu-footer');
}

function renderBreadcrumbs() {
  const breadcrumbs = document.getElementById('breadcrumbs');

  if (!state.selectedCategory && !state.selectedSubcategory) {
    breadcrumbs.classList.add('hidden');
    return;
  }

  breadcrumbs.classList.remove('hidden');
  breadcrumbs.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-breadcrumb';
  backBtn.textContent = `← ${t('categories')}`;
  backBtn.onclick = () => {
    state.selectedCategory = null;
    state.selectedSubcategory = null;
    updateURL();
    renderMenuPage();
  };
  breadcrumbs.appendChild(backBtn);

  if (state.selectedSubcategory) {
    const cat = state.categories.find(c => c.id === state.selectedCategory);
    const backCatBtn = document.createElement('button');
    backCatBtn.className = 'btn-breadcrumb';
    backCatBtn.textContent = `← ${cat?.name || ''}`;
    backCatBtn.onclick = () => {
      state.selectedSubcategory = null;
      updateURL();
      renderMenuPage();
    };
    breadcrumbs.appendChild(backCatBtn);
  }
}

function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  container.innerHTML = `<h2 class="section-title">${t('categories')}</h2>`;

  const btnsContainer = document.createElement('div');
  btnsContainer.className = 'filter-buttons';

  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'btn-filter';
    btn.textContent = cat.name;
    btn.onclick = () => {
      state.selectedCategory = cat.id;
      state.selectedSubcategory = null;
      updateURL();
      renderMenuPage();
    };
    btnsContainer.appendChild(btn);
  });

  container.appendChild(btnsContainer);
}

function renderSubcategoryFilters(subs) {
  const container = document.getElementById('subcategory-filters');
  container.classList.remove('hidden');

  const cat = state.categories.find(c => c.id === state.selectedCategory);
  container.innerHTML = `<h2 class="section-title">${cat?.name || ''}</h2>`;

  const btnsContainer = document.createElement('div');
  btnsContainer.className = 'filter-buttons';

  subs.forEach(sub => {
    const btn = document.createElement('button');
    btn.className = 'btn-filter btn-filter-secondary';
    btn.textContent = sub.name;
    btn.onclick = () => {
      state.selectedSubcategory = sub.id;
      updateURL();
      renderMenuPage();
    };
    btnsContainer.appendChild(btn);
  });

  container.appendChild(btnsContainer);
}

// Shown on first menu open (no category selected): only new items
function renderNewItems() {
  const container = document.getElementById('menu-items');
  const newItems = state.items.filter(i => i.is_new);

  container.innerHTML = '';

  const titleEl = document.createElement('h2');
  titleEl.className = 'section-title new-items-title';
  titleEl.textContent = t('newItems');
  container.appendChild(titleEl);

  if (newItems.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-items';
    msg.textContent = t('noNewItems');
    container.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'new-items-grid';

  newItems.forEach(item => {
    grid.appendChild(buildItemCard(item));
  });

  container.appendChild(grid);
}

function renderMenuItems() {
  const container = document.getElementById('menu-items');

  let filteredItems = state.items;

  if (state.selectedSubcategory) {
    filteredItems = state.items.filter(i => i.subcategory_id === state.selectedSubcategory);
  } else if (state.selectedCategory) {
    filteredItems = state.items.filter(i => i.category_id === state.selectedCategory);
  }

  container.innerHTML = '';

  if (filteredItems.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-items';
    msg.textContent = t('noItems');
    container.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'menu-items-grid';

  filteredItems.forEach(item => {
    grid.appendChild(buildItemCard(item));
  });

  container.appendChild(grid);
}

function buildItemCard(item) {
  const card = document.createElement('div');
  card.className = 'menu-item-card';

  card.innerHTML = `
    ${item.image_url ? `
      <div class="item-image-container">
        <img src="${item.image_url}" alt="${escapeHtml(item.name)}" class="item-image" loading="lazy">
        ${item.is_new ? `<span class="new-badge">NEW</span>` : ''}
      </div>
    ` : ''}
    <div class="item-content">
      <div class="item-header">
        <h3 class="item-name">
          ${escapeHtml(item.name)}
          ${item.is_new && !item.image_url ? '<span class="new-badge-inline">NEW</span>' : ''}
        </h3>
        <span class="item-price">${parseFloat(item.price).toFixed(2)} ${escapeHtml(item.currency || '')}</span>
      </div>
      ${item.description ? `<p class="item-description">${escapeHtml(item.description)}</p>` : ''}
      ${item.allergens ? `
        <div class="item-allergens">
          ${item.allergens.split(',').slice(0, 3).map(a =>
            `<span class="allergen-badge">${escapeHtml(a.trim())}</span>`
          ).join('')}
        </div>
      ` : ''}
    </div>
  `;

  card.onclick = () => showModal(item);
  return card;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFooter(containerId) {
  const footer = document.getElementById(containerId);
  const { restaurant } = state;

  const aboutText = restaurant.about_text_display || restaurant.about_text || `Welcome to ${restaurant.name}`;

  footer.innerHTML = `
    <div class="footer-content">
      <div class="footer-section">
        <h3>${t('contact')}</h3>
        ${restaurant.phone ? `<p>📞 <a href="tel:${restaurant.phone}">${restaurant.phone}</a></p>` : ''}
        ${restaurant.address ? `<p>📍 ${restaurant.address}</p>` : ''}
        ${restaurant.opening_hours ? `<p>🕐 ${restaurant.opening_hours}</p>` : ''}
      </div>
      <div class="footer-section">
        <h3>${t('about')}</h3>
        <p>${escapeHtml(aboutText)}</p>
      </div>
      <div class="footer-section">
        <h3>${t('followUs')}</h3>
        <div class="social-links">
          ${restaurant.instagram_url ? `<a href="${restaurant.instagram_url}" target="_blank" rel="noopener">Instagram</a>` : ''}
          ${restaurant.facebook_url ? `<a href="${restaurant.facebook_url}" target="_blank" rel="noopener">Facebook</a>` : ''}
          ${restaurant.website_url ? `<a href="${restaurant.website_url}" target="_blank" rel="noopener">Website</a>` : ''}
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${escapeHtml(restaurant.name)}. All rights reserved.</p>
    </div>
  `;
}

function showModal(item) {
  const modal = document.getElementById('modal');

  document.getElementById('modal-title').textContent = item.name || '';
  document.getElementById('modal-description').textContent = item.description || '';
  document.getElementById('modal-price').textContent = `${parseFloat(item.price).toFixed(2)} ${item.currency || ''}`;

  const modalImage = document.getElementById('modal-image');
  if (item.image_url) {
    modalImage.src = item.image_url;
    modalImage.classList.remove('hidden');
  } else {
    modalImage.classList.add('hidden');
  }

  const allergensDiv = document.getElementById('modal-allergens');
  if (item.allergens) {
    const allergensList = item.allergens.split(',').map(a => a.trim());
    allergensDiv.innerHTML = `
      <span class="allergens-label">${t('allergens')}:</span>
      ${allergensList.map(a => `<span class="allergen-badge">${escapeHtml(a)}</span>`).join('')}
    `;
    allergensDiv.classList.remove('hidden');
  } else {
    allergensDiv.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal').classList.add('hidden');
}

document.getElementById('modal-close').onclick = hideModal;
document.querySelector('.modal-overlay').onclick = hideModal;

function updateLanguageSwitcher() {
  const flag = LANG_FLAGS[state.currentLang] || '🌐';
  document.getElementById('current-lang-flag').textContent = flag;
  document.getElementById('current-lang-code').textContent = state.currentLang.toUpperCase();
}

document.getElementById('lang-btn').onclick = () => {
  document.getElementById('lang-dropdown').classList.toggle('hidden');
};

document.querySelectorAll('.lang-option').forEach(btn => {
  btn.onclick = async () => {
    const lang = btn.dataset.lang;
    state.currentLang = lang;
    localStorage.setItem('preferredLanguage', lang);
    updateLanguageSwitcher();
    document.getElementById('lang-dropdown').classList.add('hidden');

    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);

    const slug = window.location.pathname.split('/').filter(p => p)[0];
    await fetchRestaurantData(slug);

    const isMenuPage = window.location.pathname.includes('/menu');
    if (isMenuPage) {
      renderMenuPage();
    } else {
      renderHomepage();
    }
  };
});

function updateURL() {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', state.currentLang);

  if (state.selectedCategory) {
    url.searchParams.set('category', state.selectedCategory);
  } else {
    url.searchParams.delete('category');
  }

  if (state.selectedSubcategory) {
    url.searchParams.set('subcategory', state.selectedSubcategory);
  } else {
    url.searchParams.delete('subcategory');
  }

  window.history.replaceState({}, '', url);
}

document.addEventListener('click', (e) => {
  const switcher = document.getElementById('language-switcher');
  const dropdown = document.getElementById('lang-dropdown');

  if (!switcher.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

window.addEventListener('DOMContentLoaded', init);

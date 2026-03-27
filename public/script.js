'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────
const grid        = document.getElementById('grid');
const statusEl    = document.getElementById('status');
const searchEl    = document.getElementById('search');
const minDiscEl   = document.getElementById('minDiscount');
const maxPriceEl  = document.getElementById('maxPrice');
const dealTypeEl  = document.getElementById('dealType');
const shopsEl     = document.getElementById('shops');
const limitEl     = document.getElementById('limit');
const sortEl      = document.getElementById('sort');
const refreshBtn  = document.getElementById('refresh');
const loadMoreBtn = document.getElementById('loadMore');

// ─── State ────────────────────────────────────────────────────────────────
let allDeals     = [];
let displayCount = 48;   // how many cards are visible right now

// ─── Store display helpers ────────────────────────────────────────────────
const STORE_LABELS = {
  steam:     { label: 'Steam',     cls: 'store-steam' },
  gog:       { label: 'GOG',       cls: 'store-gog' },
  epic:      { label: 'Epic',      cls: 'store-epic' },
  humble:    { label: 'Humble',    cls: 'store-humble' },
  fanatical: { label: 'Fanatical', cls: 'store-fanatical' },
};

function storeInfo(id) {
  const key = (id || '').toLowerCase();
  for (const [k, v] of Object.entries(STORE_LABELS)) {
    if (key.includes(k)) return v;
  }
  return { label: id || 'Store', cls: 'store-default' };
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────
function showSkeletons(n = 24) {
  grid.innerHTML = Array(n).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skel" style="aspect-ratio:460/215;border-radius:0"></div>
      <div style="padding:0.85rem 1rem 1rem;display:flex;flex-direction:column;gap:0.5rem">
        <div class="skel" style="height:0.9rem;width:75%"></div>
        <div class="skel" style="height:0.75rem;width:45%"></div>
        <div style="display:flex;justify-content:space-between;margin-top:0.75rem">
          <div class="skel" style="height:1.25rem;width:4rem"></div>
          <div class="skel" style="height:1.25rem;width:3rem;border-radius:8px"></div>
        </div>
      </div>
    </div>`).join('');
}

// ─── Render one card ──────────────────────────────────────────────────────
function renderCard(d) {
  const store      = storeInfo(d.store);
  const isFree     = d.type === 'giveaway' || d.salePrice === 0;
  const price      = isFree ? 0 : (d.salePrice  || 0);
  const normal     = d.normalPrice || 0;
  const cut        = d.discount    || 0;
  const dest       = d.url         || '#';
  const expiry     = d.expiry ? new Date(d.expiry * 1000).toLocaleDateString() : null;

  // Cover image – Steam CDN when available, fallback placeholder
  const coverHtml = d.image
    ? `<img src="${d.image}" alt="${d.title}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const placeholderStyle = d.image ? 'style="display:none"' : '';

  const priceBlock = isFree
    ? `<div class="price-current free">FREE</div>`
    : `<div>
        ${normal > price ? `<div class="price-was">$${normal.toFixed(2)}</div>` : ''}
        <div class="price-current">$${price.toFixed(2)}</div>
       </div>`;

  const discBadge = isFree
    ? `<div class="discount-pill big">FREE</div>`
    : cut > 0
      ? `<div class="discount-pill${cut >= 75 ? ' big' : ''}">-${cut}%</div>`
      : '';

  return `
    <article class="card" onclick="window.open('${dest}','_blank','noopener')">
      <div class="card-cover">
        ${coverHtml}
        <div class="card-cover-placeholder" ${placeholderStyle}>🎮</div>
        <span class="store-badge ${store.cls}">${store.label}</span>
        ${isFree ? '<span class="free-badge">FREE</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${d.title}</div>
        ${expiry ? `<div class="expiry-tag">Ends ${expiry}</div>` : ''}
        <div class="price-row">
          ${priceBlock}
          ${discBadge}
        </div>
        <a class="card-link" href="${dest}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View Deal →</a>
      </div>
    </article>`;
}

// ─── Render visible slice ──────────────────────────────────────────────────
function renderVisible() {
  const visible = allDeals.slice(0, displayCount);

  if (visible.length === 0) {
    grid.innerHTML = '<div class="empty">No deals match your filters.</div>';
    loadMoreBtn.style.display = 'none';
    return;
  }

  grid.innerHTML = visible.map(renderCard).join('');
  loadMoreBtn.style.display = allDeals.length > displayCount ? 'block' : 'none';
}

// ─── Fetch from backend ───────────────────────────────────────────────────
async function fetchDeals() {
  statusEl.textContent = 'Fetching deals…';
  showSkeletons(24);
  loadMoreBtn.style.display = 'none';
  displayCount = 48;

  const params = new URLSearchParams();

  const minDisc = Number(minDiscEl.value);
  const maxP    = Number(maxPriceEl.value);
  const type    = dealTypeEl.value;
  const shops   = shopsEl.value;
  const lim     = Number(limitEl.value);
  const text    = searchEl.value.trim();

  if (minDisc > 0)                             params.set('min_discount', minDisc);
  if (maxP > 0)                                params.set('max_price', maxP);
  if (type && type !== 'all')                  params.set('deal_type', type);
  if (shops)                                   params.set('shops', shops);
  if (lim >= 10 && lim <= 5000)               params.set('limit', lim);
  if (sortEl.value !== 'discount')             params.set('sort', sortEl.value);
  if (text)                                    params.set('text', text);

  try {
    const res  = await fetch('/api/deals?' + params.toString());
    const json = await res.json();

    if (!json.success) throw new Error(json.error || 'API error');

    allDeals = Array.isArray(json.deals) ? json.deals : [];
    statusEl.textContent = `${allDeals.length} deal${allDeals.length !== 1 ? 's' : ''} found`;
    renderVisible();

  } catch (err) {
    statusEl.textContent = '⚠️  ' + err.message;
    grid.innerHTML = `<div class="empty">Could not load deals: ${err.message}</div>`;
  }
}

// ─── Load more ─────────────────────────────────────────────────────────────
loadMoreBtn.addEventListener('click', () => {
  displayCount += 48;
  renderVisible();
  window.scrollBy({ top: 400, behavior: 'smooth' });
});

// ─── Event listeners ───────────────────────────────────────────────────────
let debounceTimer;
function debounce(fn, ms = 350) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, ms);
}

searchEl.addEventListener('input',    () => debounce(fetchDeals));
minDiscEl.addEventListener('change',  fetchDeals);
maxPriceEl.addEventListener('change', fetchDeals);
dealTypeEl.addEventListener('change', fetchDeals);
shopsEl.addEventListener('change',    fetchDeals);
sortEl.addEventListener('change',     fetchDeals);
refreshBtn.addEventListener('click',  fetchDeals);

// ─── Init ──────────────────────────────────────────────────────────────────
fetchDeals();

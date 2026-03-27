const fetch = globalThis.fetch || require('node-fetch');

module.exports = async function fetchDeals(query = {}) {
  const apiKey = process.env.ITAD_API_KEY;
  const country = process.env.ITAD_COUNTRY || 'US';
  const shops = query.shops || 'steam';
  const limit = Math.min(Math.max(Number(query.limit) || 200, 10), 5000);

  if (!apiKey) {
    return {
      success: false,
      error: 'ITAD_API_KEY not set in .env',
      deals: []
    };
  }

  // ── ITAD deals endpoint (v02) ───────────────────────────────────────
  // Old endpoint might 404 in some environments; fallback to v01 for compatibility.
  const endpoint = 'https://api.isthereanydeal.com/v02/deals/list';
  const fallbackEndpoint = 'https://api.isthereanydeal.com/v01/deals/list';

  const url = new URL(endpoint);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('country', country);
  url.searchParams.set('shops', shops);
  url.searchParams.set('limit', limit);
  url.searchParams.set('sort', 'discount');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SteamScout-ITAD/1.0',
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ITAD HTTP ${response.status}: ${body}`);
    }

    const data = await response.json();

    // v02 returns { list: [...], count: N }
    const rawList = data.list || data.deals || [];
    if (!Array.isArray(rawList)) {
      throw new Error('Unexpected ITAD response shape');
    }

    let deals = rawList.map(d => {
      // v02 shape: { id, slug, title, type, deal: { shop, price, regular, cut, url, expiry } }
      const deal    = d.deal || d;
      const shop    = deal.shop?.id || deal.shop || shops.split(',')[0];
      const salePrice   = Number(deal.price?.amount   ?? deal.price_new   ?? deal.price    ?? 0);
      const normalPrice = Number(deal.regular?.amount ?? deal.price_old   ?? deal.regular  ?? 0);
      const cut         = Number(deal.cut             ?? deal.price_cut   ?? 0);

      // Steam app ID — try multiple field locations
      const appid = d.appid || d.app_id || deal.appid || null;

      // Cover image: Steam CDN if we have an appid, otherwise null
      const image = appid
        ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
        : null;

      return {
        title:       d.title || 'Unknown',
        steamAppID:  appid ? Number(appid) : null,
        image,
        salePrice,
        normalPrice,
        discount:    cut,
        type:        salePrice === 0 ? 'giveaway' : 'sale',
        store:       shop,
        url:         deal.url || `https://store.steampowered.com/search/?term=${encodeURIComponent(d.title || '')}`,
        expiry:      deal.expiry ? Number(deal.expiry) : null
      };
    });

    // ── Filters ───────────────────────────────────────────────────────────
    const minDiscount = Number(query.min_discount || 0);
    if (minDiscount > 0) deals = deals.filter(d => d.discount >= minDiscount);

    const maxPrice = Number(query.max_price);
    if (!Number.isNaN(maxPrice) && maxPrice >= 0) deals = deals.filter(d => d.salePrice <= maxPrice);

    if (query.deal_type && ['sale', 'giveaway'].includes(query.deal_type)) {
      deals = deals.filter(d => d.type === query.deal_type);
    }

    if (query.text?.trim()) {
      const q = query.text.trim().toLowerCase();
      deals = deals.filter(d => d.title.toLowerCase().includes(q));
    }

    // ── Sort ──────────────────────────────────────────────────────────────
    if (query.sort === 'price_asc')  deals.sort((a, b) => a.salePrice - b.salePrice);
    else if (query.sort === 'price_desc') deals.sort((a, b) => b.salePrice - a.salePrice);
    else deals.sort((a, b) => b.discount - a.discount);

    return { success: true, count: deals.length, deals };

  } catch (error) {
    return { success: false, error: error.message, deals: [] };
  }
};

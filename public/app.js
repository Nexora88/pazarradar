(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {
    markets: [],
    stalls: [],
    filtered: [],
    page: 1,
    pageSize: 24,
    favorites: new Set(),
    view: "markets",
    token: localStorage.getItem("street-bazaars-token") || "",
    user: JSON.parse(localStorage.getItem("street-bazaars-user") || "null"),
    authMode: "login",
    apiAvailable: false,
    offlineCached: false,
    toastTimer: null,
    map: null,
    mapLayer: null,
    mapMarkets: null,
  };
  const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const idOf = (item) => String(item?._id || item?.id || "");
  const formatPrice = (value) =>
    Number.isFinite(Number(value)) && Number(value) > 0
      ? new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency: "TRY",
          maximumFractionDigits: 2,
        }).format(Number(value))
      : "Fiyat girilmemiş";
  const dateText = () =>
    new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(),
    );
  const getToken = () => (state.token ? { Authorization: "Bearer " + state.token } : {});
  const api = async (url, options = {}) => {
    const headers = { ...getToken(), ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, { ...options, headers });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : {};
    if (response.headers.get("X-Street-Bazaars-Cache") === "stale-offline") {
      state.offlineCached = true;
    } else if (response.ok && (url.startsWith("/api/pazar") || url.startsWith("/api/tezgah"))) {
      state.offlineCached = false;
    }
    if (!response.ok) {
      throw new Error(body.message || "İstek tamamlanamadı. (" + response.status + ")");
    }
    return body;
  };
  const toast = (message, error = false) => {
    const node = $("#toast");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
  };
  const dayName = (value) => {
    if (typeof value !== "string") return "";
    const normalized = value.toLocaleLowerCase("tr-TR");
    return days.find((day) => day.toLocaleLowerCase("tr-TR") === normalized) || value;
  };
  const initials = (text) =>
    (text || "P")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toLocaleUpperCase("tr-TR");
  const getMarketDays = (market) =>
    Array.isArray(market.gunler) ? market.gunler : market.gun ? [market.gun] : [];
  const getAddress = (market) =>
    [market.mahalle, market.adres].filter(Boolean).join(", ") || "Adres bilgisi henüz eklenmemiş";
  const productEntries = () =>
    state.stalls.flatMap((stall) =>
      (stall.urunler || []).map((product) => ({
        ...product,
        stall,
        price: product.guncelFiyat ?? product.ortalamaFiyat ?? product.fiyat ?? 0,
      })),
    );

  async function loadData() {
    $("#market-grid").innerHTML =
      '<div class="loading-card"><span class="loader"></span><strong>Pazarlar yükleniyor</strong><p>Güncel kayıtlar sunucudan alınıyor.</p></div>';
    $("#load-error").classList.add("hidden");
    $("#empty-state").classList.add("hidden");
    try {
      const [marketsResult, stallsResult, healthResult] = await Promise.all([
        api("/api/pazar?limit=100&page=1"),
        api("/api/tezgah?limit=100&page=1").catch(() => ({ data: [] })),
        api("/api/health").catch(() => ({ status: "offline" })),
      ]);
      const totalPages = Math.min(100, Math.max(1, Number(marketsResult.totalPages) || 1));
      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          api("/api/pazar?limit=100&page=" + (index + 2)).catch(() => ({ data: [] })),
        ),
      );
      state.markets = [
        ...(Array.isArray(marketsResult.data) ? marketsResult.data : []),
        ...remainingPages.flatMap((page) => (Array.isArray(page.data) ? page.data : [])),
      ];
      state.stalls = Array.isArray(stallsResult.data) ? stallsResult.data : [];
      const healthy = healthResult.status === "ok";
      state.apiAvailable = healthy && !state.offlineCached;
      $("#connection-label").textContent = state.offlineCached
        ? "Çevrimdışı önbellek · eski veri"
        : healthy
          ? "Sunucu bağlantısı aktif"
          : "API yanıt veriyor";
      $(".live-dot").classList.toggle("offline", !healthy);
      if (state.token) await loadFavorites();
      renderStats();
      populateDistricts();
      render();
    } catch (error) {
      state.apiAvailable = false;
      $("#connection-label").textContent = "Bağlantı kontrol edilmeli";
      $(".live-dot").classList.add("offline");
      $("#stat-markets").textContent = "—";
      $("#stat-stalls").textContent = "—";
      $("#stat-products").textContent = "—";
      $("#market-grid").innerHTML = "";
      $("#load-error").classList.remove("hidden");
      $("#result-count").textContent = "!";
      $("#results-summary").textContent = "Sunucu verileri alınamadı";
      toast(error.message || "Sunucuya ulaşılamadı.", true);
    }
  }

  async function loadFavorites() {
    try {
      const result = await api("/api/pazar/favoriler/listem");
      state.favorites = new Set((result.data || []).map(idOf));
    } catch (error) {
      if (/401|oturum|giriş/i.test(error.message)) {
        state.favorites = new Set();
      }
    }
    $("#stat-saved").textContent = state.favorites.size;
  }

  function renderStats() {
    $("#stat-markets").textContent = state.markets.length.toLocaleString("tr-TR");
    $("#stat-stalls").textContent = state.stalls.length.toLocaleString("tr-TR");
    $("#stat-products").textContent = productEntries().length.toLocaleString("tr-TR");
    $("#stat-saved").textContent = state.favorites.size.toLocaleString("tr-TR");
    $("#stat-markets-note").textContent = state.markets.length
      ? "Sunucudaki gerçek kayıtlar"
      : "Henüz kayıt bulunmuyor";
  }

  function populateDistricts() {
    const select = $("#district-filter");
    const current = select.value;
    const districts = [...new Set(state.markets.map((item) => item.ilce).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "tr"),
    );
    select.innerHTML =
      '<option value="">Tüm ilçeler</option>' +
      districts
        .map(
          (district) =>
            '<option value="' + escapeHtml(district) + '">' + escapeHtml(district) + "</option>",
        )
        .join("");
    if (districts.includes(current)) select.value = current;
  }

  function render() {
    const search = $("#search-input").value.trim().toLocaleLowerCase("tr-TR");
    const district = $("#district-filter").value;
    const day = $("#day-filter").value;
    const type = $("#type-filter").value;
    const sort = $("#sort-filter").value;
    let list = [...state.markets];
    if (state.view === "saved") list = list.filter((market) => state.favorites.has(idOf(market)));
    if (search) {
      list = list.filter((market) =>
        [market.ad, market.ilce, market.mahalle, market.adres, market.aciklama]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(search),
      );
    }
    if (district) list = list.filter((market) => market.ilce === district);
    if (day) {
      list = list.filter((market) => getMarketDays(market).some((value) => dayName(value) === day));
    }
    if (type === "today") {
      const today = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(new Date());
      list = list.filter((market) =>
        getMarketDays(market).some((value) => dayName(value) === today),
      );
    } else if (type) {
      list = list.filter((market) =>
        (market.etiketler || []).some((tag) => String(tag).toLocaleLowerCase("tr-TR") === type),
      );
    }
    if (sort === "rating") list.sort((a, b) => (b.ortalamaPuan || 0) - (a.ortalamaPuan || 0));
    else if (sort === "district") {
      list.sort((a, b) => (a.ilce || "").localeCompare(b.ilce || "", "tr"));
    } else list.sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
    state.filtered = list;
    const pricesView = state.view === "prices";
    const mapView = state.view === "map";
    const pageCount = Math.max(1, Math.ceil(list.length / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    $("#market-pagination").classList.toggle(
      "hidden",
      mapView || pricesView || list.length <= state.pageSize,
    );
    $("#market-map-panel").classList.toggle("hidden", !mapView);
    $("#market-grid").classList.toggle("hidden", mapView);
    $("#market-section").classList.toggle("prices-mode", pricesView);
    if (mapView) {
      $("#section-title").innerHTML =
        'Pazar haritası <span class="heading-count">' + list.length + "</span>";
      $("#section-description").textContent = "Koordinatı bulunan pazarları haritada görüntüle.";
      $("#breadcrumb-current").textContent = "Pazar haritası";
      $("#results-summary").textContent = list.length + " pazar harita görünümünde";
      $("#clear-filters").classList.remove("hidden");
      $(".filter-panel").classList.remove("hidden");
      $("#empty-state").classList.add("hidden");
      $$(".nav-item").forEach((button) =>
        button.classList.toggle("active", button.dataset.view === state.view),
      );
      const mapMarkets = state.mapMarkets || list;
      $("#section-title").innerHTML =
        'Pazar haritası <span class="heading-count">' + mapMarkets.length + "</span>";
      $("#results-summary").textContent = mapMarkets.length + " pazar harita görünümünde";
      renderMap(mapMarkets);
      return;
    }
    $("#section-title").innerHTML =
      escapeHtml(
        pricesView
          ? "Fiyat radarı"
          : state.view === "saved"
            ? "Favori pazarların"
            : "Pazarları keşfet",
      ) +
      ' <span class="heading-count" id="result-count">' +
      (pricesView ? productEntries().length : list.length) +
      "</span>";
    $("#section-description").textContent = pricesView
      ? "Tezgâhlarda paylaşılan ürün fiyatlarını incele."
      : state.view === "saved"
        ? "Kaydettiğin pazarlar burada."
        : "İstanbul’un semt pazarlarını tek ekranda keşfet.";
    $("#breadcrumb-current").textContent = pricesView
      ? "Fiyat radarı"
      : state.view === "saved"
        ? "Favorilerim"
        : "Pazarları keşfet";
    $("#results-summary").textContent = pricesView
      ? productEntries().length + " ürün fiyatı listeleniyor"
      : list.length + " pazar listeleniyor";
    $("#clear-filters").classList.toggle("hidden", pricesView);
    $("#filter-panel");
    $(".filter-panel").classList.toggle("hidden", pricesView);
    $$(".nav-item").forEach((button) =>
      button.classList.toggle("active", button.dataset.view === state.view),
    );
    $("#empty-state").classList.toggle("hidden", pricesView || list.length > 0);
    if (pricesView) {
      $("#market-grid").innerHTML = renderPrices();
      return;
    }
    const start = (state.page - 1) * state.pageSize;
    $("#market-grid").innerHTML = list
      .slice(start, start + state.pageSize)
      .map(renderMarketCard)
      .join("");
    if (!list.length) $("#market-grid").innerHTML = "";
    renderPagination(list.length);
    renderStats();
  }

  function renderPagination(total) {
    const node = $("#market-pagination");
    const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
    if (pageCount <= 1) {
      node.classList.add("hidden");
      node.innerHTML = "";
      return;
    }
    node.classList.remove("hidden");
    node.innerHTML =
      '<button class="button button-secondary pagination-button" data-page="' +
      Math.max(1, state.page - 1) +
      '"' +
      (state.page === 1 ? " disabled" : "") +
      '>← Önceki</button><span class="pagination-label">Sayfa ' +
      state.page +
      " / " +
      pageCount +
      " · " +
      total +
      ' pazar</span><button class="button button-secondary pagination-button" data-page="' +
      Math.min(pageCount, state.page + 1) +
      '"' +
      (state.page === pageCount ? " disabled" : "") +
      ">Sonraki →</button>";
  }

  function renderMarketCard(market) {
    const id = idOf(market);
    const saved = state.favorites.has(id);
    const marketDays = getMarketDays(market);
    const daysHtml = marketDays.length
      ? marketDays
          .slice(0, 3)
          .map((day) => '<span class="day-chip">' + escapeHtml(dayName(day)) + "</span>")
          .join("")
      : '<span class="day-chip muted">Gün bilgisi yok</span>';
    const rating = Number(market.ortalamaPuan || 0);
    return (
      '<article class="market-card"><div class="market-cover"><span class="cover-orbit"></span><span class="cover-illustration" aria-hidden="true">♧</span><span class="cover-label">✳ SEMT PAZARI</span><button class="favorite-button ' +
      (saved ? "saved" : "") +
      '" data-favorite="' +
      escapeHtml(id) +
      '" aria-label="' +
      (saved ? "Favorilerden çıkar" : "Favorilere ekle") +
      '" title="' +
      (saved ? "Favorilerden çıkar" : "Favorilere ekle") +
      '">' +
      (saved ? "♥" : "♡") +
      '</button></div><div class="market-body"><div class="market-meta"><span class="district-chip">' +
      escapeHtml(market.ilce || "İlçe belirtilmemiş") +
      '</span><span class="rating">★ ' +
      (rating > 0 ? rating.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "Yeni") +
      "</span></div><h3>" +
      escapeHtml(market.ad || "İsimsiz pazar") +
      '</h3><p class="market-address"><span>⌖</span>' +
      escapeHtml(getAddress(market)) +
      '</p><div class="market-divider"></div><div class="market-footer"><div class="day-list">' +
      daysHtml +
      '</div><span class="market-open"><span>●</span> ' +
      escapeHtml(market.saatler?.acilis || "08:00") +
      "–" +
      escapeHtml(market.saatler?.kapanis || "20:00") +
      '</span></div><button class="card-action" data-detail="' +
      escapeHtml(id) +
      '">Pazar detayları <span>↗</span></button></div></article>'
    );
  }

  function renderPrices() {
    const entries = productEntries();
    if (!entries.length) {
      return '<div class="loading-card"><span style="font-size:27px;color:var(--green)">₺</span><strong>Henüz ürün fiyatı paylaşılmamış</strong><p>Tezgâhlara ürün ve fiyat eklendikçe burada görüntülenecek.</p></div>';
    }
    const search = $("#search-input").value.trim().toLocaleLowerCase("tr-TR");
    const district = $("#district-filter").value;
    const filtered = entries
      .filter((item) => {
        const market = item.stall.pazar;
        const matchSearch = [
          item.isim,
          item.kategori,
          item.stall.tezgahAdi,
          market?.ad,
          market?.ilce,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(search);
        return matchSearch && (!district || market?.ilce === district);
      })
      .sort((a, b) => (a.isim || "").localeCompare(b.isim || "", "tr"));
    if (!filtered.length) {
      return '<div class="loading-card"><strong>Eşleşen fiyat bulunamadı</strong><p>Arama veya ilçe filtresini değiştirmeyi dene.</p></div>';
    }
    return (
      '<div class="prices-grid">' +
      filtered
        .map((item) => {
          const price = item.price;
          const emoji =
            { Meyve: "🍎", Sebze: "🥬", Bakliyat: "🫘", Süt: "🥛", Fırın: "🥖" }[item.kategori] ||
            "🧺";
          const correctVotes = (item.oylar || []).filter((vote) => vote.oy === "dogru").length;
          const incorrectVotes = (item.oylar || []).filter((vote) => vote.oy === "hatali").length;
          return (
            '<article class="price-card"><div class="price-row"><span class="product-emoji">' +
            emoji +
            '</span><div class="price-info"><strong>' +
            escapeHtml(item.isim || "Ürün") +
            "</strong><small>" +
            escapeHtml(item.stall.tezgahAdi || "Tezgâh") +
            (item.stall.pazar?.ad ? " · " + escapeHtml(item.stall.pazar.ad) : "") +
            '</small></div><span class="price-value">' +
            escapeHtml(formatPrice(price)) +
            "</span></div><p>" +
            escapeHtml(item.birim || "birim") +
            ' başına bildirilen fiyat · Fiyatlar esnaf paylaşımına dayanır.</p><div class="price-votes"><button type="button" data-price-vote="dogru" data-stall="' +
            escapeHtml(idOf(item.stall)) +
            '" data-product="' +
            escapeHtml(idOf(item)) +
            '">✓ Doğru (' +
            correctVotes +
            ')</button><button type="button" data-price-vote="hatali" data-stall="' +
            escapeHtml(idOf(item.stall)) +
            '" data-product="' +
            escapeHtml(idOf(item)) +
            '">! Hatalı (' +
            incorrectVotes +
            ")</button></div></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderMap(markets) {
    const status = $("#map-status");
    if (!window.L) {
      status.textContent =
        "Harita kitaplığı yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenile.";
      return;
    }
    if (!state.map) {
      state.map = L.map("market-map", { scrollWheelZoom: false }).setView([41.0082, 28.9784], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap katkıcıları",
      }).addTo(state.map);
      state.mapLayer = L.layerGroup().addTo(state.map);
    }
    state.mapLayer.clearLayers();
    const located = markets
      .map((market) => {
        const coordinates = market.location?.coordinates;
        const lat = Number(
          market.konum?.lat ?? (Array.isArray(coordinates) ? coordinates[1] : NaN),
        );
        const lng = Number(
          market.konum?.lng ?? (Array.isArray(coordinates) ? coordinates[0] : NaN),
        );
        return { market, lat, lng };
      })
      .filter(
        (item) =>
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng) &&
          item.lat >= -90 &&
          item.lat <= 90 &&
          item.lng >= -180 &&
          item.lng <= 180,
      );
    if (!located.length) {
      status.textContent =
        "Gösterilecek koordinatlı pazar yok. Yönetici pazar kayıtlarına konum eklediğinde pinler burada görünür.";
      requestAnimationFrame(() => state.map.invalidateSize());
      return;
    }
    const bounds = [];
    located.forEach(({ market, lat, lng }) => {
      const marker = L.marker([lat, lng]).bindPopup(
        "<strong>" +
          escapeHtml(market.ad || "Semt pazarı") +
          "</strong><br>" +
          escapeHtml([market.ilce, market.mahalle, market.adres].filter(Boolean).join(", ")) +
          '<br><a target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/directions?from=&to=' +
          encodeURIComponent(lat + "," + lng) +
          '">Yol tarifi al</a>',
      );
      marker.addTo(state.mapLayer);
      bounds.push([lat, lng]);
    });
    if (bounds.length === 1) state.map.setView(bounds[0], 14);
    else state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    status.textContent =
      located.length +
      " konumlu pazar haritada gösteriliyor. Konumun yalnızca senin isteğinle kullanılır.";
    requestAnimationFrame(() => state.map.invalidateSize());
  }

  function openDetail(id) {
    const market = state.markets.find((item) => idOf(item) === id);
    if (!market) return;
    const existing = $("#detail-backdrop");
    if (existing) existing.remove();
    const location =
      market.konum &&
      Number.isFinite(Number(market.konum.lat)) &&
      Number.isFinite(Number(market.konum.lng))
        ? '<a class="detail-map" href="https://www.openstreetmap.org/?mlat=' +
          encodeURIComponent(market.konum.lat) +
          "&mlon=" +
          encodeURIComponent(market.konum.lng) +
          "#map=16/" +
          encodeURIComponent(market.konum.lat) +
          "/" +
          encodeURIComponent(market.konum.lng) +
          '" target="_blank" rel="noreferrer">Haritada aç ↗</a>'
        : '<span class="detail-map">Konum koordinatı henüz eklenmemiş</span>';
    const daysText = getMarketDays(market).map(dayName).join(", ") || "Gün bilgisi eklenmemiş";
    const backdrop = document.createElement("div");
    backdrop.id = "detail-backdrop";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML =
      '<section class="modal-card detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button class="modal-close" data-detail-close aria-label="Kapat">×</button><div class="modal-brand">⌖ <span>PAZAR DETAYI</span></div><h2 id="detail-title">' +
      escapeHtml(market.ad || "Semt pazarı") +
      '</h2><p class="market-address"><span>⌖</span>' +
      escapeHtml(getAddress(market)) +
      '</p><div class="detail-row"><span>İlçe</span><strong>' +
      escapeHtml(market.ilce || "Belirtilmemiş") +
      '</strong></div><div class="detail-row"><span>Kurulduğu gün</span><strong>' +
      escapeHtml(daysText) +
      '</strong></div><div class="detail-row"><span>Saatler</span><strong>' +
      escapeHtml(market.saatler?.acilis || "08:00") +
      " – " +
      escapeHtml(market.saatler?.kapanis || "20:00") +
      '</strong></div><div class="detail-row"><span>Toplam yorum</span><strong>' +
      escapeHtml(market.toplamYorum || 0) +
      '</strong></div><p class="detail-description">' +
      escapeHtml(market.aciklama || "Bu pazar için henüz ek bir açıklama paylaşılmamış.") +
      "</p>" +
      location +
      '<button class="button button-primary full-button" data-detail-favorite="' +
      escapeHtml(id) +
      '">' +
      (state.favorites.has(id) ? "♥ Favorilerimden çıkar" : "♡ Favorilerime ekle") +
      "</button></section>";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop || event.target.closest("[data-detail-close]")) {
        backdrop.remove();
      }
    });
    $("[data-detail-favorite]", backdrop).addEventListener("click", async () => {
      await toggleFavorite(id);
      backdrop.remove();
    });
  }

  async function toggleFavorite(id) {
    if (!state.token) {
      openAuth("login");
      toast("Favorilerini kaydetmek için giriş yap.");
      return;
    }
    try {
      const result = await api("/api/pazar/" + encodeURIComponent(id) + "/favori", {
        method: "POST",
      });
      if (state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);
      $("#stat-saved").textContent = state.favorites.size;
      render();
      toast(result.message || "Favori listen güncellendi.");
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openAuth(mode = "login") {
    state.authMode = mode;
    $("#auth-message").classList.add("hidden");
    $("#modal-title").textContent = state.user
      ? "Hesabın"
      : mode === "login"
        ? "Tekrar hoş geldin"
        : "Aramıza katıl";
    $("#modal-description").textContent = state.user
      ? state.user.email || "Oturumun açık."
      : mode === "login"
        ? "Favorilerini kaydetmek ve topluluğa katılmak için giriş yap."
        : "Pazar keşiflerini kaydetmek için ücretsiz hesabını oluştur.";
    $("#auth-form").classList.toggle("hidden", !!state.user);
    $("#logout-btn").classList.toggle("hidden", !state.user);
    $$(".auth-tab").forEach((button) =>
      button.classList.toggle("active", button.dataset.authMode === mode),
    );
    $(".auth-tabs").classList.toggle("hidden", !!state.user);
    $("#username-field").classList.toggle("hidden", mode !== "register" || !!state.user);
    $("#auth-submit").innerHTML =
      (mode === "login" ? "Giriş yap" : "Hesap oluştur") + " <span>→</span>";
    $("#modal-backdrop").classList.remove("hidden");
  }
  function closeAuth() {
    $("#modal-backdrop").classList.add("hidden");
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = new FormData($("#auth-form"));
    const payload = {
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    };
    if (state.authMode === "register") payload.username = String(form.get("username") || "").trim();
    const button = $("#auth-submit");
    button.disabled = true;
    button.textContent = "İşleniyor…";
    const message = $("#auth-message");
    message.classList.add("hidden");
    try {
      const result = await api("/api/auth/" + (state.authMode === "login" ? "login" : "register"), {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (state.authMode === "register") {
        message.textContent = result.message || "Hesap oluşturuldu. Şimdi giriş yapabilirsin.";
        message.classList.remove("hidden");
        message.classList.add("success");
        $("#auth-form").reset();
        state.authMode = "login";
        $$(".auth-tab").forEach((tab) =>
          tab.classList.toggle("active", tab.dataset.authMode === "login"),
        );
        $("#username-field").classList.add("hidden");
        $("#auth-submit").innerHTML = "Giriş yap <span>→</span>";
        return;
      }
      state.token = result.token;
      state.user = result.user;
      localStorage.setItem("street-bazaars-token", state.token);
      localStorage.setItem("street-bazaars-user", JSON.stringify(state.user));
      updateAccount();
      await loadFavorites();
      render();
      closeAuth();
      toast("Giriş başarılı. Hoş geldin, " + (state.user.username || "👋") + "!");
    } catch (error) {
      message.textContent = error.message || "İşlem tamamlanamadı.";
      message.classList.remove("hidden", "success");
    } finally {
      button.disabled = false;
      button.innerHTML =
        (state.authMode === "login" ? "Giriş yap" : "Hesap oluştur") + " <span>→</span>";
    }
  }

  function updateAccount() {
    $("#account-label").textContent = state.user?.username || "Giriş yap";
    $("#account-btn").title = state.user ? "Hesap ve oturum" : "Giriş yap";
  }
  function logout() {
    state.token = "";
    state.user = null;
    state.favorites.clear();
    localStorage.removeItem("street-bazaars-token");
    localStorage.removeItem("street-bazaars-user");
    updateAccount();
    renderStats();
    render();
    closeAuth();
    toast("Oturum kapatıldı.");
  }
  function changeView(view) {
    state.view = view;
    if (view !== "map") state.mapMarkets = null;
    render();
    (view === "map" ? $("#market-map-panel") : $("#market-section")).scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    if (view === "saved" && !state.token) {
      openAuth("login");
      toast("Favori listen için giriş yap.");
    }
  }
  function applyFilters() {
    state.page = 1;
    render();
  }

  function resetFilters() {
    $("#search-input").value = "";
    $("#district-filter").value = "";
    $("#day-filter").value = "";
    $("#type-filter").value = "";
    $("#sort-filter").value = "name";
    state.page = 1;
    render();
  }

  $$(".nav-item").forEach((button) =>
    button.addEventListener("click", () => changeView(button.dataset.view)),
  );
  $$('[data-view="prices"]').forEach((button) =>
    button.addEventListener("click", () => changeView("prices")),
  );
  $("#explore-btn").addEventListener("click", () => {
    changeView("markets");
    $("#market-section").scrollIntoView({ behavior: "smooth" });
  });
  $("#banner-explore").addEventListener("click", () => {
    changeView("markets");
    $("#market-section").scrollIntoView({ behavior: "smooth" });
  });
  $("#search-input").addEventListener("input", applyFilters);
  $("#district-filter").addEventListener("change", applyFilters);
  $("#day-filter").addEventListener("change", applyFilters);
  $("#type-filter").addEventListener("change", applyFilters);
  $("#sort-filter").addEventListener("change", applyFilters);
  $("#market-pagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page) || 1;
    render();
    $("#market-section").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#clear-filters").addEventListener("click", resetFilters);
  $("#empty-reset").addEventListener("click", resetFilters);
  $("#retry-btn").addEventListener("click", loadData);
  $("#refresh-btn").addEventListener("click", loadData);
  $("#account-btn").addEventListener("click", () => openAuth("login"));
  $("#modal-close").addEventListener("click", closeAuth);
  $("#modal-backdrop").addEventListener("click", (event) => {
    if (event.target === $("#modal-backdrop")) closeAuth();
  });
  $$(".auth-tab").forEach((button) =>
    button.addEventListener("click", () => openAuth(button.dataset.authMode)),
  );
  $("#auth-form").addEventListener("submit", submitAuth);
  $("#logout-btn").addEventListener("click", logout);
  $("#market-grid").addEventListener("click", async (event) => {
    const favorite = event.target.closest("[data-favorite]");
    const detail = event.target.closest("[data-detail]");
    const vote = event.target.closest("[data-price-vote]");
    if (favorite) {
      event.stopPropagation();
      toggleFavorite(favorite.dataset.favorite);
    }
    if (detail) openDetail(detail.dataset.detail);
    if (vote) {
      if (!state.token) {
        openAuth("login");
        toast("Fiyatı doğrulamak için giriş yap.");
        return;
      }
      vote.disabled = true;
      try {
        const result = await api(
          "/api/tezgah/" +
            encodeURIComponent(vote.dataset.stall) +
            "/urun/" +
            encodeURIComponent(vote.dataset.product) +
            "/oy",
          {
            method: "POST",
            body: JSON.stringify({ oy: vote.dataset.priceVote }),
          },
        );
        toast(result.message || "Oy kaydedildi.");
        await loadData();
        changeView("prices");
      } catch (error) {
        toast(error.message || "Oy kaydedilemedi.", true);
      } finally {
        vote.disabled = false;
      }
    }
  });
  $("#map-location-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Bu tarayıcı konum özelliğini desteklemiyor.", true);
      return;
    }
    $("#map-status").textContent = "Konum izni bekleniyor…";
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await api(
            "/api/pazar/yakin?lat=" +
              encodeURIComponent(latitude) +
              "&lng=" +
              encodeURIComponent(longitude) +
              "&radius=10000",
          );
          state.mapMarkets = Array.isArray(result.data) ? result.data : [];
          state.view = "map";
          populateDistricts();
          renderStats();
          render();
          toast(state.markets.length + " yakın pazar bulundu.");
        } catch (error) {
          $("#map-status").textContent = error.message;
          toast(error.message, true);
        }
      },
      (error) => {
        const messages = {
          1: "Konum izni verilmedi.",
          2: "Konum şu anda belirlenemiyor.",
          3: "Konum isteği zaman aşımına uğradı.",
        };
        $("#map-status").textContent = messages[error.code] || "Konum alınamadı.";
        toast($("#map-status").textContent, true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
  $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("click", (event) => {
    if (
      window.innerWidth <= 900 &&
      $("#sidebar").classList.contains("open") &&
      !event.target.closest("#sidebar") &&
      !event.target.closest("#menu-toggle")
    ) {
      $("#sidebar").classList.remove("open");
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#search-input").focus();
    }
    if (event.key === "Escape") {
      closeAuth();
      $("#detail-backdrop")?.remove();
      $("#sidebar").classList.remove("open");
    }
  });
  $("#today-label").textContent = dateText();
  $("#year").textContent = new Date().getFullYear();
  updateAccount();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {}),
    );
  }
  loadData();
})();

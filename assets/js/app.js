/* ==========================================================================
   Интернет-магазин — одностраничное приложение без сборки.
   Открывается двойным кликом по index.html (работает и с file://).
   Каталог: data/catalog.json (при запуске с сервера) или data/catalog.js
   (копия того же JSON для открытия без сервера).
   ========================================================================== */
(function () {
  "use strict";

  const CFG = window.STORE_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let view = null;

  /* ---------------- Иконки ---------------- */
  const I = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 8 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.3 3.5 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12.5H6L5 8z"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M3 8h18M3 16h18"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    ret: '<svg viewBox="0 0 24 24"><path d="M4 9h11a5 5 0 010 10H8"/><path d="M8 5L4 9l4 4"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11"/><path d="M3 13h18M12 9v11M12 9c-2-4-6-4-6-1.5S9 9 12 9zm0 0c2-4 6-4 6-1.5S15 9 12 9z"/></svg>'
  };

  /* ==========================================================================
     Каталог и цены
     ========================================================================== */
  let CATALOG = null, PRODUCTS = [], BY_ID = {}, CATS = {};
  const RATE = () => CFG.USD_RUB || (CATALOG && CATALOG.meta.usdRub) || 90;

  function rub(usd) {
    if (usd == null) return null;
    const raw = usd * RATE() * (1 + (CFG.MARKUP_PERCENT || 0) / 100);
    const r = CFG.PRICE_ROUND_TO || 10;
    return Math.ceil(raw / r) * r;
  }
  const fmt = (n) => (n == null ? "" : n.toLocaleString("ru-RU").replace(/,/g, " ") + " ₽");
  const priceOf = (p) => rub(p.priceUsd);
  const oldOf = (p) => (p.oldPriceUsd ? rub(p.oldPriceUsd) : null);

  async function loadCatalog() {
    // На сервере (http/https) берём JSON напрямую; при открытии файла — data/catalog.js
    if (location.protocol.startsWith("http")) {
      try {
        const r = await fetch("data/catalog.json?v=5", { cache: "no-cache" });
        if (r.ok) return await r.json();
      } catch (e) { /* упадём на запасной вариант */ }
    }
    if (window.CATALOG_DATA) return window.CATALOG_DATA;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "data/catalog.js?v=5"; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return window.CATALOG_DATA;
  }

  function indexCatalog(data) {
    CATALOG = data;
    PRODUCTS = data.products.filter((p) => p.colors && p.colors.length && p.colors[0].images.length);
    PRODUCTS.forEach((p, i) => {
      BY_ID[p.id] = p;
      p._i = i;
      p._sizes = Array.from(new Set(p.colors.flatMap((c) => c.sizes.map((s) => sizeFilterKey(s.n)))));
      p._fam = Array.from(new Set(p.colors.map((c) => c.family).filter(Boolean)));
      p._search = [p.brandName, p.line, p.name, p.nameRu, CATS[p.category]?.title, p.colors.map((c) => c.name + " " + (FAMILIES[c.family]?.ru || "")).join(" ")]
        .join(" ").toLowerCase();
    });
  }

  const FAMILIES = {
    black: { ru: "Чёрный", hex: "#1b1a18" }, white: { ru: "Белый", hex: "#fbfaf6" }, beige: { ru: "Бежевый", hex: "#d9c7ad" },
    brown: { ru: "Коричневый", hex: "#7a5a43" }, grey: { ru: "Серый", hex: "#9b9a97" }, blue: { ru: "Синий", hex: "#3d5579" },
    green: { ru: "Зелёный", hex: "#5d6e53" }, red: { ru: "Красный", hex: "#a3302c" }, pink: { ru: "Розовый", hex: "#e4b3ba" },
    purple: { ru: "Фиолетовый", hex: "#6f557e" }, yellow: { ru: "Жёлтый", hex: "#e2c862" }, orange: { ru: "Оранжевый", hex: "#d27a43" },
    metallic: { ru: "Металлик", hex: "linear-gradient(135deg,#d9d6cf,#9e998f,#e9e6df)" }, print: { ru: "Принт", hex: "conic-gradient(#1b1a18 0 25%,#d9c7ad 0 50%,#7a5a43 0 75%,#fbfaf6 0)" },
    clear: { ru: "Без цвета", hex: "#f0ece5" }
  };
  const swatchBg = (fam, hex) => hex || (FAMILIES[fam] ? FAMILIES[fam].hex : "#ccc");

  /* Таблицы размеров (ориентировочные соответствия) */
  const SIZE_CHARTS = {
    "zara-alpha": {
      title: "Одежда Zara", note: "Размеры на сайте — американские буквенные, как у бренда. Обхваты в сантиметрах.",
      head: ["Размер", "RU", "EU", "Грудь", "Талия", "Бёдра"],
      rows: [["XXS", "38–40", "32", "78", "58", "86"], ["XS", "42", "34", "82", "62", "90"], ["S", "44", "36", "86", "66", "94"], ["M", "46", "38", "90", "70", "98"], ["L", "48", "40", "96", "76", "104"], ["XL", "50", "42", "102", "82", "110"], ["XXL", "52", "44", "108", "88", "116"]]
    },
    "zara-num": {
      title: "Брюки и джинсы Zara", note: "Цифровые размеры — американская шкала (US), как на сайте бренда.",
      head: ["US", "EU", "RU", "Талия", "Бёдра"],
      rows: [["00", "32", "38", "58", "86"], ["0", "32", "40", "60", "88"], ["2", "34", "42", "62", "90"], ["4", "36", "44", "66", "94"], ["6", "38", "46", "70", "98"], ["8", "40", "48", "76", "104"], ["10", "42", "50", "82", "110"], ["12", "44", "52", "88", "116"], ["14", "46", "54", "94", "122"]]
    },
    "vs-bra": {
      title: "Бюстгальтеры Victoria's Secret", note: "Американская маркировка: цифра — обхват под грудью в дюймах, буква — полнота чашки. Обхваты в сантиметрах.",
      head: ["US", "RU / EU", "Под грудью", "Грудь (для B)"],
      rows: [["30", "65", "63–67", "80–82"], ["32", "70", "68–72", "85–87"], ["34", "75", "73–77", "90–92"], ["36", "80", "78–82", "95–97"], ["38", "85", "83–87", "100–102"], ["40", "90", "88–92", "105–107"]],
      extra: { head: ["Чашка US", "RU / EU"], rows: [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["DD (E)", "E"], ["DDD (F)", "F"], ["G", "G"]] }
    },
    "vs-alpha": {
      title: "Бельё, пижамы и одежда Victoria's Secret", note: "Американские буквенные размеры. Обхваты в сантиметрах.",
      head: ["US", "RU", "Грудь", "Талия", "Бёдра"],
      rows: [["XS", "40–42", "80–84", "60–64", "86–90"], ["S", "42–44", "84–88", "64–68", "90–94"], ["M", "46", "88–94", "68–74", "94–100"], ["L", "48–50", "94–102", "74–82", "100–108"], ["XL", "52", "102–110", "82–90", "108–116"], ["XXL", "54", "110–118", "90–98", "116–124"]]
    }
  };

  /* Размер для фильтра: без длины (Regular/Short/Long) и без пометки DD */
  function sizeFilterKey(s) {
    return String(s).replace(/\s*(Regular|Short|Long|Petite|Tall)$/i, "").replace(/\s+DD$/, "").replace(/\s*\(US \d+\)/, "").trim();
  }
  function sizeGroup(s) {
    if (/^\d{2}[A-Z]/.test(s)) return "Бюстгальтеры";
    if (/^\d{2}$/.test(s)) return "Джинсы (талия, дюймы)";
    if (/^(XXS|XS|S|M|L|XL|XXL|XXXL)(\/(XS|S|M|L|XL|XXL))?$|^(XS|S|M|L|XL)-(S|M|L|XL|XXL)$/i.test(s)) return "Одежда и бельё";
    return "Другое";
  }
  const SIZE_ORDER = ["XXS", "XS", "XS-S", "S", "S-M", "M", "M-L", "L", "L-XL", "XL", "XXL", "XXXL", "1X", "2X", "3X"];
  function sizeKey(s) {
    const a = SIZE_ORDER.indexOf(String(s).toUpperCase().split("/")[0].trim());
    if (a >= 0) return [0, a, 0];
    const m = String(s).match(/^(\d{2})\s*([A-Z]+)/i);
    if (m) return [2, +m[1], m[2].length * 10 + m[2].charCodeAt(0)];
    const n = parseFloat(s);
    if (!isNaN(n)) return [1, n, 0];
    return [3, 0, String(s).charCodeAt(0)];
  }
  const sortSizes = (arr) => arr.slice().sort((a, b) => { const x = sizeKey(a), y = sizeKey(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });

  /* ==========================================================================
     Хранилище: корзина и избранное (данные карты здесь НЕ хранятся никогда)
     ========================================================================== */
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("shop:" + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("shop:" + k, JSON.stringify(v)); } catch (e) {} }
  };
  let cart = store.get("cart", []);
  let favs = store.get("favs", []);
  let checkoutDraft = store.get("checkout", {});
  const saveCart = () => { store.set("cart", cart); updateBadges(); };
  const saveFavs = () => { store.set("favs", favs); updateBadges(); };

  function cartLines() {
    return cart.map((l) => {
      const p = BY_ID[l.pid]; if (!p) return null;
      const c = p.colors[l.ci] || p.colors[0];
      return { ...l, p, c, price: priceOf(p), sum: priceOf(p) * l.qty };
    }).filter(Boolean);
  }
  const cartCount = () => cart.reduce((a, l) => a + l.qty, 0);
  const cartTotal = () => cartLines().reduce((a, l) => a + l.sum, 0);

  function addToCart(pid, ci, size) {
    const ex = cart.find((l) => l.pid === pid && l.ci === ci && l.size === size);
    if (ex) ex.qty = Math.min(ex.qty + 1, 9); else cart.push({ pid, ci, size, qty: 1 });
    saveCart();
    const b = $("#bagBadge"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    const bb = $("#bagBtn"); bb.classList.remove("wiggle"); void bb.offsetWidth; setTimeout(() => bb.classList.add("wiggle"), 650);
  }
  function toggleFav(pid) {
    const i = favs.indexOf(pid);
    if (i >= 0) favs.splice(i, 1); else favs.unshift(pid);
    saveFavs();
    $$(`[data-fav="${pid}"]`).forEach((el) => { el.classList.toggle("on", favs.includes(pid)); el.classList.remove("pop"); void el.offsetWidth; if (favs.includes(pid)) el.classList.add("pop"); });
    const fb = $("#favBadge"); fb.classList.remove("bump"); void fb.offsetWidth; fb.classList.add("bump");
    return favs.includes(pid);
  }
  function updateBadges() {
    const n = cartCount(), f = favs.length;
    const b = $("#bagBadge"), fb = $("#favBadge");
    b.textContent = n; b.classList.toggle("on", n > 0);
    fb.textContent = f; fb.classList.toggle("on", f > 0);
  }

  /* ==========================================================================
     Общие UI-компоненты
     ========================================================================== */
  function img(src, alt, cls = "", eager = false) {
    return `<img src="${esc(src)}" alt="${esc(alt)}" class="${cls}" ${eager ? "" : 'loading="lazy"'} decoding="async" onload="this.classList.add('loaded')">`;
  }

  function card(p, opts = {}) {
    const c = p.colors[0];
    const price = priceOf(p), old = oldOf(p);
    const sizes = sortSizes(c.sizes.map((s) => s.n));
    const avail = new Set(c.sizes.filter((s) => s.a).map((s) => s.n));
    const tag = old ? "Sale" : p.isNew ? "New" : "";
    const sw = p.colors.slice(0, 5).map((cc) => `<i style="background:${swatchBg(cc.family, cc.hex)}"></i>`).join("");
    return `<div class="card reveal" style="--d:${opts.d || 0}s">
      <a href="#/p/${encodeURIComponent(p.id)}" class="ph" aria-label="${esc(p.name)}">
        ${img(c.images[0], p.name, "main")}
        ${c.images[1] ? img(c.images[1], "", "alt") : ""}
        ${tag ? `<span class="tag">${tag}</span>` : ""}
      </a>
      <button class="fav ${favs.includes(p.id) ? "on" : ""}" data-fav="${esc(p.id)}" aria-label="В избранное">${I.heart}</button>
      ${sizes.length > 1 ? `<div class="quick"><div class="q-t">Быстро в корзину</div><div class="q-s">${sizes.slice(0, 12).map((s) => `<button data-quick="${esc(p.id)}" data-size="${esc(s)}" class="${avail.has(s) ? "" : "na"}">${esc(s)}</button>`).join("")}</div></div>` : ""}
      <a href="#/p/${encodeURIComponent(p.id)}" class="meta">
        <span class="brand">${esc(p.brandName)}${p.line && p.brand === "vs" ? " · " + esc(p.line) : ""}</span>
        <span class="name">${esc(p.nameRu || p.name)}</span>
        <span class="price">${fmt(price)}${old ? ` <s>${fmt(old)}</s>` : ""}</span>
        ${p.colors.length > 1 ? `<span class="sw">${sw}${p.colors.length > 5 ? `<span>+${p.colors.length - 5}</span>` : ""}</span>` : ""}
      </a>
    </div>`;
  }

  /* Фото с CDN бренда не загрузилось — убираем слайд, оставляя локальные */
  window.dropSlide = (im) => {
    const sl = im.closest(".slide"), tr = sl && sl.parentElement;
    if (!tr || tr.children.length <= 1) return;
    sl.remove();
    const dots = $("#gallery .dots"); if (dots && dots.lastElementChild) dots.lastElementChild.remove();
    const cnt = $("#gallery .counter"); if (cnt) cnt.innerHTML = `<span id="gCur">1</span> / ${tr.children.length}`;
  };

  /* Мягкий параллакс крупных фото */
  let pxTick = false;
  function parallax() {
    if (pxTick || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pxTick = true;
    requestAnimationFrame(() => {
      pxTick = false;
      const vh = innerHeight;
      $$("[data-px]").forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const k = parseFloat(el.dataset.px) || 0.06;
        el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -k).toFixed(1)}px, 0) scale(1.14)`;
      });
    });
  }

  /* Появление при скролле */
  let io;
  function observeReveal(root = document) {
    if (!io) io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    $$(".reveal:not(.in), .reveal-img:not(.in)", root).forEach((el) => io.observe(el));
  }

  let toastT;
  function toast(html) {
    const t = $("#toast"); t.innerHTML = html; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* Анимация «улетает в корзину» */
  function flyToBag(fromEl) {
    const target = $("#bagBtn"); if (!fromEl || !target) return;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!a.width) return;
    const f = document.createElement("img");
    f.src = fromEl.currentSrc || fromEl.src; f.className = "fly";
    Object.assign(f.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const s = 28 / a.width;
      f.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) scale(${s})`;
      f.style.opacity = ".2"; f.style.borderRadius = "50%";
    }));
    setTimeout(() => f.remove(), 900);
  }

  /* Панели */
  function openDrawer(id) {
    const d = $("#" + id);
    $$(".menu-list a, .menu-sub a, .f-group, .line-item", d).forEach((el, i) => { el.style.setProperty("--si", Math.min(i, 12)); el.classList.remove("stag"); void el.offsetWidth; el.classList.add("stag"); });
    d.classList.add("open"); document.body.classList.add("lock");
  }
  function closeDrawer(id) { $("#" + id).classList.remove("open"); if (!$(".drawer.open, .modal.open, .search-layer.open")) document.body.classList.remove("lock"); }
  function openModal(html) {
    const m = $("#modal"); $(".box-inner", m).innerHTML = html; m.classList.add("open"); document.body.classList.add("lock");
  }
  function closeModal() { $("#modal").classList.remove("open"); if (!$(".drawer.open, .search-layer.open")) document.body.classList.remove("lock"); }

  /* ==========================================================================
     Роутер
     ========================================================================== */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    return { parts, q };
  }
  const go = (h) => { location.hash = h; };

  let navId = 0, prevHash = null, restoreShown = 0;
  const scrollMem = {};
  async function route() {
    const id = ++navId;
    if (prevHash != null && prevHash.startsWith("#/catalog") && catState) scrollMem[prevHash] = { y: scrollY, shown: catState.shown };
    // переход между страницами: короткое затухание старой
    const old = view.firstElementChild;
    if (old && !old.classList.contains("page-out")) {
      old.classList.add("page-out");
      $("#topProgress")?.classList.add("run");
      await new Promise((r) => setTimeout(r, 240));
    }
    if (id !== navId) return; // пользователь уже ушёл дальше
    const { parts, q } = parseHash();
    const [a, b] = parts;
    const fromProduct = (prevHash || "").startsWith("#/p/");
    const mem = fromProduct ? scrollMem[location.hash] : null;
    restoreShown = mem ? mem.shown : 0;
    if (AFTER.leave) AFTER.leave();
    closeDrawer("menu"); closeDrawer("bag"); closeDrawer("filters"); closeModal(); closeSearch();
    document.body.classList.remove("has-mobile-buy");
    $("#lookCursor")?.classList.remove("on");
    $("#mobileBuy")?.remove();
    window.scrollTo(0, 0);
    let html;
    switch (a) {
      case undefined: case "": html = pageHome(); break;
      case "catalog": html = pageCatalog(q); break;
      case "p": html = pageProduct(b, q); break;
      case "favorites": html = pageFavs(); break;
      case "checkout": html = pageCheckout(); break;
      case "pay": html = pagePay(); break;
      case "success": html = pageSuccess(); break;
      case "about": case "delivery": case "returns": case "contacts": html = pageInfo(a); break;
      default: html = pageNotFound();
    }
    view.innerHTML = `<div class="page">${html}</div>`;
    $$(".nav-desk a").forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#/" + (a || "") + (a === "catalog" && q.group ? "?group=" + q.group : "")));
    const after = AFTER[a || "home"]; if (after) after(parts, q);
    observeReveal(view);
    if (mem) window.scrollTo(0, mem.y);
    prevHash = location.hash;
    $("#topProgress")?.classList.remove("run");
    document.title = (TITLES[a] ? TITLES[a] + " — " : "") + CFG.STORE_NAME;
  }
  const TITLES = { catalog: "Каталог", favorites: "Избранное", checkout: "Оформление заказа", pay: "Оплата", success: "Заказ оформлен", about: "О магазине", delivery: "Доставка и оплата", returns: "Возврат", contacts: "Контакты" };
  const AFTER = {};

  /* ==========================================================================
     Главная «Небо»: парящая витрина, вращающийся товар при прокрутке,
     два мира брендов, созвездие категорий, частые вопросы
     ========================================================================== */
  function pick(filterFn, n, used) {
    const out = [];
    for (const p of PRODUCTS) {
      if (out.length >= n) break;
      if (used.has(p.id) || !filterFn(p)) continue;
      used.add(p.id); out.push(p);
    }
    return out;
  }
  const byBrand = (b, ...cats) => (p) => p.brand === b && (!cats.length || cats.includes(p.category));
  const pimg = (p, i = 0) => p.colors[0].images[i] || p.colors[0].images[0];

  const STEPS = [
    { word: "ОРИГИНАЛ", t: "Только <em>оригинал</em>", d: "Привозим вещи из официальных магазинов Zara и Victoria's Secret. С бирками, в фирменной упаковке.", f: byBrand("zara", "coats") },
    { word: "СЕГОДНЯ", t: "Курьер <em>в день заказа</em>", d: () => `По ${esc(CFG.CITY === "Симферополь" ? "Симферополю" : CFG.CITY)} — в день заказа или на следующий. Бесплатно от ${fmt(CFG.DELIVERY[0].freeFrom)}.`, f: byBrand("vs", "sleep") },
    { word: "КРЫМ", t: "Весь <em>Крым</em>", d: "Курьер и СДЭК: Севастополь, Ялта, Евпатория, Феодосия, Керчь — за 1–4 дня.", f: byBrand("zara", "dresses") },
    { word: "ПРИМЕРКА", t: "Сначала <em>примерка</em>", d: "Примерьте в шоуруме или при курьере. Не подошло — вернём деньги.", f: byBrand("vs", "lingerie") },
    { word: "ПРОСТО", t: "Оплата <em>как удобно</em>", d: "Картой онлайн — Мир, Visa, Mastercard — или при получении.", f: byBrand("vs", "fragrance") }
  ];
  const STEP_ICONS = ["✦", "☀", "◐", "♡", "₽"];

  const FAQ = [
    ["Это оригинальные вещи?", "Да. Мы покупаем вещи в официальных магазинах и на сайтах брендов и привозим их в Крым. Каждая вещь приходит с бирками."],
    ["Как формируется цена?", "Берём цену бренда, переводим в рубли по курсу и добавляем стоимость доставки и нашей работы. Итоговая цена указана на сайте, без доплат."],
    ["Сколько ждать доставку?", "По Симферополю привезём в день заказа или на следующий день, по Крыму — за 1–4 дня."],
    ["Можно примерить?", "Да: в шоуруме или при курьере по Симферополю. Бельё и косметику по закону вернуть нельзя, поэтому их размеры лучше уточнить по таблице."],
    ["Как оплатить?", "Картой онлайн на сайте или при получении — наличными или картой курьеру."],
    ["Как вернуть вещь?", "Одежду без следов носки и с бирками можно вернуть в течение 14 дней. Подробности — на странице «Возврат»."]
  ];

  /* Созвездие: координаты звёзд (в процентах) и связи */
  const STARS = [
    { cat: "dresses", x: 12, y: 30 }, { cat: "coats", x: 26, y: 18 }, { cat: "knit", x: 34, y: 44 }, { cat: "jeans", x: 20, y: 66 },
    { cat: "bras", x: 50, y: 26 }, { cat: "lingerie", x: 62, y: 46 }, { cat: "sleep", x: 74, y: 22 }, { cat: "fragrance", x: 86, y: 40 },
    { cat: "bodycare", x: 80, y: 70 }, { cat: "skirts", x: 44, y: 74 }, { cat: "beauty", x: 64, y: 78 }
  ];
  const LINKS = [[0, 1], [1, 2], [2, 0], [2, 3], [2, 4], [4, 5], [4, 6], [6, 7], [7, 5], [7, 8], [5, 10], [3, 9], [9, 10]];

  function pageHome() {
    const used = new Set();
    // витрина-дуга: чередуем бренды
    const zs = pick(byBrand("zara", "dresses", "coats", "knit", "blazers", "sets"), 6, used);
    const vs = pick(byBrand("vs", "lingerie", "sleep", "bras", "fragrance"), 5, used);
    const arc = []; for (let i = 0; arc.length < 11 && (zs[i] || vs[i]); i++) { if (vs[i]) arc.push(vs[i]); if (zs[i]) arc.push(zs[i]); }
    const steps = STEPS.map((s) => ({ ...s, p: pick(s.f, 1, used)[0] })).filter((s) => s.p);
    const zw = pick(byBrand("zara", "coats", "dresses", "knit"), 3, used);
    const vw = pick(byBrand("vs", "sleep", "lingerie", "bras"), 3, used);
    const fresh = PRODUCTS.filter((p) => p.isNew && !used.has(p.id));
    const mixed = []; const fz = fresh.filter((p) => p.brand === "zara"), fv = fresh.filter((p) => p.brand === "vs");
    for (let i = 0; mixed.length < 12 && (i < fz.length || i < fv.length); i++) { if (fz[i]) mixed.push(fz[i]); if (fv[i]) mixed.push(fv[i]); }
    const finale = pick(byBrand("vs", "fragrance"), 1, used)[0] || arc[0];

    const stars = STARS.filter((s) => CATS[s.cat] && PRODUCTS.some((p) => p.category === s.cat)).map((s) => {
      const p = PRODUCTS.find((x) => x.category === s.cat && !used.has(x.id)) || PRODUCTS.find((x) => x.category === s.cat);
      const n = PRODUCTS.filter((x) => x.category === s.cat).length;
      return { ...s, p, n };
    });
    const idx = Object.fromEntries(stars.map((s, i) => [s.cat, i]));

    return `
    <section class="sky-hero" id="skyHero">
      <div class="sh-cone" aria-hidden="true"></div>
      <div class="sh-lamp" aria-hidden="true"></div>
      <div class="sh-title">
        <div class="eyebrow">Zara · Victoria's Secret · ${esc(CFG.CITY)}</div>
        <h1><span class="sh-l"><span>Два бренда.</span></span><span class="sh-l"><span><em>Одно небо.</em></span></span></h1>
      </div>
      <div class="arc" id="arc">
        ${arc.map((p, i) => `<a class="cap" href="#/p/${encodeURIComponent(p.id)}" data-i="${i}" aria-label="${esc(p.nameRu || p.name)}"><span class="cap-in">${img(pimg(p), p.name, "", i < 7)}<i class="gloss"></i></span></a>`).join("")}
      </div>
      <div class="sh-floor" aria-hidden="true"></div>
      <div class="sh-pick">
        <button class="sh-arr" data-arc="-1" aria-label="Предыдущий товар">‹</button>
        <div class="sh-name" id="arcName"></div>
        <button class="sh-arr" data-arc="1" aria-label="Следующий товар">›</button>
      </div>
      <a class="sh-scroll" href="#story" data-scroll="story"><span></span>Листайте</a>
    </section>

    ${steps.length ? `<section class="story" id="story" style="--n:${steps.length}">
      <div class="story-pin">
        <div class="story-bg"></div>
        <div class="story-words" aria-hidden="true">${steps.map((s, i) => `<span data-w="${i}">${s.word}</span>`).join("")}</div>
        <div class="story-obj" id="storyObj">${steps.map((s, i) => `<a href="#/p/${encodeURIComponent(s.p.id)}" class="story-can" data-c="${i}">${img(pimg(s.p), s.p.name, "", i === 0)}<i class="gloss"></i></a>`).join("")}</div>
        <div class="story-text">${steps.map((s, i) => `<div class="st" data-t="${i}">
            <div class="st-bar"><i></i></div>
            <div class="eyebrow">0${i + 1} / 0${steps.length}</div>
            <h2>${s.t}</h2>
            <p>${typeof s.d === "function" ? s.d() : s.d}</p>
            <a class="st-prod" href="#/p/${encodeURIComponent(s.p.id)}"><b>${esc(s.p.brandName)}</b> ${esc(s.p.nameRu || s.p.name)} · ${fmt(priceOf(s.p))}</a>
          </div>`).join("")}</div>
        <nav class="story-dots" aria-label="Разделы">${steps.map((s, i) => `<button data-dot="${i}" aria-label="${s.t.replace(/<[^>]*>/g, "")}"><span>${STEP_ICONS[i] || "•"}</span></button>`).join("")}</nav>
      </div>
    </section>` : ""}

    <section class="worlds">
      <a class="world world--zara" href="#/catalog?brand=zara">
        <div class="frame reveal">
          <div class="frame-in">${zw.map((p, i) => img(pimg(p), p.name, "fz fz" + i)).join("")}</div>
          <i class="orn tl"></i><i class="orn tr"></i><i class="orn bl"></i><i class="orn br"></i>
        </div>
        <div class="w-copy reveal" style="--d:.1s">
          <div class="eyebrow">Одежда · ${PRODUCTS.filter((p) => p.brand === "zara").length} вещей</div>
          <h2>Пальто, шёлк<br>и трикотаж. <em>Zara.</em></h2>
          <p>Строгая шерсть, платья для вечера и мягкий трикотаж — то, в чём выходят из дома.</p>
          <span class="pill">Смотреть Zara</span>
        </div>
      </a>
      <a class="world world--vs" href="#/catalog?brand=vs">
        <div class="clouds" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="w-copy reveal">
          <div class="eyebrow">Бельё · Пижамы · Ароматы · ${PRODUCTS.filter((p) => p.brand === "vs").length} вещей</div>
          <h2>То, что <em>под ней.</em><br>Victoria's Secret.</h2>
          <p>Кружево, сатиновые пижамы, ароматы и уход — для себя.</p>
          <span class="pill pill--light">Смотреть VS</span>
        </div>
        <div class="arch reveal" style="--d:.15s">${vw.map((p, i) => img(pimg(p), p.name, "fa fa" + i)).join("")}</div>
      </a>
    </section>

    <section class="stars-sec" id="stars">
      <div class="stars-bg" aria-hidden="true">${Array.from({ length: 70 }, (_, i) => `<i style="left:${(i * 37.3) % 100}%;top:${(i * 61.7) % 100}%;--d:${(i % 9) * 0.4}s;--s:${1 + (i % 3)}px"></i>`).join("")}</div>
      <div class="stars-head reveal"><div class="eyebrow">${PRODUCTS.length} вещей · ${stars.length} созвездий</div><h2>Найдите свою <em>звезду</em></h2></div>
      <div class="constel">
        <svg class="c-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${LINKS.filter(([a, b]) => stars[a] && stars[b]).map(([a, b]) => `<line x1="${stars[a].x}" y1="${stars[a].y}" x2="${stars[b].x}" y2="${stars[b].y}" pathLength="1"/>`).join("")}</svg>
        ${stars.map((s, i) => `<a class="star" href="#/catalog?cat=${s.cat}" style="left:${s.x}%;top:${s.y}%;--d:${(i * 0.12).toFixed(2)}s">
          <i class="dot"></i><span class="lbl">${esc(CATS[s.cat].title)} <small>${s.n}</small></span>
          ${s.p ? `<span class="peek">${img(pimg(s.p), s.p.name)}<span>${esc(s.p.brandName)} · ${fmt(priceOf(s.p))}</span></span>` : ""}
        </a>`).join("")}
      </div>
      <div class="stars-list">${stars.map((s) => `<a class="chip chip--sky" href="#/catalog?cat=${s.cat}">✦ ${esc(CATS[s.cat].title)}</a>`).join("")}</div>
    </section>

    ${mixed.length ? `<section class="section">
      <div class="section-head reveal"><div><div class="eyebrow">Только что приехало</div><h2 class="h-2">Новинки</h2></div><a href="#/catalog?sort=new" class="link">Все</a></div>
      <div class="rail">${mixed.map((p, i) => card(p, { d: (i % 4) * 0.06 })).join("")}</div>
    </section>` : ""}

    <section class="faq-sec">
      <h2 class="faq-title reveal">Частые<br>вопросы</h2>
      <div class="faq">${FAQ.map(([q, a], i) => `<details class="reveal" style="--d:${i * 0.05}s"><summary>${esc(q)}<i></i></summary><p>${esc(a)}</p></details>`).join("")}</div>
    </section>

    <section class="finale">
      <div class="clouds" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <a class="finale-can" href="#/p/${encodeURIComponent(finale.id)}">${img(pimg(finale), finale.name)}<i class="gloss"></i></a>
      <div class="finale-copy reveal"><h2>Всё небо — <em>в каталоге</em></h2><a class="pill" href="#/catalog">Открыть каталог · ${PRODUCTS.length}</a></div>
    </section>`;
  }

  let homeCleanup = null;
  AFTER.home = () => {
    if (homeCleanup) homeCleanup();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.classList.add("is-home");

    /* --- Витрина-дуга --- */
    const arcEl = $("#arc"), caps = $$(".cap", arcEl), nameEl = $("#arcName");
    let cur = Math.floor(caps.length / 2), mx = 0, my = 0;
    const products = caps.map((c) => BY_ID[decodeURIComponent(c.getAttribute("href").split("/p/")[1])]);
    function layout() {
      const n = caps.length, w = innerWidth, mob = w < 700;
      const step = mob ? 26 : 13.5; // градусы между банками на дуге
      caps.forEach((c, i) => {
        let k = i - cur; if (k > n / 2) k -= n; if (k < -n / 2) k += n;
        const a = k * step * Math.PI / 180;
        const R = mob ? w * 0.95 : Math.min(w * 0.95, 1300);
        const x = Math.sin(a) * R, y = (1 - Math.cos(a)) * R * 0.55;
        const s = k === 0 ? 1.18 : Math.max(0.55, 0.92 - Math.abs(k) * 0.06);
        const rot = k * (mob ? 9 : 6) + (k % 2 ? 8 : -6);
        c.style.setProperty("--x", `${(x + mx * (1 + Math.abs(k)) * 4).toFixed(1)}px`);
        c.style.setProperty("--y", `${(y + my * 6).toFixed(1)}px`);
        c.style.setProperty("--s", s.toFixed(3));
        c.style.setProperty("--r", `${k === 0 ? -4 : rot}deg`);
        c.style.zIndex = 50 - Math.abs(k);
        c.style.opacity = Math.abs(k) > (mob ? 2 : 5) ? 0 : 1;
        c.classList.toggle("on", k === 0);
        c.style.setProperty("--bob", `${(i * 0.37) % 2.4}s`);
      });
      const p = products[cur];
      if (p) nameEl.innerHTML = `<span class="b">${esc(p.brandName)}</span><b>${esc(p.nameRu || p.name)}</b><span class="pr">${fmt(priceOf(p))}</span>`;
    }
    layout();
    const shift = (d) => { cur = (cur + d + caps.length) % caps.length; nameEl.classList.remove("swap"); void nameEl.offsetWidth; nameEl.classList.add("swap"); layout(); };
    caps.forEach((c, i) => c.addEventListener("click", (e) => { if (i !== cur) { e.preventDefault(); shift(i - cur); } }));
    $$("[data-arc]").forEach((b) => b.addEventListener("click", () => shift(+b.dataset.arc)));
    let auto = reduce ? null : setInterval(() => { if (scrollY < innerHeight * 0.6 && !document.hidden) shift(1); }, 3600);
    const hero = $("#skyHero");
    const onMove = (e) => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; layout(); };
    if (matchMedia("(hover: hover)").matches && !reduce) hero.addEventListener("mousemove", onMove);
    let tx = 0;
    hero.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener("touchend", (e) => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 40) shift(d < 0 ? 1 : -1); }, { passive: true });
    addEventListener("resize", layout);

    /* --- История с вращающимся товаром --- */
    const story = $("#story");
    const cans = $$(".story-can"), texts = $$(".st"), words = $$("[data-w]"), dots = $$("[data-dot]");
    let lastI = -1, raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!story) return;
        const r = story.getBoundingClientRect(), total = r.height - innerHeight;
        const prog = Math.min(1, Math.max(0, -r.top / total));
        const n = cans.length, f = prog * n, i = Math.min(n - 1, Math.floor(f)), local = f - i;
        // объект вращается и «дышит» всё время прокрутки
        const obj = $("#storyObj");
        const rot = -22 + prog * 44 + Math.sin(f * Math.PI) * 8;
        const sc = 0.9 + Math.sin(prog * Math.PI) * 0.22;
        const ty = Math.sin(f * Math.PI * 2) * 14;
        obj.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        words.forEach((w, k) => { w.style.transform = `translateX(${((k === i ? local : k < i ? 1 : 0) * -30 + 15).toFixed(1)}vw)`; });
        texts.forEach((t, k) => t.style.setProperty("--p", k === i ? local : k < i ? 1 : 0));
        if (i !== lastI) {
          lastI = i;
          cans.forEach((c, k) => c.classList.toggle("on", k === i));
          texts.forEach((t, k) => t.classList.toggle("on", k === i));
          words.forEach((w, k) => w.classList.toggle("on", k === i));
          dots.forEach((d, k) => d.classList.toggle("on", k === i));
        }
      });
    }
    dots.forEach((d) => d.addEventListener("click", () => {
      const r = story.getBoundingClientRect(), total = r.height - innerHeight;
      window.scrollTo({ top: scrollY + r.top + total * ((+d.dataset.dot + 0.35) / cans.length), behavior: "smooth" });
    }));
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* --- Созвездие: линии прорисовываются при появлении --- */
    const st = $("#stars");
    const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { st.classList.add("lit"); so.disconnect(); } }), { threshold: 0.25 });
    so.observe(st);

    homeCleanup = () => {
      clearInterval(auto); auto = null;
      removeEventListener("scroll", onScroll); removeEventListener("resize", layout);
      so.disconnect(); document.body.classList.remove("is-home"); homeCleanup = null;
    };
  };
  AFTER.leave = () => { if (homeCleanup) homeCleanup(); };
  /* ==========================================================================
     Каталог
     ========================================================================== */
  const PAGE_SIZE = 24;
  let catState = null;

  function readFilters(q) {
    const arr = (v) => (v ? v.split(",").filter(Boolean) : []);
    return {
      brand: arr(q.brand), cat: arr(q.cat), group: q.group || "", size: arr(q.size), color: arr(q.color),
      min: q.min ? +q.min : null, max: q.max ? +q.max : null, sort: q.sort || "rec", q: q.q || "", ids: arr(q.ids), title: q.title || "", sale: q.sale === "1"
    };
  }
  function filtersToHash(f) {
    const q = new URLSearchParams();
    if (f.ids.length) q.set("ids", f.ids.join(","));
    if (f.title) q.set("title", f.title);
    if (f.group) q.set("group", f.group);
    if (f.brand.length) q.set("brand", f.brand.join(","));
    if (f.cat.length) q.set("cat", f.cat.join(","));
    if (f.size.length) q.set("size", f.size.join(","));
    if (f.color.length) q.set("color", f.color.join(","));
    if (f.min != null) q.set("min", f.min);
    if (f.max != null) q.set("max", f.max);
    if (f.sort !== "rec") q.set("sort", f.sort);
    if (f.q) q.set("q", f.q);
    if (f.sale) q.set("sale", "1");
    const s = q.toString();
    return "#/catalog" + (s ? "?" + s : "");
  }

  function applyFilters(f, except) {
    let list = f.ids.length ? f.ids.map((id) => BY_ID[id]).filter(Boolean) : PRODUCTS;
    const words = f.q ? expandQuery(f.q.toLowerCase()) : [];
    return list.filter((p) => {
      if (f.group && CATS[p.category]?.group !== f.group) return false;
      if (except !== "brand" && f.brand.length && !f.brand.includes(p.brand)) return false;
      if (except !== "cat" && f.cat.length && !f.cat.includes(p.category)) return false;
      if (except !== "size" && f.size.length && !p._sizes.some((s) => f.size.includes(s))) return false;
      if (except !== "color" && f.color.length && !p._fam.some((c) => f.color.includes(c))) return false;
      if (except !== "price") { const pr = priceOf(p); if (f.min != null && pr < f.min) return false; if (f.max != null && pr > f.max) return false; }
      if (f.sale && !p.oldPriceUsd) return false;
      if (words.length && !words.every((alts) => alts.some((w) => p._search.includes(w)))) return false;
      return true;
    });
  }
  function sortList(list, sort) {
    const l = list.slice();
    if (sort === "price-asc") l.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sort === "price-desc") l.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "new") l.sort((a, b) => (b.isNew - a.isNew) || a._i - b._i);
    else if (sort === "rec") {
      // рекомендованный порядок: бренды чередуются, как в бутике
      const z = l.filter((p) => p.brand === "zara"), v = l.filter((p) => p.brand === "vs"); const out = [];
      for (let i = 0; i < Math.max(z.length, v.length); i++) { if (z[i]) out.push(z[i]); if (v[i]) out.push(v[i]); }
      return out;
    }
    return l;
  }

  function pageCatalog(q) {
    const f = readFilters(q);
    const list = sortList(applyFilters(f), f.sort);
    catState = { f, list, shown: Math.min(Math.max(PAGE_SIZE, restoreShown), list.length) };
    let title = "Весь каталог", eyebrow = `${esc(CFG.STORE_NAME)} · Zara + Victoria's Secret`;
    if (f.title) { title = esc(f.title.replace(/<[^>]*>/g, "")); eyebrow = "Образ из лукбука"; }
    else if (f.q) { title = `«${esc(f.q)}»`; eyebrow = "Поиск"; }
    else if (f.cat.length === 1) { title = esc(CATS[f.cat[0]]?.title || ""); eyebrow = CATS[f.cat[0]]?.groupTitle || ""; }
    else if (f.group) { title = esc(GROUPS[f.group] || ""); }
    else if (f.brand.length === 1) title = f.brand[0] === "zara" ? "Zara" : "Victoria's Secret";
    else if (f.sale) title = "Sale";

    const catsHere = CATALOG.categories.filter((c) => (!f.group || c.group === f.group) && PRODUCTS.some((p) => p.category === c.id && (!f.brand.length || f.brand.includes(p.brand))));
    const nFilters = f.brand.length + f.cat.length + f.size.length + f.color.length + (f.min != null || f.max != null ? 1 : 0);

    const chips = [
      ...f.brand.map((b) => [`brand`, b, b === "zara" ? "Zara" : "Victoria's Secret"]),
      ...f.cat.map((c) => ["cat", c, CATS[c]?.title]),
      ...f.size.map((s) => ["size", s, "Размер " + s]),
      ...f.color.map((c) => ["color", c, FAMILIES[c]?.ru]),
      ...(f.min != null || f.max != null ? [["price", "", `${f.min != null ? "от " + fmt(f.min) : ""} ${f.max != null ? "до " + fmt(f.max) : ""}`]] : []),
      ...(f.q ? [["q", "", "Поиск: " + f.q]] : [])
    ];

    return `
    <section class="cat-hero">
      <div class="eyebrow">${eyebrow}</div>
      <h1 class="h-1">${title}</h1>
    </section>
    ${f.ids.length ? "" : `<div class="cat-tabs">
      <a class="chip ${!f.cat.length ? "on" : ""}" href="${filtersToHash({ ...f, cat: [], title: "" })}">Все</a>
      ${catsHere.map((c) => `<a class="chip ${f.cat.length === 1 && f.cat[0] === c.id ? "on" : ""}" href="${filtersToHash({ ...f, cat: [c.id] })}">${esc(c.title)}</a>`).join("")}
    </div>`}
    <div class="toolbar">
      <button class="tb-btn" id="openFilters">${I.filter} Фильтры ${nFilters ? `<i>${nFilters}</i>` : ""}</button>
      <span class="count">${list.length} ${plural(list.length, "товар", "товара", "товаров")}</span>
      <select id="sortSel" aria-label="Сортировка">
        ${[["rec", "Рекомендуем"], ["new", "Сначала новинки"], ["price-asc", "Цена ↑"], ["price-desc", "Цена ↓"]].map(([v, t]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>
    ${chips.length ? `<div class="active-filters">${chips.map(([k, v, t]) => `<button class="chip" data-unset="${k}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}<button class="chip" data-unset="all" style="border-color:transparent">Сбросить всё</button></div>` : ""}
    ${list.length ? `<div class="grid" id="grid">${list.slice(0, catState.shown).map((p, i) => card(p, { d: (i % 4) * 0.05 })).join("")}</div>
      <div class="more-wrap" id="moreWrap">${moreHTML()}</div>`
      : `<div class="empty"><h2 class="h-2">Ничего не нашлось</h2><p class="muted">Попробуйте убрать часть фильтров или изменить запрос.</p><a href="#/catalog" class="btn btn--ghost" style="margin-top:18px">Весь каталог</a></div>`}`;
  }
  function moreHTML() {
    const { list, shown } = catState;
    if (shown >= list.length) return list.length > PAGE_SIZE ? `<span class="muted" style="font-size:12px">Вы посмотрели всё — ${list.length} из ${list.length}</span>` : "";
    return `<div class="progress"><i style="width:${(shown / list.length) * 100}%"></i></div>
      <div class="muted" style="font-size:12px;margin-bottom:18px">Показано ${shown} из ${list.length}</div>
      <button class="btn btn--ghost" id="moreBtn">Показать ещё</button>`;
  }
  AFTER.catalog = () => {
    $("#sortSel")?.addEventListener("change", (e) => go(filtersToHash({ ...catState.f, sort: e.target.value })));
    $("#openFilters")?.addEventListener("click", () => { renderFilters(); openDrawer("filters"); });
    // бесконечная подгрузка + кнопка
    const more = () => {
      if (!catState || catState.shown >= catState.list.length) return;
      const from = catState.shown; catState.shown = Math.min(from + PAGE_SIZE, catState.list.length);
      $("#grid").insertAdjacentHTML("beforeend", catState.list.slice(from, catState.shown).map((p, i) => card(p, { d: (i % 4) * 0.05 })).join(""));
      $("#moreWrap").innerHTML = moreHTML(); observeReveal($("#grid"));
    };
    $("#moreWrap")?.addEventListener("click", (e) => { if (e.target.closest("#moreBtn")) more(); });
    const sentinel = $("#moreWrap");
    if (sentinel) new IntersectionObserver((ents) => { if (ents[0].isIntersecting && catState.shown < catState.list.length && catState.shown < PAGE_SIZE * 3) more(); }, { rootMargin: "400px" }).observe(sentinel);
  };
  const GROUPS = { clothes: "Одежда", lingerie: "Бельё", sleep: "Пижамы и дом", beauty: "Красота и ароматы" };

  function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; }

  /* Панель фильтров (живой подсчёт результатов) */
  let draft = null;
  function renderFilters() {
    draft = JSON.parse(JSON.stringify(catState.f));
    paintFilters(true);
  }
  function paintFilters(first) {
    const f = draft;
    const opened = first ? new Set(["brand", "cat"]) : new Set($$("#filters .f-group.open").map((g) => g.dataset.g));
    const base = (except) => applyFilters(f, except);
    const cnt = (list, fn) => list.filter(fn).length;
    const bList = base("brand"), cList = base("cat"), sList = base("size"), colList = base("color"), pList = base("price");
    const cats = CATALOG.categories.filter((c) => (!f.group || c.group === f.group)).map((c) => [c, cnt(cList, (p) => p.category === c.id)]).filter(([c, n]) => n || f.cat.includes(c.id));
    const allSizes = sortSizes(Array.from(new Set(sList.flatMap((p) => p._sizes))));
    const fams = Object.keys(FAMILIES).map((k) => [k, cnt(colList, (p) => p._fam.includes(k))]).filter(([k, n]) => n || f.color.includes(k));
    const prices = pList.map(priceOf); const pMin = prices.length ? Math.floor(Math.min(...prices) / 100) * 100 : 0; const pMax = prices.length ? Math.ceil(Math.max(...prices) / 100) * 100 : 0;
    const lo = f.min ?? pMin, hi = f.max ?? pMax;
    const grp = (id, title, body) => `<div class="f-group ${opened.has(id) ? "open" : ""}" data-g="${id}"><button type="button">${title}</button><div class="f-opts"><div class="f-inner"><div class="f-pad">${body}</div></div></div></div>`;
    const total = applyFilters(f).length;

    $("#filtersBody").innerHTML =
      grp("brand", "Бренд", [["zara", "Zara"], ["vs", "Victoria's Secret"]].map(([k, t]) => `<label class="f-check"><input type="checkbox" data-f="brand" value="${k}" ${f.brand.includes(k) ? "checked" : ""}><span class="bx"></span>${t}<small>${cnt(bList, (p) => p.brand === k)}</small></label>`).join("")) +
      grp("cat", "Категория", cats.map(([c, n]) => `<label class="f-check"><input type="checkbox" data-f="cat" value="${c.id}" ${f.cat.includes(c.id) ? "checked" : ""}><span class="bx"></span>${esc(c.title)}<small>${n}</small></label>`).join("")) +
      grp("size", "Размер", allSizes.length ? ["Одежда и бельё", "Джинсы (талия, дюймы)", "Бюстгальтеры", "Другое"].map((g) => { const ss = allSizes.filter((s) => sizeGroup(s) === g); return ss.length ? `<div class="f-sub">${g}</div>` + ss.map((s) => `<button type="button" class="f-size ${f.size.includes(s) ? "on" : ""}" data-f="size" data-v="${esc(s)}">${esc(s)}</button>`).join("") : ""; }).join("") : '<span class="muted">Нет размеров</span>') +
      grp("color", "Цвет", fams.map(([k, n]) => `<button type="button" class="f-color ${f.color.includes(k) ? "on" : ""}" data-f="color" data-v="${k}"><i style="background:${FAMILIES[k].hex}"></i>${FAMILIES[k].ru} <span class="muted">${n}</span></button>`).join("")) +
      grp("price", "Цена", `<div class="price-range">
        <div class="vals"><label>от <input type="number" inputmode="numeric" id="pMin" value="${lo}" min="${pMin}" max="${pMax}"></label><label>до <input type="number" inputmode="numeric" id="pMax" value="${hi}" min="${pMin}" max="${pMax}"></label></div>
        <div class="dual"><div class="track"><i style="left:${pMax > pMin ? ((lo - pMin) / (pMax - pMin)) * 100 : 0}%;right:${pMax > pMin ? 100 - ((hi - pMin) / (pMax - pMin)) * 100 : 0}%"></i></div>
        <input type="range" id="rMin" min="${pMin}" max="${pMax}" step="100" value="${lo}"><input type="range" id="rMax" min="${pMin}" max="${pMax}" step="100" value="${hi}"></div>
      </div>`) +
      `<div class="f-group"><label class="f-check" style="padding:20px 0"><input type="checkbox" id="fSale" ${f.sale ? "checked" : ""}><span class="bx"></span>Только со скидкой</label></div>`;
    $("#filtersApply").textContent = total ? `Показать ${total}` : "Нет товаров";
    $("#filtersApply").disabled = !total;
    draft._pMin = pMin; draft._pMax = pMax;
  }
  function filtersEvents() {
    const body = $("#filtersBody");
    body.addEventListener("click", (e) => {
      const g = e.target.closest(".f-group > button"); if (g) { g.parentElement.classList.toggle("open"); return; }
      const b = e.target.closest("button[data-f]"); if (b) { const k = b.dataset.f, v = b.dataset.v; draft[k] = draft[k].includes(v) ? draft[k].filter((x) => x !== v) : [...draft[k], v]; paintFilters(); }
    });
    body.addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.f) { const k = t.dataset.f; draft[k] = t.checked ? [...draft[k], t.value] : draft[k].filter((x) => x !== t.value); paintFilters(); }
      if (t.id === "fSale") { draft.sale = t.checked; paintFilters(); }
      if (t.id === "pMin" || t.id === "pMax" || t.id === "rMin" || t.id === "rMax") {
        let lo = +($("#" + (t.id[0] === "r" ? "rMin" : "pMin")).value), hi = +($("#" + (t.id[0] === "r" ? "rMax" : "pMax")).value);
        if (lo > hi) [lo, hi] = [hi, lo];
        draft.min = lo > draft._pMin ? lo : null; draft.max = hi < draft._pMax ? hi : null; paintFilters();
      }
    });
    body.addEventListener("input", (e) => {
      if (e.target.id === "rMin" || e.target.id === "rMax") {
        const lo = +$("#rMin").value, hi = +$("#rMax").value;
        $("#pMin").value = Math.min(lo, hi); $("#pMax").value = Math.max(lo, hi);
        const span = draft._pMax - draft._pMin || 1;
        const tr = $(".dual .track i"); tr.style.left = ((Math.min(lo, hi) - draft._pMin) / span) * 100 + "%"; tr.style.right = 100 - ((Math.max(lo, hi) - draft._pMin) / span) * 100 + "%";
      }
    });
    $("#filtersApply").addEventListener("click", () => { const d = { ...draft }; delete d._pMin; delete d._pMax; closeDrawer("filters"); go(filtersToHash(d)); });
    $("#filtersReset").addEventListener("click", () => { draft = { ...draft, brand: [], cat: [], size: [], color: [], min: null, max: null, sale: false }; paintFilters(); });
  }

  /* ==========================================================================
     Страница товара
     ========================================================================== */
  let pdp = null;
  function pageProduct(id, q) {
    const p = BY_ID[id];
    if (!p) return pageNotFound();
    const ci = Math.min(+q.c || 0, p.colors.length - 1);
    pdp = { p, ci, size: null };
    const cat = CATS[p.category];
    const related = PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 8);
    const pairs = PRODUCTS.filter((x) => x.brand !== p.brand && CATS[x.category]?.group !== "beauty").filter((_, i) => (i + p._i) % 7 === 0).slice(0, 8);
    return `
    <div class="pdp">
      <div class="gallery" id="gallery"></div>
      <div class="pdp-info">
        <div class="crumbs"><a href="#/catalog">Каталог</a><span>/</span><a href="#/catalog?cat=${p.category}">${esc(cat?.title || "")}</a></div>
        <div class="brand">${esc(p.brandName)}${p.line && p.brand === "vs" ? " · " + esc(p.line) : ""}</div>
        <h1>${esc(p.nameRu || p.name)}</h1>
        <div class="price">${fmt(priceOf(p))}${oldOf(p) ? ` <s>${fmt(oldOf(p))}</s>` : ""}</div>
        <div id="pdpOptions"></div>
        <div class="pdp-actions">
          <button class="btn" id="addBtn"><span class="lbl">Добавить в корзину</span></button>
          <button class="fav-btn ${favs.includes(p.id) ? "on" : ""}" data-fav="${esc(p.id)}" aria-label="В избранное">${I.heart}</button>
        </div>
        <div class="perks">
          <div>${I.truck}<span>Курьер по Симферополю — сегодня или завтра, по Крыму — 1–4 дня</span></div>
          <div>${I.ret}<span>Возврат в течение 14 дней</span></div>
          <div>${I.gift}<span>Оригинал из официального магазина ${esc(p.brandName)}</span></div>
        </div>
        <div class="acc">
          ${p.description ? `<details open><summary>Описание</summary><div class="acc-body">${esc(p.description)}</div></details>` : ""}
          ${p.composition ? `<details><summary>Состав и уход</summary><div class="acc-body">${esc(p.composition)}</div></details>` : ""}
          <details><summary>Доставка и возврат</summary><div class="acc-body">${CFG.DELIVERY.map((d) => `${d.title} — ${d.price ? fmt(d.price) : "бесплатно"}${d.freeFrom ? ` (бесплатно от ${fmt(d.freeFrom)})` : ""}`).join("\n")}\n\nВозврат — 14 дней с момента получения, если вещь не была в носке и сохранены бирки. Бельё и косметика надлежащего качества возврату не подлежат.</div></details>
          <details><summary>Артикул</summary><div class="acc-body">${esc(p.ref || p.id)}${p.source ? `\nСтраница бренда: ${esc(p.source)}` : ""}</div></details>
        </div>
      </div>
    </div>
    ${pairs.length ? `<section class="section"><div class="section-head reveal"><div><div class="eyebrow">Из другого бренда</div><h2 class="h-2">Соберите образ</h2></div></div><div class="rail">${pairs.map((x) => card(x)).join("")}</div></section>` : ""}
    ${related.length ? `<section class="section"><div class="section-head reveal"><div><div class="eyebrow">${esc(cat?.title || "")}</div><h2 class="h-2">Похожие</h2></div><a class="link" href="#/catalog?cat=${p.category}">Все</a></div><div class="rail">${related.map((x) => card(x)).join("")}</div></section>` : ""}`;
  }
  function paintGallery() {
    const { p, ci } = pdp; const c = p.colors[ci];
    $("#gallery").innerHTML = `<div class="track" id="gTrack">${c.images.map((src, i) => `<div class="slide" data-zoom="${esc(src)}">${img(src, p.name + " — фото " + (i + 1), "", i < 2).replace("<img ", '<img onerror="dropSlide(this)" ')}</div>`).join("")}</div>
      ${c.images.length > 1 ? `<div class="dots">${c.images.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div><div class="counter"><span id="gCur">1</span> / ${c.images.length}</div>` : ""}`;
    const tr = $("#gTrack");
    tr.addEventListener("scroll", () => {
      const i = Math.round(tr.scrollLeft / tr.clientWidth);
      $$("#gallery .dots i").forEach((d, k) => d.classList.toggle("on", k === i));
      const cur = $("#gCur"); if (cur) cur.textContent = i + 1;
    }, { passive: true });
  }
  function paintOptions() {
    const { p, ci, size } = pdp; const c = p.colors[ci];
    const sizes = sortSizes(c.sizes.map((s) => s.n));
    const avail = new Set(c.sizes.filter((s) => s.a).map((s) => s.n));
    const oneSize = sizes.length <= 1;
    if (oneSize && sizes.length === 1 && avail.has(sizes[0])) pdp.size = sizes[0];
    const chart = SIZE_CHARTS[p.sizeChart];
    $("#pdpOptions").innerHTML = `
      <div class="opt-t">Цвет <span>${esc(c.name)}${c.family && FAMILIES[c.family] ? " · " + FAMILIES[c.family].ru.toLowerCase() : ""}</span></div>
      <div class="colors">${p.colors.map((cc, i) => cc.images[0]
        ? `<button class="${i === ci ? "on" : ""}" data-ci="${i}" title="${esc(cc.name)}">${img(cc.images[0], cc.name)}</button>`
        : `<button class="dotc ${i === ci ? "on" : ""}" data-ci="${i}" title="${esc(cc.name)}"><i style="background:${swatchBg(cc.family, cc.hex)}"></i></button>`).join("")}</div>
      ${oneSize ? `<div class="opt-t">Размер <span>${esc(sizes[0] || "Единый")}</span></div>` : `
      <div class="opt-t">Размер ${chart ? `<button id="sizeChartBtn">Таблица размеров</button>` : ""}</div>
      <div class="sizes" id="sizes">${sizes.map((s) => `<button class="${avail.has(s) ? "" : "na"} ${size === s ? "on" : ""}" data-size="${esc(s)}" ${avail.has(s) ? "" : 'aria-disabled="true" title="Нет в наличии"'}>${esc(s)}</button>`).join("")}</div>`}
      <div class="size-hint" id="sizeHint"></div>`;
    const mb = $("#mobileBuy");
    if (mb) $(".mb-p small", mb).textContent = pdp.size ? "Размер " + pdp.size : (oneSize ? "" : "Выберите размер");
  }
  AFTER.p = () => {
    if (!pdp || !BY_ID[pdp.p.id]) return;
    paintGallery(); paintOptions();
    const p = pdp.p;
    // липкая кнопка покупки на телефоне
    document.body.insertAdjacentHTML("beforeend", `<div class="mobile-buy" id="mobileBuy"><div class="mb-p">${fmt(priceOf(p))}<small></small></div><button class="btn" id="mbAdd">В корзину</button></div>`);
    document.body.classList.add("has-mobile-buy");
    paintOptions();
    const addBtn = $("#addBtn");
    new IntersectionObserver((e) => $("#mobileBuy")?.classList.toggle("show", !e[0].isIntersecting)).observe(addBtn);

    $(".pdp-info").addEventListener("click", (e) => {
      const cb = e.target.closest("[data-ci]");
      if (cb) {
        pdp.ci = +cb.dataset.ci;
        const sizes = new Set(p.colors[pdp.ci].sizes.filter((s) => s.a).map((s) => s.n));
        if (!sizes.has(pdp.size)) pdp.size = null;
        history.replaceState(null, "", `#/p/${encodeURIComponent(p.id)}?c=${pdp.ci}`);
        const g = $("#gallery"); g.style.opacity = 0; g.style.transition = "opacity .25s";
        setTimeout(() => { paintGallery(); g.style.opacity = 1; }, 200);
        paintOptions(); return;
      }
      const sb = e.target.closest("#sizes [data-size]");
      if (sb && !sb.classList.contains("na")) { pdp.size = sb.dataset.size; paintOptions(); return; }
      if (e.target.closest("#sizeChartBtn")) showSizeChart(p.sizeChart);
    });
    const doAdd = () => {
      const c = p.colors[pdp.ci];
      const needSize = c.sizes.length > 1;
      if (needSize && !pdp.size) {
        const s = $("#sizes"); s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake");
        $("#sizeHint").textContent = "Выберите размер";
        if (window.innerWidth < 1024) s.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const size = pdp.size || (c.sizes[0] ? c.sizes[0].n : "Единый");
      addToCart(p.id, pdp.ci, size);
      flyToBag($("#gallery .slide img"));
      addBtn.classList.add("added"); $(".lbl", addBtn).textContent = "Добавлено ✓";
      setTimeout(() => { addBtn.classList.remove("added"); $(".lbl", addBtn).textContent = "Добавить в корзину"; }, 1800);
      toast(`Добавлено в корзину · ${esc(size)} <a href="javascript:void 0" data-open-bag>Открыть</a>`);
    };
    addBtn.addEventListener("click", doAdd);
    $("#mbAdd").addEventListener("click", doAdd);
    $("#gallery").addEventListener("click", (e) => {
      const s = e.target.closest("[data-zoom]"); if (!s) return;
      const z = $("#zoom"); z.innerHTML = $$("#gallery .slide").map((x) => `<img src="${esc(x.dataset.zoom)}" alt="">`).join(""); z.classList.add("open"); document.body.classList.add("lock");
      const idx = $$("#gallery .slide").indexOf(s); setTimeout(() => z.children[idx]?.scrollIntoView(), 30);
    });
  };
  function showSizeChart(key) {
    const ch = SIZE_CHARTS[key]; if (!ch) return;
    const tbl = (h, rows) => `<div class="table-scroll"><table class="size-table"><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    openModal(`<div class="eyebrow">Таблица размеров</div><h2 class="h-2" style="margin:8px 0 6px">${ch.title}</h2><p class="muted" style="font-size:13px">${ch.note}</p>
      ${tbl(ch.head, ch.rows)}${ch.extra ? tbl(ch.extra.head, ch.extra.rows) : ""}
      <p class="muted" style="font-size:12px;margin-top:18px">Сомневаетесь в размере? Напишите нам — подскажем по замерам конкретной модели. ${esc(CFG.PHONE)}</p>`);
  }

  /* ==========================================================================
     Избранное
     ========================================================================== */
  function pageFavs() {
    const list = favs.map((id) => BY_ID[id]).filter(Boolean);
    return `<section class="cat-hero"><div class="eyebrow">Сохранённое</div><h1 class="h-1">Избранное</h1></section>
      ${list.length ? `<div class="toolbar"><span class="count">${list.length} ${plural(list.length, "вещь", "вещи", "вещей")}</span><span></span><a class="link" href="#/catalog">В каталог</a></div><div class="grid">${list.map((p, i) => card(p, { d: (i % 4) * 0.05 })).join("")}</div>`
        : `<div class="empty"><h2 class="h-2">Здесь пока пусто</h2><p class="muted">Нажмите ♡ на понравившейся вещи — она появится здесь.</p><a class="btn" href="#/catalog" style="margin-top:20px">Смотреть каталог</a></div>`}`;
  }

  /* ==========================================================================
     Корзина (выезжающая панель)
     ========================================================================== */
  function renderBag() {
    const lines = cartLines();
    const total = cartTotal();
    const free = CFG.DELIVERY[0].freeFrom;
    $("#bagCount").textContent = cartCount() ? `(${cartCount()})` : "";
    $("#bagItems").innerHTML = lines.length ? lines.map((l, i) => `
      <div class="line-item" data-i="${i}">
        <a href="#/p/${encodeURIComponent(l.p.id)}?c=${l.ci}" class="ph">${img(l.c.images[0], l.p.name)}</a>
        <div class="li-t">
          <span class="brand">${esc(l.p.brandName)}</span>
          <a href="#/p/${encodeURIComponent(l.p.id)}?c=${l.ci}" class="nm">${esc(l.p.nameRu || l.p.name)}</a>
          <span class="vr">${esc(l.c.name)} · ${esc(l.size)}</span>
          <span>${fmt(l.price)}</span>
          <div class="li-b">
            <div class="qty"><button data-q="-1" aria-label="Меньше">−</button><span>${l.qty}</span><button data-q="1" aria-label="Больше">+</button></div>
            <button class="rm" data-rm>Удалить</button>
          </div>
        </div>
      </div>`).join("")
      : `<div class="bag-empty"><h2 class="h-2">Корзина пуста</h2><p class="muted">Начните с лукбука или загляните в новинки.</p><a href="#/catalog" class="btn" style="margin-top:18px">В каталог</a></div>`;
    $("#bagFoot").style.display = lines.length ? "" : "none";
    if (lines.length) {
      const left = free ? Math.max(0, free - total) : 0;
      $("#bagFoot").innerHTML = `
        ${free ? `<div class="free-ship">${left ? `До бесплатной доставки по Симферополю — ${fmt(left)}` : "Доставка по Симферополю — бесплатно"}<div class="bar"><i style="width:${Math.min(100, (total / free) * 100)}%"></i></div></div>` : ""}
        <div class="row total"><span>Итого</span><span data-count="${total}">${fmt(lastBagTotal)}</span></div>
        <a href="#/checkout" class="btn btn--block">Оформить заказ</a>
        <button class="btn btn--ghost btn--block" style="margin-top:8px" data-close="bag">Продолжить покупки</button>`;
      countUp();
    } else lastBagTotal = 0;
  }
  let lastBagTotal = 0;
  function countUp() {
    const el = $("#bagFoot [data-count]"); if (!el) return;
    const to = +el.dataset.count, from = lastBagTotal, t0 = performance.now(), dur = 600;
    lastBagTotal = to;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round((from + (to - from) * e) / 10) * 10); if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to); };
    requestAnimationFrame(step);
  }
  function bagEvents() {
    $("#bagItems").addEventListener("click", (e) => {
      const li = e.target.closest(".line-item"); if (!li) return;
      const i = +li.dataset.i;
      const q = e.target.closest("[data-q]");
      if (q) {
        cart[i].qty = Math.max(1, Math.min(9, cart[i].qty + +q.dataset.q)); saveCart(); renderBag();
        $$("#bagItems .line-item").forEach((x) => (x.style.animation = "none"));
        const sp = $(`#bagItems .line-item[data-i="${i}"] .qty span`); if (sp) sp.classList.add("flip");
      }
      if (e.target.closest("[data-rm]") && !li.classList.contains("removing")) { li.classList.add("removing"); setTimeout(() => { cart.splice(i, 1); saveCart(); renderBag(); }, 380); }
    });
  }

  /* ==========================================================================
     Оформление заказа
     ========================================================================== */
  function deliveryCost(id, total) {
    const d = CFG.DELIVERY.find((x) => x.id === id) || CFG.DELIVERY[0];
    return d.freeFrom != null && total >= d.freeFrom ? 0 : d.price;
  }
  function pageCheckout() {
    const lines = cartLines();
    if (!lines.length) return `<div class="empty"><h2 class="h-2">Корзина пуста</h2><p class="muted">Добавьте товары, чтобы оформить заказ.</p><a href="#/catalog" class="btn" style="margin-top:18px">В каталог</a></div>`;
    const d = checkoutDraft;
    const del = d.delivery || CFG.DELIVERY[0].id, pay = d.payment || "card";
    const total = cartTotal();
    const field = (id, label, type = "text", attrs = "", err = "Заполните поле") => `<label class="field"><input id="${id}" name="${id}" type="${type}" placeholder=" " value="${esc(d[id] || "")}" ${attrs}><label for="${id}">${label}</label><div class="err">${err}</div></label>`;
    return `
    <section class="cat-hero"><div class="eyebrow">Шаг 1 из 2</div><h1 class="h-1">Оформление</h1></section>
    <div class="checkout">
      <form class="co-main" id="coForm" novalidate autocomplete="on">
        <div class="co-step"><h2 class="h-3"><i>01</i>Получатель</h2>
          ${field("name", "Имя и фамилия", "text", 'autocomplete="name" required')}
          ${field("phone", "Телефон", "tel", 'autocomplete="tel" inputmode="tel" required', "Введите номер в формате +7 (978) 123-45-67")}
          ${field("email", "E-mail (необязательно)", "email", 'autocomplete="email"', "Проверьте адрес почты")}
        </div>
        <div class="co-step"><h2 class="h-3"><i>02</i>Доставка</h2>
          ${CFG.DELIVERY.map((x) => { const c = deliveryCost(x.id, total); return `<label class="choice"><input type="radio" name="delivery" value="${x.id}" ${x.id === del ? "checked" : ""}><span class="dot"></span><span class="t"><b>${x.title}</b><small>${x.note}${x.freeFrom && c ? ` · бесплатно от ${fmt(x.freeFrom)}` : ""}</small></span><span class="p">${c ? fmt(c) : "Бесплатно"}</span></label>`; }).join("")}
          <div class="addr-wrap" id="addrWrap" style="padding-top:18px">
            ${field("city", "Город / населённый пункт", "text", 'autocomplete="address-level2"')}
            ${field("address", "Улица, дом, квартира или пункт СДЭК", "text", 'autocomplete="street-address"')}
            <label class="field"><textarea id="comment" placeholder=" ">${esc(d.comment || "")}</textarea><label for="comment">Комментарий курьеру (необязательно)</label></label>
          </div>
        </div>
        <div class="co-step"><h2 class="h-3"><i>03</i>Оплата</h2>
          ${CFG.PAYMENT_METHODS.map((x) => `<label class="choice"><input type="radio" name="payment" value="${x.id}" ${x.id === pay ? "checked" : ""}><span class="dot"></span><span class="t"><b>${x.title}</b><small>${x.note}</small></span></label>`).join("")}
        </div>
        <button class="btn btn--block" style="margin-top:28px;height:58px" id="coSubmit">Продолжить</button>
        <p class="consent">Нажимая «Продолжить», вы соглашаетесь на обработку персональных данных для доставки заказа.</p>
      </form>
      <aside class="co-side" id="coSide"></aside>
    </div>`;
  }
  function paintSummary() {
    const lines = cartLines(), total = cartTotal();
    const del = $('input[name=delivery]:checked')?.value || CFG.DELIVERY[0].id;
    const dc = deliveryCost(del, total);
    $("#coSide").innerHTML = `
      <details ${window.innerWidth >= 1024 ? "open" : ""}><summary><span>Ваш заказ · ${cartCount()} ${plural(cartCount(), "вещь", "вещи", "вещей")}</span><b>${fmt(total + dc)}</b></summary>
        <div style="margin-top:12px">${lines.map((l) => `<div class="co-mini">${img(l.c.images[0], "")}<div>${esc(l.p.nameRu || l.p.name)}<small>${esc(l.p.brandName)} · ${esc(l.c.name)} · ${esc(l.size)} · ${l.qty} шт.</small></div><span>${fmt(l.sum)}</span></div>`).join("")}</div>
      </details>
      <div class="co-sum" style="margin-top:14px">
        <div class="row"><span>Товары</span><span>${fmt(total)}</span></div>
        <div class="row"><span>Доставка</span><span>${dc ? fmt(dc) : "Бесплатно"}</span></div>
        <div class="row total"><span>К оплате</span><span>${fmt(total + dc)}</span></div>
      </div>`;
  }
  function phoneMask(v) {
    let d;
    const i = v.indexOf("+7");
    if (i >= 0) d = "7" + (v.slice(0, i) + v.slice(i + 2)).replace(/\D/g, "");
    else {
      d = v.replace(/\D/g, "");
      if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
      if (!(d.length === 11 && d.startsWith("7"))) d = "7" + d;
    }
    d = d.slice(0, 11);
    const p = ["+7"];
    if (d.length > 1) p.push(" (" + d.slice(1, 4));
    if (d.length >= 4) p[1] += ")";
    if (d.length > 4) p.push(" " + d.slice(4, 7));
    if (d.length > 7) p.push("-" + d.slice(7, 9));
    if (d.length > 9) p.push("-" + d.slice(9, 11));
    return p.join("");
  }
  AFTER.checkout = () => {
    const form = $("#coForm"); if (!form) return;
    const sync = () => {
      const del = CFG.DELIVERY.find((x) => x.id === $('input[name=delivery]:checked').value);
      $("#addrWrap").classList.toggle("hidden", !del.needsAddress);
      if (del.id === "courier-simf" && !$("#city").value) $("#city").value = CFG.CITY;
      paintSummary();
      $("#coSubmit").textContent = $('input[name=payment]:checked').value === "card" ? "Перейти к оплате" : "Подтвердить заказ";
    };
    const save = () => {
      const data = Object.fromEntries(new FormData(form).entries());
      checkoutDraft = { ...data, comment: $("#comment").value };
      store.set("checkout", checkoutDraft); // только контакты и адрес — без каких-либо платёжных данных
    };
    form.addEventListener("change", () => { sync(); save(); });
    form.addEventListener("input", (e) => { if (e.target.id === "phone") e.target.value = phoneMask(e.target.value); e.target.closest(".field")?.classList.remove("invalid"); save(); });
    $("#phone").addEventListener("focus", (e) => { const el = e.target; if (!el.value) el.value = "+7 ("; setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0); });
    sync();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      const bad = (id) => { $("#" + id).closest(".field").classList.add("invalid"); ok = false; };
      if ($("#name").value.trim().length < 2) bad("name");
      if ($("#phone").value.replace(/\D/g, "").length !== 11) bad("phone");
      const em = $("#email").value.trim(); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) bad("email");
      const del = CFG.DELIVERY.find((x) => x.id === $('input[name=delivery]:checked').value);
      if (del.needsAddress) { if ($("#city").value.trim().length < 2) bad("city"); if ($("#address").value.trim().length < 4) bad("address"); }
      if (!ok) { $(".field.invalid input")?.focus(); return; }
      save();
      const total = cartTotal(), dc = deliveryCost(del.id, total);
      const order = {
        id: "Z" + String(Date.now()).slice(-7), createdAt: new Date().toISOString(),
        items: cartLines().map((l) => ({ id: l.p.id, brand: l.p.brandName, name: l.p.name, color: l.c.name, size: l.size, qty: l.qty, price: l.price })),
        subtotal: total, delivery: { id: del.id, title: del.title, cost: dc }, amount: total + dc, currency: "RUB",
        customer: { name: $("#name").value.trim(), phone: $("#phone").value, email: em }, address: del.needsAddress ? `${$("#city").value.trim()}, ${$("#address").value.trim()}` : CFG.ADDRESS,
        comment: $("#comment").value.trim(), payment: $('input[name=payment]:checked').value, status: "new"
      };
      store.set("pendingOrder", order);
      if (order.payment === "card") go("#/pay");
      else finishOrder(order, null);
    });
  };

  /* ==========================================================================
     Оплата картой
     ========================================================================== */
  function pagePay() {
    const order = store.get("pendingOrder", null);
    if (!order || !cart.length) return `<div class="empty"><h2 class="h-2">Нет заказа для оплаты</h2><a href="#/catalog" class="btn" style="margin-top:18px">В каталог</a></div>`;
    return `
    <section class="pay"><div class="pay-box">
      <a href="#/checkout" class="eyebrow" style="display:inline-block;margin-bottom:18px">← Назад к заказу</a>
      <div class="pay-head"><div><div class="eyebrow">Заказ № ${esc(order.id)}</div><div class="amt">${fmt(order.amount)}</div></div><span class="secure">${I.lock} Защищённое соединение</span></div>
      <div class="card3d" id="card3d">
        <div class="inner">
          <div class="face front">
            <div class="row1"><span class="chip-ic"></span><span class="brand-logo" id="cBrand"></span></div>
            <div class="num" id="cNum"></div>
            <div class="row2"><div class="holder"><small>Держатель</small><span id="cHolder">IVAN IVANOV</span></div><div><small>Срок</small><span id="cExp">ММ/ГГ</span></div></div>
          </div>
          <div class="face back"><div class="stripe"></div><div class="cvc-strip"><span id="cCvc">•••</span></div><small>CVC / CVV</small></div>
        </div>
      </div>
      <form class="pay-form" id="payForm" novalidate autocomplete="off">
        <label class="field"><input id="pNum" inputmode="numeric" placeholder=" " maxlength="23" autocomplete="off" data-lpignore="true"><label for="pNum">Номер карты</label><span class="brand-ic" id="pBrand"></span><div class="err">Проверьте номер карты</div></label>
        <div class="two">
          <label class="field"><input id="pExp" inputmode="numeric" placeholder=" " maxlength="7" autocomplete="off"><label for="pExp">ММ / ГГ</label><div class="err">Неверный срок</div></label>
          <label class="field"><input id="pCvc" inputmode="numeric" placeholder=" " maxlength="4" type="password" autocomplete="off"><label for="pCvc">CVC</label><div class="err">3 цифры с обратной стороны</div></label>
        </div>
        <label class="field"><input id="pHolder" placeholder=" " autocomplete="off" style="text-transform:uppercase"><label for="pHolder">Имя на карте (латиницей)</label><div class="err">Как на карте, латинскими буквами</div></label>
        <div class="field" id="payErr" style="display:none;color:var(--err);font-size:13px"></div>
        <button class="btn btn--block pay-btn" id="payBtn"><span class="spin"></span><span class="lbl">Оплатить ${fmt(order.amount)}</span></button>
      </form>
      <div class="pay-logos"><span>МИР</span><span>VISA</span><span>MASTERCARD</span></div>
      <p class="pay-note">Демо-режим: данные карты не передаются и не сохраняются.<br>Подключение банковского эквайринга — в файле assets/js/payment.js.</p>
    </div></section>`;
  }
  AFTER.pay = () => {
    const form = $("#payForm"); if (!form) return;
    const U = window.CardUtils, card3d = $("#card3d");
    const num = $("#pNum"), exp = $("#pExp"), cvc = $("#pCvc"), holder = $("#pHolder");
    const paintNum = () => {
      const d = U.digits(num.value), b = U.brand(d);
      const groups = []; const len = b === "visa" || b === "mir" || b === "mastercard" || !b ? 16 : 16;
      for (let i = 0; i < Math.max(len, d.length); i++) groups.push(d[i] ? `<span>${i >= 4 && i < 12 && d.length > i + 0 && i < d.length - 4 ? d[i] : d[i]}</span>` : `<span class="ph">•</span>`);
      let html = ""; groups.forEach((g, i) => { html += g + ((i + 1) % 4 === 0 ? " " : ""); });
      $("#cNum").innerHTML = html;
      card3d.dataset.brand = b; $("#cBrand").textContent = U.brandTitle[b]; $("#pBrand").textContent = U.brandTitle[b];
    };
    paintNum();
    num.addEventListener("input", () => { num.value = U.formatNumber(num.value); paintNum(); num.closest(".field").classList.remove("invalid"); if (U.digits(num.value).length === 16 && U.luhn(num.value)) exp.focus(); });
    exp.addEventListener("input", () => { exp.value = U.formatExp(exp.value); $("#cExp").textContent = exp.value.replace(/\s/g, "") || "ММ/ГГ"; exp.closest(".field").classList.remove("invalid"); if (U.digits(exp.value).length === 4) cvc.focus(); });
    cvc.addEventListener("input", () => { cvc.value = U.digits(cvc.value).slice(0, 3); $("#cCvc").textContent = "•".repeat(cvc.value.length) || "•••"; cvc.closest(".field").classList.remove("invalid"); });
    holder.addEventListener("input", () => { holder.value = holder.value.replace(/[^a-zA-Z\s.\-]/g, "").toUpperCase().slice(0, 26); $("#cHolder").textContent = holder.value || "IVAN IVANOV"; holder.closest(".field").classList.remove("invalid"); });
    cvc.addEventListener("focus", () => card3d.classList.add("flipped"));
    cvc.addEventListener("blur", () => card3d.classList.remove("flipped"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let ok = true; const bad = (el) => { el.closest(".field").classList.add("invalid"); ok = false; };
      if (!U.luhn(num.value)) bad(num);
      if (!U.validExp(exp.value)) bad(exp);
      if (cvc.value.length !== 3) bad(cvc);
      if (holder.value.trim().length < 3) bad(holder);
      if (!ok) return;
      const order = store.get("pendingOrder", null);
      // Данные карты собираются только здесь и только в памяти
      const cardData = { number: U.digits(num.value), expMonth: U.digits(exp.value).slice(0, 2), expYear: "20" + U.digits(exp.value).slice(2), cvc: cvc.value, holder: holder.value.trim() };
      const btn = $("#payBtn"); btn.classList.add("loading"); btn.disabled = true; $("#payErr").style.display = "none";
      const pr = $("#processing"); pr.classList.add("on", "run"); pr.classList.remove("done");
      const msgs = ["Связываемся с банком", "Проверяем данные", "Подтверждаем оплату"]; let mi = 0;
      const msgEl = $(".msg", pr); msgEl.textContent = msgs[0];
      const t = setInterval(() => { mi = Math.min(mi + 1, msgs.length - 1); msgEl.style.opacity = 0; setTimeout(() => { msgEl.textContent = msgs[mi]; msgEl.style.opacity = 1; }, 250); }, 900);
      let res;
      try { res = await window.PaymentGateway.charge({ id: order.id, amount: order.amount, currency: "RUB", phone: order.customer.phone, email: order.customer.email, items: order.items }, cardData); }
      catch (err) { res = { ok: false, error: err.message }; }
      clearInterval(t);
      // стираем данные карты из формы и памяти
      cardData.number = cardData.cvc = cardData.holder = ""; form.reset();
      if (res.ok) {
        msgEl.textContent = "Оплата прошла"; pr.classList.add("done");
        setTimeout(() => finishOrder(order, res.paymentId), 1100);
      } else {
        pr.classList.remove("on", "run"); btn.classList.remove("loading"); btn.disabled = false;
        paintNum(); $("#cExp").textContent = "ММ/ГГ"; $("#cHolder").textContent = "IVAN IVANOV"; $("#cCvc").textContent = "•••";
        const pe = $("#payErr"); pe.textContent = res.error || "Оплата не прошла"; pe.style.display = "block";
      }
    });
  };

  function finishOrder(order, paymentId) {
    order.status = paymentId ? "paid" : "awaiting_payment_on_delivery";
    order.paymentId = paymentId;
    /* ===== МЕСТО ДЛЯ ОТПРАВКИ ЗАКАЗА =====
       Здесь заказ нужно отправить в CRM / Telegram-бот / на сервер, например:
       fetch("https://ваш-сервер/api/orders", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(order) });
       В объекте order нет и не может быть данных карты. */
    store.set("lastOrder", order);
    store.set("pendingOrder", null);
    cart = []; saveCart();
    go("#/success");
    setTimeout(() => $("#processing").classList.remove("on", "run", "done"), 400);
  }

  function pageSuccess() {
    const o = store.get("lastOrder", null);
    if (!o) return pageNotFound();
    const paid = o.status === "paid";
    return `<section class="success">
      <div class="eyebrow">${paid ? "Оплата получена" : "Оплата при получении"}</div>
      <h1 class="h-display">Заказ <em>оформлен</em></h1>
      <div class="order-no">№ ${esc(o.id)}</div>
      <p class="muted" style="font-size:15px;max-width:520px;margin:0 auto">Спасибо, ${esc(o.customer.name.split(" ")[0])}! Мы позвоним по номеру ${esc(o.customer.phone)}, чтобы подтвердить детали и время доставки.</p>
      <div class="sum">
        ${o.items.map((i) => `<div><span>${esc(i.brand)} · ${esc(i.name)} · ${esc(i.size)} × ${i.qty}</span><span>${fmt(i.price * i.qty)}</span></div>`).join("")}
        <div><span>${esc(o.delivery.title)}</span><span>${o.delivery.cost ? fmt(o.delivery.cost) : "Бесплатно"}</span></div>
        <div><span>Адрес</span><span style="text-align:right">${esc(o.address)}</span></div>
        <div><span><b style="color:var(--ink)">${paid ? "Оплачено" : "К оплате при получении"}</b></span><span><b>${fmt(o.amount)}</b></span></div>
      </div>
      <div class="actions"><a href="#/" class="btn">На главную</a><a href="#/catalog" class="btn btn--ghost">Продолжить покупки</a></div>
    </section>`;
  }
  AFTER.success = () => {
    const c = document.createElement("div"); c.className = "confetti";
    for (let i = 0; i < 46; i++) { const s = document.createElement("i"); s.style.left = Math.random() * 100 + "%"; s.style.animationDuration = 2.4 + Math.random() * 2.4 + "s"; s.style.animationDelay = Math.random() * 0.8 + "s"; s.style.transform = `rotate(${Math.random() * 40 - 20}deg)`; c.appendChild(s); }
    document.body.appendChild(c); setTimeout(() => c.remove(), 5500);
  };

  /* ==========================================================================
     Информационные страницы
     ========================================================================== */
  function pageInfo(key) {
    const N = esc(CFG.STORE_NAME);
    const links = [["about", "О магазине"], ["delivery", "Доставка и оплата"], ["returns", "Возврат"], ["contacts", "Контакты"]];
    const aboutImgs = [pick(byBrand("zara"), 1, new Set())[0], pick(byBrand("vs", "sleep"), 1, new Set())[0]].filter(Boolean);
    const pages = {
      about: `<div class="eyebrow">О нас</div><h1 class="h-1">${N}</h1>
        <p class="lead">Мультибрендовый бутик в&nbsp;Симферополе: одежда Zara и&nbsp;бельё, пижамы, косметика и&nbsp;ароматы Victoria's&nbsp;Secret — в&nbsp;одном месте.</p>
        <div class="about-img">${aboutImgs.map((p) => img(p.colors[0].images[0], "")).join("")}</div>
        <p>Мы привозим вещи из официальных магазинов брендов и продаём их в Крыму — с примеркой, доставкой курьером по Симферополю и отправкой по всему полуострову.</p>
        <h2>Почему мы</h2>
        <ul><li>Только оригинальные товары из официальных магазинов Zara и Victoria's Secret.</li><li>Актуальные коллекции: каталог обновляется вслед за сайтами брендов.</li><li>Примерка в шоуруме и при курьере по Симферополю.</li><li>Поможем с размером: подскажем по замерам конкретной модели.</li></ul>
        <h2>Как мы работаем</h2>
        <p>Вы выбираете вещи на сайте и оформляете заказ. Менеджер перезванивает, подтверждает наличие и сроки. Вещи из шоурума доставим в тот же день, под заказ — привезём в оговорённый срок.</p>`,
      delivery: `<div class="eyebrow">Покупателям</div><h1 class="h-1">Доставка и оплата</h1>
        <p class="lead">Доставляем по Симферополю и по всему Крыму.</p>
        <h2>Доставка</h2>
        <table><thead><tr><th>Способ</th><th>Срок</th><th>Стоимость</th></tr></thead><tbody>
        ${CFG.DELIVERY.map((d) => `<tr><td>${d.title}</td><td>${d.note}</td><td>${d.price ? fmt(d.price) : "Бесплатно"}${d.freeFrom ? `<br><span class="muted">бесплатно от ${fmt(d.freeFrom)}</span>` : ""}</td></tr>`).join("")}
        </tbody></table>
        <p>Курьер по Симферополю привозит заказ в удобный двухчасовой интервал. Можно примерить вещи при курьере (до 15 минут) и оплатить только то, что подошло.</p>
        <h2>Оплата</h2>
        <ul><li><b>Картой онлайн</b> — Мир, Visa, Mastercard. Оплата проходит на защищённой странице банка.</li><li><b>При получении</b> — наличными или картой курьеру, в шоуруме.</li></ul>
        <p class="muted">Для доставки по Крыму транспортной компанией может потребоваться предоплата.</p>`,
      returns: `<div class="eyebrow">Покупателям</div><h1 class="h-1">Возврат и обмен</h1>
        <p class="lead">Вернуть или обменять вещь можно в течение 14 дней с момента получения.</p>
        <h2>Условия</h2>
        <ul><li>Вещь не была в носке, сохранены товарный вид, бирки и упаковка.</li><li>Есть документ, подтверждающий покупку (чек или номер заказа).</li><li>Бельё, купальники, чулочно-носочные изделия и косметика / парфюмерия надлежащего качества возврату и обмену не подлежат (Постановление Правительства РФ № 2463).</li></ul>
        <h2>Как вернуть</h2>
        <ul><li>В шоуруме: ${esc(CFG.ADDRESS)}.</li><li>Курьером по Симферополю — вызовите курьера по телефону ${esc(CFG.PHONE)}.</li><li>Из других городов Крыма — через СДЭК, адрес для отправки сообщит менеджер.</li></ul>
        <h2>Деньги</h2>
        <p>Возвращаем в течение 10 дней тем же способом, которым был оплачен заказ. Стоимость доставки при возврате вещи надлежащего качества не возвращается.</p>`,
      contacts: `<div class="eyebrow">Связаться</div><h1 class="h-1">Контакты</h1>
        <div class="contact-cards">
          <a href="tel:${esc(CFG.PHONE_RAW)}"><small>Телефон</small><b>${esc(CFG.PHONE)}</b></a>
          <a href="${esc(CFG.TELEGRAM)}" target="_blank" rel="noopener"><small>Telegram</small><b>Написать нам</b></a>
          <a href="mailto:${esc(CFG.EMAIL)}"><small>Почта</small><b>${esc(CFG.EMAIL)}</b></a>
          <div><small>Часы работы</small><b>${esc(CFG.WORK_HOURS)}</b></div>
        </div>
        <h2>Шоурум</h2>
        <p>${esc(CFG.ADDRESS)}</p>
        <div class="map-ph"><span>Здесь будет карта</span></div>`
    };
    return `<section class="info"><div class="info-grid">
      <nav class="info-side">${links.map(([k, t]) => `<a class="chip ${k === key ? "on" : ""}" href="#/${k}">${t}</a>`).join("")}</nav>
      <article class="prose reveal">${pages[key]}</article>
    </div></section>`;
  }
  function pageNotFound() {
    return `<div class="empty" style="padding:120px 16px"><div class="eyebrow">404</div><h1 class="h-1" style="margin:14px 0 18px">Страница не найдена</h1><a href="#/" class="btn">На главную</a></div>`;
  }

  /* ==========================================================================
     Поиск
     ========================================================================== */
  function openSearch() {
    const l = $("#search"); l.classList.add("open"); document.body.classList.add("lock");
    setTimeout(() => $("#searchInput").focus(), 60); paintSearch();
  }
  function closeSearch() { $("#search")?.classList.remove("open"); if (!$(".drawer.open, .modal.open")) document.body.classList.remove("lock"); }
  function paintSearch() {
    const q = $("#searchInput").value.trim().toLowerCase();
    const box = $("#searchResults");
    if (!q) {
      const hints = ["платье", "пальто", "пижама", "бралетт", "Bombshell", "кашемир", "джинсы", "vanilla", "кружево", "satin"];
      box.innerHTML = `<div class="eyebrow">Популярное</div><div class="search-hints">${hints.map((h) => `<button class="chip" data-hint="${esc(h)}">${esc(h)}</button>`).join("")}</div>
        <div class="eyebrow" style="margin-top:32px">Категории</div><div class="search-hints">${CATALOG.categories.filter((c) => PRODUCTS.some((p) => p.category === c.id)).map((c) => `<a class="chip" href="#/catalog?cat=${c.id}">${esc(c.title)}</a>`).join("")}</div>`;
      return;
    }
    const words = expandQuery(q);
    const res = PRODUCTS.filter((p) => words.every((alts) => alts.some((w) => p._search.includes(w))));
    box.innerHTML = res.length ? `<div class="toolbar" style="position:static;margin:0 calc(-1 * var(--gutter)) 24px"><span class="count">Найдено: ${res.length}</span><span></span><a class="link" href="#/catalog?q=${encodeURIComponent(q)}">Все результаты</a></div>
      <div class="grid" style="padding:0">${res.slice(0, 12).map((p) => card(p)).join("")}</div>` : `<p class="muted">Ничего не найдено по запросу «${esc(q)}»</p>`;
    observeReveal(box);
  }
  /* Русские запросы → английские названия брендов */
  const SYN = {
    "плать": ["dress"], "пальто": ["coat"], "куртк": ["jacket", "bomber", "puffer"], "тренч": ["trench"], "пиджак": ["blazer"], "жакет": ["blazer", "jacket"],
    "свитер": ["sweater"], "джемпер": ["sweater"], "кардиган": ["cardigan"], "трикотаж": ["knit"], "кашемир": ["cashmere"], "шерст": ["wool"],
    "брюк": ["pants", "trousers"], "джинс": ["jeans", "denim"], "юбк": ["skirt"], "шорт": ["shorts"], "футболк": ["t-shirt", "tee"], "рубашк": ["shirt"], "блуз": ["blouse"],
    "топ": ["top"], "боди": ["bodysuit", "teddy"], "комплект": ["set"], "костюм": ["suit", "set"], "свитшот": ["sweatshirt"], "худи": ["hoodie"],
    "пижам": ["pajama", "pj", "sleep"], "халат": ["robe"], "сорочк": ["slip", "nightgown", "chemise"], "бюст": ["bra"], "лифчик": ["bra"], "бра": ["bra"], "бралет": ["bralette"],
    "трус": ["pant", "thong", "cheeky", "brief", "hiphugger", "panty"], "стринг": ["thong"], "кружев": ["lace"], "шёлк": ["silk", "satin"], "шелк": ["silk", "satin"], "сатин": ["satin"],
    "аромат": ["fragrance", "mist", "perfume", "parfum"], "духи": ["perfume", "parfum", "eau"], "парфюм": ["perfume", "parfum"], "мист": ["mist"], "спрей": ["mist"], "лосьон": ["lotion"],
    "крем": ["cream", "lotion"], "гель": ["wash"], "блеск": ["gloss"], "губ": ["lip"], "ванил": ["vanilla"], "чулк": ["stocking"], "корсет": ["corset", "bustier"],
    "чёрн": ["black"], "черн": ["black"], "бел": ["white"], "красн": ["red"], "розов": ["pink"], "беж": ["beige"]
  };
  function expandQuery(q) {
    return q.split(/\s+/).filter(Boolean).map((w) => {
      const alts = [w];
      for (const k in SYN) if (w.startsWith(k) || k.startsWith(w) && w.length >= 3) alts.push(...SYN[k]);
      return alts;
    });
  }

  /* ==========================================================================
     Инициализация
     ========================================================================== */
  function shell() {
    const N = esc(CFG.STORE_NAME);
    $("#app").innerHTML = `
    <div class="announce"><span>Курьер по Симферополю — в день заказа · Доставка по всему Крыму · Zara и Victoria's Secret в одном бутике</span></div>
    <header class="header" id="header">
      <div class="left">
        <button class="icon-btn burger" id="burger" aria-label="Меню">${I.menu}</button>
        <nav class="nav-desk">
          <a href="#/catalog">Каталог</a><a href="#/catalog?group=clothes">Одежда</a><a href="#/catalog?group=lingerie">Бельё</a><a href="#/catalog?group=sleep">Пижамы</a><a href="#/catalog?group=beauty">Красота</a>
        </nav>
      </div>
      <a href="#/" class="logo" aria-label="${N}">${Array.from(CFG.STORE_NAME).map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join("")}</a>
      <div class="right">
        <button class="icon-btn" id="searchBtn" aria-label="Поиск">${I.search}</button>
        <a class="icon-btn" href="#/favorites" aria-label="Избранное">${I.heart}<span class="badge" id="favBadge"></span></a>
        <button class="icon-btn" id="bagBtn" aria-label="Корзина">${I.bag}<span class="badge" id="bagBadge"></span></button>
      </div>
    </header>
    <main id="view"></main>
    <footer class="footer">
      <p class="big">${N}</p>
      <div class="cols">
        <div><h4>Рассылка</h4><p style="color:#8b857b">Новые поступления и закрытые распродажи — раз в неделю.</p><form class="sub" onsubmit="event.preventDefault();this.innerHTML='<p style=&quot;padding:12px 0;margin:0&quot;>Спасибо! Вы подписаны.</p>'"><input type="email" placeholder="E-mail" required aria-label="E-mail"><button>Подписаться</button></form></div>
        <div><h4>Каталог</h4><a href="#/catalog?brand=zara">Zara</a><a href="#/catalog?brand=vs">Victoria's Secret</a><a href="#/catalog?group=lingerie">Бельё</a><a href="#/catalog?group=beauty">Красота</a><a href="#/catalog?sale=1">Sale</a></div>
        <div><h4>Покупателям</h4><a href="#/about">О магазине</a><a href="#/delivery">Доставка и оплата</a><a href="#/returns">Возврат</a><a href="#/contacts">Контакты</a></div>
        <div><h4>Связь</h4><a href="tel:${esc(CFG.PHONE_RAW)}">${esc(CFG.PHONE)}</a><a href="${esc(CFG.TELEGRAM)}" target="_blank" rel="noopener">Telegram</a><p>${esc(CFG.WORK_HOURS)}</p><p>${esc(CFG.CITY)}, Крым</p></div>
      </div>
      <div class="legal"><p>© ${new Date().getFullYear()} ${N}. Все права защищены.</p><p>Zara и Victoria's Secret — товарные знаки их правообладателей. Магазин не является официальным представителем брендов.</p></div>
    </footer>
    <div class="drawer" id="menu"><div class="scrim" data-close="menu"></div><div class="panel">
      <div class="panel-head"><span class="logo" style="font-size:22px">${N}</span><button class="icon-btn" data-close="menu" aria-label="Закрыть">${I.close}</button></div>
      <nav class="menu-list">
        <a href="#/catalog">Каталог <small>${PRODUCTS.length}</small></a>
        <a href="#/catalog?group=clothes">Одежда <small>Zara</small></a>
        <a href="#/catalog?group=lingerie">Бельё <small>VS · Zara</small></a>
        <a href="#/catalog?group=sleep">Пижамы и дом</a>
        <a href="#/catalog?group=beauty">Красота <small>VS</small></a>
        <a href="#/catalog?sort=new">Новинки</a>
        <a href="#/favorites">Избранное</a>
      </nav>
      <div class="menu-sub"><a href="#/about">О магазине</a><a href="#/delivery">Доставка и оплата</a><a href="#/returns">Возврат</a><a href="#/contacts">Контакты</a><a href="tel:${esc(CFG.PHONE_RAW)}">${esc(CFG.PHONE)}</a></div>
    </div></div>
    <div class="drawer right bag" id="bag"><div class="scrim" data-close="bag"></div><div class="panel">
      <div class="panel-head"><span class="h-3">Корзина <span id="bagCount" class="muted"></span></span><button class="icon-btn" data-close="bag" aria-label="Закрыть">${I.close}</button></div>
      <div class="bag-items" id="bagItems"></div><div class="bag-foot" id="bagFoot"></div>
    </div></div>
    <div class="drawer right filters" id="filters"><div class="scrim" data-close="filters"></div><div class="panel">
      <div class="panel-head"><span class="h-3">Фильтры</span><button class="icon-btn" data-close="filters" aria-label="Закрыть">${I.close}</button></div>
      <div class="f-body" id="filtersBody"></div>
      <div class="f-foot"><button class="btn btn--ghost" id="filtersReset">Сбросить</button><button class="btn" id="filtersApply">Показать</button></div>
    </div></div>
    <div class="search-layer" id="search">
      <div class="search-top">${I.search.replace("<svg", '<svg width="22" height="22" style="stroke:currentColor;fill:none;stroke-width:1.2"')}<input id="searchInput" placeholder="Что вы ищете?" autocomplete="off" enterkeyhint="search"><button class="icon-btn" id="searchClose" aria-label="Закрыть">${I.close}</button></div>
      <div class="search-results" id="searchResults"></div>
    </div>
    <div class="modal" id="modal"><div class="scrim" data-close-modal></div><div class="box"><button class="icon-btn x" data-close-modal aria-label="Закрыть">${I.close}</button><div class="box-inner"></div></div></div>
    <div class="zoom" id="zoom"></div>
    <div class="processing" id="processing"><div class="pc">
      <div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46"/></svg><div class="tick"><svg viewBox="0 0 40 40"><path d="M11 21l6 6 12-13"/></svg></div></div>
      <div class="msg">Связываемся с банком</div><div class="sub">Не закрывайте страницу</div>
    </div></div>
    <div class="toast" id="toast"></div>
    <div class="top-progress" id="topProgress"></div>
    <div class="scroll-bar" id="scrollBar"></div>
    <div class="look-cursor" id="lookCursor">Смотреть</div>
    <button class="back-top" id="backTop" aria-label="Наверх">${I.up}</button>`;
    view = $("#view");
  }

  function globalEvents() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      const fav = t.closest("[data-fav]");
      if (fav) { e.preventDefault(); const on = toggleFav(fav.dataset.fav); toast(on ? 'Добавлено в избранное · <a href="#/favorites">Открыть</a>' : "Удалено из избранного"); return; }
      const qk = t.closest("[data-quick]");
      if (qk) {
        e.preventDefault(); const p = BY_ID[qk.dataset.quick];
        addToCart(p.id, 0, qk.dataset.size); flyToBag(qk.closest(".card").querySelector("img.main"));
        toast(`${esc(p.nameRu || p.name)} · ${esc(qk.dataset.size)} — в корзине <a href="javascript:void 0" data-open-bag>Открыть</a>`); return;
      }
      if (t.closest("[data-open-bag]") || t.closest("#bagBtn")) { e.preventDefault(); renderBag(); openDrawer("bag"); return; }
      const cl = t.closest("[data-close]"); if (cl) { closeDrawer(cl.dataset.close); return; }
      if (t.closest("[data-close-modal]")) { closeModal(); return; }
      if (t.closest("#burger")) { openDrawer("menu"); return; }
      if (t.closest("#searchBtn")) { openSearch(); return; }
      if (t.closest("#searchClose")) { closeSearch(); return; }
      const hint = t.closest("[data-hint]"); if (hint) { $("#searchInput").value = hint.dataset.hint; paintSearch(); return; }
      const sc = t.closest("[data-scroll]");
      if (sc) { e.preventDefault(); const el = document.getElementById(sc.dataset.scroll); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) + 40), behavior: "smooth" }); return; }
      const un = t.closest("[data-unset]");
      if (un) {
        const f = { ...catState.f }, k = un.dataset.unset, v = un.dataset.v;
        if (k === "all") Object.assign(f, { brand: [], cat: [], size: [], color: [], min: null, max: null, q: "", sale: false });
        else if (k === "price") { f.min = null; f.max = null; } else if (k === "q") f.q = ""; else f[k] = f[k].filter((x) => x !== v);
        go(filtersToHash(f)); return;
      }
      if (t.closest("#zoom")) { $("#zoom").classList.remove("open"); if (!$(".drawer.open, .modal.open")) document.body.classList.remove("lock"); return; }
      if (t.closest("#backTop")) window.scrollTo({ top: 0, behavior: "smooth" });
    });
    // ссылки внутри панелей закрывают их
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer("menu"); closeDrawer("bag"); closeDrawer("filters"); closeModal(); closeSearch(); $("#zoom").classList.remove("open"); } });
    let st;
    $("#searchInput").addEventListener("input", () => { clearTimeout(st); st = setTimeout(paintSearch, 140); });
    $("#searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.value.trim()) go("#/catalog?q=" + encodeURIComponent(e.target.value.trim())); });
    // шапка: прячется при скролле вниз
    let lastY = 0;
    window.addEventListener("scroll", () => {
      const y = scrollY, h = $("#header");
      h.classList.toggle("scrolled", y > 10);
      if (y > 400 && y > lastY + 4 && !document.body.classList.contains("lock")) h.classList.add("hide");
      if (y < lastY - 4 || y < 400) h.classList.remove("hide");
      document.body.classList.toggle("hdr-hidden", h.classList.contains("hide"));
      const max = document.documentElement.scrollHeight - innerHeight;
      $("#scrollBar").style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      parallax();
      $("#backTop").classList.toggle("show", y > 1400);
      lastY = y;
    }, { passive: true });
    window.addEventListener("hashchange", () => { if (location.hash.startsWith("#ch-")) return; route(); });
    window.addEventListener("storage", () => { cart = store.get("cart", []); favs = store.get("favs", []); updateBadges(); });
    bagEvents(); filtersEvents();
  }

  async function init() {
    try {
      const data = await loadCatalog();
      data.categories.forEach((c) => { CATS[c.id] = { ...c, groupTitle: GROUPS[c.group] }; });
      indexCatalog(data);
    } catch (e) {
      $("#app").innerHTML = `<div style="padding:80px 24px;text-align:center;font-family:sans-serif">Не удалось загрузить каталог (data/catalog.js).<br><small>${esc(e && e.message)}</small></div>`;
      return;
    }
    cart = cart.filter((l) => BY_ID[l.pid]);
    favs = favs.filter((id) => BY_ID[id]);
    shell(); globalEvents(); updateBadges();
    document.title = CFG.STORE_NAME + " — " + CFG.STORE_TAGLINE;
    await route();
  }
  init();
})();

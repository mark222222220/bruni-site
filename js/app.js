(function () {
  "use strict";
  const S = window.SHOP, PRODUCTS = window.PRODUCTS, CATS = window.CATEGORIES;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const rub = n => n.toLocaleString("ru-RU") + " " + S.currency;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BRAND = { zara: "ZARA", vs: "Victoria's Secret" };
  const byId = id => PRODUCTS.find(p => p.id === id);
  const catName = (b, c) => (CATS[b].find(x => x.id === c) || {}).name || "";
  const isSale = p => !!p.oldPrice;

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("zv_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("zv_" + k, JSON.stringify(v)); } catch (e) {} }
  };
  let cart = store.get("cart", []);
  let favs = store.get("favs", []);
  let density = store.get("density", "normal");

  // ---------- visuals ----------
  function media(p, colorIdx = 0) {
    if (p.img) return `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">`;
    return renderArt(p.art, (p.colors[colorIdx] || p.colors[0])[1]);
  }
  const heart = `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`;

  function card(p) {
    const tags = [];
    if (isSale(p)) tags.push(`<span class="tag tag--sale">−${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>`);
    if (p.tags.includes("new")) tags.push(`<span class="tag">New</span>`);
    else if (p.tags.includes("hit")) tags.push(`<span class="tag tag--hit">Хит</span>`);
    const quick = p.sizes.length > 1 || p.sizes[0] !== "ONE SIZE"
      ? `<small>Быстро в корзину</small>${p.sizes.map(s => `<button data-quick="${p.id}" data-size="${esc(s)}">${esc(s)}</button>`).join("")}`
      : `<button data-quick="${p.id}" data-size="${esc(p.sizes[0])}" style="width:100%">В корзину</button>`;
    return `<article class="card rv" data-brand="${p.brand}">
      <a class="card-media" href="#/p/${p.id}" aria-label="${esc(p.name)}">${media(p)}</a>
      <div class="card-tags">${tags.join("")}</div>
      <button class="fav-btn ${favs.includes(p.id) ? "on" : ""}" data-fav="${p.id}" aria-label="В избранное">${heart}</button>
      <div class="quick">${quick}</div>
      <div class="card-info">
        <a href="#/p/${p.id}"><span class="brand-label">${BRAND[p.brand]}</span>${esc(p.name)}</a>
        <div class="price">${isSale(p) ? `<span class="now-sale">${rub(p.price)}</span><s>${rub(p.oldPrice)}</s>` : rub(p.price)}</div>
      </div>
      <div class="swatches">${p.colors.slice(0, 5).map(c => `<i class="sw" style="background:${c[1]}" title="${esc(c[0])}"></i>`).join("")}</div>
    </article>`;
  }

  // ---------- router ----------
  function parse() {
    const h = location.hash.slice(1) || "/";
    const [path, qs] = h.split("?");
    return { path, q: new URLSearchParams(qs || "") };
  }
  function route() {
    const { path, q } = parse();
    closeAll();
    let m;
    if (path === "/" || path === "") home();
    else if (path === "/catalog") catalog(q);
    else if ((m = path.match(/^\/p\/(\w+)/))) product(m[1]);
    else if (path === "/fav") favorites();
    else if (path === "/checkout") checkout();
    else if (path === "/contacts") contacts();
    else if (path === "/delivery") delivery();
    else if (path === "/sizes") sizes();
    else notFound();
    $$(".nav a").forEach(a => {
      const href = a.getAttribute("href").slice(1);
      a.classList.toggle("active", location.hash.slice(1).startsWith(href) && href !== "/");
    });
    app.style.animation = "none"; app.offsetHeight; app.style.animation = "";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    reveal();
  }

  // ---------- pages ----------
  function home() {
    document.title = `ZARA × Victoria's Secret — ${S.city}`;
    const newIn = PRODUCTS.filter(p => p.tags.includes("new"));
    const hitsVS = PRODUCTS.filter(p => p.brand === "vs" && p.tags.includes("hit"));
    const tileZ = [["coats", "coat", "#b98b5e"], ["dresses", "slipdress", "#1a1a1a"], ["jeans", "jeans", "#4a6a93"], ["shoes", "boot", "#3a2a20"]];
    const tileV = [["bras", "bra", "#e8a5b5"], ["sleep", "pajama", "#ecc3cd"], ["pink", "hoodie", "#f2b5c4"], ["beauty", "mist", "#d97a9a"]];
    app.innerHTML = `
      <section class="hero">
        <a class="hero-side hero-side--zara" href="#/catalog?brand=zara">
          <div class="hero-big">ZARA</div>
          <div class="hero-art">${renderArt("coat", "#2b2724")}</div>
          <div class="hero-copy">
            <div><small>Woman · Осень—Зима</small><h2>Пальто, твид и мягкий трикотаж</h2></div>
            <span class="btn btn--ghost">Смотреть</span>
          </div>
        </a>
        <a class="hero-side hero-side--vs" href="#/catalog?brand=vs">
          <div class="hero-big">Victoria's<br>Secret</div>
          <div class="hero-art">${renderArt("robe", "#e9a3b6")}</div>
          <div class="hero-copy">
            <div><small>Lingerie · Sleep · Beauty</small><h2>Кружево, сатин и любимые ароматы</h2></div>
            <span class="btn btn--rose">Смотреть</span>
          </div>
        </a>
      </section>

      <div class="perks">
        <div class="perk"><b>Самовывоз</b><span>В нашем магазине в Евпатории — в день заказа</span></div>
        <div class="perk"><b>Доставка по городу</b><span>Бесплатно от ${rub(S.freeDeliveryFrom)}</span></div>
        <div class="perk"><b>Примерка</b><span>Курьер подождёт, пока вы примерите</span></div>
        <div class="perk"><b>Оригинал</b><span>Только подлинные вещи брендов</span></div>
      </div>

      <section class="section">
        <div class="section-head rv">
          <div><p class="eyebrow">Только что пришло</p><h2 class="h2">Новинки <em>недели</em></h2></div>
          <a class="link" href="#/catalog?tag=new">Все новинки</a>
        </div>
        <div class="rail">${newIn.map(card).join("")}</div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="section-head rv"><div><p class="eyebrow">ZARA Woman</p><h2 class="h2">Гардероб сезона</h2></div><a class="link" href="#/catalog?brand=zara">Весь ZARA</a></div>
        <div class="tiles">${tileZ.map(([c, a, col]) => `<a class="tile rv" href="#/catalog?brand=zara&cat=${c}"><small>ZARA</small>${renderArt(a, col)}<span>${catName("zara", c)}</span></a>`).join("")}</div>
      </section>

      <section class="editorial">
        <div class="editorial-art"><span class="stamp">the sleep edit</span>${renderArt("pajama", "#ecc3cd")}</div>
        <div class="editorial-copy rv">
          <p class="eyebrow">Victoria's Secret</p>
          <h2 class="h2">Сатиновые вечера <em>дома</em></h2>
          <p>Пижамы, халаты и сорочки из мягкого сатина и кружева. Идеальный подарок — себе или любимой.</p>
          <div><a class="btn" href="#/catalog?brand=vs&cat=sleep">Выбрать пижаму</a></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head rv"><div><p class="eyebrow">Victoria's Secret</p><h2 class="h2">Бельё, PINK <em>и ароматы</em></h2></div><a class="link" href="#/catalog?brand=vs">Весь Victoria's Secret</a></div>
        <div class="tiles">${tileV.map(([c, a, col]) => `<a class="tile tile--vs rv" href="#/catalog?brand=vs&cat=${c}"><small>VS</small>${renderArt(a, col)}<span>${catName("vs", c)}</span></a>`).join("")}</div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="section-head rv"><div><p class="eyebrow">Выбор покупательниц</p><h2 class="h2">Бестселлеры</h2></div><a class="link" href="#/catalog?tag=hit">Смотреть все</a></div>
        <div class="rail">${hitsVS.concat(PRODUCTS.filter(p => p.brand === "zara" && p.tags.includes("hit"))).map(card).join("")}</div>
      </section>

      ${contactsBlock()}`;
  }

  function catalog(q) {
    const brand = q.get("brand"), cat = q.get("cat"), tag = q.get("tag"), sort = q.get("sort") || "pop";
    let list = PRODUCTS.slice();
    if (brand) list = list.filter(p => p.brand === brand);
    if (cat) list = list.filter(p => p.cat === cat);
    if (tag === "sale") list = list.filter(isSale);
    else if (tag) list = list.filter(p => p.tags.includes(tag));
    if (sort === "asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "new") list.sort((a, b) => b.tags.includes("new") - a.tags.includes("new"));
    else list.sort((a, b) => b.tags.includes("hit") - a.tags.includes("hit"));

    const link = patch => {
      const n = new URLSearchParams(q);
      Object.entries(patch).forEach(([k, v]) => v == null ? n.delete(k) : n.set(k, v));
      const s = n.toString(); return "#/catalog" + (s ? "?" + s : "");
    };
    const title = tag === "new" ? "Новинки" : tag === "sale" ? "Sale" : tag === "hit" ? "Бестселлеры"
      : cat ? catName(brand, cat) : brand ? BRAND[brand] : "Весь каталог";
    document.title = `${title} — ZARA × Victoria's Secret`;
    const chips = brand
      ? [`<a class="chip ${!cat ? "on" : ""} ${brand === "vs" ? "chip--vs" : ""}" href="${link({ cat: null })}">Все</a>`]
          .concat(CATS[brand].map(c => `<a class="chip ${cat === c.id ? "on" : ""} ${brand === "vs" ? "chip--vs" : ""}" href="${link({ cat: c.id })}">${c.name}</a>`))
      : [`<a class="chip ${!tag ? "on" : ""}" href="${link({ tag: null })}">Все</a>`,
         `<a class="chip ${tag === "new" ? "on" : ""}" href="${link({ tag: "new" })}">Новинки</a>`,
         `<a class="chip ${tag === "hit" ? "on" : ""}" href="${link({ tag: "hit" })}">Бестселлеры</a>`,
         `<a class="chip ${tag === "sale" ? "on" : ""}" href="${link({ tag: "sale" })}">Sale</a>`];

    app.innerHTML = `
      <div class="cat-hero ${brand === "vs" ? "cat-hero--vs" : ""}">
        <div><p class="eyebrow">${brand ? (cat ? BRAND[brand] : "Женщинам") : "ZARA × Victoria's Secret"}</p><h1 class="h2">${esc(title)}</h1></div>
        <div class="brand-switch">
          <a class="${!brand ? "on" : ""}" href="${link({ brand: null, cat: null })}">Все</a>
          <a class="${brand === "zara" ? "on" : ""}" href="${link({ brand: "zara", cat: null })}">ZARA</a>
          <a class="${brand === "vs" ? "on" : ""}" href="${link({ brand: "vs", cat: null })}">Victoria's Secret</a>
        </div>
      </div>
      <div class="toolbar">
        <div class="chips">${chips.join("")}</div>
        <div class="tools-right">
          <span class="count">${list.length} ${plural(list.length, ["товар", "товара", "товаров"])}</span>
          <select class="select" id="sort" aria-label="Сортировка">
            <option value="pop" ${sort === "pop" ? "selected" : ""}>Популярные</option>
            <option value="new" ${sort === "new" ? "selected" : ""}>Сначала новинки</option>
            <option value="asc" ${sort === "asc" ? "selected" : ""}>Цена ↑</option>
            <option value="desc" ${sort === "desc" ? "selected" : ""}>Цена ↓</option>
          </select>
          <div class="dens">
            <button data-dens="normal" class="${density === "normal" ? "on" : ""}" aria-label="Крупно"><svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg></button>
            <button data-dens="dense" class="${density === "dense" ? "on" : ""}" aria-label="Мелко"><svg viewBox="0 0 16 16">${[1, 6, 11].map(x => [1, 6, 11].map(y => `<rect x="${x}" y="${y}" width="4" height="4"/>`).join("")).join("")}</svg></button>
          </div>
        </div>
      </div>
      <section class="catalog">
        ${list.length ? `<div class="grid ${density === "dense" ? "dense" : ""}">${list.map(card).join("")}</div>`
          : `<div class="empty"><h2 class="h2">Здесь пока пусто</h2><p>Попробуйте другой раздел</p><a class="btn" href="#/catalog">Весь каталог</a></div>`}
      </section>`;
    $("#sort").onchange = e => { location.hash = link({ sort: e.target.value }); };
  }

  function product(id) {
    const p = byId(id);
    if (!p) return notFound();
    document.title = `${p.name} — ${BRAND[p.brand]}`;
    let ci = 0, size = p.sizes.length === 1 ? p.sizes[0] : null;
    const isLingerie = p.brand === "vs" && ["bras", "sets"].includes(p.cat);
    const related = PRODUCTS.filter(x => x.brand === p.brand && x.cat === p.cat && x.id !== p.id)
      .concat(PRODUCTS.filter(x => x.brand === p.brand && x.cat !== p.cat)).slice(0, 8);

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">Главная</a> / <a href="#/catalog?brand=${p.brand}">${BRAND[p.brand]}</a> / <a href="#/catalog?brand=${p.brand}&cat=${p.cat}">${catName(p.brand, p.cat)}</a></nav>
      <section class="pdp" data-brand="${p.brand}">
        <div class="gallery" id="gallery"></div>
        <div class="buy">
          <div><p class="brand-label">${BRAND[p.brand]} · ${catName(p.brand, p.cat)}</p><h1>${esc(p.name)}</h1></div>
          <div class="price">${isSale(p) ? `<span class="now-sale">${rub(p.price)}</span><s>${rub(p.oldPrice)}</s>` : rub(p.price)}</div>
          <div><div class="opt-label"><span>Цвет: <b id="cName">${esc(p.colors[0][0])}</b></span></div>
            <div class="colors">${p.colors.map((c, i) => `<button class="color ${i === 0 ? "on" : ""}" data-ci="${i}" style="background:${c[1]}" aria-label="${esc(c[0])}"></button>`).join("")}</div></div>
          <div id="sizeBox"><div class="opt-label"><span id="sizeLbl">${size ? "Размер: " + esc(size) : "Выберите размер"}</span>${p.sizes.length > 1 ? `<button data-go="#/sizes">Таблица размеров</button>` : ""}</div>
            <div class="sizes">${p.sizes.map(s => `<button class="size ${s === size ? "on" : ""}" data-size="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>
          <div class="buy-row">
            <button class="btn ${p.brand === "vs" ? "btn--rose" : ""}" id="addBtn">Добавить в корзину</button>
            <button class="fav-btn ${favs.includes(p.id) ? "on" : ""}" data-fav="${p.id}" aria-label="В избранное">${heart}</button>
          </div>
          <p class="hint">Самовывоз сегодня из магазина в ${S.city === "Евпатория" ? "Евпатории" : S.city} · Доставка по городу ${S.deliveryPrice} ${S.currency}, от ${rub(S.freeDeliveryFrom)} — бесплатно</p>
          <div class="acc">
            <details open><summary>Описание</summary><p>${esc(p.desc)}</p></details>
            <details><summary>Состав и уход</summary><p>${esc(p.comp)}. ${p.cat === "beauty" || p.cat === "body" ? "Хранить вдали от прямых солнечных лучей." : "Деликатная стирка при 30°, не отбеливать."}</p></details>
            ${isLingerie ? `<details><summary>Как подобрать размер белья</summary><p>Цифра — обхват под грудью (70, 75, 80), буква — полнота чашки. Не уверены? Приходите на примерку в магазин — консультант поможет подобрать.</p></details>` : ""}
            <details><summary>Доставка и возврат</summary><p>Доставка по Евпатории за 1 день, оплата при получении. Обмен и возврат в течение 14 дней при сохранении бирок и товарного вида. Бельё и косметика обмену не подлежат.</p></details>
          </div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="section-head"><h2 class="h2">Вам может <em>понравиться</em></h2></div>
        <div class="rail">${related.map(card).join("")}</div>
      </section>`;

    const gal = () => {
      $("#gallery").innerHTML = [0, 1, 2].map(() => `<div class="g">${media(p, ci)}</div>`).join("");
    };
    gal();
    $$(".color").forEach(b => b.onclick = () => {
      ci = +b.dataset.ci; $$(".color").forEach(x => x.classList.toggle("on", x === b));
      $("#cName").textContent = p.colors[ci][0]; gal();
    });
    $$(".size").forEach(b => b.onclick = () => {
      size = b.dataset.size; $$(".size").forEach(x => x.classList.toggle("on", x === b));
      $("#sizeLbl").textContent = "Размер: " + size; $("#sizeBox").classList.remove("size-error");
    });
    $("#addBtn").onclick = () => {
      if (!size) { const box = $("#sizeBox"); box.classList.remove("size-error"); void box.offsetWidth; box.classList.add("size-error"); $("#sizeLbl").textContent = "Пожалуйста, выберите размер"; return; }
      addToCart(p.id, ci, size);
    };
  }

  function favorites() {
    document.title = "Избранное";
    const list = favs.map(byId).filter(Boolean);
    app.innerHTML = `<div class="cat-hero"><div><p class="eyebrow">Wishlist</p><h1 class="h2">Избранное</h1></div></div>
      <section class="catalog">${list.length ? `<div class="grid">${list.map(card).join("")}</div>`
        : `<div class="empty"><h2 class="h2">Пока ничего</h2><p>Нажимайте ♡ на товарах, чтобы сохранить их здесь</p><a class="btn" href="#/catalog">В каталог</a></div>`}</section>`;
  }

  function checkout() {
    document.title = "Оформление заказа";
    if (!cart.length) {
      app.innerHTML = `<div class="empty" style="padding:140px 20px"><h2 class="h2">Корзина пуста</h2><p>Добавьте что-нибудь красивое</p><a class="btn" href="#/catalog">В каталог</a></div>`;
      return;
    }
    const t = totals("pickup");
    app.innerHTML = `
      <section class="checkout">
        <form class="form" id="orderForm" novalidate>
          <div><p class="eyebrow">Шаг 1 из 1</p><h1 class="h2">Оформление</h1></div>
          <div><h3>Контакты</h3>
            <div class="fields">
              <div class="field"><input id="fName" placeholder=" " required autocomplete="name"><label for="fName">Имя *</label></div>
              <div class="field"><input id="fPhone" type="tel" placeholder=" " required autocomplete="tel"><label for="fPhone">Телефон *</label></div>
            </div></div>
          <div><h3>Получение</h3>
            <div class="radio-cards">
              <label class="radio-card"><input type="radio" name="ship" value="pickup" checked><b>Самовывоз</b><span>${esc(S.address)} · бесплатно</span></label>
              <label class="radio-card"><input type="radio" name="ship" value="courier"><b>Курьер по Евпатории</b><span>${S.deliveryPrice} ${S.currency}, от ${rub(S.freeDeliveryFrom)} — бесплатно</span></label>
            </div>
            <div class="fields" id="addrFields" style="margin-top:14px;display:none">
              <div class="field full"><input id="fAddr" placeholder=" " autocomplete="street-address"><label for="fAddr">Адрес доставки *</label></div>
            </div></div>
          <div><h3>Оплата</h3>
            <div class="radio-cards">
              <label class="radio-card"><input type="radio" name="pay" value="Наличными при получении" checked><b>Наличными</b><span>При получении</span></label>
              <label class="radio-card"><input type="radio" name="pay" value="Картой / переводом при получении"><b>Картой или переводом</b><span>При получении</span></label>
            </div></div>
          <div class="fields"><div class="field full"><textarea id="fNote" placeholder=" "></textarea><label for="fNote">Комментарий к заказу</label></div></div>
          <button class="btn btn--block" type="submit">Подтвердить заказ</button>
          <p class="hint">Нажимая кнопку, вы соглашаетесь на обработку персональных данных для связи по заказу.</p>
        </form>
        <aside class="summary" id="summary"></aside>
      </section>`;
    const renderSummary = () => {
      const ship = $("input[name=ship]:checked").value, tt = totals(ship);
      $("#summary").innerHTML = `<h3 style="font:400 22px var(--serif)">Ваш заказ</h3>
        ${cart.map(it => { const p = byId(it.id); return p ? `<div class="line"><div class="line-media">${media(p, it.ci)}</div><div><div class="line-top"><span>${esc(p.name)}</span><span>${rub(p.price * it.qty)}</span></div><div class="line-meta">${esc(p.colors[it.ci][0])} · ${esc(it.size)} · ${it.qty} шт</div></div></div>` : ""; }).join("")}
        <div class="sum-row"><span>Товары</span><span>${rub(tt.sub)}</span></div>
        <div class="sum-row"><span>Доставка</span><span>${tt.ship ? rub(tt.ship) : "Бесплатно"}</span></div>
        <div class="sum-row total"><span>Итого</span><span>${rub(tt.total)}</span></div>`;
    };
    renderSummary();
    $$("input[name=ship]").forEach(r => r.onchange = () => { $("#addrFields").style.display = r.value === "courier" && r.checked ? "grid" : "none"; renderSummary(); });
    const phone = $("#fPhone");
    phone.addEventListener("input", () => {
      let d = phone.value.replace(/\D/g, ""); if (d[0] === "8") d = "7" + d.slice(1); if (d && d[0] !== "7") d = "7" + d; d = d.slice(0, 11);
      const m = d.match(/^(\d)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
      phone.value = !d ? "" : `+${m[1]}` + (m[2] ? ` (${m[2]}` : "") + (m[2].length === 3 ? ")" : "") + (m[3] ? ` ${m[3]}` : "") + (m[4] ? `-${m[4]}` : "") + (m[5] ? `-${m[5]}` : "");
    });
    $("#orderForm").onsubmit = e => {
      e.preventDefault();
      const ship = $("input[name=ship]:checked").value;
      const checks = [["fName", v => v.trim().length > 1], ["fPhone", v => v.replace(/\D/g, "").length === 11]];
      if (ship === "courier") checks.push(["fAddr", v => v.trim().length > 4]);
      let ok = true;
      checks.forEach(([id, fn]) => { const f = $("#" + id), good = fn(f.value); f.parentElement.classList.toggle("err", !good); if (!good && ok) { f.focus(); ok = false; } });
      if (!ok) return toast("Проверьте выделенные поля");
      const tt = totals(ship);
      const order = {
        no: "ZV-" + Date.now().toString().slice(-6),
        name: $("#fName").value.trim(), phone: phone.value, ship, addr: ship === "courier" ? $("#fAddr").value.trim() : S.address,
        pay: $("input[name=pay]:checked").value, note: $("#fNote").value.trim(),
        items: cart.map(it => ({ ...it })), total: tt.total, date: new Date().toISOString()
      };
      const orders = store.get("orders", []); orders.push(order); store.set("orders", orders);
      cart = []; saveCart();
      success(order, tt);
    };
  }

  function orderText(o, tt) {
    const lines = o.items.map((it, i) => { const p = byId(it.id); return `${i + 1}. ${BRAND[p.brand]} — ${p.name} (${p.colors[it.ci][0]}, ${it.size}) × ${it.qty} = ${rub(p.price * it.qty)}`; });
    return [`Заказ ${o.no}`, ...lines, `Доставка: ${tt.ship ? rub(tt.ship) : "бесплатно"}`, `Итого: ${rub(o.total)}`, "",
      `Имя: ${o.name}`, `Телефон: ${o.phone}`, `${o.ship === "courier" ? "Курьер: " + o.addr : "Самовывоз"}`, `Оплата: ${o.pay}`, o.note ? `Комментарий: ${o.note}` : ""].filter(Boolean).join("\n");
  }

  function success(o, tt) {
    const text = encodeURIComponent(orderText(o, tt));
    app.innerHTML = `<section class="success">
      <p class="eyebrow">Заказ ${o.no}</p>
      <h1 class="h2">Спасибо, ${esc(o.name)}! <em>Заказ принят</em></h1>
      <p>Чтобы мы сразу увидели заказ, отправьте его нам в мессенджер одним нажатием — текст уже готов. Мы перезвоним на ${esc(o.phone)} для подтверждения.</p>
      <div class="row">
        ${S.whatsapp ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${S.whatsapp}?text=${text}">Отправить в WhatsApp</a>` : ""}
        ${S.telegram ? `<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://t.me/${S.telegram}?text=${text}">Отправить в Telegram</a>` : ""}
        <a class="btn btn--ghost" href="tel:${S.phoneRaw}">Позвонить</a>
      </div>
      <a class="link" href="#/catalog" style="margin-top:20px">Продолжить покупки</a>
    </section>`;
  }

  function contactsBlock() {
    const q = encodeURIComponent(S.address);
    return `<section class="contacts" id="shop">
      <div class="contacts-info rv">
        <div><p class="eyebrow">Наш магазин</p><h2 class="h2">Ждём вас <em>в Евпатории</em></h2></div>
        <dl>
          <div><dt>Адрес</dt><dd>${esc(S.address)}</dd></div>
          <div><dt>Часы работы</dt><dd>${esc(S.hours)}</dd></div>
          <div><dt>Телефон</dt><dd><a href="tel:${S.phoneRaw}">${esc(S.phone)}</a></dd></div>
        </dl>
        <div><a class="btn btn--ghost" target="_blank" rel="noopener" href="https://yandex.ru/maps/?text=${q}">Построить маршрут</a></div>
      </div>
      <div class="map"><iframe title="Магазин на Яндекс Картах" loading="lazy" src="https://yandex.ru/map-widget/v1/?text=${q}&z=16"></iframe></div>
    </section>`;
  }
  function contacts() { document.title = "Магазин — Евпатория"; app.innerHTML = contactsBlock(); }

  function delivery() {
    document.title = "Доставка и оплата";
    app.innerHTML = `<article class="page"><p class="eyebrow">Покупателям</p><h1 class="h2">Доставка, оплата <em>и возврат</em></h1>
      <h3>Самовывоз</h3><p>Бесплатно из магазина по адресу: ${esc(S.address)}. ${esc(S.hours)}. Заказ отложим на 3 дня.</p>
      <h3>Курьер по Евпатории</h3><p>Доставка в день заказа или на следующий день — ${rub(S.deliveryPrice)}, при заказе от ${rub(S.freeDeliveryFrom)} — бесплатно. Курьер подождёт 15 минут, пока вы примеряете.</p>
      <h3>Оплата</h3><ul><li>Наличными при получении</li><li>Картой или переводом при получении</li></ul>
      <h3>Обмен и возврат</h3><p>В течение 14 дней при сохранении бирок, упаковки и товарного вида. Нижнее бельё, купальники и парфюмерия надлежащего качества обмену и возврату не подлежат.</p></article>`;
  }
  function sizes() {
    document.title = "Таблица размеров";
    app.innerHTML = `<article class="page"><p class="eyebrow">Покупателям</p><h1 class="h2">Таблица <em>размеров</em></h1>
      <h3>ZARA · одежда</h3>
      <table class="table"><tr><th>Размер</th><th>RU</th><th>Грудь, см</th><th>Талия, см</th><th>Бёдра, см</th></tr>
        <tr><td>XS</td><td>42</td><td>82</td><td>62</td><td>90</td></tr><tr><td>S</td><td>44</td><td>86</td><td>66</td><td>94</td></tr>
        <tr><td>M</td><td>46</td><td>90</td><td>70</td><td>98</td></tr><tr><td>L</td><td>48</td><td>96</td><td>76</td><td>104</td></tr>
        <tr><td>XL</td><td>50</td><td>102</td><td>82</td><td>110</td></tr></table>
      <h3>ZARA · джинсы (EUR)</h3>
      <table class="table"><tr><th>EUR</th><th>32</th><th>34</th><th>36</th><th>38</th><th>40</th><th>42</th></tr><tr><td>RU</td><td>38</td><td>40</td><td>42</td><td>44</td><td>46</td><td>48</td></tr></table>
      <h3>Victoria's Secret · бюстгальтеры</h3>
      <table class="table"><tr><th>Обхват под грудью</th><th>Размер</th></tr><tr><td>68–72 см</td><td>70</td></tr><tr><td>73–77 см</td><td>75</td></tr><tr><td>78–82 см</td><td>80</td></tr></table>
      <p>Разница между обхватом груди и обхватом под грудью: ~12 см — A, ~14 см — B, ~16 см — C.</p></article>`;
  }
  function notFound() { app.innerHTML = `<div class="empty" style="padding:140px 20px"><h2 class="h2">Страница не найдена</h2><p>Возможно, она переехала</p><a class="btn" href="#/">На главную</a></div>`; }

  // ---------- cart ----------
  function totals(ship) {
    const sub = cart.reduce((s, it) => s + (byId(it.id)?.price || 0) * it.qty, 0);
    const sh = ship === "courier" && sub < S.freeDeliveryFrom ? S.deliveryPrice : 0;
    return { sub, ship: sh, total: sub + sh };
  }
  function saveCart() { store.set("cart", cart); updateBadges(); renderCart(); }
  function addToCart(id, ci, size) {
    const ex = cart.find(it => it.id === id && it.ci === ci && it.size === size);
    if (ex) ex.qty++; else cart.push({ id, ci, size, qty: 1 });
    saveCart();
    const b = $("#cartCount"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    toast(`«${byId(id).name}» в корзине`, "Открыть", openCart);
  }
  function renderCart() {
    const body = $("#cartBody"), foot = $("#cartFoot");
    if (!cart.length) {
      body.innerHTML = `<div class="cart-empty"><p>В корзине пока пусто</p><a class="btn" href="#/catalog" data-close>В каталог</a></div>`;
      foot.style.display = "none"; return;
    }
    foot.style.display = "";
    body.innerHTML = cart.map((it, i) => {
      const p = byId(it.id); if (!p) return "";
      return `<div class="line"><a class="line-media" href="#/p/${p.id}">${media(p, it.ci)}</a><div>
        <div class="line-top"><a href="#/p/${p.id}">${esc(p.name)}</a><span>${rub(p.price * it.qty)}</span></div>
        <div class="line-meta">${BRAND[p.brand]} · ${esc(p.colors[it.ci][0])} · ${esc(it.size)}</div>
        <div class="line-ctrl"><div class="qty"><button data-q="${i}" data-d="-1" aria-label="Меньше">−</button><span>${it.qty}</span><button data-q="${i}" data-d="1" aria-label="Больше">+</button></div>
        <button class="rm" data-rm="${i}">Удалить</button></div></div></div>`;
    }).join("");
    const t = totals("pickup"), left = S.freeDeliveryFrom - t.sub;
    foot.innerHTML = `
      <div class="hint">${left > 0 ? `До бесплатной доставки осталось <b>${rub(left)}</b>` : "Доставка по Евпатории — бесплатно ✓"}</div>
      <div class="progress"><i style="width:${Math.min(100, t.sub / S.freeDeliveryFrom * 100)}%"></i></div>
      <div class="sum-row total"><span>Итого</span><span>${rub(t.sub)}</span></div>
      <a class="btn btn--block" href="#/checkout">Оформить заказ</a>`;
  }
  function updateBadges() {
    const n = cart.reduce((s, it) => s + it.qty, 0);
    const c = $("#cartCount"); c.textContent = n; c.classList.toggle("on", n > 0);
    const f = $("#favCount"); f.textContent = favs.length; f.classList.toggle("on", favs.length > 0);
  }
  function openCart() { renderCart(); $("#drawer").classList.add("on"); $("#overlay").classList.add("on"); document.body.classList.add("lock"); }
  function closeAll() {
    $("#drawer").classList.remove("on"); $("#overlay").classList.remove("on"); $("#search").classList.remove("on");
    document.body.classList.remove("lock", "menu-open");
  }
  function toggleFav(id) {
    favs = favs.includes(id) ? favs.filter(x => x !== id) : favs.concat(id);
    store.set("favs", favs); updateBadges();
    $$(`[data-fav="${id}"]`).forEach(b => b.classList.toggle("on", favs.includes(id)));
    if (favs.includes(id)) toast("Добавлено в избранное", "Смотреть", () => location.hash = "#/fav");
    if (parse().path === "/fav") favorites(), reveal();
  }

  // ---------- search ----------
  function openSearch() {
    $("#search").classList.add("on"); $("#overlay").classList.add("on"); document.body.classList.add("lock");
    setTimeout(() => $("#searchInput").focus(), 200); doSearch();
  }
  function doSearch() {
    const v = $("#searchInput").value.trim().toLowerCase(), r = $("#searchResults");
    if (!v) {
      r.innerHTML = `<p class="eyebrow">Популярные запросы</p><div class="search-hint">${["Пальто", "Джинсы", "Пижама", "Bombshell", "Мист", "Кружево", "Блейзер", "PINK"].map(s => `<button class="chip" data-sq="${s}">${s}</button>`).join("")}</div>`;
      return;
    }
    const words = v.split(/\s+/);
    const res = PRODUCTS.filter(p => {
      const hay = [p.name, p.desc, BRAND[p.brand], catName(p.brand, p.cat), p.colors.map(c => c[0]).join(" ")].join(" ").toLowerCase();
      return words.every(w => hay.includes(w.slice(0, Math.max(3, w.length - 2))));
    });
    r.innerHTML = res.length ? `<p class="eyebrow">Найдено: ${res.length}</p><div class="grid">${res.map(card).join("")}</div>`
      : `<p class="muted">Ничего не нашлось по запросу «${esc(v)}». Попробуйте иначе.</p>`;
    $$(".rv", r).forEach(e => e.classList.add("in"));
  }

  // ---------- utils ----------
  function plural(n, f) { const m = n % 10, h = n % 100; return f[m === 1 && h !== 11 ? 0 : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 1 : 2]; }
  let tt;
  function toast(msg, action, fn) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ""}`;
    if (action) $("button", t).onclick = () => { t.classList.remove("on"); fn(); };
    t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 3200);
  }
  let io;
  function reveal() {
    if (!("IntersectionObserver" in window)) return $$(".rv").forEach(e => e.classList.add("in"));
    io && io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -40px 0px" });
    $$(".rv:not(.in)").forEach(e => io.observe(e));
  }

  // ---------- global events ----------
  document.addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.fav) { e.preventDefault(); toggleFav(t.dataset.fav); }
    else if (t.dataset.quick) { e.preventDefault(); addToCart(t.dataset.quick, 0, t.dataset.size); }
    else if (t.dataset.q) { const it = cart[+t.dataset.q]; it.qty += +t.dataset.d; if (it.qty < 1) cart.splice(+t.dataset.q, 1); saveCart(); }
    else if (t.dataset.rm) { cart.splice(+t.dataset.rm, 1); saveCart(); }
    else if (t.dataset.dens) { density = t.dataset.dens; store.set("density", density); route(); }
    else if (t.dataset.sq) { $("#searchInput").value = t.dataset.sq; doSearch(); }
    else if (t.dataset.go) location.hash = t.dataset.go;
    else if (t.hasAttribute("data-close") || t.hasAttribute("data-close-search")) closeAll();
  });
  $("#cartBtn").onclick = openCart;
  $("#searchBtn").onclick = openSearch;
  $("#overlay").onclick = closeAll;
  $("#burger").onclick = () => document.body.classList.toggle("menu-open");
  $("#searchInput").addEventListener("input", doSearch);
  $("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") { const a = $("#searchResults .card a"); if (a) location.hash = a.getAttribute("href"); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); } });
  window.addEventListener("scroll", () => $("#header").classList.toggle("scrolled", scrollY > 10), { passive: true });
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", () => { cart = store.get("cart", []); favs = store.get("favs", []); updateBadges(); renderCart(); });

  // ---------- init ----------
  $("#ticker").textContent = [`Доставка по ${S.city === "Евпатория" ? "Евпатории" : S.city} бесплатно от ${rub(S.freeDeliveryFrom)}`, "Новая коллекция ZARA Woman", "Victoria's Secret: бельё, пижамы, ароматы", "Самовывоз в день заказа", S.address].join("   ✦   ");
  $("#footAddr").textContent = S.address; $("#footHours").textContent = S.hours;
  $("#footPhone").textContent = S.phone; $("#footPhone").href = "tel:" + S.phoneRaw;
  $("#year").textContent = new Date().getFullYear();
  updateBadges(); renderCart(); route();
})();

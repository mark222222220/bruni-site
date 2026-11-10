#!/usr/bin/env python3
"""
Собирает data/catalog.json из сырых данных, собранных скриптами zara_scrape.py и vs_scrape.py,
скачивает основные фото в img/ (WebP) и пишет data/catalog.js — копию JSON для открытия
сайта двойным кликом (браузеры не дают читать JSON-файлы с диска).

Использование:  python3 tools/build_catalog.py <папка_с_сырыми_данными> [--no-images]
Если вы правите data/catalog.json вручную — после правок запустите tools/json_to_js.py
"""
import json, os, re, sys, io, time, urllib.request, datetime, html as H

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else "."
NO_IMG = "--no-images" in sys.argv
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

CATEGORIES = [
    ("dresses", "Платья", "clothes"), ("coats", "Пальто", "clothes"), ("jackets", "Куртки и тренчи", "clothes"),
    ("blazers", "Пиджаки", "clothes"), ("knit", "Трикотаж", "clothes"), ("shirts", "Рубашки и блузки", "clothes"),
    ("tops", "Топы и боди", "clothes"), ("tshirts", "Футболки", "clothes"), ("trousers", "Брюки", "clothes"),
    ("jeans", "Джинсы", "clothes"), ("skirts", "Юбки", "clothes"), ("sets", "Комплекты", "clothes"), ("sweats", "Свитшоты и джоггеры", "clothes"),
    ("bras", "Бюстгальтеры", "lingerie"), ("panties", "Трусики", "lingerie"), ("lingerie", "Бельё и боди", "lingerie"),
    ("sleep", "Пижамы и халаты", "sleep"), ("lounge", "Домашняя одежда", "sleep"),
    ("fragrance", "Ароматы", "beauty"), ("bodycare", "Уход за телом", "beauty"), ("beauty", "Косметика", "beauty"),
]
ZARA_CAT = {"Платья": "dresses", "Пальто": "coats", "Куртки и тренчи": "jackets", "Пиджаки": "blazers", "Трикотаж": "knit",
            "Брюки": "trousers", "Джинсы": "jeans", "Юбки": "skirts", "Футболки": "tshirts", "Рубашки и блузки": "shirts",
            "Топы и боди": "tops", "Комплекты": "sets", "Свитшоты": "sweats", "Бельё и пижамы": "lingerie"}
VS_CAT = {"Бюстгальтеры": "bras", "Трусики": "panties", "Бельё": "lingerie", "Пижамы": "sleep", "Домашняя одежда": "lounge",
          "Ароматы": "fragrance", "Уход за телом": "bodycare", "Косметика": "beauty"}

FAM_WORDS = [  # порядок важен
    ("print", ["snake", "leopard", "animal", "print", "stripe", "striped", "check", "floral", "multicolor", "plaid", "polka", "dot"]),
    ("metallic", ["gold", "silver", "metallic", "shine", "glitter", "golden"]),
    ("white", ["white", "ecru", "oyster", "ivory", "cream", "ice", "snow", "coconut"]),
    ("black", ["black", "anthracite", "charcoal", "noir", "ebony"]),
    ("grey", ["gray", "grey", "marl", "silver", "stone", "steel"]),
    ("beige", ["beige", "sand", "camel", "taupe", "nude", "mink", "tan", "butter", "champagne", "almond", "latte", "oatmeal", "toffee", "natural", "sandalwood"]),
    ("brown", ["brown", "chocolate", "coffee", "mocha", "cocoa", "rust", "cognac", "espresso"]),
    ("blue", ["blue", "navy", "indigo", "denim", "azure", "cobalt", "teal"]),
    ("green", ["green", "khaki", "olive", "mint", "sage", "emerald", "forest"]),
    ("red", ["red", "burgundy", "maroon", "garnet", "wine", "cherry", "scarlet", "berry", "reddish", "chili", "merlot", "brick"]),
    ("pink", ["pink", "rose", "blush", "fuchsia", "magenta", "coral", "peach", "salmon"]),
    ("purple", ["purple", "lilac", "violet", "lavender", "plum", "mauve", "orchid", "eggplant", "fig"]),
    ("yellow", ["yellow", "lemon", "mustard"]),
    ("orange", ["orange", "terracotta", "apricot"]),
    ("clear", ["clear", "no color", "transparent"]),
]
def family(*names):
    for n in names:
        s = (n or "").lower()
        first = re.split(r"[/,-]", s)[0]
        for fam, words in FAM_WORDS:
            if any(w in first for w in words):
                return fam
    for n in names:
        s = (n or "").lower()
        for fam, words in FAM_WORDS:
            if any(w in s for w in words):
                return fam
    return None

COLOR_RU = {"black": "Чёрный", "white": "Белый", "ecru": "Экрю", "navy blue": "Тёмно-синий", "brown": "Коричневый", "gray marl": "Серый меланж",
    "red": "Красный", "burgundy": "Бордовый", "beige": "Бежевый", "gray": "Серый", "dark brown": "Тёмно-коричневый", "oyster-white": "Устрично-белый",
    "taupe brown": "Серо-коричневый", "khaki": "Хаки", "blue": "Синий", "light blue": "Голубой", "leopard": "Леопард", "striped": "В полоску",
    "dark gray": "Тёмно-серый", "anthracite grey": "Антрацит", "maroon": "Бордовый", "light beige": "Светло-бежевый", "dark khaki": "Тёмный хаки",
    "beige marl": "Бежевый меланж", "dark navy": "Тёмно-синий", "light gray": "Светло-серый", "mink": "Норковый", "multicolored": "Разноцветный",
    "pink": "Розовый", "green": "Зелёный", "dark green": "Тёмно-зелёный", "yellow": "Жёлтый", "cream": "Кремовый", "olive green": "Оливковый",
    "brown marl": "Коричневый меланж", "pastel pink": "Пастельно-розовый", "intense red": "Ярко-красный", "printed": "С принтом", "golden": "Золотой",
    "sand / marl": "Песочный меланж", "brown / taupe": "Коричневый / серо-бежевый", "black / white": "Чёрный / белый", "black / ecru": "Чёрный / экрю",
    "black / brown": "Чёрный / коричневый", "ecru / black": "Экрю / чёрный", "ecru / red": "Экрю / красный", "pastel yellow": "Пастельно-жёлтый",
    "ice": "Ледяной", "butter": "Сливочный", "stone": "Каменный", "indigo": "Индиго", "dark indigo": "Тёмный индиго", "mid-blue": "Синий",
    "light camel": "Светлый кэмел", "mid-camel": "Кэмел", "dusty pink": "Пыльно-розовый", "electric blue": "Электрик", "garnet": "Гранатовый",
    "apple green": "Яблочно-зелёный", "midnight blue": "Полночный синий", "light khaki": "Светлый хаки", "dark olive": "Тёмно-оливковый",
    "dark burgundy": "Тёмно-бордовый", "light tan": "Светло-бежевый", "taupe gray": "Серо-бежевый", "light mink": "Светлый норковый",
    "neon blue": "Неоново-синий", "reddish": "Красноватый", "greenish": "Зеленоватый", "brown stripes": "Коричневая полоска", "red stripe": "Красная полоска"}
def color_ru(name):
    return COLOR_RU.get((name or "").strip().lower(), (name or "").strip().capitalize())

def strip_html(h):
    t = re.sub(r"<li>\s*", "• ", h or ""); t = re.sub(r"</(p|li|ul)>|<br\s*/?>", "\n", t); t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\n\s*\n+", "\n", H.unescape(t)).strip()

# ---------- изображения ----------
IMG_DIR = os.path.join(SITE, "img")
def fetch_img(url, out, width):
    if os.path.exists(out): return True
    if NO_IMG: return False
    try:
        from PIL import Image
        data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()
        im = Image.open(io.BytesIO(data)).convert("RGB")
        if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out, "WEBP", quality=72, method=5)
        time.sleep(0.15)
        return True
    except Exception as e:
        print("img fail", url[:90], e); return False

LOCAL_W = 720
def localize(urls, key, n_local):
    """Первые n_local фото скачиваются в img/ (для каталога и превью), остальные остаются ссылками на CDN бренда."""
    out = []
    for i, u in enumerate(urls):
        if i < n_local:
            rel = f"img/{key}-{i}.webp"
            if fetch_img(u["local"], os.path.join(SITE, rel), LOCAL_W): out.append(rel); continue
        out.append(u["remote"])
    return out

# ---------- ZARA ----------
def build_zara():
    det = json.load(open(os.path.join(RAW, "zara_detail.json")))
    lists = {}
    for fn in os.listdir(os.path.join(RAW, "zl")):
        d = json.load(open(os.path.join(RAW, "zl", fn)))
        for g in d.get("productGroups", []):
            for e in g.get("elements", []):
                for c in e.get("commercialComponents", []):
                    if c.get("type") == "Product": lists[str(c["id"])] = c
    out = []
    for pid, v in det.items():
        if "error" in v: continue
        p = v["product"]; li = lists.get(pid, {})
        cat = ZARA_CAT[v["cat"]]
        nm = p["name"].upper()
        if cat == "lingerie":
            if re.search(r"PAJAMA|PYJAMA|ROBE|NIGHT", nm): cat = "sleep"
            elif re.search(r"\bBRA\b|BRALETTE", nm): cat = "bras"
            elif re.search(r"BRIEF|PANT|THONG|KNICKER", nm) and "PANTS" not in nm: cat = "panties"
        colors = []
        for ci, c in enumerate(p["detail"]["colors"][:6]):
            media = [m for m in c.get("xmedia", []) if m.get("type") == "image" and m.get("kind") in ("full", "other")]
            media += [m for m in c.get("xmedia", []) if m.get("type") == "image" and m.get("kind") == "plain"][:1]
            urls = [{"local": m["url"].replace("{width}", "1024"), "remote": m["url"].replace("{width}", "1500")} for m in media[:7]]
            if not urls: continue
            imgs = localize(urls, f"z/{pid}-{c['id']}", 2 if ci == 0 else 1)
            sizes = [{"n": s["name"], "a": s.get("availability") in ("in_stock", "low_on_stock")} for s in c.get("sizes", [])]
            colors.append({"name": color_ru(c["name"]), "nameEn": c["name"], "family": family(c["name"]), "hex": None,
                           "images": imgs, "sizes": sizes, "priceUsd": c.get("price", 0) / 100})
        if not colors: continue
        c0 = p["detail"]["colors"][0]
        comp = []
        for part in (p["detail"].get("detailedComposition") or {}).get("parts", []):
            comps = ", ".join(f'{x["percentage"]} {x["material"]}' for x in part.get("components", []))
            if comps: comp.append(f'{part.get("description", "").capitalize()}: {comps}')
        sz = set(s["n"] for c in colors for s in c["sizes"])
        chart = "zara-num" if any("(US" in s for s in sz) else ("zara-alpha" if sz - {"ONE SIZE"} else "none")
        old = c0.get("oldPrice")
        out.append({
            "id": "z-" + pid, "brand": "zara", "brandName": "Zara", "line": None, "name": p["name"].capitalize() if p["name"].isupper() else p["name"],
            "category": cat, "priceUsd": c0["price"] / 100, "oldPriceUsd": (old / 100) if old else None,
            "isNew": any(t.get("type") == "NEW" for t in (li.get("tagTypes") or [])),
            "description": c0.get("description") or "", "composition": "\n".join(comp), "sizeChart": chart,
            "ref": p["detail"].get("displayReference"), "source": f"https://www.zara.com/us/en/{li['seo']['keyword']}-p{li['seo']['seoProductId']}.html" if li.get("seo") else None,
            "colors": colors})
    return out

# ---------- VICTORIA'S SECRET ----------
VS_IMG = "https://www.victoriassecret.com/p/{}/{}.jpg"
def build_vs():
    raw = json.load(open(os.path.join(RAW, "vs_raw.json")))
    det = json.load(open(os.path.join(RAW, "vs_detail.json")))
    out = []; skipped = 0
    for gid, r in raw.items():
        it = r["item"]; d = det.get(gid, {})
        cat = VS_CAT[r["cat"]]
        price = float(re.sub(r"[^\d.]", "", (it.get("price") or "0").split("-")[0]) or 0)
        sale = float(re.sub(r"[^\d.]", "", it["salePrice"].split("-")[0]) or 0) if it.get("salePrice") else None
        if not price: continue
        colors = []
        choices = d.get("choices") if "error" not in d else None
        if choices:
            # сначала цвет, показанный в каталоге
            first = it["id"].split("|")[1]
            choices = sorted(choices, key=lambda c: c["id"] != first)
            for ci, c in enumerate(choices[:6]):
                imgs_src = c["images"] or []
                if not imgs_src: continue
                urls = [{"local": VS_IMG.format("760x1013", x), "remote": VS_IMG.format("1520x2027", x)} for x in imgs_src[:7]]
                fix = lambda x: re.sub(r"^(XXS|XS|S|M|L|XL|XXL|XXXL)(Regular|Short|Long|Petite|Tall)$", r"\1 \2", x)
                sizes = [{"n": fix(s), "a": True} for s in c["sizes"]] + [{"n": fix(s), "a": False} for s in c["unavailable"]]
                if not sizes: continue
                colors.append({"name": c["label"], "nameEn": c["label"], "family": family(c.get("color"), c["label"]), "hex": None,
                               "images": localize(urls, f"vs/{gid}-{c['id']}", 2 if ci == 0 else 1), "sizes": sizes, "priceUsd": c.get("price")})
        if not colors:
            skipped += 1
            continue  # без страницы товара нет размеров — не выдумываем, пропускаем
        sz = set(s["n"] for c in colors for s in c["sizes"])
        chart = "vs-bra" if any(re.match(r"^\d{2}[A-Z]", s) for s in sz) else ("vs-alpha" if any(s.split("/")[0].strip() in ("XS", "S", "M", "L", "XL", "XXL") for s in sz) else "none")
        out.append({
            "id": "vs-" + gid, "brand": "vs", "brandName": "Victoria's Secret", "line": it.get("family"),
            "name": it["name"], "category": cat, "priceUsd": sale or price, "oldPriceUsd": price if sale else None,
            "isNew": bool(it.get("isNew")), "description": d.get("desc", ""), "composition": "", "sizeChart": chart,
            "ref": it["id"].replace("|", "-"), "source": "https://www.victoriassecret.com" + it["url"].split("?")[0],
            "colors": colors})
    print("VS skipped (no detail page):", skipped)
    return out

def main():
    rate = json.load(urllib.request.urlopen(urllib.request.Request("https://www.cbr-xml-daily.ru/daily_json.js", headers={"User-Agent": UA}), timeout=30))
    usd = round(rate["Valute"]["USD"]["Value"], 4)
    z = build_zara(); v = build_vs()
    cats_used = {p["category"] for p in z + v}
    data = {
        "meta": {"generatedAt": datetime.datetime.now().isoformat(timespec="seconds"), "usdRub": usd, "usdRubDate": rate["Date"][:10],
                 "usdRubSource": "ЦБ РФ (cbr-xml-daily.ru)", "currencyOfPrices": "USD",
                 "sources": {"zara": {"site": "https://www.zara.com/us/en/ (раздел WOMAN)", "count": len(z)},
                             "vs": {"site": "https://www.victoriassecret.com/us/", "count": len(v)}},
                 "note": "Цены priceUsd — цены брендов в США. Рубли = priceUsd × курс × (1 + наценка%), наценка задаётся в assets/js/config.js"},
        "categories": [{"id": i, "title": t, "group": g} for i, t, g in CATEGORIES if i in cats_used],
        "products": z + v}
    os.makedirs(os.path.join(SITE, "data"), exist_ok=True)
    with open(os.path.join(SITE, "data", "catalog.json"), "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    write_js()
    print("zara", len(z), "vs", len(v), "usd", usd)

def write_js():
    src = os.path.join(SITE, "data", "catalog.json")
    data = json.load(open(src, encoding="utf8"))
    with open(os.path.join(SITE, "data", "catalog.js"), "w", encoding="utf8") as f:
        f.write("/* Автоматическая копия data/catalog.json для открытия сайта без сервера. Не редактируйте — правьте catalog.json и запустите tools/json_to_js.py */\n")
        f.write("window.CATALOG_DATA = "); json.dump(data, f, ensure_ascii=False, separators=(",", ":")); f.write(";\n")

if __name__ == "__main__":
    main()

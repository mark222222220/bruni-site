#!/usr/bin/env python3
"""После ручной правки data/catalog.json запустите:  python3 tools/json_to_js.py
Скрипт обновит data/catalog.js — копию каталога, которую сайт читает при открытии двойным кликом."""
import json, os
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(SITE, "data", "catalog.json"), encoding="utf8"))
with open(os.path.join(SITE, "data", "catalog.js"), "w", encoding="utf8") as f:
    f.write("/* Автоматическая копия data/catalog.json для открытия сайта без сервера. Не редактируйте — правьте catalog.json и запустите tools/json_to_js.py */\n")
    f.write("window.CATALOG_DATA = "); json.dump(data, f, ensure_ascii=False, separators=(",", ":")); f.write(";\n")
print("ok:", len(data["products"]), "товаров")

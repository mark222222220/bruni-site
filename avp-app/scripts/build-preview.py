"""Собирает веб-предпросмотр приложения в один HTML-файл (код, стили и шрифты внутри).

    npx expo export --platform web --output-dir dist
    python3 scripts/build-preview.py dist preview.html
"""
import base64, glob, sys

src, out = sys.argv[1], sys.argv[2]
js = open(glob.glob(src + '/_expo/static/js/web/entry-*.js')[0]).read().replace('</script', '<\\/script')
css = ''.join(open(f).read() for f in glob.glob(src + '/_expo/static/css/*.css'))
fonts = ''
for w, n in [('400Regular', 'Rubik_400Regular'), ('600SemiBold', 'Rubik_600SemiBold'), ('700Bold', 'Rubik_700Bold'), ('800ExtraBold', 'Rubik_800ExtraBold')]:
    b = base64.b64encode(open(f'node_modules/@expo-google-fonts/rubik/{w}/{n}.ttf', 'rb').read()).decode()
    fonts += f"@font-face{{font-family:'{n}';src:url(data:font/ttf;base64,{b}) format('truetype');font-display:block}}\n"
page = f'''<title>AVP system</title>
<style>
:root{{color-scheme:dark;padding:0!important}}
html,body{{height:100%;margin:0;background:#0A0A0C;overflow:hidden;-webkit-text-size-adjust:100%;overscroll-behavior:none}}
#root{{display:flex;height:100%;flex:1}}
input,textarea{{font-size:16px}}
{fonts}{css}
</style>
<div id="root"></div>
<script>try{{history.replaceState(null,'','/')}}catch(e){{}}</script>
<script>
{js}
</script>
'''
open(out, 'w').write(page)
print(f'{out}: {len(page) / 1e6:.1f} MB')

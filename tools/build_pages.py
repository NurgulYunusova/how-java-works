#!/usr/bin/env python3
"""Builds the static pages that search engines read.

tools/template.html is the page source. This script runs the real site in headless Chrome
(tools/extract.html), takes the text of every topic in every language, and writes:

  index.html            the root page, English text, picks the reader's language on load
  az/, tr/, en/         one page per topic and language, e.g. az/gc/index.html
  sitemap.xml, robots.txt
  og/az.png ...         preview images for links shared in chats and social networks

Run it after changing the template or any text:  python3 tools/build_pages.py
"""
import html, json, os, re, shutil, subprocess, sys, tempfile, datetime

BASE = 'https://how-java-works.pages.dev/'
LANGS = ['az', 'tr', 'en']
LOCALE = {'az': 'az_AZ', 'tr': 'tr_TR', 'en': 'en_US'}
HOME = {
    'az': ('Java necə işləyir · interaktiv dərslər',
           'Java-nın daxilini interaktiv öyrən: JVM-də stack və heap, HashMap, Garbage Collection, thread-lər, virtual thread-lər, bytecode və daha çoxu. Azərbaycan dilində, pulsuz.'),
    'tr': ('Java nasıl çalışır · interaktif dersler',
           "Java'nın iç yapısını interaktif öğren: JVM'de stack ve heap, HashMap, Garbage Collection, thread'ler, virtual thread'ler, bytecode ve daha fazlası. Türkçe ve ücretsiz."),
    'en': ('How Java works · interactive lessons',
           'Learn Java internals interactively: stack and heap in the JVM, HashMap, garbage collection, threads, virtual threads, bytecode and more. Free, in English, Turkish and Azerbaijani.'),
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
WJ = '⁠'


def chrome(*args):
    return subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', *args],
                          capture_output=True, text=True, timeout=120)


def extract():
    r = chrome('--virtual-time-budget=15000', '--dump-dom', 'file://' + os.path.join(ROOT, 'tools', 'extract.html'))
    m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, re.S)
    if not m:
        sys.exit('extract.html produced no output:\n' + r.stderr[-2000:])
    data = json.loads(html.unescape(m.group(1)))
    if 'error' in data:
        sys.exit('extract.html failed: ' + data['error'])
    return data


def url(lang, route):
    return BASE + lang + '/' + ('' if route == 'home' else route + '/')


def clean(s):
    return s.replace(WJ, '')


def fill(doc, attr, value, raw=False):
    """Puts text into the empty element that carries attr, e.g. data-s="gMem"."""
    pat = re.compile(r'(<(\w+)\b[^>]*\b' + re.escape(attr) + r'[^>]*>)(</\2>)')
    value = clean(value)
    new, n = pat.subn(lambda m: m.group(1) + (value if raw else html.escape(value, quote=False)) + m.group(3), doc)
    return new, n


def head(lang, route, page, site, is_root):
    title, desc = HOME[lang] if route == 'home' else (clean(page['title']), clean(page['desc']))
    canon = BASE if is_root else url(lang, route)
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{url(l, route)}">\n' for l in LANGS)
    alts += f'<link rel="alternate" hreflang="x-default" href="{BASE if route == "home" else url("en", route)}">\n'
    e = lambda s: html.escape(s, quote=True)
    ld = {'@context': 'https://schema.org', '@type': 'WebSite' if route == 'home' else 'LearningResource',
          'name': title if route == 'home' else clean(page['name']), 'description': desc, 'inLanguage': lang, 'url': canon}
    if route != 'home':
        ld.update({'learningResourceType': 'interactive lesson', 'isPartOf': {'@type': 'WebSite', 'name': clean(site), 'url': BASE + lang + '/'}})
    return (f'<title>{e(title)}</title>\n'
            f'<meta name="description" content="{e(desc)}">\n'
            f'<link rel="canonical" href="{canon}">\n{alts}'
            f'<meta property="og:type" content="website">\n'
            f'<meta property="og:site_name" content="{e(clean(site))}">\n'
            f'<meta property="og:title" content="{e(title)}">\n'
            f'<meta property="og:description" content="{e(desc)}">\n'
            f'<meta property="og:url" content="{canon}">\n'
            f'<meta property="og:image" content="{BASE}og/{lang}.png">\n'
            f'<meta property="og:locale" content="{LOCALE[lang]}">\n'
            f'<meta name="twitter:card" content="summary_large_image">\n'
            f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')


def build_page(tpl, data, lang, route, is_root=False):
    L = data[lang]
    page = L['pages'][route]
    depth = 0 if is_root else (1 if route == 'home' else 2)
    root = '../' * depth
    doc = tpl
    attrs = f'lang="{lang}"' + ('' if is_root else f' data-route="{route}" data-lang="{lang}" data-root="{root or "./"}"')
    doc = doc.replace('<html lang="az">', f'<html {attrs}>', 1)
    doc = re.sub(r'<title>.*?</title>', lambda m: head(lang, route, page, L['site'], is_root), doc, count=1, flags=re.S)
    doc = doc.replace('href="../css/', f'href="{root}css/').replace('src="../js/', f'src="{root}js/')
    target = lambda r: root + (lang + '/' + ('' if r == 'home' else r + '/'))
    doc = re.sub(r'href="#([a-z]+)" data-go="\1"', lambda m: f'href="{target(m.group(1))}" data-go="{m.group(1)}"', doc)
    for key, text in L['texts'].items():
        doc, _ = fill(doc, key, text)
    view = 'view-' + ('lesson' if route in data['routes'][3:] else route)
    doc = re.sub(r'(<(?:main|div)\b[^>]*\bid="(view-[a-z]+)"[^>]*?)( hidden)?>',
                 lambda m: m.group(1) + ('' if m.group(2) == view else ' hidden') + '>', doc)
    if page.get('h1'):
        doc, n = fill(doc, 'id="ls-title"', page['h1']); assert n == 1
    if page.get('prose'):
        doc, n = fill(doc, 'id="ls-prose"' if view == 'view-lesson' else 'id="hm-prose"', page['prose'], raw=True); assert n == 1
    return doc


def main():
    tpl = open(os.path.join(ROOT, 'tools', 'template.html'), encoding='utf-8').read()
    data = extract()
    routes = data['routes']
    for lang in LANGS:
        shutil.rmtree(os.path.join(ROOT, lang), ignore_errors=True)
        for r in routes:
            d = os.path.join(ROOT, lang, '' if r == 'home' else r)
            os.makedirs(d, exist_ok=True)
            open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(build_page(tpl, data, lang, r))
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(build_page(tpl, data, 'en', 'home', is_root=True))

    today = datetime.date.today().isoformat()
    items = [f'  <url><loc>{BASE}</loc><lastmod>{today}</lastmod></url>']
    for r in routes:
        alts = ''.join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{url(l, r)}"/>' for l in LANGS)
        alts += f'<xhtml:link rel="alternate" hreflang="x-default" href="{BASE if r == "home" else url("en", r)}"/>'
        items += [f'  <url><loc>{url(l, r)}</loc><lastmod>{today}</lastmod>{alts}</url>' for l in LANGS]
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + '\n'.join(items) + '\n</urlset>\n')
    open(os.path.join(ROOT, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n')

    os.makedirs(os.path.join(ROOT, 'og'), exist_ok=True)
    for lang in LANGS:
        chrome('--hide-scrollbars', '--virtual-time-budget=4000', '--window-size=1200,630',
               '--screenshot=' + os.path.join(ROOT, 'og', lang + '.png'), 'file://' + os.path.join(ROOT, lang, 'index.html'))
    print(f'{len(routes) * len(LANGS) + 1} pages, sitemap with {len(items)} addresses, 3 preview images')


if __name__ == '__main__':
    main()

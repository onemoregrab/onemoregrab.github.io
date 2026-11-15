#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""공식 홈페이지 정적 다국어 페이지 생성기.

index.html(한국어 원문)을 바탕으로 /en/ /ja/ /zh-tw/ /es/ /pt/ /ar/ 의 index.html 을 만든다.
- 머리말(<head>)의 lang·title·description·canonical·hreflang·og 를 그 언어 값으로 바꾸고
- 본문의 data-i18n 계열 표시가 붙은 자리를 사전(assets/i18n-dict-*.js) 값으로 미리 채운다.
  (그래서 자바스크립트를 실행하지 않는 검색엔진도 그 언어 본문을 읽는다.)
- 스토어 링크에는 채널·언어별 UTM 을 붙인다.

사용법:  python3 tools/build_i18n_pages.py          # 생성
        python3 tools/build_i18n_pages.py --check  # 생성 결과가 원본과 어긋나면 실패(0/1)

원문(index.html)이나 사전을 고친 뒤에는 반드시 다시 실행한다.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://onemoregrab.github.io'

# 언어 -> (경로, html lang, og:locale)
LANGS = [
    ('en', 'en', 'en', 'en_US'),
    ('ja', 'ja', 'ja', 'ja_JP'),
    ('zh-TW', 'zh-tw', 'zh-Hant', 'zh_TW'),
    ('es', 'es', 'es', 'es_ES'),
    ('pt', 'pt', 'pt', 'pt_BR'),
    ('ar', 'ar', 'ar', 'ar_AR'),
]
KO_LOCALE = 'ko_KR'

STORE_APPLE = 'https://apps.apple.com/app/id6832755431'
STORE_PLAY = 'https://play.google.com/store/apps/details?id=com.onemoregrab.clawgame'


# ---------------------------------------------------------------- 사전 파싱
class JSLiteral:
    """i18n 사전 파일의 자바스크립트 객체 리터럴만 읽는 최소 파서."""

    def __init__(self, src):
        self.s = src
        self.i = 0

    def error(self, msg):
        raise ValueError('%s (at %d: %r)' % (msg, self.i, self.s[max(0, self.i - 40):self.i + 40]))

    def ws(self):
        while self.i < len(self.s):
            c = self.s[self.i]
            if c in ' \t\r\n':
                self.i += 1
            elif self.s.startswith('//', self.i):
                j = self.s.find('\n', self.i)
                self.i = len(self.s) if j < 0 else j + 1
            else:
                break

    def string(self):
        q = self.s[self.i]
        if q not in '\'"':
            self.error('string expected')
        self.i += 1
        out = []
        while self.i < len(self.s):
            c = self.s[self.i]
            if c == '\\':
                n = self.s[self.i + 1]
                self.i += 2
                if n == 'n':
                    out.append('\n')
                elif n == 't':
                    out.append('\t')
                elif n == 'r':
                    out.append('\r')
                elif n == 'u':
                    out.append(chr(int(self.s[self.i:self.i + 4], 16)))
                    self.i += 4
                elif n == 'x':
                    out.append(chr(int(self.s[self.i:self.i + 2], 16)))
                    self.i += 2
                else:
                    out.append(n)
            elif c == q:
                self.i += 1
                return ''.join(out)
            else:
                out.append(c)
                self.i += 1
        self.error('unterminated string')

    def key(self):
        self.ws()
        if self.s[self.i] in '\'"':
            return self.string()
        m = re.match(r'[A-Za-z0-9_$]+', self.s[self.i:])
        if not m:
            self.error('key expected')
        self.i += m.end()
        return m.group(0)

    def value(self):
        self.ws()
        c = self.s[self.i]
        if c == '{':
            return self.obj()
        if c in '\'"':
            return self.string()
        m = re.match(r'(true|false|null|-?\d+(?:\.\d+)?)', self.s[self.i:])
        if not m:
            self.error('value expected')
        self.i += m.end()
        v = m.group(1)
        return {'true': True, 'false': False, 'null': None}.get(v, float(v) if '.' in v else int(v))

    def obj(self):
        self.ws()
        if self.s[self.i] != '{':
            self.error('{ expected')
        self.i += 1
        out = {}
        while True:
            self.ws()
            if self.s[self.i] == '}':
                self.i += 1
                return out
            k = self.key()
            self.ws()
            if self.s[self.i] != ':':
                self.error(': expected')
            self.i += 1
            out[k] = self.value()
            self.ws()
            if self.s[self.i] == ',':
                self.i += 1
            elif self.s[self.i] != '}':
                self.error(', or } expected')


def load_dict():
    merged = {}
    for name in ('i18n-dict-a.js', 'i18n-dict-b.js'):
        with open(os.path.join(ROOT, 'assets', name), encoding='utf-8') as f:
            src = f.read()
        start = src.find('Object.assign(')
        if start < 0:
            raise ValueError('%s: Object.assign not found' % name)
        # 'Object.assign(window.OMG_I18N_DICT || {}, {' 의 두 번째 인자(사전 본문)를 읽는다
        m = re.search(r'Object\.assign\([^,]*,\s*\{', src)
        if not m:
            raise ValueError('%s: dictionary object not found' % name)
        p = JSLiteral(src)
        p.i = m.end() - 1
        part = p.obj()
        for lang, table in part.items():
            merged.setdefault(lang, {}).update(table)
    return merged


# ---------------------------------------------------------------- 본문 치환
TAG_RE = re.compile(r'<([a-zA-Z][a-zA-Z0-9:-]*)')
I18N_ATTR_RE = re.compile(r'data-i18n(-[a-z]+(?:-[a-z]+)*)?="([^"]*)"')


def esc_text(v):
    return (v.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def esc_attr(v):
    return esc_text(v).replace('"', '&quot;')


def find_close(src, tag, pos):
    """pos 이후에서 tag 의 짝이 맞는 닫는 태그 시작 위치를 찾는다."""
    pat = re.compile(r'<(/?)' + re.escape(tag) + r'(?=[\s/>])', re.I)
    depth = 1
    for m in pat.finditer(src, pos):
        if m.group(1) == '/':
            depth -= 1
            if depth == 0:
                return m.start()
        else:
            end = src.find('>', m.end())
            if end < 0:
                break
            if src[end - 1] != '/':
                depth += 1
    raise ValueError('closing tag not found: <%s> at %d' % (tag, pos))


def collect_inner_spans(src):
    """data-i18n / data-i18n-html 이 붙은 요소의 (본문 시작, 본문 끝, 키, 종류) 목록."""
    out = []
    for m in I18N_ATTR_RE.finditer(src):
        kind = m.group(1) or ''
        key = m.group(2)
        if kind not in ('', '-html'):
            continue
        lt = src.rfind('<', 0, m.start())
        if lt < 0:
            continue
        tm = TAG_RE.match(src, lt)
        if not tm:
            continue
        tag = tm.group(1)
        gt = src.find('>', m.end())
        if gt < 0:
            continue
        close = find_close(src, tag, gt + 1)
        out.append((gt + 1, close, key, tag, 'html' if kind == '-html' else 'text'))
    out.sort()
    for a, b in zip(out, out[1:]):
        if a[1] > b[0]:
            raise ValueError('overlapping i18n elements: %s / %s' % (a[2], b[2]))
    return out


def collect_attr_spans(src):
    """data-i18n-alt 같은 표시의 (대상 속성 값 시작, 값 끝, 키, 속성 이름).

    data-i18n-alt="KEY" 는 같은 요소의 alt 속성 값을 사전 값으로 바꾼다는 뜻이다(i18n.js 와 같은 규칙).
    """
    out = []
    for m in I18N_ATTR_RE.finditer(src):
        kind = m.group(1) or ''
        if kind in ('', '-html'):
            continue
        attr = kind[1:]
        lt = src.rfind('<', 0, m.start())
        tm = TAG_RE.match(src, lt) if lt >= 0 else None
        if not tm:
            continue
        gt = src.find('>', m.end())
        if gt < 0:
            continue
        tag_src = src[lt:gt]
        am = re.search(r'(?<=[\s<])' + re.escape(attr) + r'="([^"]*)"', tag_src)
        if am:
            out.append((lt + am.start(1), lt + am.end(1), m.group(2), attr))
        else:
            # 대상 속성이 없으면 태그 끝에 새로 넣는다
            insert = ' %s=""' % attr
            out.append((gt, gt, m.group(2), attr, insert, tag_src))
    return out


def render_body(src, table, fallback):
    def pick(key):
        v = table.get(key)
        if v is None:
            v = fallback.get(key)
        return v

    # 1. 속성 값(alt·aria-label·title·content·data-*)
    for span in sorted(collect_attr_spans(src), key=lambda x: x[0], reverse=True):
        v = pick(span[2])
        if v is None:
            continue
        a, b, key, attr = span[:4]
        if len(span) > 4:
            src = src[:a] + (' %s="%s"' % (attr, esc_attr(v))) + src[b:]
        else:
            src = src[:a] + esc_attr(v) + src[b:]

    # 2. 요소 본문
    for a, b, key, tag, kind in sorted(collect_inner_spans(src), reverse=True):
        v = pick(key)
        if v is None:
            continue
        src = src[:a] + (v if kind == 'html' else esc_text(v)) + src[b:]

    return src


# ---------------------------------------------------------------- 머리말
def hreflang_block():
    rows = ['<link rel="alternate" hreflang="ko" href="%s/">' % SITE]
    for lang, path, _, _ in LANGS:
        rows.append('<link rel="alternate" hreflang="%s" href="%s/%s/">' % (lang, SITE, path))
    rows.append('<link rel="alternate" hreflang="x-default" href="%s/">' % SITE)
    return '\n'.join(rows)


def play_url(lang, slot):
    ref = 'utm_source%%3Donemoregrab_web%%26utm_medium%%3Dportal%%26utm_campaign%%3D%s%%26utm_content%%3D%s' % (lang, slot)
    return '%s&amp;referrer=%s' % (STORE_PLAY, ref)


def apple_url(lang, slot):
    return '%s?mt=8&amp;ct=omgweb_%s_%s' % (STORE_APPLE, slot, lang.replace('-', ''))


def rewrite_stores(src, lang):
    """홈의 스토어 링크에 언어·위치별 UTM 을 붙인다(히어로 / 시작 섹션)."""
    def link(m):
        url = m.group(1)
        after = src[m.end():m.end() + 220]
        slot = 'start' if 'data-i18n="start.' in after else 'hero'
        return 'href="%s"' % (play_url(lang, slot) if url == STORE_PLAY else apple_url(lang, slot))

    src = re.sub(r'href="(https://apps\.apple\.com/app/id6832755431(?:\?[^"]*)?)"', link, src)
    src = re.sub(r'href="(https://play\.google\.com/store/apps/details\?id=com\.onemoregrab\.clawgame(?:&amp;[^"]*)?)"', link, src)
    # 기기에 맞는 스토어로 보내는 큰 버튼(portal.js 가 읽는 값)
    src = re.sub(r'data-appstore="[^"]*"', lambda _: 'data-appstore="%s"' % apple_url(lang, 'hero'), src, count=1)
    src = re.sub(r'data-playstore="[^"]*"', lambda _: 'data-playstore="%s"' % play_url(lang, 'hero'), src, count=1)
    return src


def set_head(src, lang, path, html_lang, og_locale, table, fallback):
    title = table.get('meta.home.title') or fallback.get('meta.home.title')
    desc = table.get('meta.home.desc') or fallback.get('meta.home.desc')
    brand = table.get('brand.game') or fallback.get('brand.game') or '한 판 더! 인형뽑기'
    url = '%s/%s/' % (SITE, path)

    # <html>
    html_attrs = 'lang="%s"' % html_lang
    if lang == 'ar':
        html_attrs += ' dir="rtl"'
    html_attrs += ' data-lang-set="%s"' % lang
    src = re.sub(r'<html[^>]*>', lambda _: '<html %s>' % html_attrs, src, count=1)

    # 미리 그려 두므로 즉시 실행 언어 감지 스크립트는 뺀다
    src = re.sub(r'<script>\(function\(\)\{try\{var L=\[.*?</script>\n', '', src, count=1, flags=re.S)

    src = re.sub(r'<title>.*?</title>', lambda _: '<title>%s</title>' % esc_text(title), src, count=1, flags=re.S)
    src = re.sub(r'<meta name="description" content="[^"]*">',
                 lambda _: '<meta name="description" content="%s">' % esc_attr(desc), src, count=1)

    # hreflang 8종
    src = re.sub(r'<link rel="alternate" hreflang="ko".*?<link rel="alternate" hreflang="x-default"[^>]*>',
                 lambda _: hreflang_block(), src, count=1, flags=re.S)
    src = re.sub(r'<link rel="canonical" href="[^"]*">',
                 lambda _: '<link rel="canonical" href="%s">' % url, src, count=1)

    # og / twitter
    src = re.sub(r'<meta property="og:locale" content="[^"]*">',
                 lambda _: '<meta property="og:locale" content="%s">' % og_locale, src, count=1)
    all_locales = [KO_LOCALE] + [lo for _, _, _, lo in LANGS]
    alts = [lo for lo in all_locales if lo != og_locale]
    src = re.sub(r'(<meta property="og:locale:alternate" content="[^"]*">\n)+',
                 lambda _: ''.join('<meta property="og:locale:alternate" content="%s">\n' % a for a in alts), src, count=1)
    src = re.sub(r'<meta property="og:site_name" content="[^"]*">',
                 lambda _: '<meta property="og:site_name" content="%s">' % esc_attr(brand), src, count=1)
    src = re.sub(r'<meta property="og:title" content="[^"]*">',
                 lambda _: '<meta property="og:title" content="%s">' % esc_attr(title), src, count=1)
    src = re.sub(r'<meta property="og:description" content="[^"]*">',
                 lambda _: '<meta property="og:description" content="%s">' % esc_attr(desc), src, count=1)
    src = re.sub(r'<meta property="og:url" content="[^"]*">',
                 lambda _: '<meta property="og:url" content="%s">' % url, src, count=1)
    src = re.sub(r'<meta name="twitter:title" content="[^"]*">',
                 lambda _: '<meta name="twitter:title" content="%s">' % esc_attr(title), src, count=1)
    src = re.sub(r'<meta name="twitter:description" content="[^"]*">',
                 lambda _: '<meta name="twitter:description" content="%s">' % esc_attr(desc), src, count=1)
    return src


def set_country_banner(src, table, fallback):
    """도감 위 배너의 첫 값(전체 대표)을 그 언어로 채운다."""
    def pick(key):
        v = table.get(key)
        return v if v is not None else fallback.get(key)

    for el, key in (('cb-name', 'tab.all.name'), ('cb-desc', 'tab.all.desc'),
                    ('cb-stages', 'tab.all.stages'), ('cb-doll', 'tab.all.doll'),
                    ('cb-boss', 'tab.all.boss')):
        v = pick(key)
        if v is None:
            continue
        pat = re.compile(r'(<[a-z0-9]+[^>]*id="%s"[^>]*>)(.*?)(</[a-z0-9]+>)' % el, re.S)
        src = pat.sub(lambda m: m.group(1) + esc_text(v) + m.group(3), src, count=1)
    return src


STORE_URL_RE = re.compile(
    r'https://apps\.apple\.com/app/id6832755431(\?[^"]*)?'
    r'|https://play\.google\.com/store/apps/details\?id=com\.onemoregrab\.clawgame(&amp;[^"]*)?')


def strip_store_utm(src):
    """이미 붙어 있는 스토어 UTM 을 떼고 깨끗한 주소로 돌려놓는다(여러 번 돌려도 같은 결과)."""
    src = re.sub(r'https://apps\.apple\.com/app/id6832755431(?:\?[^"]*)?', STORE_APPLE, src)
    src = re.sub(r'https://play\.google\.com/store/apps/details\?id=com\.onemoregrab\.clawgame(?:&amp;[^"]*)?', STORE_PLAY, src)
    return src


def ensure_analytics_tags(src, ver):
    """GA4 켜는 한 줄(config.js 의 ga4Id)을 읽는 스크립트 두 개를 넣는다(이미 있으면 그대로)."""
    if '/assets/analytics.js' in src:
        src = re.sub(r'/assets/config\.js\?v=[0-9a-z]+', '/assets/config.js?v=%s' % ver, src)
        src = re.sub(r'/assets/analytics\.js\?v=[0-9a-z]+', '/assets/analytics.js?v=%s' % ver, src)
        return src
    tags = ('<script src="/assets/config.js?v=%s"></script>\n'
            '<script src="/assets/analytics.js?v=%s" defer></script>\n') % (ver, ver)
    return re.sub(r'(<link rel="stylesheet" href="/assets/portal\.css[^"]*">\n)',
                  lambda m: m.group(1) + tags, src, count=1)


def ensure_root_head(src):
    """루트(한국어) 머리말을 정적 경로 기준으로 맞춘다."""
    src = re.sub(r'<html[^>]*>', lambda _: '<html lang="ko" data-lang-set="ko">', src, count=1)
    src = re.sub(r'<link rel="alternate" hreflang="ko".*?<link rel="alternate" hreflang="x-default"[^>]*>',
                 lambda _: hreflang_block(), src, count=1, flags=re.S)
    return src


def build():
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
        raw = f.read()
    dicts = load_dict()
    fallback = dicts.get('en', {})
    base = strip_store_utm(raw)
    ver_m = re.search(r'i18n\.js\?v=([0-9a-z]+)', base)
    base = ensure_analytics_tags(base, ver_m.group(1) if ver_m else '20261115i')

    results = {'': ensure_root_head(base)}
    results[''] = rewrite_stores(results[''], 'ko')

    for lang, path, html_lang, og_locale in LANGS:
        table = dicts.get(lang, {})
        src = set_head(base, lang, path, html_lang, og_locale, table, fallback)
        src = render_body(src, table, fallback)
        src = set_country_banner(src, table, fallback)
        src = rewrite_stores(src, lang)
        results[path] = src
    return results


def main():
    check = '--check' in sys.argv
    results = build()
    bad = 0
    for path, src in results.items():
        out_dir = os.path.join(ROOT, path) if path else ROOT
        out_file = os.path.join(out_dir, 'index.html')
        if check:
            if not os.path.exists(out_file):
                print('MISSING %s' % out_file)
                bad += 1
                continue
            with open(out_file, encoding='utf-8') as f:
                if f.read() != src:
                    print('STALE   %s' % out_file)
                    bad += 1
            continue
        os.makedirs(out_dir, exist_ok=True)
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write(src)
        print('wrote %s (%d bytes)' % (out_file, len(src.encode('utf-8'))))
    if check:
        print('ok' if not bad else '%d 파일이 원본과 다릅니다: 다시 생성하세요' % bad)
        return 1 if bad else 0
    return 0


if __name__ == '__main__':
    sys.exit(main())

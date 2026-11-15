// 공식 포털 다국어(ko · en · ja · zh-TW · es · pt · ar) 전환.
// - HTML 의 한국어 원문은 그대로 두고, data-i18n 계열 표시가 붙은 요소만 바꾼다.
//   그래서 한국어로 볼 때 화면은 손대기 전과 완전히 같다(원문을 그대로 되돌려 놓는다).
// - 언어는 ?lang=xx > 저장해 둔 선택(localStorage) > 브라우저 언어 순으로 고른다.
// - 사전은 assets/i18n-dict-a.js(영어·일본어·번체중국어), assets/i18n-dict-b.js(스페인어·포르투갈어·아랍어)에 있다.
(function () {
  'use strict'

  var LANGS = ['ko', 'en', 'ja', 'zh-TW', 'es', 'pt', 'ar']
  var CODES = { ko: 'KO', en: 'EN', ja: 'JA', 'zh-TW': '繁', es: 'ES', pt: 'PT', ar: 'AR' }
  var NAMES = { ko: '한국어', en: 'English', ja: '日本語', 'zh-TW': '繁體中文', es: 'Español', pt: 'Português', ar: 'العربية' }
  var STORE_KEY = 'omg-lang'
  var D = window.OMG_I18N_DICT || {}
  var marks = []
  var current = 'ko'
  var titleKo = document.title
  var descEl = document.querySelector('meta[name="description"]')
  var descKo = descEl ? descEl.getAttribute('content') : ''

  var GLOBE = '<svg class="globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3.2 9h17.6M3.2 15h17.6M12 3c2.6 2.6 3.9 5.7 3.9 9S14.6 18.4 12 21c-2.6-2.6-3.9-5.7-3.9-9S9.4 5.6 12 3z"></path></svg>'

  function lookup(key) {
    if (current === 'ko') return null
    var d = D[current]
    if (d && d[key] != null) return d[key]
    var e = D.en
    if (e && e[key] != null) return e[key]
    return null
  }

  function t(key, fallback) {
    var v = lookup(key)
    if (v != null) return v
    return fallback == null ? key : fallback
  }

  // 1. 표시가 붙은 요소의 한국어 원문을 기억해 둔다(언어를 되돌릴 때 그대로 복원).
  var ATTRS = ['alt', 'aria-label', 'title', 'content', 'data-name', 'data-desc', 'data-stages', 'data-doll', 'data-boss']

  function collect() {
    marks = []
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n],[data-i18n-html]'), function (el) {
      var k = el.getAttribute('data-i18n')
      if (k) marks.push({ el: el, key: k, type: 'text', ko: el.textContent })
      k = el.getAttribute('data-i18n-html')
      if (k) marks.push({ el: el, key: k, type: 'html', ko: el.innerHTML })
    })
    ATTRS.forEach(function (attr) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-' + attr + ']'), function (el) {
        marks.push({ el: el, key: el.getAttribute('data-i18n-' + attr), type: 'attr', attr: attr, ko: el.getAttribute(attr) || '' })
      })
    })
  }

  // 2. 지금 언어로 화면을 채운다.
  function apply() {
    marks.forEach(function (m) {
      var v = lookup(m.key)
      var text = v == null ? m.ko : v
      if (m.type === 'text') {
        if (m.el.textContent !== text) m.el.textContent = text
      } else if (m.type === 'html') {
        if (m.el.innerHTML !== text) m.el.innerHTML = text
      } else if (m.el.getAttribute(m.attr) !== text) {
        m.el.setAttribute(m.attr, text)
      }
    })

    // 문서 언어·방향(아랍어는 오른쪽에서 왼쪽으로 읽는다)
    document.documentElement.setAttribute('lang', current === 'zh-TW' ? 'zh-Hant' : current)
    document.documentElement.setAttribute('dir', current === 'ar' ? 'rtl' : 'ltr')

    // 페이지 제목과 설명
    var page = (document.body && document.body.getAttribute('data-page')) || 'home'
    var title = t('meta.' + page + '.title', '')
    document.title = title || titleKo
    if (descEl) {
      var desc = t('meta.' + page + '.desc', '')
      descEl.setAttribute('content', desc || descKo)
    }

    // 도감 탭을 눌렀을 때 위 배너에 보이는 값도 지금 언어로 맞춘다
    var active = document.querySelector('.tab-btn.is-active')
    if (active) {
      var fields = { 'cb-name': 'data-name', 'cb-desc': 'data-desc', 'cb-stages': 'data-stages', 'cb-doll': 'data-doll', 'cb-boss': 'data-boss' }
      Object.keys(fields).forEach(function (id) {
        var el = document.getElementById(id)
        if (el) el.textContent = active.getAttribute(fields[id]) || ''
      })
    }

    updateSwitcher()
  }

  // 3. 언어 전환 단추(상단 바)와 모바일 메뉴 안의 언어 목록
  function closeMenu() {
    var wrap = document.getElementById('lang-switch')
    if (!wrap) return
    wrap.classList.remove('is-open')
    var btn = document.getElementById('lang-btn')
    if (btn) btn.setAttribute('aria-expanded', 'false')
  }

  function updateSwitcher() {
    var code = document.getElementById('lang-code')
    if (code) code.textContent = CODES[current] || 'KO'
    var btn = document.getElementById('lang-btn')
    if (btn) btn.setAttribute('aria-label', t('lang.label', '언어') + ' / Language')
    Array.prototype.forEach.call(document.querySelectorAll('.lang-menu a, .mob-lang-links button'), function (a) {
      var on = a.getAttribute('data-lang') === current
      a.setAttribute('aria-selected', on ? 'true' : 'false')
      a.classList.toggle('is-active', on)
    })
  }

  function choose(lang) {
    if (LANGS.indexOf(lang) < 0) lang = null
    if (!lang) return
    current = lang
    try { localStorage.setItem(STORE_KEY, lang) } catch (e) {}
    apply()
    try {
      var url = new URL(location.href)
      if (lang === 'ko') url.searchParams.delete('lang')
      else url.searchParams.set('lang', lang)
      history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
    } catch (e) {}
    closeMenu()
    var drawer = document.getElementById('mob-drawer')
    if (drawer && drawer.classList.contains('is-open')) {
      drawer.classList.remove('is-open')
      var mob = document.getElementById('mob-btn')
      if (mob) mob.setAttribute('aria-expanded', 'false')
    }
    try {
      document.dispatchEvent(new CustomEvent('omg:langchange', { detail: { lang: lang } }))
    } catch (e) {}
  }

  function mount() {
    var bar = document.querySelector('.riot-bar-inner .bar-right')
    if (bar && !document.getElementById('lang-switch')) {
      var wrap = document.createElement('div')
      wrap.className = 'lang-switch'
      wrap.id = 'lang-switch'

      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'lang-btn'
      btn.id = 'lang-btn'
      btn.setAttribute('aria-haspopup', 'true')
      btn.setAttribute('aria-expanded', 'false')
      btn.innerHTML = GLOBE + '<span id="lang-code">' + (CODES[current] || 'KO') + '</span><span class="caret" aria-hidden="true">▾</span>'

      var menu = document.createElement('div')
      menu.className = 'lang-menu'
      menu.id = 'lang-menu'
      menu.setAttribute('role', 'menu')
      LANGS.forEach(function (l) {
        var a = document.createElement('a')
        a.href = '?lang=' + l
        a.setAttribute('role', 'menuitem')
        a.setAttribute('data-lang', l)
        a.innerHTML = '<span>' + NAMES[l] + '</span><span class="code">' + CODES[l] + '</span>'
        a.addEventListener('click', function (e) { e.preventDefault(); choose(l) })
        menu.appendChild(a)
      })

      wrap.appendChild(btn)
      wrap.appendChild(menu)
      bar.insertBefore(wrap, bar.querySelector('.mob-toggle'))

      btn.addEventListener('click', function (e) {
        e.stopPropagation()
        var open = !wrap.classList.contains('is-open')
        wrap.classList.toggle('is-open', open)
        btn.setAttribute('aria-expanded', open ? 'true' : 'false')
      })
      document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) closeMenu() })
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu() })
    }

    var drawer = document.getElementById('mob-drawer')
    if (drawer && !document.getElementById('mob-lang')) {
      var box = document.createElement('div')
      box.className = 'mob-lang'
      box.id = 'mob-lang'
      var head = document.createElement('span')
      head.className = 'mob-sns-title'
      head.setAttribute('data-i18n', 'lang.label')
      head.textContent = '언어'
      var row = document.createElement('div')
      row.className = 'mob-lang-links'
      LANGS.forEach(function (l) {
        var b = document.createElement('button')
        b.type = 'button'
        b.setAttribute('data-lang', l)
        b.textContent = NAMES[l]
        b.addEventListener('click', function () { choose(l) })
        row.appendChild(b)
      })
      box.appendChild(head)
      box.appendChild(row)
      drawer.appendChild(box)
    }
  }

  // 4. 언어 고르기: 주소의 lang > 저장된 선택 > 브라우저 언어
  function norm(tag) {
    if (!tag) return null
    var v = String(tag).toLowerCase()
    if (v.indexOf('ko') === 0) return 'ko'
    if (v.indexOf('ja') === 0) return 'ja'
    if (v.indexOf('zh') === 0) return 'zh-TW'
    if (v.indexOf('es') === 0) return 'es'
    if (v.indexOf('pt') === 0) return 'pt'
    if (v.indexOf('ar') === 0) return 'ar'
    if (v.indexOf('en') === 0) return 'en'
    return null
  }

  function detect() {
    var q = null
    try { q = new URLSearchParams(location.search).get('lang') } catch (e) {}
    if (q) {
      var hit = norm(q)
      if (hit) return hit
      for (var i = 0; i < LANGS.length; i++) if (LANGS[i].toLowerCase() === String(q).toLowerCase()) return LANGS[i]
    }
    try {
      var saved = localStorage.getItem(STORE_KEY)
      if (saved && LANGS.indexOf(saved) >= 0) return saved
    } catch (e) {}
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || '']
    for (var j = 0; j < list.length; j++) {
      var n = norm(list[j])
      if (n) return n
    }
    return 'en'
  }

  // 5. 다른 스크립트가 쓰는 도구
  window.OMG_I18N = {
    langs: LANGS,
    lang: function () { return current },
    t: t,
    // {ko, en} 형태의 값에서 지금 언어에 맞는 것을 고른다(없으면 영어, 그다음 한국어)
    pick: function (obj) {
      if (!obj) return ''
      if (current === 'ko') return obj.ko || obj.en || ''
      return obj[current] || obj.en || obj.ko || ''
    },
    // 앱과 함께 쓰는 공지(/omg-policy/notice.json): 우리 사전에 그 언어 문장이 있으면 그것을 쓴다
    noticeText: function (id, field, obj) {
      var d = D[current]
      if (d && d['notice.' + id + '.' + field] != null) return d['notice.' + id + '.' + field]
      if (!obj) return null
      if (current === 'ko') return obj.ko || obj.en || null
      return obj.en || obj.ko || null
    },
    set: choose,
    refresh: apply
  }

  current = detect()
  document.documentElement.setAttribute('lang', current === 'zh-TW' ? 'zh-Hant' : current)
  if (current === 'ar') document.documentElement.setAttribute('dir', 'rtl')
  mount()
  collect()
  apply()
})()

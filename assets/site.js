// 공식 홈페이지 공용 스크립트: 출시 전환, 복사 버튼, 공지 불러오기. 외부 서버와 통신하지 않고, 쿠키·분석 도구를 쓰지 않는다.
(function () {
  'use strict'

  // 출시 버튼: config.js 의 launched 가 true 면 스토어 링크 버튼으로 바꾼다
  var cfg = window.OMG || {}
  var ctas = document.querySelectorAll('[data-cta]')
  if (cfg.launched) {
    var appleSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="margin-right:10px;flex-shrink:0" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.92.04-2.02.61-2.67 1.36-.58.65-1.09 1.71-1.03 2.74 1.03.08 2.07-.48 2.69-1.23z"/></svg>'
    var googlePlaySvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="margin-right:10px;flex-shrink:0" aria-hidden="true"><path d="M3.609 1.814L13.792 12 3.61 22.186c-.183-.243-.292-.55-.292-.888V2.702c0-.338.109-.645.292-.888zM15.207 13.415l2.256 2.256-11.83 6.726 9.574-8.982zm0-2.83L5.633 1.603l11.83 6.726-2.256 2.256zm1.414 1.415l3.208 1.825c.78.444.78 1.168 0 1.612l-3.208 1.825-1.921-1.921 1.921-1.841z"/></svg>'

    Array.prototype.forEach.call(ctas, function (cta) {
      var frag = document.createDocumentFragment()
      if (cfg.appStoreUrl && /^https:\/\/apps\.apple\.com\//.test(cfg.appStoreUrl)) {
        var aIos = document.createElement('a')
        aIos.className = 'btn'
        aIos.href = cfg.appStoreUrl
        aIos.rel = 'noopener'
        aIos.target = '_blank'
        aIos.innerHTML = appleSvg + '<span>App Store에서 받기</span>'
        frag.appendChild(aIos)
      }
      if (cfg.playUrl && /^https:\/\/play\.google\.com\//.test(cfg.playUrl)) {
        var aAos = document.createElement('a')
        aAos.className = 'btn'
        aAos.href = cfg.playUrl
        aAos.rel = 'noopener'
        aAos.target = '_blank'
        aAos.innerHTML = googlePlaySvg + '<span>Google Play에서 받기</span>'
        frag.appendChild(aAos)
      }
      if (frag.childNodes.length > 0) {
        cta.replaceWith(frag)
      }
    })
  }

  // 우측 상단 메뉴: 바깥을 누르거나 Esc 를 누르거나 항목을 고르면 닫는다
  var menu = document.getElementById('menu')
  if (menu) {
    document.addEventListener('click', function (e) {
      if (!menu.open) return
      if (!menu.contains(e.target) || (e.target.closest && e.target.closest('.menu-panel a'))) menu.open = false
    })
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.open) { menu.open = false; var sm = menu.querySelector('summary'); if (sm) sm.focus() } })
  }

  // 주소의 #앵커가 가리키는 토글(고객문의)은 열어서 보여 준다
  function openHash() {
    var el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView() }
  }
  openHash(); window.addEventListener('hashchange', openHash)

  // 복사 버튼 (환불 신청 메일 양식)
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.cp') : null
    if (!b) return
    var el = document.getElementById(b.getAttribute('data-cp'))
    if (!el) return
    var text = el.innerText || el.textContent
    var old = b.textContent
    function done() { b.textContent = '복사됨 ✓'; setTimeout(function () { b.textContent = old }, 1500) }
    function fallback() {
      try {
        var r = document.createRange(); r.selectNodeContents(el)
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r)
        if (document.execCommand('copy')) done(); else b.textContent = '길게 눌러 직접 복사'
      } catch (x) { b.textContent = '길게 눌러 직접 복사' }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback()
  })

  // 공지: 앱이 읽는 것과 같은 파일(/omg-policy/notice.json)을 읽어 보여 준다. 기간(from~until, 한국 날짜) 안의 공지만.
  var lists = [document.getElementById('home-notices'), document.getElementById('notice-list')].filter(Boolean)
  if (lists.length) {
    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    fetch('/omg-policy/notice.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json() })
      .then(function (data) {
        var items = (data && Array.isArray(data.notices) ? data.notices : []).filter(function (n) {
          return n && n.title && (n.title.ko || n.title.en) && (!n.from || n.from <= today) && (!n.until || n.until >= today)
        }).sort(function (x, y) { return String(y.from || '').localeCompare(String(x.from || '')) })
        lists.forEach(function (ul) { render(ul, items) })
      })
      .catch(function () {
        lists.forEach(function (ul) { ul.textContent = ''; var li = document.createElement('li'); li.className = 'muted'; li.textContent = '공지를 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.'; ul.appendChild(li) })
      })
  }
  function render(ul, items) {
    var limit = parseInt(ul.getAttribute('data-limit') || '0', 10)
    var shown = limit > 0 ? items.slice(0, limit) : items
    ul.textContent = ''
    if (!shown.length) { var e = document.createElement('li'); e.className = 'muted'; e.textContent = '지금 새로 알려 드릴 공지는 없어요.'; ul.appendChild(e); return }
    shown.forEach(function (n) {
      var li = document.createElement('li')
      var h = document.createElement('h3'); h.textContent = (n.title.ko || n.title.en)
      li.appendChild(h)
      if (n.from) { var t = document.createElement('time'); t.setAttribute('datetime', n.from); t.textContent = n.from; li.appendChild(t) }
      var body = n.body && (n.body.ko || n.body.en)
      if (body) { var p = document.createElement('p'); p.textContent = body; li.appendChild(p) }
      ul.appendChild(li)
    })
  }
})()

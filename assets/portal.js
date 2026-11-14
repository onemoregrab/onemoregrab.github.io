// 공용 포털 동작: 모바일 메뉴, 하위 메뉴(공식 SNS) 열고 닫기, 기기에 맞는 다운로드 버튼.
// 한 기능에서 오류가 나도 나머지 기능은 계속 동작하도록 기능마다 따로 감싼다.
(function () {
  'use strict'
  document.documentElement.setAttribute('data-portal', 'v3')

  function run(fn) {
    try { fn() } catch (err) {
      if (window.console && window.console.warn) window.console.warn('[portal]', err)
    }
  }

  // 1. 모바일 메뉴(☰) 열고 닫기. 바깥을 누르거나 Esc, 항목을 고르면 닫힌다.
  run(function () {
    var btn = document.getElementById('mob-btn')
    var drawer = document.getElementById('mob-drawer')
    if (!btn || !drawer) return

    function setOpen(open) {
      drawer.classList.toggle('is-open', open)
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation()
      setOpen(!drawer.classList.contains('is-open'))
    })

    Array.prototype.forEach.call(drawer.querySelectorAll('a'), function (link) {
      link.addEventListener('click', function () { setOpen(false) })
    })

    document.addEventListener('click', function (e) {
      if (!drawer.classList.contains('is-open')) return
      if (drawer.contains(e.target) || btn.contains(e.target)) return
      setOpen(false)
    })

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        setOpen(false)
        btn.focus()
      }
    })
  })

  // 2. 상단 메뉴의 하위 목록(공식 SNS ▾)을 눌러서도 열고 닫을 수 있게 한다. (PC 는 마우스를 올려도 열린다)
  run(function () {
    var items = document.querySelectorAll('.nav-item')
    if (!items.length) return

    function closeAll(except) {
      Array.prototype.forEach.call(items, function (item) {
        if (item === except) return
        item.classList.remove('is-open')
        var b = item.querySelector('button.nav-link')
        if (b) b.setAttribute('aria-expanded', 'false')
      })
    }

    Array.prototype.forEach.call(items, function (item) {
      var trigger = item.querySelector('button.nav-link')
      if (!trigger || !item.querySelector('.nav-dropdown')) return
      trigger.setAttribute('aria-expanded', 'false')
      trigger.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        var open = !item.classList.contains('is-open')
        closeAll(item)
        item.classList.toggle('is-open', open)
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
      })
    })

    document.addEventListener('click', function (e) {
      Array.prototype.forEach.call(items, function (item) {
        if (item.contains(e.target)) return
        item.classList.remove('is-open')
        var b = item.querySelector('button.nav-link')
        if (b) b.setAttribute('aria-expanded', 'false')
      })
    })

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return
      closeAll(null)
    })
  })

  // 3. 큰 버튼(무료로 플레이하기): 방문한 기기에 맞는 스토어로 보낸다.
  //    iOS -> App Store, Android -> Google Play, PC -> 이 페이지의 시작 섹션(스토어 버튼 + QR)으로 부드럽게 이동.
  function initCta() {
    run(function () {
      var cta = document.getElementById('hero-cta') || document.querySelector('[data-cta]')
      if (!cta) return

      var ua = navigator.userAgent || ''
      var uaData = navigator.userAgentData
      var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      var isAndroid = /Android/i.test(ua) || !!(uaData && uaData.platform === 'Android')
      var appStore = cta.getAttribute('data-appstore') || 'https://apps.apple.com/app/id6832755431'
      var playStore = cta.getAttribute('data-playstore') || 'https://play.google.com/store/apps/details?id=com.onemoregrab.clawgame'
      var hint = document.getElementById('hero-os-hint')

      if (isIOS) {
        cta.setAttribute('href', appStore)
        cta.setAttribute('target', '_blank')
        cta.setAttribute('rel', 'noopener')
        if (hint) hint.textContent = 'App Store로 이동해요'
      } else if (isAndroid) {
        cta.setAttribute('href', playStore)
        cta.setAttribute('target', '_blank')
        cta.setAttribute('rel', 'noopener')
        if (hint) hint.textContent = 'Google Play로 이동해요'
      } else {
        cta.setAttribute('href', '#start')
        if (hint) hint.textContent = 'PC에서는 아래에서 스토어 링크와 QR 코드를 볼 수 있어요'
        cta.addEventListener('click', function (e) {
          var start = document.getElementById('start')
          if (!start) return
          e.preventDefault()
          var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          start.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
          if (history.replaceState) history.replaceState(null, '', '#start')
        })
      }
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCta)
  else initCta()
})()

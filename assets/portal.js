// 공용 헤더 동작: 모바일 메뉴(☰) 열고 닫기. 바깥을 누르거나 Esc, 항목을 고르면 닫힌다.
(function () {
  'use strict'
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
})()

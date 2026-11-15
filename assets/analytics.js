// GA4(구글 애널리틱스 4) 연결 — 측정 ID가 없으면 아무 것도 하지 않는다(요청·쿠키 0).
// 켜는 방법: assets/config.js 의 ga4Id 에 GA4 속성의 측정 ID(G-XXXXXXXXXX)를 넣는다. 이 파일은 고치지 않는다.
//   GA4 속성은 analytics.google.com > 관리 > 속성 만들기 > 데이터 스트림(웹, https://onemoregrab.github.io)에서 만든다.
(function () {
  'use strict'
  var cfg = window.OMG || {}
  var id = String(cfg.ga4Id || '').trim()
  if (!/^G-[A-Z0-9]{4,}$/i.test(id)) return

  var s = document.createElement('script')
  s.async = true
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id)
  document.head.appendChild(s)

  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  gtag('js', new Date())
  // 언어별 정적 경로(/en/ …, 루트는 ko)를 그대로 페이지 보고서에 남기고, 언어도 함께 보낸다.
  gtag('config', id, { page_language: document.documentElement.lang || '' })
})()

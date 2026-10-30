/* 섹션 2. 미토피아 이야기: 화면 전체가 고른 이야기의 배경이고, 아래 썸네일 줄은 항상 떠 있다
 *
 * 카드 내용은 index.html 의 <ol class="world-data"> 에 있다. 이 파일은 그 내용을 읽어 화면을 만들 뿐이라
 * 글·이미지를 바꾸거나 카드를 늘릴 때는 HTML 만 고치면 된다. 카드 하나 = 이미지(또는 영상) 하나 + 글 하나.
 *   <li>
 *     <h3>카드 제목</h3>
 *     <p data-img="media/world/01.webp">글</p>
 *     (영상이면 data-img 대신 data-video="...mp4" data-poster="첫 화면.webp" data-thumb="썸네일.webp". 소리 없이 반복 재생된다)
 *     (그림이 아직 없을 때는 data-img 대신 data-ph="pot | two | drift" 로 임시 그림을 쓴다)
 *   </li>
 * p 의 data-zoom / data-origin 으로 이미지를 확대해 보여 줄 수 있고, li 에 data-last 가 있으면 인스타그램 버튼이 나온다.
 * 썸네일을 누르면 그 이야기로 바뀐다. 자동으로 넘어가지 않는다. (좌우 방향키로도 카드를 옮길 수 있다)
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-world]');
  var list = document.querySelector('.world-data');
  if (!root || !list) return;

  var $ = function (sel) { return root.querySelector(sel); };
  var section = root.closest('.fp-section');
  var strip = $('.world__strip'), media = $('.world__media'), lineEl = $('.world__line'), linkEl = $('.world__link');
  var cur = -1, uid = 0, swapTimer, outTimer;

  /* ---------- 데이터 ---------- */
  var S = Array.prototype.map.call(list.children, function (li) {
    var p = li.querySelector('p');
    return {
      title: li.querySelector('h3').textContent.trim(),
      last: li.hasAttribute('data-last'),
      line: p.textContent.trim(), img: p.getAttribute('data-img'), alt: p.getAttribute('data-alt') || '',
      video: p.getAttribute('data-video'), poster: p.getAttribute('data-poster'), thumb: p.getAttribute('data-thumb'),
      ph: p.getAttribute('data-ph'), side: +p.getAttribute('data-side') || 0,
      zoom: p.getAttribute('data-zoom'), origin: p.getAttribute('data-origin') || '50% 50%'
    };
  });
  if (!S.length) return;

  /* ---------- 그림 ---------- */
  /* 이미지가 아직 없는 카드의 임시 그림. 실제 그림이 생기면 p 에 data-img 만 넣으면 이 그림 대신 쓰인다 */
  function placeholder(kind, side) {
    var id = 'wph' + (++uid);
    var o = '<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf0d8"/><stop offset="1" stop-color="#cfe3d2"/></linearGradient></defs><rect width="160" height="100" fill="url(#' + id + ')"/>';
    if (kind === 'pot') {
      o += '<ellipse cx="80" cy="92" rx="90" ry="22" fill="#9ccaa2"/><path d="M52 62h56l8 22a10 10 0 0 1-10 12H54a10 10 0 0 1-10-12z" fill="#2c3330"/><ellipse cx="80" cy="62" rx="30" ry="6" fill="#fff"/><path d="M62 58c0-10 8-14 18-14s18 4 18 14z" fill="#fff"/>' +
        '<g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"><path d="M68 38c-5-7 5-10 0-17M80 36c-5-9 5-13 0-22M92 38c-5-7 5-10 0-17"/></g>' +
        '<circle cx="28" cy="82" r="7" fill="#f6c9d7"/><circle cx="132" cy="84" r="6" fill="#f6c9d7"/><circle cx="116" cy="90" r="5" fill="#f4d9a8"/>';
    } else if (kind === 'two') {
      var a = side === 1 ? .35 : 1, b = side === 0 ? .35 : 1;   // side: 0 왼쪽만 강조, 1 오른쪽만 강조, 2 둘 다
      o += '<g opacity="' + a + '"><rect width="76" height="100" fill="#f7e7c9"/><ellipse cx="38" cy="96" rx="52" ry="20" fill="#9ccaa2"/><circle cx="26" cy="74" r="13" fill="#f6c9d7"/><circle cx="52" cy="82" r="10" fill="#f4d9a8"/><circle cx="26" cy="70" r="1.6" fill="#2a1822"/><circle cx="32" cy="70" r="1.6" fill="#2a1822"/></g>' +
        '<g opacity="' + b + '"><rect x="84" width="76" height="100" fill="#37484a"/><ellipse cx="122" cy="98" rx="52" ry="20" fill="#24342f"/><ellipse cx="124" cy="68" rx="24" ry="22" fill="#6b5a66"/><path d="M110 50l-6-14 12 8zM138 50l6-14-12 8z" fill="#2a2024"/><circle cx="117" cy="64" r="2.4" fill="#fff"/><circle cx="131" cy="64" r="2.4" fill="#fff"/></g>' +
        '<path d="M76 0c8 22-8 36 0 52s-8 30 2 48h6c-10-18 6-32-2-48s8-30 0-52z" fill="#7fc2c4"/>';
    } else {
      o += '<rect y="52" width="160" height="48" fill="#7fc2c4"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"><path d="M10 66q10-5 20 0t20 0 20 0M70 80q10-5 20 0t20 0 20 0M0 90q10-5 20 0t20 0"/></g>' +
        '<circle cx="86" cy="58" r="13" fill="#f6c9d7"/><circle cx="81" cy="55" r="1.7" fill="#2a1822"/><circle cx="91" cy="55" r="1.7" fill="#2a1822"/><ellipse cx="86" cy="70" rx="17" ry="4" fill="#fff" opacity=".6"/>';
    }
    return o + '</svg>';
  }
  function layer(s, small) {
    var d = document.createElement('div');
    d.className = 'world__layer';
    if (s.video && !small) {                                   // 영상: 소리 없이 반복 재생 (보이는 동안에만 재생된다)
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('aria-label', s.alt);
      if (s.poster) v.poster = s.poster;
      v.src = s.video;
      d.appendChild(v);
    } else if (s.img || s.thumb || s.poster) {
      s = small && s.thumb ? { img: s.thumb, alt: s.alt } : (s.img ? s : { img: s.poster, alt: s.alt });
      var im = new Image();
      im.alt = s.alt; im.decoding = 'async'; im.draggable = false; im.src = s.img;
      if (s.zoom) { im.style.transform = 'scale(' + s.zoom + ')'; im.style.transformOrigin = s.origin; }
      d.appendChild(im);
    } else d.innerHTML = placeholder(s.ph, s.side);
    return d;
  }

  /* ---------- 썸네일 줄 (항상 보임) ---------- */
  S.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'world__thumb'; b.setAttribute('role', 'listitem');
    b.setAttribute('aria-label', s.title);
    var a = document.createElement('span'); a.className = 'world__thumb-art'; a.appendChild(layer(s, true));
    b.appendChild(a);
    b.addEventListener('click', function () { show(i); });
    strip.appendChild(b);
  });
  var thumbs = strip.children;
  $('.world__arrow--prev').addEventListener('click', function () { show(cur - 1); });
  $('.world__arrow--next').addEventListener('click', function () { show(cur + 1); });

  /* ---------- 이야기 ---------- */
  function show(i) {
    i = Math.max(0, Math.min(S.length - 1, i));
    if (i === cur) return;
    var s = S[i];
    cur = i;
    var old = Array.prototype.slice.call(media.children);
    var box = layer(s); box.classList.add('world__card');
    media.appendChild(box);
    void box.offsetWidth;                                     // 처음 상태를 한 번 그린 뒤 나타나게 한다
    box.classList.add('is-on');
    old.forEach(function (o) { o.classList.remove('is-on'); });
    playVideos();
    clearTimeout(outTimer);
    outTimer = setTimeout(function () { old.forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); }); }, 1100);

    $('.world__vtitle').textContent = s.title;
    clearTimeout(swapTimer);
    lineEl.classList.add('is-swap');
    swapTimer = setTimeout(function () { lineEl.textContent = s.line; lineEl.classList.remove('is-swap'); }, 180);
    linkEl.hidden = !s.last;
    Array.prototype.forEach.call(thumbs, function (t, n) { t.setAttribute('aria-current', n === i ? 'true' : 'false'); });
    var th = thumbs[i];
    if (th && strip.scrollTo) strip.scrollTo({ left: th.offsetLeft - (strip.clientWidth - th.clientWidth) / 2, behavior: 'smooth' });
    var nx = S[i + 1];                                        // 다음 카드의 이미지를 미리 받아 둔다
    if (nx && nx.img) { var p = new Image(); p.src = nx.img; }
  }
  /* 영상 카드: 이 섹션이 보이고 그 카드가 골라져 있을 때만 재생. 다른 섹션으로 넘어가면 멈춘다 */
  function playVideos() {
    var on = section.classList.contains('is-active');
    Array.prototype.forEach.call(media.querySelectorAll('video'), function (v) {
      var shown = v.parentNode.classList.contains('is-on');
      if (on && shown) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } else v.pause();
    });
  }
  var fp = document.querySelector('[data-fullpage]');
  if (fp) fp.addEventListener('fullpage:change', function () { setTimeout(playVideos, 0); });
  setTimeout(playVideos, 300);

  document.addEventListener('keydown', function (e) {
    if (!section.classList.contains('is-active') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
  });

  lineEl.textContent = '';
  show(0);
})();

/* 트레일러(인트로) 페이지: 영상 재생 + 자막 두 줄씩 부드럽게 + 끝나면 index.html 로 이동 */
(function () {
  'use strict';

  // ---- 속도 조절 (ms) ----
  var T = {
    first: 600,      // 영상이 시작된 뒤 첫 자막이 나타나기까지
    step: 3400,      // 자막 한 개가 나타나서 다음 자막으로 넘어가기까지 (더 천천히: 4500, 빠르게: 3000)
    fade: 800,       // 나타나는 시간 = 사라지는 시간 (나머지 시간 동안 또렷하게 머문다)
    lastHold: 3000,  // 마지막 자막이 나타난 뒤 사라지기 시작할 때까지
    endFade: 1200,   // 건너뛰기로 나갈 때 어두워지는 시간
    outroFade: 1400, // 마지막 자막이 사라진 뒤 흰 엔딩 화면으로 바뀌는 시간
    btnAt: 600,     // 엔딩에서 이끼 글자가 다 자란 뒤 '하치 따라가기' 버튼이 나타나는 시간 (영상 시작 기준)
    rate: 1,         // 트레일러 영상 재생 속도 (1 = 원래 속도, 0.5 = 2배 느리게). 15초 영상으로 바꾸면서 원래 속도로 되돌림
    zoom: 1.07       // 영상이 천천히 다가가는 정도 (1 이면 가만히)
  };
  var NEXT = 'index.html';        // 끝나면 이동할 페이지
  var FLAG = 'hachi-trailer';     // 본 적이 있다고 기억하는 키 (index.html 의 첫 줄 스크립트가 확인한다)

  var root = document.querySelector('[data-trailer]');
  var video = root.querySelector('video');
  var cues = Array.prototype.slice.call(root.querySelectorAll('.cue'));
  var btnSkip = root.querySelector('[data-skip]');
  var btnSound = root.querySelector('[data-sound]');
  var btnStart = root.querySelector('[data-start]');
  var curtain = root.querySelector('.curtain');
  var outro = root.querySelector('[data-outro]');
  var mossCanvas = outro.querySelector('canvas');
  var moss = null;   // 이끼 글자 (js/moss-text.js). 못 만들면 대체 글자를 보여 준다
  try {
    moss = window.MossText ? MossText.create(mossCanvas, { calm: matchMedia('(prefers-reduced-motion: reduce)').matches }) : null;
  } catch (e) { if (window.console) console.error('[moss] 시작 실패', e); }
  if (moss) moss.ready.catch(function (e) { console.error('[moss]', e); moss = null; });
  var btnGo = outro.querySelector('[data-go]');
  var outroOn = false;
  var timers = [], started = false, leaving = false, triedBlob = false;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.style.setProperty('--fade', T.fade + 'ms');

  // 재생 속도: 영상을 다시 불러오면 속도가 1로 돌아가므로 불러올 때마다 다시 맞춘다
  function setRate() { try { video.defaultPlaybackRate = T.rate; video.playbackRate = T.rate; } catch (e) {} }
  setRate();
  video.addEventListener('loadedmetadata', setRate);
  video.addEventListener('playing', setRate);

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  /* ---------- 자막 일정 ---------- */
  function runCues() {
    var total = 0;
    cues.forEach(function (el, i) {
      var on = T.first + i * T.step;
      var last = i === cues.length - 1;
      var off = on + (last ? T.lastHold : T.step - T.fade);
      later(function () { el.classList.remove('is-off'); el.classList.add('is-on'); }, on);
      later(function () { el.classList.remove('is-on'); el.classList.add('is-off'); }, off);
      total = off + T.fade;
    });
    later(showOutro, total + 300);
    // 영상이 끝난 뒤에도 마지막 장면이 멈춰 있지 않도록 끝까지 천천히 다가간다
    if (!calm && video.animate && T.zoom !== 1) {
      video.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + T.zoom + ')' }],
        { duration: total + 300 + T.outroFade, easing: 'cubic-bezier(.25,.1,.4,1)', fill: 'forwards' });
    }
  }

  /* ---------- 시작 / 이동 ---------- */
  function begin() {
    if (started) return;
    started = true;
    btnStart.hidden = true;
    btnSkip.classList.add('is-shown');
    syncSound();
    runCues();
  }

  function remember() {
    try { sessionStorage.setItem(FLAG, '1'); return sessionStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
  }

  /* ---------- 엔딩 화면 ---------- */
  function showOutro() {
    if (outroOn || leaving) return;
    outroOn = true;
    timers.forEach(clearTimeout);
    root.classList.add('is-outro');
    outro.removeAttribute('aria-hidden');
    fadeAudio(T.outroFade);
    outro.classList.add('is-on');
    var ready = false;
    function showButton() {
      if (ready) return; ready = true;
      btnGo.classList.add('is-ready');
    }
    function fallback() { outro.classList.add('is-fallback'); setTimeout(showButton, 1200); }
    if (moss) {
      moss.start().then(function () { setTimeout(showButton, T.btnAt); }).catch(fallback);
    } else fallback();
  }

  function go() {
    if (leaving) return;
    leaving = true;
    var search = location.search;
    if (!remember() && !/[?&]notrailer\b/.test(search)) search += (search ? '&' : '?') + 'notrailer';
    location.replace(NEXT + search + location.hash);
  }
  btnGo.addEventListener('click', go);
  addEventListener('keydown', function (e) {   // 엔딩에서 Enter 로도 이동
    if (outroOn && btnGo.classList.contains('is-ready') && e.key === 'Enter') go();
  });

  function leave() {
    if (leaving) return;
    leaving = true;
    timers.forEach(clearTimeout);
    // 저장소를 쓸 수 없는 환경에서는 index.html 이 다시 트레일러로 보내지 않도록 표시를 붙여 간다
    var search = location.search;
    if (!remember() && !/[?&]notrailer\b/.test(search)) search += (search ? '&' : '?') + 'notrailer';
    curtain.classList.add('is-on');
    try { fadeAudio(T.endFade); } catch (e) {}
    setTimeout(function () { location.replace(NEXT + search + location.hash); }, T.endFade);
  }

  // 나갈 때 소리도 같이 줄인다
  function fadeAudio(ms) {
    if (video.muted) return;
    var v0 = video.volume, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      video.volume = Math.max(0, v0 * (1 - k));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- 소리 ---------- */
  function syncSound() {
    btnSound.hidden = false;
    btnSound.classList.add('is-shown');
    btnSound.setAttribute('aria-pressed', String(!video.muted));
    btnSound.querySelector('[data-sound-label]').textContent = video.muted ? '소리 켜기' : '소리 끄기';
  }
  btnSound.addEventListener('click', function () {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
    if (video.paused && !video.ended) video.play().catch(function () {});
    syncSound();
  });

  /* ---------- 재생 ---------- */
  // 소리가 있는 영상이라 먼저 소리를 켠 채로 시도하고, 브라우저가 막으면 음소거로 시작한다
  function play() {
    video.muted = false;
    var p = video.play();
    if (!p || !p.catch) return;
    p.catch(function () {
      video.muted = true;
      var q = video.play();
      if (q && q.catch) q.catch(function () { btnStart.hidden = false; });   // 음소거 재생도 막힌 환경: 탭하면 시작
    });
  }

  video.addEventListener('playing', begin);
  video.addEventListener('error', function () {
    // 일부 서버(구간 요청 미지원)에서 영상이 안 나올 때: 통째로 내려받아 재생해 본다
    if (triedBlob || !window.fetch || !window.URL) { leave(); return; }
    triedBlob = true;
    fetch(video.getAttribute('src')).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) {
      video.src = URL.createObjectURL(b);
      video.load();
      play();
    }).catch(leave);
  });

  btnStart.addEventListener('click', function () {
    video.muted = false;
    video.play().then(begin).catch(function () {
      video.muted = true;
      video.play().then(begin).catch(leave);
    });
  });
  btnSkip.addEventListener('click', leave);
  addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (outroOn) go(); else leave(); } });
  addEventListener('pageshow', function (e) { if (e.persisted && !leaving && !started) play(); });

  play();
})();

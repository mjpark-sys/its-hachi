/* 메인 페이지: 풀페이지 스크롤 + 히어로 시선 이벤트 + 섹션 영상 재생 관리 */
(function () {
  'use strict';

  var DURATION = 900;    // 섹션이 올라오는 시간(ms). 느리게: 1300, 빠르게: 700

  // 히어로 프롤로그 문구 (index.html 의 .prologue). 한 줄씩 나타났다 사라지며, 줄 수는 HTML 에 있는 만큼 따라간다
  var PROLOGUE = {
    start: 700,      // 히어로가 보인 뒤 첫 줄이 나타나기까지(ms)
    line: 7000,      // 한 줄이 나타나서 사라질 때까지 걸리는 시간(ms). 더 느리게: 4500, 빠르게: 2500
    fade: 1100,      // 나타나는 시간 = 사라지는 시간(ms). 나머지 시간(line - fade×2) 동안은 또렷하게 머문다
    loop: true,      // true: 마지막 줄 뒤에 잠깐 쉬고 처음부터 다시. false: 한 번만 보여 주고 끝
    rest: 3000       // loop 일 때 마지막 줄이 사라진 뒤 쉬는 시간(ms)
  };

  var heroRoot = document.querySelector('[data-gaze-hero]');
  var coarse = matchMedia('(pointer: coarse)').matches;
  var test = /[?&]test\b/.test(location.search);   // 테스트용 (코덱 없는 브라우저)

  // 히어로가 어떤 이유로든 시작하지 못해도 나머지 페이지(스크롤·메뉴·섹션 영상)는 정상 동작해야 한다
  var hero = { setActive: function () {} };
  try {
    var inst = window.GazeHero && GazeHero.init(heroRoot);
    if (inst) hero = inst;
  } catch (err) {
    if (window.console && console.error) console.error('[hero] 시작 실패', err);
    heroRoot.setAttribute('data-state', 'error');
  }

  // 히어로 안내 문구: 모바일은 문구를 바꾸고, 첫 입력 후 숨긴다
  if (coarse) heroRoot.querySelector('.gaze-hero__hint').textContent = '화면을 터치하거나 기울여 보세요';
  var hideHint = function () { heroRoot.classList.add('is-touched'); removeEventListener('pointermove', hideHint); };
  setTimeout(function () { addEventListener('pointermove', hideHint, { passive: true }); }, 1200);

  /* ---------- 히어로 프롤로그: 한 줄씩 부드럽게 나타났다 사라지기 ---------- */
  var prologue = (function () {
    var root = heroRoot.querySelector('[data-prologue]');
    var lines = root ? Array.prototype.slice.call(root.querySelectorAll('.prologue__line')) : [];
    var anims = [], timer;
    var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // 움직임 줄이기 설정이면 위치·흐림 없이 투명도만 바꾼다

    function stop() {
      clearTimeout(timer);
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      anims = [];
    }
    function start() {
      stop();
      if (!lines.length) return;
      if (!lines[0].animate) { root.classList.add('is-static'); return; }   // 아주 오래된 브라우저
      var P = PROLOGUE;
      // 줄마다 같은 길이(cycle)의 애니메이션을 줄 순서×line 만큼 늦게 시작해서 한 줄씩 이어지게 한다
      var cycle = lines.length * P.line + (P.loop ? P.rest : 0);
      var fin = P.fade / cycle, out = (P.line - P.fade) / cycle, end = P.line / cycle;
      var hidden = calm ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' };
      var shown = calm ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' };
      var gone = calm ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(6px)' };
      // easing 은 전체가 아니라 키프레임 사이 구간마다 걸어야 한다 (전체에 걸면 12초짜리 주기 전체의 시간 흐름이 뒤틀린다)
      function frame(base, offset) { var f = {}; for (var k in base) f[k] = base[k]; f.offset = offset; f.easing = 'ease-in-out'; return f; }
      timer = setTimeout(function () {
        anims = lines.map(function (el, i) {
          return el.animate(
            [frame(hidden, 0), frame(shown, fin), frame(shown, out), frame(gone, end), frame(gone, 1)],
            { duration: cycle, delay: i * P.line, iterations: P.loop ? Infinity : 1, easing: 'linear', fill: 'both' }
          );
        });
      }, P.start);
    }
    return { start: start, stop: stop };
  })();

  /* ---------- 섹션 영상: 보이는 섹션만 재생, 이웃 섹션은 미리 불러오기 ---------- */
  function pickSrc(v) {
    var base = v.getAttribute('data-src');
    if (test) return base + 'test.webm';
    // 화면을 꽉 채울 때 필요한 가로 픽셀 수로 4K / HD 선택 (모바일은 데이터 절약을 위해 HD)
    var need = Math.max(innerWidth, innerHeight * 1.795) * Math.min(devicePixelRatio || 1, 3);
    var conn = navigator.connection || {};
    var slow = conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
    return base + (!coarse && !slow && need > 2200 ? '4k.mp4' : 'hd.mp4');
  }
  // 얼굴 선택형 섹션(#faces)은 지금 고른 얼굴의 영상이 그 섹션의 영상이다
  function videoOf(sec) { return sec ? (sec.querySelector('.face-bg.is-on video.bgvideo') || sec.querySelector('video.bgvideo')) : null; }
  function prep(sec) { return prepV(videoOf(sec)); }
  function prepV(v) {
    if (v && !v.getAttribute('src')) {
      v.preload = 'auto';
      v.src = pickSrc(v);
      // 4K 디코딩이 안 되는 기기·브라우저는 HD로 다시
      v.addEventListener('error', function () {
        var s = v.getAttribute('src') || '';
        if (/4k\.mp4$/.test(s)) { v.src = s.replace(/4k\.mp4$/, 'hd.mp4'); v.load(); if (v._want) tryPlay(v); }
      });
      v.load();
    }
    return v;
  }

  // 자동 재생이 막힌 환경(저전력 모드 등): 첫 터치·클릭 때 현재 섹션 영상을 다시 재생한다
  var pendingPlay = null;
  function tryPlay(v) {
    var p;
    try { p = v.play(); } catch (e) { p = null; }
    if (p && p.catch) p.catch(function (err) {
      if (err && err.name === 'AbortError') return;
      pendingPlay = v;
    });
  }
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (name) {
    addEventListener(name, function () {
      var v = pendingPlay;
      if (v) { pendingPlay = null; if (v._want) tryPlay(v); }
    }, { capture: true, passive: true });
  });

  function playV(v) { v = prepV(v); if (v) { v._want = true; tryPlay(v); } }
  function pauseV(v) { if (v) { v._want = false; v.pause(); } }
  function play(sec) { playV(videoOf(sec)); }
  function pause(sec) { if (sec) Array.prototype.forEach.call(sec.querySelectorAll('video.bgvideo'), pauseV); }

  /* ---------- 섹션 표시 점 / 메뉴 현재 위치 ---------- */
  var dotsNav = document.querySelector('.fp-dots');
  var fpRoot = document.querySelector('[data-fullpage]');
  var sections = Array.prototype.slice.call(fpRoot.querySelectorAll(':scope > .fp-section'));
  sections.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-go', '#' + s.id);
    b.setAttribute('aria-label', s.getAttribute('data-label'));
    b.innerHTML = '<span>' + s.getAttribute('data-label') + '</span>';
    dotsNav.appendChild(b);
  });
  function mark(i) {
    Array.prototype.forEach.call(dotsNav.children, function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    var id = sections[i].id;
    Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) {
      a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'true' : 'false');
    });
  }

  var themeTimer, inTimer, prepTimer;

  // ?perf 를 주소 끝에 붙이면 전환마다 프레임 시간을 콘솔에 찍는다 (버벅임 진단용)
  var perf = /[?&]perf\b/.test(location.search);
  function sampleFrames(label, ms) {
    var t0 = performance.now(), last = t0, n = 0, worst = 0, slow = 0;
    (function step(now) {
      var d = now - last; last = now; n++;
      if (n > 1) { if (d > worst) worst = d; if (d > 25) slow++; }
      if (now - t0 < ms) requestAnimationFrame(step);
      else console.log('[perf] ' + label + ' — ' + n + '프레임, 평균 ' + ((now - t0) / n).toFixed(1) + 'ms, 최악 ' + worst.toFixed(0) + 'ms, 25ms 초과 ' + slow + '회');
    })(t0);
  }
  /* ---------- 하치의 세 얼굴 (#faces): 아기하치·하치·빌런 하치 고르기 ---------- */
  var facesSec = document.getElementById('faces');
  var FACES = ['baby', 'main', 'villain'];
  var FACE_THEME = { baby: 'dark', main: 'dark', villain: 'light' };   // 헤더·점 색: dark = 진한 글자(밝은 배경), light = 흰 글자(어두운 배경)
  function faceOfHash(h) { var id = String(h || '').replace(/^#/, ''); return FACES.indexOf(id) >= 0 ? id : null; }
  function facesActive() { var fp = fpRoot.__fullpage; return !!(fp && facesSec && fp.sections[fp.index] === facesSec); }
  function syncHash(face) { try { if (history.replaceState) history.replaceState(null, '', '#' + face); } catch (e) { /* file:// 등 */ } }
  // 끄억뿌르륵 수치 게이지(반원): 얼굴마다 수치(0~1)가 있고, 바늘 각도·진행 호·숫자가 따라간다. 수치는 여기서 바꾼다
  var GAUGE = { baby: 0, main: 0.5, villain: 1 };
  var gauge = facesSec && facesSec.querySelector('.face-gauge');
  var gaugeNum = gauge && gauge.querySelector('[data-gauge-num]');
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var numRaf, numNow = null;
  function buildTicks() {
    var g = gauge.querySelector('.face-gauge__ticks'), ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i <= 20; i++) {
      var th = Math.PI * (1 - i / 20), major = i % 5 === 0, r1 = 132, r2 = major ? 145 : 139;
      var ln = document.createElementNS(ns, 'line');
      ln.setAttribute('x1', (170 + r1 * Math.cos(th)).toFixed(1)); ln.setAttribute('y1', (150 - r1 * Math.sin(th)).toFixed(1));
      ln.setAttribute('x2', (170 + r2 * Math.cos(th)).toFixed(1)); ln.setAttribute('y2', (150 - r2 * Math.sin(th)).toFixed(1));
      if (major) ln.setAttribute('class', 'is-major');
      g.appendChild(ln);
    }
  }
  function setGauge(face, animate) {
    if (!gauge) return;
    var lv = GAUGE[face], to = Math.round(lv * 100), from = numNow == null ? to : numNow;
    gauge.style.setProperty('--level', lv);
    gauge.style.setProperty('--rot', (-90 + 180 * lv) + 'deg');
    gauge.style.setProperty('--amp', (lv * 2.4).toFixed(2) + 'deg');
    gauge.style.setProperty('--lv', lv);
    cancelAnimationFrame(numRaf);
    if (!animate || calm || from === to) { numNow = to; gaugeNum.textContent = to; return; }
    var t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / 1000), e = 1 - Math.pow(1 - k, 3);
      numNow = Math.round(from + (to - from) * e); gaugeNum.textContent = numNow;
      if (k < 1) numRaf = requestAnimationFrame(step);
    })(t0);
  }
  // 섹션에 들어오면 바늘이 0에서 출발해 고른 얼굴까지 돌아간다
  function sweepGauge() {
    if (!gauge || calm) return;
    var face = facesSec.getAttribute('data-face');
    gauge.classList.add('is-reset'); numNow = 0; setGauge('baby', false);
    void gauge.offsetWidth;
    gauge.classList.remove('is-reset');
    setTimeout(function () { setGauge(face, true); }, 350);
  }
  var gaugeCap = facesSec && facesSec.querySelector('.face-gauge__cap');   // 게이지 아래 한 줄(얼굴마다 다름)
  var faceTimer;
  function setFace(face) {
    if (!facesSec || FACES.indexOf(face) < 0) return;
    var active = facesActive(), same = facesSec.getAttribute('data-face') === face;
    facesSec.setAttribute('data-face', face);
    facesSec.setAttribute('data-theme', FACE_THEME[face]);
    Array.prototype.forEach.call(facesSec.querySelectorAll('.face-bg, .face-profile, .face-scenes'), function (el) {
      el.classList.toggle('is-on', el.getAttribute('data-face') === face);
    });
    Array.prototype.forEach.call(facesSec.querySelectorAll('.face-stop'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-face') === face ? 'true' : 'false');
    });
    setGauge(face, active && !same);
    if (gaugeCap) gaugeCap.textContent = facesSec.querySelector('.face-profile[data-face="' + face + '"]').getAttribute('data-cap') || '';
    if (!active || same) return;
    document.body.setAttribute('data-theme', FACE_THEME[face]);
    syncHash(face);
    play(facesSec);                                  // 새 얼굴 영상은 바로 재생하고, 이전 영상은 크로스페이드가 끝난 뒤 멈춘다
    clearTimeout(faceTimer);
    faceTimer = setTimeout(function () {
      Array.prototype.forEach.call(facesSec.querySelectorAll('.face-bg'), function (bg) {
        if (!bg.classList.contains('is-on')) pauseV(bg.querySelector('video.bgvideo'));
      });
    }, 800);
  }
  // 섹션에 들어오면 나머지 얼굴 영상도 조금 뒤에 미리 불러와서, 얼굴을 바꿀 때 바로 움직이게 한다 (데이터 절약 모드에서는 안 함)
  function warmFaces() {
    var conn = navigator.connection || {};
    if (conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '')) return;
    setTimeout(function () {
      if (facesActive()) Array.prototype.forEach.call(facesSec.querySelectorAll('video.bgvideo'), prepV);
    }, 1600);
  }
  if (facesSec) {
    if (gauge) buildTicks();
    setFace(faceOfHash(location.hash) || 'main');    // 공유된 주소(#villain 등)는 그 얼굴이 골라진 채로 열린다
    Array.prototype.forEach.call(facesSec.querySelectorAll('.face-stop'), function (b) {
      b.addEventListener('click', function () { setFace(b.getAttribute('data-face')); });
    });
    // #baby·#main·#villain 링크(세 얼굴 안의 다음 버튼, 예전 주소)를 누르면 그 얼굴을 먼저 고른 뒤 섹션으로 이동한다 (FullPage 보다 먼저 등록해야 한다)
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"], [data-go]');
      var f = a && faceOfHash(a.getAttribute('data-go') || a.getAttribute('href'));
      if (f) setFace(f);
    });
    addEventListener('hashchange', function () { var f = faceOfHash(location.hash); if (f) setFace(f); });
  }

  FullPage.init(fpRoot, {
    duration: DURATION,
    wheel: false,   // 마우스 휠로는 넘기지 않고 SCROLL 버튼·오른쪽 점·상단 메뉴·키보드·스와이프로 이동. 다시 켜려면 true
    onLeave: function (from, to) {
      var S = this.sections;
      clearTimeout(prepTimer);                       // 전환 중에는 이웃 영상 내려받기를 시작하지 않는다
      play(S[to]);                                   // 올라오는 동안 이미 움직이고 있도록
      if (to === 0) hero.setActive(true);
      if (perf) sampleFrames(from + '→' + to, DURATION + 100);
      mark(to);
      clearTimeout(themeTimer); clearTimeout(inTimer);
      // 헤더 색은 새 섹션이 절반쯤 올라왔을 때, 문구는 조금 더 늦게
      themeTimer = setTimeout(function () { document.body.setAttribute('data-theme', S[to].getAttribute('data-theme')); }, DURATION * 0.45);
      inTimer = setTimeout(function () { S[to].classList.add('is-in'); }, DURATION * 0.35);
    },
    onChange: function (to) {
      var S = this.sections;
      document.body.setAttribute('data-theme', S[to].getAttribute('data-theme'));
      S.forEach(function (s, i) {
        if (i !== to) { pause(s); s.classList.remove('is-in'); }
      });
      S[to].classList.add('is-in');
      play(S[to]);
      if (S[to] === facesSec) { syncHash(facesSec.getAttribute('data-face')); warmFaces(); sweepGauge(); }   // 주소는 #faces 가 아니라 고른 얼굴(#main 등)로
      // 이웃 영상은 전환이 끝나고 한 박자 쉰 뒤에 불러온다 (문구가 떠오르는 동안 디코더·네트워크가 몰리지 않게)
      clearTimeout(prepTimer);
      prepTimer = setTimeout(function () { prep(S[to + 1]); prep(S[to - 1]); }, 900);
      hero.setActive(to === 0);
      if (to === 0) prologue.start(); else prologue.stop();   // 히어로로 돌아올 때마다 프롤로그를 처음부터
      mark(to);
    }
  });
})();

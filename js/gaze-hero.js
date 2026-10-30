/*!
 * GazeHero — 마우스 위치에 따라 캐릭터가 그쪽을 바라보는 비주얼 배너 (Video Scrubbing)
 *
 * 구성 (tools/build_frames.py 가 만든다)
 *   frames/<tier>/base.mp4   움직이지 않는 배경 (원본 해상도). 캐릭터 영상과 색 처리가 같도록 이미지가 아닌 영상으로 둔다
 *   frames/<tier>/gaze.mp4   캐릭터 영역만 잘라낸 영상. 정방향(0..N-1) 뒤에 역방향(N..2N-1)을 이어 붙였다
 *   frames/gaze-data.js      프레임별 시선 벡터, 깜빡임 구간, 배경/캐릭터 영역 좌표
 *
 * 모션 규칙
 *  - 마우스가 움직이는 즉시, 시선이 가장 비슷한 프레임을 목표로 정한다
 *  - 눈동자가 움직이는 프레임은 1초 36프레임으로, 거의 안 변하는 프레임은 6배속으로 지나간다(사실상 건너뜀)
 *  - 다른 방향으로 갈 때는 영상 속 깜빡임을 거쳐 넘어가고, 눈 감은 프레임끼리 이어 붙이는 지점은 짧게 크로스페이드
 *  - 재생 도중에 마우스가 바뀌면 그 자리에서 바로 방향을 튼다
 *
 * 재생 방식
 *  - 이어지는 프레임은 <video>를 그대로 재생한다 (하드웨어 디코딩: 4K여도 메모리 일정, 부드러움)
 *  - 되돌아가는 구간은 역방향 사본을 재생한다
 *  - 영상 위치 이동(seek)은 느릴 수 있어서 영상 2개를 번갈아 쓴다.
 *    보이지 않는 쪽을 다음에 필요한 위치로 미리 옮겨 두었다가, 그 순간에 바로 교체한다
 *
 * 어떤 환경에서도 멈추지 않게 하는 장치 (로딩)
 *  - 영상을 통째로 내려받아 메모리(Blob)에서 재생한다. 서버/사내 프록시가 Range 요청을 지원하지 않아도,
 *    네트워크가 느려도, 사파리처럼 Range를 요구하는 브라우저에서도 같은 방식으로 동작한다.
 *    (file:// 처럼 내려받기가 막힌 환경에서는 예전처럼 주소를 바로 연결한다)
 *  - 느린 회선이면 자동으로 더 가벼운 화질로 바꾼다. 영상 디코딩에 실패하면 낮은 화질 → 주소 직접 연결 순으로 다시 시도한다.
 *  - 'loadeddata' 같은 이벤트 하나에 의존하지 않고 readyState를 직접 확인한다.
 *    재생 전에는 영상을 불러오지 않는 브라우저(저전력 모드 등)는 muted play로 깨우고, 그래도 안 되면 첫 터치/클릭 때 다시 시도한다.
 *  - 배경 영상이 안 와도 포스터 이미지 위에서 동작한다.
 *  - 재생 도중 어느 단계에서 멈추더라도 감시 타이머(watchdog)가 상태를 되돌린다.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    data: null,                 // window.GAZE_DATA
    basePath: 'frames/',
    tier: 'auto',               // 'auto' | '4k' | 'qhd'
    coarseMaxTier: 'qhd',       // 터치 기기(모바일)에서 쓸 최대 화질 (데이터 절약)
    upscaleTolerance: 1.08,     // 이 배율 이하의 확대는 허용
    fps: 36,                    // 눈동자가 움직이는 프레임의 재생 속도 (원본 24fps보다 살짝 빠르게)
    fastRate: 6,                // 거의 안 변하는 프레임을 지나가는 배속
    rangeX: 0.30,               // 화면 너비의 30%만큼 떨어지면 시선 끝까지
    rangeY: 0.34,
    deadZone: 0.18,             // 눈 근처에서는 정면 응시
    weightY: 0.8,               // 세로 방향 가중치 (아래를 보는 장면이 없어서 낮춤)
    switchCost: 0.28,           // 다른 방향 구간으로 바꿀 때 페널티 (경계에서 왔다 갔다 방지)
    jumpCost: 1.5,              // 서로 다른 깜빡임 사이 점프 비용
    crossfadeMs: 90,            // 눈 감은 프레임끼리 이어 붙일 때 크로스페이드
    returnDelay: 1600,          // 마우스가 창 밖으로 나간 뒤 정면으로 돌아오기까지(ms)
    touchReturnDelay: 3200,     // 터치한 쪽을 바라본 뒤 정면으로 돌아오기까지(ms)
    idleBlink: [3800, 7500],    // 가만히 있을 때 자동 깜빡임 간격(ms), null이면 끔
    smoothMs: 130,              // 마우스 위치를 따라가는 부드러움(ms). 클수록 시선이 느긋하게 따라옴 (0이면 마우스를 그대로 따라감)
    headMs: 380,                // 고개가 시선을 따라가는 느긋함(ms). 시선보다 조금 늦게 따라와야 자연스럽다
    head: { x: 8, skew: 0.8, up: 0.01 },   // 고개 움직임 최대치: x=옮기는 거리(1920 화면 기준 px), skew=위쪽이 기우는 각도(도), up=위를 볼 때 늘어나는 비율. null이면 고개는 고정
    gyro: 'auto',               // 'auto' = 권한이 필요 없는 기기만, 'ask' = iOS 권한 요청, false = 끔
    portraitWidth: 2.4,          // 세로 화면: 하치 영상 폭을 화면 폭의 몇 배까지 키울지. 클수록 하치가 커지고 팔이 좌우로 더 잘린다(위쪽에 남는 곳은 배경색으로 채움). 이전 값은 1.9
    blob: true,                 // 영상을 통째로 내려받아 메모리에서 재생 (Range 미지원 서버·프록시, 느린 회선에서도 안정적)
    stallMs: 15000,             // 내려받기가 이만큼 멈춰 있으면 포기하고 주소 직접 연결로 전환
    maxLoadMs: 12000,           // 예상 내려받기 시간이 이보다 길면 더 가벼운 화질로 바꿈
    maxBlobMs: 45000,           // 가장 가벼운 화질도 이보다 오래 걸리면 통째로 받지 않고 주소를 바로 연결(받는 즉시 재생)
    seekableWaitMs: 8000,       // 주소 직접 연결 시 Range 미지원 서버라면 전체가 받아질 때까지 기다리는 최대 시간
    loadTimeoutMs: 25000,       // 영상 주소를 연결한 뒤 재생 준비까지 기다리는 최대 시간(탭이 보이는 동안만 셈)
    baseGraceMs: 6000,          // 캐릭터 영상이 준비된 뒤 배경 영상을 더 기다려 주는 시간 (그래도 안 오면 포스터 위에서 동작)
    debug: false,
    onReady: null
  };

  var STATIC_STEP = 0.012;      // 이웃 프레임 간 시선 변화가 이보다 작으면 '정지' 프레임
  var MIN_TARGET_STEP = 0.035;  // 같은 방향 안에서 이보다 작은 목표 변화는 무시
  var NEVER = { then: function () { return NEVER; }, catch: function () { return NEVER; } };   // 영원히 끝나지 않는 약속 (새 로딩이 이어받을 때)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rangeIncl(a, b) {
    var out = [], s = a <= b ? 1 : -1;
    for (var k = a; k !== b + s; k += s) out.push(k);
    return out;
  }
  function noop() {}

  /* ---------- 미디어 도우미 ---------- */

  /* 재생을 시도해 로딩을 깨운다 (재생 전에는 영상을 불러오지 않는 브라우저용). 실패는 무시 */
  function kick(v) {
    try { var p = v.play(); if (p && p.catch) p.catch(noop); } catch (e) { /* 무시 */ }
  }

  /* 영상 v가 minState(2 = 현재 프레임 있음) 이상이 될 때까지 기다린다. 이벤트 + 주기 확인을 함께 써서 이벤트가 안 와도 멈추지 않는다.
     탭이 가려져 있는 시간은 제한 시간에 넣지 않는다. 성공 true / 오류·시간 초과 false */
  function whenReady(v, minState, limitMs) {
    return new Promise(function (resolve) {
      var seen = 0, last = performance.now(), kicked = false, iv, done = false;
      var evs = ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'error', 'emptied'];
      function finish(ok) {
        if (done) return;
        done = true;
        clearInterval(iv);
        evs.forEach(function (e) { v.removeEventListener(e, check); });
        resolve(ok);
      }
      function check() {
        if (done) return;
        var now = performance.now();
        if (!document.hidden) seen += now - last;
        last = now;
        if (v.readyState >= minState) { finish(true); return; }
        if (v.error) { finish(false); return; }
        if (!kicked && seen > 1200 && v.readyState < 1) { kicked = true; kick(v); }
        if (seen > limitMs) finish(false);
      }
      evs.forEach(function (e) { v.addEventListener(e, check); });
      iv = setInterval(check, 100);
      check();
    });
  }

  /* 영상 전체가 탐색 가능해질 때까지 기다린다. Range 요청을 지원하지 않는 서버는 받은 만큼만 탐색할 수 있어서,
     그 상태로 시작하면 먼 프레임으로 이동하지 못한다. 제한 시간이 지나면 그냥 진행한다 */
  function whenSeekable(v, limitMs) {
    return new Promise(function (resolve) {
      var seen = 0, last = performance.now();
      (function chk() {
        var now = performance.now(), ok = false;
        if (!document.hidden) seen += now - last;
        last = now;
        try { ok = v.seekable.length > 0 && v.seekable.end(v.seekable.length - 1) >= v.duration - 0.2; } catch (e) { ok = true; }
        if (ok || seen > limitMs) resolve(ok); else setTimeout(chk, 150);
      })();
    });
  }

  /* 한 번 재생했다 멈춘다 — 일부 모바일 브라우저는 재생을 거쳐야 프레임 이동이 화면에 반영된다.
     재생이 막혀 있으면(NotAllowedError) onBlocked 호출. 끝나지 않아도 2.5초 뒤에는 넘어간다 */
  function prime(v, onBlocked) {
    return new Promise(function (resolve) {
      var settled = false, timer;
      function fin() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { v.pause(); } catch (e) { /* 무시 */ }
        resolve();
      }
      var p;
      try { p = v.play(); } catch (e) { p = null; }
      if (p && p.then) {
        p.then(fin, function (err) {
          if (onBlocked && (!err || err.name !== 'AbortError')) onBlocked();
          fin();
        });
      } else fin();
      timer = setTimeout(fin, 2500);
    });
  }

  /* 파일을 통째로 내려받아 Blob으로. 진행 상황을 알려 주고, 데이터가 stallMs 동안 오지 않으면 실패 처리.
     onProgress(받은 비율, 받은 바이트, 전체 바이트, 걸린 ms) 가 false 를 돌려주면 중단('abort') */
  function fetchBlob(url, mime, stallMs, onProgress) {
    return new Promise(function (resolve, reject) {
      var ctl = global.AbortController ? new AbortController() : null;
      var finished = false, last = performance.now(), t0 = last, timer;
      function end(err, blob) {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        if (err) { try { if (ctl) ctl.abort(); } catch (e) { /* 무시 */ } reject(err); }
        else resolve(blob);
      }
      timer = setInterval(function () {
        if (!document.hidden && performance.now() - last > stallMs) end(new Error('stall'));
      }, 1000);
      fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'same-origin', cache: 'default' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var total = parseInt(res.headers.get('Content-Length'), 10) || 0;
        if (!res.body || !res.body.getReader) {
          return res.blob().then(function (b) { end(null, new Blob([b], { type: mime })); });
        }
        var reader = res.body.getReader(), chunks = [], got = 0;
        (function pump() {
          reader.read().then(function (r) {
            if (finished) return;
            if (r.done) {
              if (total && got < total) { end(new Error('short')); return; }
              end(null, new Blob(chunks, { type: mime }));
              return;
            }
            chunks.push(r.value); got += r.value.length; last = performance.now();
            if (onProgress && onProgress(total ? got / total : 0, got, total, last - t0) === false) { end(new Error('abort')); return; }
            pump();
          }, function (e) { end(e); });
        })();
      }).catch(function (e) { end(e); });
    });
  }

  function GazeHero(root, options) {
    this.root = root;
    this.o = Object.assign({}, DEFAULTS, options || {});
    this.data = this.o.data || global.GAZE_DATA;
    if (!this.data) throw new Error('GazeHero: GAZE_DATA가 없습니다. frames/gaze-data.js를 먼저 불러오세요.');
    var q = location.search;
    if (/[?&]debug\b/.test(q)) this.o.debug = true;
    var forced = q.match(/[?&]tier=(\w+)/);
    if (forced) this.o.tier = forced[1];
    if (/[?&]noblob\b/.test(q)) this.o.blob = false;
    if (/[?&]nohead\b/.test(q)) this.o.head = null;

    this.F = this.data.frames;
    this.N = this.data.count;
    this.srcFps = this.data.fps || 24;
    this.rate = this.o.fps / this.srcFps;
    this.stepMs = 1000 / this.o.fps;
    this.coarse = !!(global.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.reduceMotion = !!(global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.curFrame = this.data.start || 0;
    this.curPos = this.curFrame;
    this.target = this.curFrame;
    this.targetDirty = false;
    this.runs = [];
    this.busy = false;
    this.playing = false;
    this.ready = false;
    this.state = 'loading';
    this.visible = true;
    this.active = true;         // 풀페이지에서 이 섹션이 보이는 중인지 (setActive로 제어)
    this.inView = true;
    this.vec = { x: 0, y: 0 };
    this.raw = { x: 0, y: 0 };    // 마우스가 가리키는 값 (그대로)
    this.sv = { x: 0, y: 0 };     // 부드럽게 따라가는 시선 값 → 목표 프레임을 고르는 데 쓴다
    this.hv = { x: 0, y: 0 };     // 고개가 따라가는 값 (시선보다 느긋)
    this.gen = 0;               // 재생 세대 (방향이 바뀌면 이전 비동기 작업 무효화)
    this.lastActivity = performance.now();
    this._looping = false;
    this._retries = 0;

    this._indexStructure();
    this._tick = this._tick.bind(this);
    this._build();
    this._bindInput();
    this._scheduleBlink();
    this._startLoop();
  }

  /* ================= 데이터 구조 & 경로 계산 ================= */
  GazeHero.prototype._indexStructure = function () {
    var d = this.data, self = this;
    this.blinkAfter = {};
    this.blinkBefore = {};
    this.closedSet = {};
    d.blinks.forEach(function (b, idx) {
      b.idx = idx;
      self.closedSet[b.closed] = idx;
      d.segments.forEach(function (s, si) {
        if (s[1] === b.from) self.blinkAfter[si] = b;
        if (s[0] === b.to) self.blinkBefore[si] = b;
      });
    });
    this.targetable = [];
    for (var i = 0; i < this.N; i++) if (this.F[i][3]) this.targetable.push(i);
  };

  GazeHero.prototype._seg = function (i) { return this.F[i][2]; };
  GazeHero.prototype._gazeDist = function (a, b) {
    var A = this.F[a], B = this.F[b];
    if (!A || !B || A[0] == null || B[0] == null) return 1;
    return Math.hypot(A[0] - B[0], A[1] - B[1]);
  };
  GazeHero.prototype._isStatic = function (a, b) {
    return this._seg(a) >= 0 && this._seg(b) >= 0 && this._gazeDist(a, b) < STATIC_STEP;
  };
  GazeHero.prototype._blinkOf = function (f) {
    var bl = this.data.blinks;
    for (var i = 0; i < bl.length; i++) if (f > bl[i].from && f < bl[i].to) return bl[i];
    return null;
  };

  GazeHero.prototype._walk = function (a, b) { return a === b ? [] : rangeIncl(a, b).slice(1); };

  GazeHero.prototype._exits = function (from) {
    var s = this._seg(from);
    if (s < 0) {
      // 깜빡이는 중: 그 깜빡임의 눈 감은 프레임까지 마저 감은 뒤 원하는 쪽으로 넘어간다
      var bk = this._blinkOf(from);
      return bk ? [{ blink: bk.idx, path: this._walk(from, bk.closed) }] : [];
    }
    var out = [], aft = this.blinkAfter[s], bef = this.blinkBefore[s];
    if (aft) out.push({ blink: aft.idx, path: this._walk(from, aft.closed) });
    if (bef) out.push({ blink: bef.idx, path: this._walk(from, bef.closed) });
    return out;
  };

  GazeHero.prototype._enters = function (to) {
    var s = this._seg(to), out = [], bef = this.blinkBefore[s], aft = this.blinkAfter[s];
    if (bef) out.push({ blink: bef.idx, path: rangeIncl(bef.closed, to) });
    if (aft) out.push({ blink: aft.idx, path: rangeIncl(aft.closed, to) });
    return out;
  };

  /* 경로의 체감 시간 (프레임 수 기준, 정지 프레임은 배속만큼 가볍게) */
  GazeHero.prototype._cost = function (from, path) {
    var c = 0, prev = from, light = this.rate / this.o.fastRate;
    for (var i = 0; i < path.length; i++) {
      var k = path[i];
      c += Math.abs(k - prev) > 1 ? 0 : (this._isStatic(prev, k) ? light : 1);
      prev = k;
    }
    return c;
  };

  GazeHero.prototype._plan = function (from, to, forceBlink) {
    var s0 = this._seg(from), s1 = this._seg(to);
    if (!forceBlink && s0 >= 0 && s0 === s1) return this._walk(from, to);
    var exits = this._exits(from), enters = this._enters(to), best = null, bestCost = Infinity;
    var diff = this.data.blinkDiff;
    for (var i = 0; i < exits.length; i++) {
      for (var j = 0; j < enters.length; j++) {
        var e = exits[i], n = enters[j];
        var jump = e.blink === n.blink ? 0 : (diff ? diff[e.blink][n.blink] : 3) * this.o.jumpCost;
        var tail = e.path.length ? e.path[e.path.length - 1] : from;
        var path = e.path.concat(n.path[0] === tail ? n.path.slice(1) : n.path);
        var cost = this._cost(from, path) + jump;
        if (cost < bestCost) { bestCost = cost; best = path; }
      }
    }
    return best;
  };

  /* 프레임 경로 → 재생 구간. 같은 방향으로 이어지는 프레임은 한 구간, 방향이 바뀌거나 건너뛰면 새 구간 */
  GazeHero.prototype._toRuns = function (from, path) {
    var runs = [], prev = from, run = null, i;
    for (i = 0; i < path.length; i++) {
      var k = path[i], d = k - prev;
      if (Math.abs(d) === 1) {
        if (run && run.to === prev && (run.dir === d || run.from === run.to)) { run.dir = d; run.to = k; }
        else { run = { from: prev, to: k, dir: d }; runs.push(run); }
      } else {
        run = { from: k, to: k, dir: 0 }; runs.push(run);       // 눈 감은 프레임끼리 건너뛰기
      }
      prev = k;
    }
    for (i = runs.length - 1; i >= 0; i--) if (!runs[i].dir) runs[i].dir = runs[i + 1] ? runs[i + 1].dir : 1;
    return runs;
  };

  GazeHero.prototype._posOf = function (frame, dir) { return dir > 0 ? frame : 2 * this.N - 1 - frame; };
  GazeHero.prototype._frameOf = function (pos) { return pos < this.N ? pos : 2 * this.N - 1 - pos; };
  GazeHero.prototype._mirror = function (pos) { return 2 * this.N - 1 - pos; };

  /* ================= 입력 → 목표 ================= */
  GazeHero.prototype._headingSeg = function () {
    var last = this.runs.length ? this.runs[this.runs.length - 1].to : this.curFrame;
    return this._seg(last);
  };

  GazeHero.prototype._pickTarget = function (vx, vy) {
    if (Math.hypot(vx, vy) < this.o.deadZone) { vx = 0; vy = 0; }
    var hs = this._headingSeg(), best = this.target, bestCost = Infinity, wy = this.o.weightY;
    for (var k = 0; k < this.targetable.length; k++) {
      var i = this.targetable[k], f = this.F[i];
      var c = Math.hypot(f[0] - vx, (f[1] - vy) * wy);
      if (f[2] !== hs) c += this.o.switchCost;
      if (c < bestCost) { bestCost = c; best = i; }
    }
    return best;
  };

  /* 마우스·터치·기울기가 가리키는 값을 받는다. 시선은 이 값을 바로 쓰지 않고, 매 프레임 부드럽게 따라간다(_follow) */
  GazeHero.prototype.lookAt = function (vx, vy) {
    this.raw.x = vx; this.raw.y = vy;
    if (!this.o.smoothMs || !this.ready) { this.sv.x = vx; this.sv.y = vy; this._applyLook(vx, vy); }
    this._scheduleBlink();
  };

  GazeHero.prototype._applyLook = function (vx, vy) {
    this.vec.x = vx; this.vec.y = vy;
    var t = this._pickTarget(vx, vy);
    var tiny = this._seg(t) === this._seg(this.target) && this._gazeDist(t, this.target) < MIN_TARGET_STEP;
    if (t !== this.target && !tiny) { this.target = t; this.targetDirty = true; }
  };

  /* 매 프레임: 시선 값(sv)은 마우스(raw)를 지수 평활로, 고개(hv)는 시선(sv)을 더 느긋하게 따라간다.
     시선이 먼저 움직이고 고개가 뒤따라오는 순서라서 눈이 갑자기 튀거나 목표 프레임이 자주 바뀌지 않고 이어진다 */
  GazeHero.prototype._follow = function (dt) {
    var o = this.o, a = o.smoothMs ? 1 - Math.exp(-dt / o.smoothMs) : 1, sv = this.sv, hv = this.hv, raw = this.raw;
    sv.x += (raw.x - sv.x) * a; sv.y += (raw.y - sv.y) * a;
    if (Math.abs(raw.x - sv.x) < 0.002) sv.x = raw.x;
    if (Math.abs(raw.y - sv.y) < 0.002) sv.y = raw.y;
    if (sv.x !== this._lx || sv.y !== this._ly) { this._lx = sv.x; this._ly = sv.y; this._applyLook(sv.x, sv.y); }
    if (o.head && this.stage && !this.reduceMotion) {
      var b = o.headMs ? 1 - Math.exp(-dt / o.headMs) : 1;
      hv.x += (sv.x - hv.x) * b; hv.y += (sv.y - hv.y) * b;
      if (Math.abs(sv.x - hv.x) < 0.0005) hv.x = sv.x;
      if (Math.abs(sv.y - hv.y) < 0.0005) hv.y = sv.y;
      this._applyHead();
    }
  };

  /* 고개 움직임: 배경 영상과 캐릭터 영상이 들어 있는 stage 전체를 함께 움직인다.
     한쪽(캐릭터)만 움직이면 브라우저가 두 겹의 색을 다르게 처리해 캐릭터 영역이 네모로 드러날 수 있어서, 둘을 같은 방식으로 움직인다.
     3D 회전 없이 2D 만 쓴다: 옆으로 조금 옮기고(translateX), 아래쪽 가장자리를 고정한 채 위쪽을 기울이고(skewX), 위를 볼 때 위로 살짝 늘인다(scaleY).
     움직이면서 화면 가장자리가 드러나지 않도록 움직인 만큼만 같이 키운다(scale). 가만히 있을 때는 transform 을 아예 없앤다 */
  GazeHero.prototype._applyHead = function () {
    var h = this.o.head, g = this.geom;
    if (!h || !g) return;
    var k = g.dh / 1080, x = clamp(this.hv.x, -1.3, 1.3), y = clamp(this.hv.y, -1.3, 1.3), t = 'none';
    if (Math.abs(x) > 0.002 || y < -0.002) {
      var W = this.root.clientWidth, H = this.root.clientHeight;
      var tx = x * h.x * k, sk = x * h.skew;
      var need = Math.abs(tx) + H * Math.tan(Math.abs(sk) * Math.PI / 180) + 2;       // 가장자리가 드러날 수 있는 최대 폭(px)
      var sc = 1 + need / (W / 2), sy = y < 0 ? 1 + (-y) * h.up : 1;
      t = 'translateX(' + tx.toFixed(2) + 'px) skewX(' + (-sk).toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ',' + (sc * sy).toFixed(4) + ')';
    }
    if (t !== this._headT) {
      this._headT = t;
      this.vids.forEach(function (v) { v.style.transformOrigin = 'center bottom'; v.style.transform = t; });
    }
  };

  GazeHero.prototype.lookCenter = function () { this.lookAt(0, 0); };

  GazeHero.prototype._eyeOnScreen = function () {
    var r = this.root.getBoundingClientRect(), g = this.geom;
    if (!g) return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
    return { x: r.left + g.dx + this.data.eye.x * g.dw, y: r.top + g.dy + this.data.eye.y * g.dh };
  };

  GazeHero.prototype._bindInput = function () {
    var self = this, returnTimer = null;
    function fromPoint(px, py) {
      var e = self._eyeOnScreen();
      var vx = (px - e.x) / (innerWidth * self.o.rangeX);
      var vy = (py - e.y) / (innerHeight * self.o.rangeY);
      var len = Math.hypot(vx, vy), max = 1.35;
      if (len > max) { vx *= max / len; vy *= max / len; }
      self.lookAt(vx, vy);
    }
    function scheduleReturn(e) {
      clearTimeout(returnTimer);
      var touch = e && e.pointerType && e.pointerType !== 'mouse';
      returnTimer = setTimeout(function () { self.lookCenter(); }, touch ? self.o.touchReturnDelay : self.o.returnDelay);
    }
    addEventListener('pointermove', function (e) {
      if (!self.visible) return;
      clearTimeout(returnTimer);
      fromPoint(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') scheduleReturn(e);
    }, { passive: true });
    addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' && self.root.contains(e.target)) { fromPoint(e.clientX, e.clientY); scheduleReturn(e); }
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { scheduleReturn(); });
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) scheduleReturn(); });
    addEventListener('blur', function () { scheduleReturn(); });

    if (this.o.gyro && this.coarse && 'DeviceOrientationEvent' in global) {
      var base = null, lastTouch = 0;
      self.root.addEventListener('pointerdown', function () { lastTouch = performance.now(); }, { passive: true });
      var onOrient = function (e) {
        if (e.gamma == null || !self.visible) return;
        if (performance.now() - lastTouch < 2500) return;
        if (!base) base = { g: e.gamma, b: e.beta };
        base.g += (e.gamma - base.g) * 0.004;
        base.b += (e.beta - base.b) * 0.004;
        self.lookAt(clamp((e.gamma - base.g) / 18, -1.35, 1.35), clamp((e.beta - base.b) / 18, -1.35, 1.35));
      };
      var D = global.DeviceOrientationEvent;
      if (typeof D.requestPermission === 'function') {
        if (this.o.gyro === 'ask') {
          self.root.addEventListener('click', function once() {
            self.root.removeEventListener('click', once);
            D.requestPermission().then(function (s) { if (s === 'granted') addEventListener('deviceorientation', onOrient); }).catch(noop);
          });
        }
      } else {
        addEventListener('deviceorientation', onOrient);
      }
    }

    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (ents) {
        self.inView = ents[ents.length - 1].isIntersecting;   // 한꺼번에 여러 건이 오면 가장 최근 것이 현재 상태
        self._updateVisible();
      }, { threshold: 0.02 }).observe(this.root);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self._halt(); else self._resync();
    });
    // 뒤로가기 캐시(bfcache)에서 복원되면 영상 디코더가 초기화돼 있을 수 있다
    addEventListener('pageshow', function (e) { if (e.persisted) self._resync(); });
  };

  GazeHero.prototype._updateVisible = function () {
    var was = this.visible;
    this.visible = this.inView && this.active;
    if (!this.visible) this._halt();
    else {
      if (!was) { this._scheduleBlink(); if (this.seekOnly) this._probePlay(null); }
      this._startLoop();
    }
  };

  /* 풀페이지 스크롤에서 다른 섹션으로 덮였을 때 멈추고, 돌아오면 다시 시작 */
  GazeHero.prototype.setActive = function (on) {
    this.active = !!on;
    this._updateVisible();
  };

  GazeHero.prototype._scheduleBlink = function () {
    var r = this.o.idleBlink;
    this.nextBlinkAt = (r && !this.reduceMotion) ? performance.now() + r[0] + Math.random() * (r[1] - r[0]) : Infinity;
  };

  /* 탭이 다시 보이거나 캐시에서 복원됐을 때: 현재 프레임을 다시 그리고, 멈춘 로딩을 이어간다 */
  GazeHero.prototype._resync = function () {
    this._startLoop();
    if (this.state === 'error') { this._load(); return; }
    if (!this.ready) { this._kickAll(); return; }
    if (!this.busy && !this.playing) {
      var v = this._active();
      v._pos = -1;                                   // 위치를 믿지 않고 다시 맞춘다
      this._seekVid(v, this.curPos);
      this._preseek();
    }
  };

  GazeHero.prototype._kickAll = function () {
    [this.baseVid].concat(this.vids).forEach(function (v) { if (v.readyState < 2) kick(v); });
  };

  /* 재생 방식(seekOnly=false)으로 돌아갈 수 있는지 확인한다. 로딩 중 화면에 안 보이는 상태라서 막혔던 경우 등에 복구된다 */
  GazeHero.prototype._probePlay = function (onFail) {
    var self = this, v = this._active(), p;
    if (!this.seekOnly || !this.ready || this.busy || this.playing) return;
    try { p = v.play(); } catch (e) { p = null; }
    if (!p || !p.then) return;
    p.then(function () {
      if (self.busy || self.playing) return;
      v.pause();
      self.seekOnly = false;
      v._pos = -1;
      self._seekVid(v, self.curPos);
    }, function () { if (onFail) onFail(); });
  };

  /* 자동 재생이 막혔거나 로딩이 멈춘 환경: 첫 터치·클릭·키 입력(사용자 동작)이 오면 다시 시도한다 */
  GazeHero.prototype._unlock = function () {
    var self = this;
    if (this._unlockBound) return;
    this._unlockBound = true;
    var evs = ['pointerup', 'touchend', 'click', 'keydown'];
    var h = function () {
      evs.forEach(function (e) { removeEventListener(e, h, true); });
      self._unlockBound = false;
      if (self.state === 'error') { self._retries = 0; self._load(); return; }
      if (!self.ready) { self._kickAll(); self._unlock(); return; }
      if (self.seekOnly) self._probePlay(function () { self._unlock(); });
    };
    evs.forEach(function (e) { addEventListener(e, h, { capture: true, passive: true }); });
  };

  /* ================= 화면 구성 ================= */
  GazeHero.prototype._makeVideo = function () {
    var v = document.createElement('video');
    v.className = 'gaze-hero__video';
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.preload = 'auto';
    v.disablePictureInPicture = true;
    v.setAttribute('disableremoteplayback', '');
    v._pos = -1;
    return v;
  };

  GazeHero.prototype._build = function () {
    var root = this.root, self = this;
    Array.prototype.slice.call(root.querySelectorAll('canvas')).forEach(function (c) { c.parentNode.removeChild(c); });
    this.backdrop = document.createElement('canvas');
    this.backdrop.className = 'gaze-hero__backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    root.insertBefore(this.backdrop, root.firstChild);
    this.poster = new Image();
    this.poster.onload = function () { self._paintBackdrop(); };
    this.poster.src = this.o.basePath + 'poster.webp';
    this.stage = document.createElement('div');
    this.stage.className = 'gaze-hero__stage';
    this.stage.setAttribute('aria-hidden', 'true');
    this.baseVid = this._makeVideo();
    this.baseVid.className = 'gaze-hero__base';
    ['loadeddata', 'seeked'].forEach(function (event) {
      self.baseVid.addEventListener(event, function () { self._paintBackdrop(); });
    });
    this.vids = [this._makeVideo(), this._makeVideo()];
    this.act = 0;
    // 영상 요소는 DOM에서 옮기지 않는다 (브라우저에 따라 옮기는 순간 재생·디코더가 초기화됨). 겹침 순서는 z-index로만 바꾼다
    this.baseVid.style.zIndex = '0';
    this.vids[0].style.opacity = '1'; this.vids[0].style.zIndex = '2';
    this.vids[1].style.opacity = '0'; this.vids[1].style.zIndex = '1';
    this.stage.appendChild(this.baseVid);
    this.stage.appendChild(this.vids[0]);
    this.stage.appendChild(this.vids[1]);
    root.insertBefore(this.stage, root.firstChild);

    // 실행 중 오류·끝 도달 처리 (로딩을 다시 해도 중복 등록되지 않도록 여기서 한 번만 연결)
    this.vids.forEach(function (v, i) {
      v.addEventListener('ended', function () { if (self.playing && v === self._active()) self._finishRun(self.gen); });
      v.addEventListener('error', function () { self._onMediaError(v); });
      if (i === 0) {
        v.addEventListener('progress', function () {
          if (self._blobMode || !v.buffered.length || !v.duration) return;
          self._progress(v.buffered.end(v.buffered.length - 1) / v.duration);
        });
      }
    });

    var relayout = function () { self._layout(); };
    if ('ResizeObserver' in global) {
      var layoutObserver = new ResizeObserver(relayout);
      layoutObserver.observe(root);
      var copy = root.querySelector('.s-hero__copy');
      if (copy) layoutObserver.observe(copy);
    }
    else addEventListener('resize', relayout);
    addEventListener('orientationchange', function () { setTimeout(relayout, 300); });
    this._layout();
    this._load();
  };

  GazeHero.prototype._progress = function (f) {
    this.root.style.setProperty('--gaze-progress', clamp(f || 0, 0, 1).toFixed(3));
  };

  GazeHero.prototype._layout = function () {
    var cw = this.root.clientWidth, ch = this.root.clientHeight;
    if (!cw || !ch) return;
    var src = this.data.source || [3840, 2160], P = this.data.patch || [0, 0, src[0], src[1]];
    var stacked = matchMedia('(max-aspect-ratio: 3/2), (max-width: 1100px)').matches &&
      !matchMedia('(min-width: 601px) and (max-height: 600px)').matches;
    var dh, dw, dx, dy;
    if (stacked) {
      var copy = this.root.querySelector('.s-hero__copy');
      var copyBottom = copy ? copy.offsetTop + copy.offsetHeight : ch * .4;
      // The character starts around 20% down the source. Keep it below the copy.
      dh = Math.max(180, Math.min(cw * this.o.portraitWidth * src[1] / src[0], (ch - copyBottom - 44) / .8));   // 세로 화면: 화면 폭의 portraitWidth 배까지 키운다(팔은 좌우가 조금 잘려도 됨)
      dw = dh * src[0] / src[1];
      dy = ch - dh;
    } else {
      dw = Math.min(cw, ch * src[0] / src[1]);
      dh = dw * src[1] / src[0];
      dy = ch - dh;
    }
    dx = (cw - dw) / 2;
    var gap = dy > 0;
    this.root.style.setProperty('--gaze-stage-w', dw + 'px');
    if (gap) this.root.setAttribute('data-gap', ''); else this.root.removeAttribute('data-gap');
    this.root.style.setProperty('--gaze-stage-top', dy + 'px');
    this.root.style.setProperty('--gaze-stage-h', dh + 'px');
    // 히어로 문구가 하치와 항상 같은 간격을 유지하도록, 시안(1920×1080) 1px 이 화면에서 몇 px 인지(k)와 시안의 왼쪽·위쪽 시작점을 알려 준다
    this.root.style.setProperty('--hero-k', (dh / 1080) + 'px');
    this.root.style.setProperty('--hero-x0', dx + 'px');
    this.root.style.setProperty('--hero-y0', dy + 'px');
    this.geom = { dw: dw, dh: dh, dx: dx, dy: dy, need: dw * Math.min(global.devicePixelRatio || 1, 3) };
    this._paintBackdrop();
    var st = this.stage.style;
    st.left = dx + 'px'; st.top = dy + 'px'; st.width = dw + 'px'; st.height = dh + 'px';
    st.transformOrigin = (cw / 2 - dx) + 'px ' + (ch - dy) + 'px';   // 고개 움직임의 축: 화면 아래쪽 가운데
    // 영상 가장자리를 배경에 서서히 녹여 경계선이 보이지 않게 (화면 끝에 닿은 변은 제외)
    var F = 32, fl = P[0] > 0 ? F / P[2] * 100 : 0, fr = P[0] + P[2] < src[0] ? F / P[2] * 100 : 0;
    var ft = P[1] > 0 ? F / P[3] * 100 : 0, fb = P[1] + P[3] < src[1] ? F / P[3] * 100 : 0;
    var m = 'linear-gradient(to right, transparent 0, #000 ' + fl + '%, #000 ' + (100 - fr) + '%, transparent 100%),' +
            'linear-gradient(to bottom, transparent 0, #000 ' + ft + '%, #000 ' + (100 - fb) + '%, transparent 100%)';
    this.vids.forEach(function (v) {
      var vs = v.style;
      vs.left = (P[0] / src[0] * 100) + '%';
      vs.top = (P[1] / src[1] * 100) + '%';
      vs.width = (P[2] / src[0] * 100) + '%';
      vs.height = (P[3] / src[1] * 100) + '%';
      vs.webkitMaskImage = m; vs.maskImage = m;
      vs.webkitMaskComposite = 'source-in'; vs.maskComposite = 'intersect';
    });
  };

  // Extend the decoded source's actual edge pixels, with no guessed CSS colors.
  // Drawing is supported for file:// media; no pixel reads or canvas export are needed.
  GazeHero.prototype._paintBackdrop = function () {
    var c = this.backdrop, g = this.geom;
    if (!c || !g) return;
    var source = this.baseVid && this.baseVid.readyState >= 2 ? this.baseVid : this.poster;
    var sw = source && (source.videoWidth || source.naturalWidth);
    var sh = source && (source.videoHeight || source.naturalHeight);
    if (!sw || !sh) return;
    var w = this.root.clientWidth, h = this.root.clientHeight;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var x = g.dx, y = g.dy, iw = g.dw, ih = g.dh;
    // Corners, side strips, then the original frame cover the viewport continuously.
    if (y > 0) {
      ctx.drawImage(source, 0, 0, sw, 1, x, 0, iw, y + 1);
      if (x > 0) {
        ctx.drawImage(source, 0, 0, 1, 1, 0, 0, x + 1, y + 1);
        ctx.drawImage(source, sw - 1, 0, 1, 1, x + iw - 1, 0, w - x - iw + 1, y + 1);
      }
    }
    if (x > 0) {
      ctx.drawImage(source, 0, 0, 1, sh, 0, y, x + 1, ih);
      ctx.drawImage(source, sw - 1, 0, 1, sh, x + iw - 1, y, w - x - iw + 1, ih);
    }
    ctx.drawImage(source, 0, 0, sw, sh, x, y, iw, ih);
    if (this.ready) {
      var P = this.data.patch, src = this.data.source;
      var px = x + P[0] / src[0] * iw, py = y + P[1] / src[1] * ih;
      var pw = P[2] / src[0] * iw, ph = P[3] / src[1] * ih;
      var layer = this._patchCanvas || (this._patchCanvas = document.createElement('canvas'));
      var lw = Math.ceil(pw * dpr), lh = Math.ceil(ph * dpr);
      if (layer.width !== lw || layer.height !== lh) { layer.width = lw; layer.height = lh; }
      var lc = layer.getContext('2d');
      lc.clearRect(0, 0, lw, lh);
      lc.globalCompositeOperation = 'source-over';
      var active = this._active(), standby = this._standby();
      if (standby.readyState >= 2 && parseFloat(standby.style.opacity) > 0) lc.drawImage(standby, 0, 0, lw, lh);
      if (active.readyState >= 2) {
        lc.globalAlpha = parseFloat(getComputedStyle(active).opacity) || 1;
        lc.drawImage(active, 0, 0, lw, lh); lc.globalAlpha = 1;
      }
      var edge = Math.min(24 * dpr, lw * .04, lh * .04);
      var gx = lc.createLinearGradient(0, 0, lw, 0);
      gx.addColorStop(0, 'transparent'); gx.addColorStop(edge/lw, '#000');
      gx.addColorStop(1-edge/lw, '#000'); gx.addColorStop(1, 'transparent');
      var gy = lc.createLinearGradient(0, 0, 0, lh);
      gy.addColorStop(0, 'transparent'); gy.addColorStop(edge/lh, '#000');
      gy.addColorStop(1, '#000');
      lc.globalCompositeOperation = 'destination-in';
      lc.fillStyle = gx; lc.fillRect(0, 0, lw, lh);
      lc.fillStyle = gy; lc.fillRect(0, 0, lw, lh);
      lc.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, px, py, pw, ph);
    }
  };

  GazeHero.prototype._tiersAsc = function () {
    var tiers = this.data.tiers || { '4k': 1 };
    return Object.keys(tiers).sort(function (a, b) { return tiers[a] - tiers[b]; });
  };

  GazeHero.prototype._chooseTier = function () {
    var tiers = this.data.tiers || { '4k': 1 }, src = this.data.source || [3840, 2160];
    if (this.o.tier !== 'auto' && tiers[this.o.tier]) return this.o.tier;
    var names = this._tiersAsc();
    var cap = this.coarse && tiers[this.o.coarseMaxTier] ? tiers[this.o.coarseMaxTier] : Infinity;
    // 데이터 절약 모드·느린 회선(2G/3G)에서는 가장 가벼운 화질
    var conn = global.navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    if (conn && (conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || ''))) cap = Math.min(cap, tiers[names[0]]);
    names = names.filter(function (n) { return tiers[n] <= cap; });
    if (!names.length) names = [this._tiersAsc()[0]];
    var need = this.geom ? this.geom.need : innerWidth * (global.devicePixelRatio || 1);
    for (var i = 0; i < names.length; i++) {
      if (src[0] * tiers[names[i]] * this.o.upscaleTolerance >= need) return names[i];
    }
    return names[names.length - 1];
  };

  GazeHero.prototype._setState = function (s, why) {
    this.state = s;
    this.root.setAttribute('data-state', s);
    if (why) this.root.setAttribute('data-error', why); else this.root.removeAttribute('data-error');
    if (this.o.debug && why) console.warn('[GazeHero] ' + s + ': ' + why);
  };

  GazeHero.prototype._lowerTier = function (tier) {
    var names = this._tiersAsc(), i = names.indexOf(tier);
    return i > 0 ? names[i - 1] : null;
  };

  /* 로딩 시작 — 영상을 메모리로 내려받은 뒤(가능하면) 요소에 연결한다. 실패하면 낮은 화질 / 주소 직접 연결 순으로 다시 시도 */
  GazeHero.prototype._load = function () {
    var self = this, id = (this.loadId = (this.loadId || 0) + 1);
    var tier = this._tierOverride || this._chooseTier(), dir = this.o.basePath + tier + '/';
    this.tier = tier;
    this.ready = false;
    this.root.setAttribute('data-tier', tier);
    this._setState('loading');
    this._progress(0);
    var file = (location.search.match(/[?&]video=([\w.]+)/) || [])[1] || 'gaze.mp4';   // 테스트용 덮어쓰기
    var isWebm = /\.webm$/.test(file), mime = isWebm ? 'video/webm' : 'video/mp4';
    var gazeUrl = dir + file, baseUrl = dir + (isWebm ? 'base.webm' : 'base.mp4');
    var canBlob = this.o.blob && !this._forceDirect && /^https?:$/.test(location.protocol) &&
                  global.fetch && global.Blob && global.URL && URL.createObjectURL;
    var lowerTier = this.o.tier === 'auto' ? this._lowerTier(tier) : null;

    var sources;
    if (canBlob) {
      var baseP = fetchBlob(baseUrl, mime, this.o.stallMs).catch(function () { return null; });   // 배경 영상은 없어도 된다
      var gazeP = fetchBlob(gazeUrl, mime, this.o.stallMs, function (frac, got, total, ms) {
        if (id !== self.loadId) return false;
        self._progress(frac);
        // 이 속도로는 너무 오래 걸리면 더 가벼운 화질로 바꾼다
        if (total && ms > 1500) {
          var eta = (total - got) / (got / ms);
          if (lowerTier && eta > self.o.maxLoadMs) { self._tierOverride = lowerTier; return false; }
          if (!lowerTier && eta > self.o.maxBlobMs) return false;      // 너무 느림 → 주소 직접 연결로 바로 재생
        }
        return true;
      });
      sources = Promise.all([baseP, gazeP]).then(function (r) {
        return { base: r[0] ? URL.createObjectURL(r[0]) : baseUrl, gaze: URL.createObjectURL(r[1]), blob: true };
      }, function (err) {
        if (id !== self.loadId) return NEVER;
        if (self._tierOverride && self._tierOverride !== tier) {           // 느린 회선 → 가벼운 화질로 다시
          self._load();
          return NEVER;
        }
        if (self.o.debug) console.warn('[GazeHero] 내려받기 실패 → 주소 직접 연결', err && err.message);
        return { base: baseUrl, gaze: gazeUrl, blob: false };
      });
    } else {
      sources = Promise.resolve({ base: baseUrl, gaze: gazeUrl, blob: false });
    }
    sources.then(function (src) {
      if (id !== self.loadId) return;
      self._attach(src, id);
    });
  };

  GazeHero.prototype._revoke = function () {
    (this._urls || []).forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* 무시 */ } });
    this._urls = [];
  };

  GazeHero.prototype._attach = function (src, id) {
    var self = this, bv = this.baseVid, vids = this.vids;
    this._revoke();
    if (src.blob) this._urls = [src.base, src.gaze];
    this._blobMode = src.blob;
    this.seekOnly = false;
    bv.removeAttribute('data-failed');
    bv.style.display = '';

    bv.src = src.base; bv.load();
    vids.forEach(function (v) {
      v._pos = -1; v._seeking = null; v._seekTarget = -1;
      v.src = src.gaze; v.load();
    });

    var limit = this.o.loadTimeoutMs;
    var gazeReady = Promise.all(vids.map(function (v) { return whenReady(v, 2, limit); })).then(function (r) { return r[0] && r[1]; });
    var baseReady = whenReady(bv, 2, limit);

    gazeReady.then(function (ok) {
      if (id !== self.loadId) return NEVER;
      if (!ok) { self._loadFailed(src, id, '캐릭터 영상을 불러오지 못했습니다'); return NEVER; }
      return src.blob ? true : Promise.all([whenSeekable(vids[0], self.o.seekableWaitMs), whenSeekable(vids[1], self.o.seekableWaitMs)]);
    }).then(function (go) {
      if (id !== self.loadId) return NEVER;
      // 배경 영상은 잠깐만 더 기다린다. 끝내 안 오면 포스터 이미지 위에서 동작한다
      return Promise.race([baseReady, new Promise(function (res) { setTimeout(function () { res(false); }, self.o.baseGraceMs); })]);
    }).then(function (baseOk) {
      if (id !== self.loadId || baseOk === undefined) return;
      if (!baseOk && bv.readyState < 2) { bv.style.display = 'none'; bv.setAttribute('data-failed', ''); }
      return Promise.all([prime(bv, null), prime(vids[0], function () { self.seekOnly = true; }), prime(vids[1], function () { self.seekOnly = true; })]);
    }).then(function (r) {
      if (id !== self.loadId || !r) return;
      if (bv.readyState >= 1) { try { bv.currentTime = 0.5 / self.srcFps; } catch (e) { /* 무시 */ } }
      // 보이는 영상은 첫 화면 프레임에, 대기 영상은 그 반대 방향 사본에 세워 둔다
      var p0 = self._posOf(self.curFrame, 1);
      return Promise.all([self._seekVid(vids[0], p0), self._seekVid(vids[1], self._mirror(p0))]).then(function () { return p0; });
    }).then(function (p0) {
      if (id !== self.loadId || p0 == null) return;
      self.curPos = p0;
      self.ready = true;
      self.lastActivity = performance.now();
      self._setState('ready');
      self.root.setAttribute('data-painted', '');
      self._progress(1);
      self.targetDirty = self.target !== self.curFrame;
      if (self.seekOnly) {
        self._unlock();
        setTimeout(function () { self._probePlay(null); }, 700);   // 화면에 보이게 된 뒤에는 재생이 허용될 수 있다
      }
      if (self.o.onReady) self.o.onReady(self);
    }).catch(function (e) {
      if (id === self.loadId) self._loadFailed(src, id, '초기화 오류: ' + (e && e.message));
    });
  };

  /* 로딩 실패: 메모리 재생 → 주소 직접 연결 → 낮은 화질 순으로 다시 시도. 모두 안 되면 포스터를 그대로 두고 첫 터치 때 재시도 */
  GazeHero.prototype._loadFailed = function (src, id, why) {
    if (id !== this.loadId) return;
    this.ready = false;
    if (src.blob && !this._forceDirect) {
      this._forceDirect = true;                          // 메모리 재생이 안 되는 환경 → 주소 직접 연결
      this._load();
      return;
    }
    var lower = this.o.tier === 'auto' ? this._lowerTier(this.tier) : null;
    if (lower && this._tierOverride !== lower) {
      this._tierOverride = lower;                        // 4K 디코딩이 안 되는 환경 → 가벼운 화질
      this._forceDirect = false;
      this._load();
      return;
    }
    this._setState('error', why);
    this._unlock();
  };

  /* 재생 중 영상 오류(디코더 중단 등): 몇 번까지 자동으로 처음부터 다시 */
  GazeHero.prototype._onMediaError = function (v) {
    if (!v.getAttribute('src') && !v.src) return;
    if (this.state === 'loading') return;                // 로딩 중 오류는 whenReady/_loadFailed 가 처리한다
    if (this._retries >= 2) { this._setState('error', '영상 재생 오류'); this._unlock(); return; }
    this._retries++;
    this._recover(true);
    var self = this;
    setTimeout(function () { self._load(); }, 600);
  };

  /* ================= 영상 제어 ================= */
  GazeHero.prototype._active = function () { return this.vids[this.act]; };
  GazeHero.prototype._standby = function () { return this.vids[1 - this.act]; };

  /* 영상 v를 pos 프레임으로 이동. 같은 영상에 새 이동 요청이 오면 이전 요청은 무시된다.
     seeked 이벤트가 오지 않아도 멈추지 않는다 (0.6초 뒤 실제 위치를 확인하고, 아직 이동 중이면 최대 5초까지 더 기다림) */
  GazeHero.prototype._seekVid = function (v, pos) {
    if (v._pos === pos && !v._seeking) return Promise.resolve(true);
    if (v._seeking && v._seekTarget === pos) return v._seeking;
    var self = this, token = (v._token = (v._token || 0) + 1), want = (pos + 0.5) / this.srcFps;
    v._seekTarget = pos;
    v._pos = -1;                                          // 이동하는 동안 위치는 알 수 없다
    v._seeking = new Promise(function (resolve) {
      var finished = false, t0 = performance.now(), timer;
      var near = function () { return !v.seeking && Math.abs(v.currentTime - want) < 0.75 / self.srcFps; };
      var fin = function () {
        if (finished) return;
        finished = true;
        v.removeEventListener('seeked', fin);
        clearTimeout(timer);
        if (token !== v._token) { resolve(false); return; }
        v._pos = pos;
        v._seeking = null;
        resolve(true);
      };
      var check = function () {
        if (finished) return;
        if (near() || performance.now() - t0 > 5000) fin(); else timer = setTimeout(check, 150);
      };
      v.addEventListener('seeked', fin);
      timer = setTimeout(check, 600);
      try { v.currentTime = want; } catch (e) { fin(); }
    });
    return v._seeking;
  };

  /* 보이지 않는 영상을 앞으로 올려 교체. 다른 그림이면 크로스페이드, 같은 그림(반대 사본)이면 즉시 */
  GazeHero.prototype._swap = function (fade) {
    var oldV = this._active(), newV = this._standby(), self = this;
    this.act = 1 - this.act;
    newV.style.zIndex = '2'; oldV.style.zIndex = '1';
    oldV.style.transition = 'none';
    clearTimeout(this._fadeTimer);
    if (fade) {
      newV.style.transition = 'opacity ' + this.o.crossfadeMs + 'ms linear';
      newV.style.opacity = '1';
      this.fadeUntil = performance.now() + this.o.crossfadeMs + 20;
      this._fadeTimer = setTimeout(function () {
        if (self._active() === newV) { oldV.style.opacity = '0'; self._preseek(); }
      }, this.o.crossfadeMs + 20);
    } else {
      newV.style.transition = 'none';
      newV.style.opacity = '1';
      oldV.style.opacity = '0';
      this.fadeUntil = 0;
    }
  };

  /* 다음 구간이 다른 위치에서 시작하면, 보이지 않는 영상을 그 위치로 미리 옮겨 둔다 */
  GazeHero.prototype._preseek = function () {
    if (performance.now() < (this.fadeUntil || 0)) return;   // 크로스페이드 중에는 아래 영상을 건드리지 않는다
    var r = this.runs[0], n = this.runs[1], pos = null;
    if (r && n) {
      var endPos = this._posOf(r.to, r.dir), nextPos = this._posOf(n.from, n.dir);
      if (nextPos !== endPos) pos = nextPos;
    } else if (!this.busy) {
      pos = this._mirror(this.curPos);                         // 쉬는 중: 반대 방향으로 바로 출발할 수 있게
    }
    if (pos != null) this._seekVid(this._standby(), pos);
  };

  GazeHero.prototype._shown = function (pos) {
    this.curPos = pos;
    this.curFrame = this._frameOf(pos);
    this.lastShownAt = this.lastActivity = performance.now();
  };

  /* frame에서 다음 프레임까지 걸리는 시간. 정지 프레임은 빠르게, 단 도착 3프레임 전부터는 보통 속도 (지나침 방지) */
  GazeHero.prototype._frameMs = function (frame, dir, endPos) {
    var nx = frame + dir;
    if (endPos != null && Math.abs(endPos - this._posOf(frame, dir)) <= 3) return this.stepMs;
    return nx >= 0 && nx < this.N && this._isStatic(frame, nx) ? 1000 / (this.srcFps * this.o.fastRate) : this.stepMs;
  };

  GazeHero.prototype._start = function (path) {
    this.gen++;
    this.runs = this._toRuns(this.curFrame, path);
    this.busy = true;
    this.lastActivity = performance.now();
    this._next(this.gen);
  };

  GazeHero.prototype._stop = function () {
    this.runs = [];
    this.busy = false;
    this._preseek();
  };

  GazeHero.prototype._next = function (gen) {
    if (gen !== this.gen) return;
    var self = this;
    if (!this.runs.length || this.targetDirty) { this._stop(); return; }   // 끝났거나 목표가 바뀜 → 새로 경로 계산
    var r = this.runs[0], sp = this._posOf(r.from, r.dir), a = this._active();
    if (a._pos === sp && !a._seeking) { this._runOn(gen); return; }
    // 다른 위치에서 시작: 대기 영상(대개 미리 옮겨져 있음)으로 교체
    var fade = this._frameOf(sp) !== this.curFrame;
    var wait = Math.max(0, (this.fadeUntil || 0) - performance.now());
    setTimeout(function () {
      if (gen !== self.gen) return;
      self._seekVid(self._standby(), sp).then(function () {
        if (gen !== self.gen) return;
        // 직전 프레임이 충분히 보인 뒤에 교체 (리듬 유지)
        var hold = fade ? Math.max(0, self.stepMs - (performance.now() - (self.lastShownAt || 0))) : 0;
        setTimeout(function () {
          if (gen !== self.gen) return;
          self._swap(fade);
          self._shown(sp);
          self._runOn(gen);
        }, hold);
      });
    }, wait);
  };

  GazeHero.prototype._runOn = function (gen) {
    var self = this, r = this.runs[0], v = this._active();
    this._shown(this._posOf(r.from, r.dir));
    this._preseek();
    if (r.from === r.to) {   // 한 프레임만 보여주고 다음으로
      this.runs.shift();
      setTimeout(function () { self._next(gen); }, this.stepMs);
      return;
    }
    this.endPos = this._posOf(r.to, r.dir);
    if (this.seekOnly) { this._stepBySeek(gen); return; }
    // 예상 도착 시각 (프레임 콜백이 늦게 와도 지나치지 않도록 예비 타이머)
    var ms = 0;
    for (var f = r.from; f !== r.to; f += r.dir) ms += this._frameMs(f, r.dir, this.endPos);
    clearTimeout(this._endTimer);
    this._endTimer = setTimeout(function () {
      if (gen === self.gen && self.playing) self._finishRun(gen);
    }, ms + this.stepMs * 0.4);
    try { v.playbackRate = this._frameMs(r.from, r.dir, this.endPos) < this.stepMs ? this.o.fastRate : this.rate; } catch (e) { /* 무시 */ }
    this.playing = true;
    var p;
    try { p = v.play(); } catch (e) { p = null; }
    if (p && p.catch) p.catch(function (err) {
      if (gen !== self.gen || !self.playing) return;
      if (err && err.name === 'AbortError') return;       // 우리가 pause()로 끊은 것
      self.playing = false; self.seekOnly = true; self._unlock(); self._stepBySeek(gen);
    });
    this._watch(v, gen);
  };

  GazeHero.prototype._watch = function (v, gen) {
    var self = this;
    if (v.requestVideoFrameCallback) {
      v.requestVideoFrameCallback(function (t, meta) { self._onFrame(meta.mediaTime, v, gen); });
    } else {
      requestAnimationFrame(function () { self._onFrame(v.currentTime - 0.5 / self.srcFps, v, gen); });
    }
  };

  GazeHero.prototype._onFrame = function (mediaTime, v, gen) {
    // 교체된 영상이나 지난 재생에서 온 콜백은 무시
    if (!this.playing || gen !== this.gen || v !== this._active()) return;
    var r = this.runs[0];
    if (!r) { this._finishRun(gen); return; }
    var p = clamp(Math.round(mediaTime * this.srcFps), 0, 2 * this.N - 1);
    this._shown(p);
    v._pos = p;
    if (this.targetDirty) { this._interrupt(); return; }      // 목표가 바뀌면 지금 프레임에서 바로 방향을 튼다
    if (p >= this.endPos) { this._finishRun(gen); return; }
    var rate = this._frameMs(this.curFrame, r.dir, this.endPos) < this.stepMs ? this.o.fastRate : this.rate;
    if (v.playbackRate !== rate) v.playbackRate = rate;
    this._watch(v, gen);
  };

  /* 구간 끝: 멈추고, 멈춘 위치가 끝 프레임과 다르면 맞춘다 */
  GazeHero.prototype._finishRun = function (gen) {
    var self = this, v = this._active(), end = this.endPos;
    clearTimeout(this._endTimer);
    this.playing = false;
    v.pause();
    var at = Math.floor(v.currentTime * this.srcFps + 0.001);
    var go = function () {
      if (gen !== self.gen) return;
      self._shown(end);
      self.runs.shift();
      self._next(gen);
    };
    if (at === end) { v._pos = end; go(); }
    else { v._pos = -1; this._seekVid(v, end).then(go); }   // 멈춘 실제 위치가 다르면 기록된 위치를 믿지 않고 반드시 다시 이동
  };

  /* 재생 중 목표가 바뀜: 지금 보이는 프레임에서 멈추고 경로를 새로 짠다 */
  GazeHero.prototype._interrupt = function () {
    var v = this._active();
    this.gen++;
    clearTimeout(this._endTimer);
    this.playing = false;
    v.pause();
    var at = clamp(Math.max(this.curPos, Math.floor(v.currentTime * this.srcFps + 0.001)), 0, 2 * this.N - 1);
    v._pos = at;
    this._shown(at);
    this._stop();
  };

  GazeHero.prototype._stepBySeek = function (gen) {
    var self = this, v = this._active();
    if (gen !== this.gen) return;
    if (this.curPos === this.endPos) { this.runs.shift(); this._next(gen); return; }
    var step = this.endPos > this.curPos ? 1 : -1, nxt = this.curPos + step;
    var wait = Math.max(0, this._frameMs(this.curFrame, step, this.endPos) - (performance.now() - (this.lastShownAt || 0)));
    setTimeout(function () {
      if (gen !== self.gen) return;
      self._seekVid(v, nxt).then(function () {
        if (gen !== self.gen) return;
        self._shown(nxt);
        if (self.targetDirty) { self._stop(); return; }
        self._stepBySeek(gen);
      });
    }, wait);
  };

  GazeHero.prototype._halt = function () {
    if (this.playing) this._interrupt();
  };

  /* 어떤 이유로든 재생 흐름이 멈춰 버렸을 때: 모든 진행 중 작업을 끊고 현재 프레임을 다시 맞춘 뒤 목표를 새로 계산한다 */
  GazeHero.prototype._recover = function (silent) {
    var v = this._active(), self = this;
    this.gen++;
    clearTimeout(this._endTimer);
    clearTimeout(this._fadeTimer);
    this.playing = false;
    try { v.pause(); } catch (e) { /* 무시 */ }
    this.runs = [];
    this.busy = false;
    this.lastActivity = performance.now();
    if (silent) return;
    this.vids.forEach(function (x) { x.style.transition = 'none'; });
    this.fadeUntil = 0;
    this.vids[this.act].style.opacity = '1';
    this.vids[1 - this.act].style.opacity = '0';
    v._pos = -1;
    this._seekVid(v, this.curPos).then(function () {
      self.targetDirty = self.target !== self.curFrame;
      self._preseek();
    });
  };

  /* ================= 메인 루프 ================= */
  GazeHero.prototype._startLoop = function () {
    if (this._looping) return;
    this._looping = true;
    requestAnimationFrame(this._tick);
  };

  GazeHero.prototype._tick = function (now) {
    if (!this.visible) { this._looping = false; this._lastT = 0; return; }
    requestAnimationFrame(this._tick);
    if (this.o.debug) this._debug();
    var dt = this._lastT ? Math.min(now - this._lastT, 100) : 16;   // 탭 전환 직후 등 긴 공백은 100ms 로 제한
    this._lastT = now;
    if (!this.ready) return;
    if (!this._lastPaint || now - this._lastPaint >= 1000 / 36) { this._paintBackdrop(); this._lastPaint = now; }
    this._follow(dt);
    // 감시: 재생 중이면 3.5초, 대기 중이면 9초 동안 아무 진전이 없으면 멈춘 것으로 보고 복구
    if (this.busy && now - this.lastActivity > (this.playing ? 3500 : 9000)) { this._recover(); return; }
    if (!this.busy) {
      if (this.targetDirty) {
        this.targetDirty = false;
        var p = this._plan(this.curFrame, this.target, false);
        if (p && p.length) this._start(p);
      } else if (now > this.nextBlinkAt && this._seg(this.curFrame) >= 0) {
        var b = this._plan(this.curFrame, this.curFrame, true);   // 가만히 있을 때 제자리 깜빡임
        if (b && b.length) this._start(b);
        this._scheduleBlink();
      }
    }
  };

  GazeHero.prototype._debug = function () {
    if (!this._dbg) {
      this._dbg = document.createElement('pre');
      this._dbg.style.cssText = 'position:absolute;left:12px;bottom:12px;z-index:9;margin:0;padding:8px 10px;' +
        'font:12px/1.4 ui-monospace,monospace;background:rgba(0,0,0,.6);color:#fff;border-radius:6px;pointer-events:none';
      this.root.appendChild(this._dbg);
    }
    var f = this.F[this.curFrame];
    var pad = function (n) { n = String(n); while (n.length < 3) n = ' ' + n; return n; };
    this._dbg.textContent =
      'state  ' + this.state + (this._blobMode ? '  (blob)' : '  (direct)') +
      '\ntier   ' + this.tier + '  (need ' + (this.geom ? Math.round(this.geom.need) : '?') + 'px)' + (this.seekOnly ? '  seek-mode' : '') +
      '\nframe  ' + pad(this.curFrame + 1) + ' / ' + this.N + '   seg ' + f[2] + '   video ' + (this.act ? 'B' : 'A') +
      '\ntarget ' + pad(this.target + 1) + '   runs ' + this.runs.length + '   rate ' + this._active().playbackRate +
      '\ninput  ' + this.vec.x.toFixed(2) + ', ' + this.vec.y.toFixed(2) +
      '\ngaze   ' + (f[0] == null ? 'blink' : f[0].toFixed(2) + ', ' + f[1].toFixed(2));
  };

  GazeHero.init = function (root, options) {
    if (!root) return null;
    var inst = new GazeHero(root, options);
    root.__gazeHero = inst;
    return inst;
  };

  global.GazeHero = GazeHero;
})(window);

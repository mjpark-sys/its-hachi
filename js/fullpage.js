/*!
 * FullPage — 스크롤할 때 한 섹션씩, 다음 섹션이 아래에서 올라와 덮는 풀페이지 전환
 *
 *   <main class="fp" data-fullpage>
 *     <section class="fp-section" id="home" data-label="HOME" data-theme="light">…</section>
 *     <section class="fp-section" id="about" data-label="소개" data-theme="dark">…</section>
 *   </main>
 *   <script src="js/fullpage.js"></script>
 *   <script>FullPage.init(document.querySelector('[data-fullpage]'), { duration: 1100 })</script>
 *
 * 입력: 마우스 휠·트랙패드(관성 스크롤 한 번 = 한 섹션), 터치 스와이프, 키보드(↑↓ PageUp/Down Space Home End),
 *       #id 링크, [data-go="#id"] 버튼
 * 섹션 안에 .fp-scroll 요소가 있고 내용이 넘치면, 그 안을 끝까지 스크롤한 다음에 섹션이 넘어간다.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    duration: 1100,                                  // 전환 시간(ms). 클수록 천천히 올라온다
    easing: 'cubic-bezier(0.76, 0, 0.24, 1)',        // 천천히 출발 → 빠르게 → 부드럽게 멈춤
    underShift: 18,                                  // 덮이는 섹션이 위로 밀려나는 정도(%)
    underShade: 0.35,                                // 덮이는 섹션이 어두워지는 정도
    wheel: true,                                     // false면 마우스 휠·트랙패드로는 섹션을 넘기지 않는다 (섹션 안쪽 스크롤은 그대로)
    wheelThreshold: 30,                              // 이만큼 휠을 굴려야 넘어감 (작은 흔들림 무시)
    gestureGap: 180,                                 // 휠 이벤트 사이가 이보다 짧으면 같은 스크롤 동작(관성 포함)으로 본다
    touchThreshold: 50,                              // 스와이프 최소 거리(px)
    hash: true,                                      // 주소 끝에 #섹션id 표시
    onLeave: null,                                   // function(from, to) 전환 시작
    onChange: null                                   // function(to, from) 전환 끝
  };

  function FullPage(root, options) {
    this.root = root;
    this.o = Object.assign({}, DEFAULTS, options || {});
    if (global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.o.duration = Math.min(this.o.duration, 450);
      this.o.underShift = 0;
    }
    this.sections = Array.prototype.slice.call(root.children).filter(function (el) {
      return el.classList.contains('fp-section');
    });
    this.index = 0;
    this.animating = false;
    this._wheel = { last: 0, acc: 0, used: false };
    this._queued = 0;            // 전환 중에 새로 시작한 스크롤 한 번(+1/-1)을 기억해 뒀다가 전환이 끝나면 실행

    var self = this;
    this.sections.forEach(function (s) {
      var shade = document.createElement('div');
      shade.className = 'fp-shade';
      s.appendChild(shade);
      s._shade = shade;
    });

    if (this.o.hash && location.hash) {
      var i = this._indexOfId(location.hash.slice(1));
      if (i >= 0) this.index = i;
    }
    document.documentElement.classList.add('fp-active');
    this._commit();
    this._bind();
    root.classList.add('fp-ready');
    setTimeout(function () { self._emit('onChange', self.index, -1); }, 0);
  }

  FullPage.prototype._indexOfId = function (id) {
    for (var i = 0; i < this.sections.length; i++) {
      var s = this.sections[i], alias = s.getAttribute('data-alias');
      if (s.id === id) return i;
      if (alias && (' ' + alias + ' ').indexOf(' ' + id + ' ') >= 0) return i;   // 다른 이름(별칭)으로도 같은 섹션을 연다
    }
    return -1;
  };

  FullPage.prototype._emit = function (name, a, b) {
    if (typeof this.o[name] === 'function') this.o[name].call(this, a, b);
    this.root.dispatchEvent(new CustomEvent('fullpage:' + (name === 'onLeave' ? 'leave' : 'change'), { detail: { to: name === 'onLeave' ? b : a, from: name === 'onLeave' ? a : b } }));
  };

  /* 현재 index 기준으로 모든 섹션의 최종 상태를 고정 */
  FullPage.prototype._commit = function () {
    var idx = this.index;
    this.sections.forEach(function (s, i) {
      s.style.zIndex = String(i + 1);
      s.style.transform = i <= idx ? 'translateY(0)' : 'translateY(100%)';
      s.style.visibility = i === idx ? 'visible' : 'hidden';   // 가려진 섹션은 그리지 않는다 (성능)
      s._shade.style.opacity = '0';
      s.classList.toggle('is-active', i === idx);
      s.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      if (i === idx) s.removeAttribute('inert'); else s.setAttribute('inert', '');
    });
  };

  FullPage.prototype.next = function () { this.goTo(this.index + 1); };
  FullPage.prototype.prev = function () { this.goTo(this.index - 1); };

  FullPage.prototype.goTo = function (to) {
    if (typeof to === 'string') to = this._indexOfId(to.replace(/^#/, ''));
    to = Math.max(0, Math.min(this.sections.length - 1, to));
    if (to === this.index || this.animating || to < 0) return;
    var self = this, from = this.index, o = this.o, timing = { duration: o.duration, easing: o.easing, fill: 'forwards' };
    var down = to > from, moving, under, anims = [];
    var canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';   // 구형 브라우저는 애니메이션 없이 바로 이동
    this.animating = true;
    this.root.classList.add('is-moving');
    this._emit('onLeave', from, to);

    if (down) {
      // 다음 섹션이 아래에서 올라와 현재 섹션을 덮는다
      moving = this.sections[to]; under = this.sections[from];
      moving.style.visibility = 'visible';
      if (canAnimate) {
        anims.push(moving.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], timing));
        anims.push(under.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-' + o.underShift + '%)' }], timing));
        anims.push(under._shade.animate([{ opacity: 0 }, { opacity: o.underShade }], timing));
      }
    } else {
      // 현재 섹션이 아래로 내려가며 이전 섹션이 드러난다 (건너뛰는 중간 섹션은 미리 치워 둔다)
      moving = this.sections[from]; under = this.sections[to];
      for (var i = to + 1; i < from; i++) this.sections[i].style.transform = 'translateY(100%)';
      under.style.visibility = 'visible';
      if (canAnimate) {
        anims.push(moving.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], timing));
        anims.push(under.animate([{ transform: 'translateY(-' + o.underShift + '%)' }, { transform: 'translateY(0)' }], timing));
        anims.push(under._shade.animate([{ opacity: o.underShade }, { opacity: 0 }], timing));
      }
    }

    var finished = false;
    var done = function () {
      if (finished) return;
      finished = true;
      self.index = to;
      self._commit();
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      self.animating = false;
      self.root.classList.remove('is-moving');
      if (self.o.hash) {
        var id = self.sections[to].id;
        try { if (id && history.replaceState) history.replaceState(null, '', '#' + id); } catch (err) { /* file:// 등에서 막혀도 이동에는 영향 없음 */ }
      }
      self._emit('onChange', to, from);
      var q = self._queued; self._queued = 0;
      if (q) self.goTo(self.index + q);
    };
    var fin = anims[0] && anims[0].finished;
    if (fin && typeof fin.then === 'function') fin.then(done, done);
    else if (anims[0]) anims[0].onfinish = done;
    else { done(); return; }
    setTimeout(done, o.duration + 300);   // 탭이 가려져 애니메이션이 멈춰도 상태가 꼬이지 않도록
  };

  /* 섹션 안의 스크롤 영역이 해당 방향으로 더 스크롤될 수 있는지 */
  FullPage.prototype._canInnerScroll = function (target, dir) {
    var el = target && target.closest ? target.closest('.fp-scroll') : null;
    if (!el || !this.sections[this.index].contains(el)) return false;
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  };

  FullPage.prototype._bind = function () {
    var self = this, o = this.o, w = this._wheel;

    addEventListener('wheel', function (e) {
      if (!o.wheel) return;                                          // 휠로 넘기기 꺼짐: 기본 동작(섹션 안쪽 스크롤)에 맡긴다
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (Math.abs(dy) < Math.abs(e.deltaX)) return;                 // 가로 스크롤은 무시
      var dir = dy > 0 ? 1 : -1;
      var now = performance.now();
      if (self._canInnerScroll(e.target, dir)) {                     // 섹션 안 스크롤 먼저
        // 안쪽 스크롤이 끝에 닿은 뒤에도 같은 손동작(관성)이 이어진다. 그 관성으로 섹션이 넘어가지 않게 한 동작으로 묶는다
        w.last = now; w.acc = 0; w.used = true;
        return;
      }
      e.preventDefault();
      if (now - w.last > o.gestureGap) { w.acc = 0; w.used = false; }  // 새 스크롤 동작 시작
      w.last = now;
      if (w.used) return;                                            // 같은 동작(관성)은 무시
      w.acc += dy;
      if (Math.abs(w.acc) >= o.wheelThreshold) {
        w.used = true;
        var d = w.acc > 0 ? 1 : -1;
        if (self.animating) self._queued = d;                        // 전환 중에 새로 시작한 동작은 끝난 뒤 이어서 실행
        else self.goTo(self.index + d);
      }
    }, { passive: false });

    var t = null;
    addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { t = null; return; }
      t = { x: e.touches[0].clientX, y: e.touches[0].clientY, target: e.target, time: performance.now() };
    }, { passive: true });
    addEventListener('touchmove', function (e) {
      if (!t) return;
      var dy = t.y - e.touches[0].clientY, dx = t.x - e.touches[0].clientX;
      if (Math.abs(dx) > Math.abs(dy)) return;                      // 가로 스와이프(카드 넘기기 등)는 그대로 둔다
      // 섹션 안 스크롤 중이 아니면 브라우저 기본 스크롤(당겨서 새로고침 등)을 막는다
      if (!self._canInnerScroll(t.target, dy > 0 ? 1 : -1) && e.cancelable) e.preventDefault();
    }, { passive: false });
    addEventListener('touchend', function (e) {
      if (!t) return;
      var p = e.changedTouches[0], dy = t.y - p.clientY, dx = t.x - p.clientX;
      var start = t; t = null;
      if (Math.abs(dy) < o.touchThreshold || Math.abs(dy) < Math.abs(dx) * 1.2) return;
      var dir = dy > 0 ? 1 : -1;
      if (self._canInnerScroll(start.target, dir)) return;
      self.goTo(self.index + dir);
    }, { passive: true });

    addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable || e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key, dir = 0;
      if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1;
      else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
      else if (k === 'Home') { e.preventDefault(); self.goTo(0); return; }
      else if (k === 'End') { e.preventDefault(); self.goTo(self.sections.length - 1); return; }
      if (!dir) return;
      if (self._canInnerScroll(document.activeElement, dir)) return;
      e.preventDefault();
      self.goTo(self.index + dir);
    });

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"], [data-go]');
      if (!a) return;
      var id = (a.getAttribute('data-go') || a.getAttribute('href') || '').replace(/^#/, '');
      var i = self._indexOfId(id);
      if (i < 0) return;
      e.preventDefault();
      self.goTo(i);
    });

    addEventListener('hashchange', function () {
      var i = self._indexOfId(location.hash.slice(1));
      if (i >= 0) self.goTo(i);
    });
  };

  FullPage.init = function (root, options) {
    if (!root) return null;
    var inst = new FullPage(root, options);
    root.__fullpage = inst;
    return inst;
  };

  global.FullPage = FullPage;
})(window);

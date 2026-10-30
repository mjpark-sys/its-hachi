/* Hachi outro adapter for the Moss Type WebGL renderer.
 * Visual source: https://moss-type.vercel.app/ — panic_puriii.
 * See vendor/moss-renderer.js and vendor/MOSS-NOTES.md for source details.
 * Public API: MossText.create(canvas, options) → ready/start/stop/destroy/stats.
 */
(function (root) {
  'use strict';
  var script = document.currentScript;
  var rendererURL = new URL('vendor/moss-renderer.js', script.src).href;
  var rendererReady;
  function loadRenderer() {
    if (root.HachiMossRenderer) return Promise.resolve(root.HachiMossRenderer);
    if (!rendererReady) rendererReady = new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = rendererURL;
      el.onload = function () {
        if (root.HachiMossRenderer) resolve(root.HachiMossRenderer);
        else reject(new Error('Moss renderer failed to initialize'));
      };
      el.onerror = function () { reject(new Error('Moss renderer could not load')); };
      document.head.appendChild(el);
    });
    return rendererReady;
  }
  function create(canvas, options) {
    var cfg = Object.assign({ text: "it's hachi", calm: false }, options);
    var chars = Array.from(cfg.text);
    var stage, running = false, destroyed = false, raf = 0, preparingRaf = 0, pausedAt = null;
    var observer;
    var total = 0;
    var originalVisibility = canvas.style.visibility;
    canvas.style.visibility = 'hidden';
    function resize() {
      if (!stage || destroyed) return;
      var rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) stage.resize(rect.width, rect.height);
    }
    function frame() {
      if (!running || destroyed) return;
      stage.update();
      raf = requestAnimationFrame(frame);
    }
    function suspend() {
      cancelAnimationFrame(raf);
      if (stage && pausedAt === null) pausedAt = performance.now();
    }
    function resume() {
      if (pausedAt !== null) {
        stage.t0 += performance.now() - pausedAt;
        pausedAt = null;
      }
      stage.lastT = stage.time;
      cancelAnimationFrame(raf);
      frame();
    }
    function visibility() {
      if (!stage || !running) return;
      if (document.hidden) suspend(); else resume();
    }
    var ready = loadRenderer().then(function (renderer) {
      if (destroyed) return;
      stage = renderer.create(canvas);
      var defaultWrap = stage.wrapWidth.bind(stage);
      stage.wrapWidth = function () {
        if (canvas.clientWidth < 640) return defaultWrap();
        var width = chars.reduce(function (sum, ch, index) {
          return sum + stage.font.glyph(ch).advance + (index ? stage.font.kerning(chars[index - 1], ch) : 0);
        }, 0);
        return Math.max(defaultWrap(), width + .05);
      };
      stage.reducedMotion = cfg.calm || root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (stage.reducedMotion) total = 0;
      resize();
      if (root.ResizeObserver) {
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
      } else root.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', visibility);
      // Build during the trailer, keeping partially built glyphs off-screen.
      // Retain the reference's frame-budgeted queue rather than delaying letters.
      stage.setText(cfg.text);
      return new Promise(function (resolve, reject) {
        function prepare() {
          if (destroyed) { resolve(); return; }
          try {
            stage.update();
            if (stage.queue.length) {
              preparingRaf = requestAnimationFrame(prepare);
              return;
            }
            stage.renderer.compileAsync(stage.scene, stage.camera).then(function () {
              if (!destroyed) {
                stage.update();
                canvas.style.visibility = originalVisibility;
              }
              resolve();
            }, reject);
          } catch (error) { reject(error); }
        }
        prepare();
      });
    });
    return {
      ready: ready,
      typingTotal: function () { return total; },
      start: function () {
        return ready.then(function () {
          if (destroyed || running) return;
          running = true;
          if (document.hidden) suspend(); else resume();
        });
      },
      stop: function () { running = false; suspend(); },
      setLod: function (level) { if (stage) stage.setQuality(1 / Math.max(1, level)); },
      stats: function () {
        return { renderer: 'WebGL', font: 'Archivo Black', preset: 'Spring Bloom',
          ready: !!stage, running: running, queued: stage ? stage.queue.length : 0,
          quality: stage ? stage.quality : 1 };
      },
      destroy: function () {
        destroyed = true; running = false; cancelAnimationFrame(raf);
        cancelAnimationFrame(preparingRaf);
        canvas.style.visibility = originalVisibility;
        if (observer) observer.disconnect();
        root.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', visibility);
        if (!stage) return;
        stage.glyphs.concat(stage.dying).forEach(function (g) { g.dispose(stage.cache); });
        stage.scene.traverse(function (object) {
          if (object.geometry) object.geometry.dispose();
          var materials = object.material ? [].concat(object.material) : [];
          materials.forEach(function (material) { material.dispose(); });
        });
        canvas.removeEventListener('pointermove', stage.hachiPointerMove);
        canvas.removeEventListener('pointerleave', stage.hachiPointerLeave);
        stage.composer.dispose(); stage.renderer.dispose();
      }
    };
  }
  root.MossText = { create: create };
})(window);

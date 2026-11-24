// REBELL ― 紅蒼交錯 : 共通部品（定数・数学・ドット描画・入力）
(function () {
  'use strict';
  var R = window.REBELL = {};
  R.W = 480; R.H = 270;      // 内部解像度（これを整数倍に拡大して表示）
  R.GY = 192;                // 地面の高さ
  R.OUT = '#160d2a';         // ドット絵の輪郭色

  R.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  R.lerp = function (a, b, t) { return a + (b - a) * t; };
  R.rand = function (a, b) { return a + Math.random() * (b - a); };
  R.irand = function (a, b) { return Math.floor(R.rand(a, b + 1)); };
  R.sign = function (v) { return v < 0 ? -1 : 1; };
  R.ease = function (t) { return t * t * (3 - 2 * t); };
  R.rng = function (seed) {   // 固定シード乱数（背景用。毎回同じ絵にする）
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  R.mk = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  R.overlap = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };

  // ---- ドット描画（整数座標の fillRect だけで描く） ----
  R.painter = function (ctx) {
    var P = { ctx: ctx, ox: 0, oy: 0 };
    P.rect = function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x + P.ox), Math.round(y + P.oy), Math.round(w), Math.round(h)); };
    P.px = function (x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x + P.ox), Math.round(y + P.oy), 1, 1); };
    P.disc = function (cx, cy, r, c) {
      ctx.fillStyle = c; cx = Math.round(cx + P.ox); cy = Math.round(cy + P.oy);
      var ri = Math.ceil(r);
      for (var dy = -ri; dy <= ri; dy++) {
        var q = r * r - dy * dy; if (q < 0) continue;
        var w = Math.floor(Math.sqrt(q)); ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
      }
    };
    P.ell = function (cx, cy, rx, ry, c) {
      ctx.fillStyle = c; cx = Math.round(cx + P.ox); cy = Math.round(cy + P.oy);
      var ri = Math.ceil(ry);
      for (var dy = -ri; dy <= ri; dy++) {
        var q = 1 - (dy * dy) / (ry * ry); if (q < 0) continue;
        var w = Math.floor(rx * Math.sqrt(q)); ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
      }
    };
    // 太さ w の線。w>=3 は丸い筆、2 以下は四角い筆
    P.line = function (x0, y0, x1, y1, w, c) {
      var dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      for (var i = 0; i <= n; i++) {
        var x = x0 + dx * i / n, y = y0 + dy * i / n;
        if (w <= 2) P.rect(x - (w - 1) / 2, y - (w - 1) / 2, w, w, c); else P.disc(x, y, (w - 1) / 2, c);
      }
    };
    // 角を少し落とした四角い筆で引く太線（幅がちょうど w ドットになる。手足など、むっちりした部品用）
    P.bar = function (x0, y0, x1, y1, w, c) {
      var dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), cut = w >= 6 ? 2 : (w >= 4 ? 1 : 0);
      ctx.fillStyle = c;
      for (var i = 0; i <= n; i++) {
        var x = Math.round(x0 + dx * i / n - w / 2 + P.ox + 0.001), y = Math.round(y0 + dy * i / n - w / 2 + P.oy + 0.001);
        if (!cut) ctx.fillRect(x, y, w, w);
        else if (cut === 1) { ctx.fillRect(x + 1, y, w - 2, w); ctx.fillRect(x, y + 1, w, w - 2); }
        else { ctx.fillRect(x + 2, y, w - 4, w); ctx.fillRect(x + 1, y + 1, w - 2, w - 2); ctx.fillRect(x, y + 2, w, w - 4); }
      }
    };
    // 文字で打ったドット絵を置く（legend は 1 文字 → 色。legend に無い文字は透明）
    P.bmp = function (rows, legend, x, y) {
      x = Math.round(x + P.ox); y = Math.round(y + P.oy);
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        for (var i = 0; i < row.length; i++) {
          var col = legend[row[i]]; if (!col) continue;
          var j = i; while (j + 1 < row.length && row[j + 1] === row[i]) j++;
          ctx.fillStyle = col; ctx.fillRect(x + i, y + r, j - i + 1, 1); i = j;
        }
      }
    };
    // 多角形の塗り（スキャンライン）
    P.poly = function (pts, c) {
      ctx.fillStyle = c;
      var minY = 1e9, maxY = -1e9, i, n = pts.length;
      for (i = 0; i < n; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
      for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        var sy = y + 0.5, xs = [];
        for (i = 0; i < n; i++) {
          var a = pts[i], b = pts[(i + 1) % n];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort(function (p, q) { return p - q; });
        for (i = 0; i + 1 < xs.length; i += 2) {
          var xa = Math.round(xs[i] + P.ox), xb = Math.round(xs[i + 1] + P.ox);
          if (xb > xa) ctx.fillRect(xa, Math.round(y + P.oy), xb - xa, 1);
        }
      }
    };
    return P;
  };
  // 1px の輪郭をつけた複製を作る
  R.outline = function (src, col, dst) {
    var c = dst || R.mk(src.width, src.height), x = c.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height);
    x.drawImage(src, -1, 0); x.drawImage(src, 1, 0); x.drawImage(src, 0, -1); x.drawImage(src, 0, 1);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col || R.OUT; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over'; x.drawImage(src, 0, 0);
    return c;
  };
  // 単色で塗りつぶした複製（被弾時の白フラッシュ用）
  R.tint = function (src, col, dst) {
    var c = dst || R.mk(src.width, src.height), x = c.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over';
    return c;
  };
  // 2 本の骨の関節位置（足・腕の曲がり）。bend は曲げる向き（+1 / -1）
  R.ik = function (rx, ry, tx, ty, l1, l2, bend) {
    var dx = tx - rx, dy = ty - ry, d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var dd = Math.min(d, l1 + l2 - 0.01);
    var a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
    var h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var ux = dx / d, uy = dy / d;
    return [rx + ux * a - uy * h * bend, ry + uy * a + ux * h * bend];
  };

  // ---- 入力（キーボード / ゲームパッド / タッチ） ----
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyJ: 'attack', KeyZ: 'attack', KeyK: 'special', KeyX: 'special',
    KeyL: 'dash', KeyC: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyQ: 'switch', KeyE: 'switch', KeyF: 'cross', KeyV: 'cross',
    Digit1: 'potion', KeyR: 'potion', Digit2: 'crystal', KeyT: 'crystal',
    Escape: 'pause', KeyP: 'pause', Enter: 'ok', KeyM: 'mute', KeyB: 'bloom'
  };
  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'dash', 'switch', 'cross', 'potion', 'crystal', 'pause', 'ok', 'mute', 'bloom'];
  var I = R.input = { down: {}, hit: {}, any: false, pad: false };
  var kdown = {}, latch = {}, touch = {}, sim = {}, padPrev = {}, anyLatch = false;
  ACTIONS.forEach(function (a) { I.down[a] = false; I.hit[a] = false; });
  window.addEventListener('keydown', function (e) {
    var a = KEYMAP[e.code];
    if (a) { e.preventDefault(); if (!e.repeat) { latch[a] = true; anyLatch = true; } kdown[e.code] = true; I.usePad = false; showTouch(false); }
    if (R.onGesture) R.onGesture();
  });
  window.addEventListener('keyup', function (e) { if (KEYMAP[e.code]) { kdown[e.code] = false; } });
  window.addEventListener('blur', function () { kdown = {}; touch = {}; });
  // タッチ操作ボタンは、実際に画面をタッチしたときだけ出す（キーボードを押したら隠す）
  function showTouch(on) { var box = document.getElementById('touch'); if (box) box.classList.toggle('on', on); }
  window.addEventListener('pointerdown', function (e) {
    anyLatch = true;
    if (e.pointerType === 'touch') showTouch(true);
    if (e.target && e.target.id === 'screen') latch.ok = true;      // 画面タップ/クリックでもメニューを進められる
    if (R.onGesture) R.onGesture();
  });
  I.sim = function (a, on) { sim[a] = !!on; if (on) latch[a] = true; };   // 動作確認用
  I.tap = function (a) { latch[a] = true; };
  function readPad() {
    var o = {}, pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i]; if (!p || !p.buttons || p.buttons.length < 10) continue;
      var b = function (n) { return !!(p.buttons[n] && p.buttons[n].pressed); };
      var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      o.left = o.left || b(14) || ax < -0.4; o.right = o.right || b(15) || ax > 0.4;
      o.up = o.up || ay < -0.6; o.down = o.down || ay > 0.6;
      o.jump = o.jump || b(0); o.dash = o.dash || b(1) || b(7); o.attack = o.attack || b(2); o.special = o.special || b(3);
      var lb = b(4), rb = b(5);
      o.cross = o.cross || (lb && rb); o.switch = o.switch || ((lb || rb) && !(lb && rb));
      o.potion = o.potion || b(12); o.crystal = o.crystal || b(13);
      o.pause = o.pause || b(9); o.ok = o.ok || b(0) || b(9);
    }
    return o;
  }
  I.poll = function () {
    var pad = readPad(), k = {};
    for (var code in kdown) if (kdown[code]) k[KEYMAP[code]] = true;
    I.any = anyLatch; anyLatch = false; I.pad = false;
    for (var i = 0; i < ACTIONS.length; i++) {
      var a = ACTIONS[i], p = !!pad[a];
      if (p) { I.pad = true; I.usePad = true; }
      I.down[a] = !!(k[a] || p || touch[a] || sim[a]);
      I.hit[a] = !!(latch[a] || (p && !padPrev[a]));
      if (I.hit[a]) I.any = true;
      padPrev[a] = p; latch[a] = false;
    }
  };
  I.clearHits = function () { for (var i = 0; i < ACTIONS.length; i++) I.hit[ACTIONS[i]] = false; I.any = false; };
  // タッチ操作ボタン
  window.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('touch'); if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (btn) {
      var a = btn.getAttribute('data-act');
      var on = function (e) { e.preventDefault(); touch[a] = true; latch[a] = true; btn.classList.add('act'); if (R.onGesture) R.onGesture(); };
      var off = function (e) { e.preventDefault(); touch[a] = false; btn.classList.remove('act'); };
      btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  });

  // 音（Codex 担当のモジュール）への安全な窓口
  R.snd = function (name, opt) { try { if (window.REBELL_AUDIO) window.REBELL_AUDIO.sfx(name, opt); } catch (e) { } };
  R.bgm = function (name) { try { if (window.REBELL_AUDIO) { if (name) window.REBELL_AUDIO.playBgm(name); else window.REBELL_AUDIO.stopBgm(); } } catch (e) { } };
  R.onGesture = function () { try { if (window.REBELL_AUDIO) window.REBELL_AUDIO.init(); } catch (e) { } };
})();

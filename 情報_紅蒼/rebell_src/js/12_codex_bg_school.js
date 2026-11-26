// Codex 担当: ステージ2「玉龍学園」の背景ドット絵（window.REBELL_BG_SCHOOL）
(function () {
  'use strict';

  const P = {
    sky: ['#0b0a26', '#14113c', '#1f1856', '#2e2170', '#45308e', '#582c73'],
    cloud: ['#3a2a78', '#5a3fa0', '#7a5cc0'],
    moon: ['#7d1a36', '#a82445', '#c8324a', '#e0485a', '#f06a70'],
    stone: ['#24213f', '#2f2b55', '#3d3868', '#4f4984', '#655e9e', '#8078b8', '#a39bd0'],
    cyan: ['#1aa6c8', '#37e6ff', '#7af3ff'],
    pink: ['#d9368f', '#ff4fb0', '#ff7ad1'],
    bloom: ['#b8478f', '#e765b0', '#ff8fcb', '#ffb7df', '#ffd9ee'],
    trunk: ['#3a2140', '#55305a', '#855578'],
    mountain: ['#1a1535', '#2a2150', '#3b2d68'],
    smoke: ['#3a2a78', '#6a5a9a', '#8a7ab8'],
    gold: '#ffd36a'
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function random(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function integer(r, lo, hi) {
    return lo + Math.floor(r() * (hi - lo + 1));
  }
  function make(w, h, wrap) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: canvas, ctx: ctx, w: w, h: h, wrap: !!wrap, ink: '' };
  }

  // 描画命令はここだけ。遠景では矩形ごとに左右を折り返す。
  function rect(t, x, y, w, h, color) {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0 || y >= t.h || y + h <= 0) return;
    if (t.ink !== color) {
      t.ctx.fillStyle = color;
      t.ink = color;
    }
    if (!t.wrap) {
      t.ctx.fillRect(x, y, w, h);
      return;
    }
    x = ((x % t.w) + t.w) % t.w;
    while (w > 0) {
      const n = Math.min(w, t.w - x);
      t.ctx.fillRect(x, y, n, h);
      w -= n;
      x = 0;
    }
  }
  function px(t, x, y, c) { rect(t, x, y, 1, 1, c); }
  function line(t, x0, y0, x1, y1, c, size) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    const n = size || 1, offset = Math.floor(n / 2);
    let error = dx + dy;
    for (;;) {
      rect(t, x0 - offset, y0 - offset, n, n, c);
      if (x0 === x1 && y0 === y1) break;
      const e = error * 2;
      if (e >= dy) { error += dy; x0 += sx; }
      if (e <= dx) { error += dx; y0 += sy; }
    }
  }
  function outline(t, points, color, size) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      line(t, a[0], a[1], b[0], b[1], color, size);
    }
  }
  function poly(t, points, color) {
    const ymin = Math.max(0, Math.floor(Math.min.apply(null, points.map(p => p[1]))));
    const ymax = Math.min(t.h - 1, Math.ceil(Math.max.apply(null, points.map(p => p[1]))));
    for (let y = ymin; y <= ymax; y++) {
      const cuts = [], sample = y + 0.5;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= sample && b[1] > sample) || (b[1] <= sample && a[1] > sample)) {
          cuts.push(a[0] + (sample - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const a = Math.ceil(cuts[i]), b = Math.floor(cuts[i + 1]);
        rect(t, a, y, b - a + 1, 1, color);
      }
    }
  }
  function ellipse(t, cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - y * y / (ry * ry))));
      rect(t, cx - span, cy + y, span * 2 + 1, 1, color);
    }
  }
  function ring(t, cx, cy, rx, ry, color, thickness) {
    const ix = Math.max(0.25, rx - (thickness || 1));
    const iy = Math.max(0.25, ry - (thickness || 1));
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if (x * x / (rx * rx) + y * y / (ry * ry) <= 1 &&
            x * x / (ix * ix) + y * y / (iy * iy) >= 1) {
          px(t, cx + x, cy + y, color);
        }
      }
    }
  }
  function grain(t, x, y, w, h, r, colors, count) {
    for (let i = 0; i < count; i++) {
      px(t, integer(r, x, x + w - 1), integer(r, y, y + h - 1),
        colors[integer(r, 0, colors.length - 1)]);
    }
  }
  function sparkle(t, x, y, color) {
    line(t, x - 2, y, x + 2, y, color);
    line(t, x, y - 3, x, y + 3, color);
    px(t, x, y, P.cyan[2]);
  }

  function buildSky() {
    const t = make(480, 270), r = random(0x713a20);
    const levels = [0, 45, 95, 152, 218, 270];
    for (let y = 0; y < t.h; y++) {
      let k = 0;
      while (k < levels.length - 2 && y >= levels[k + 1]) k++;
      const f = (y - levels[k]) / (levels[k + 1] - levels[k]);
      for (let x = 0; x < t.w; x++) {
        const b = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        px(t, x, y, P.sky[k + (f > b ? 1 : 0)]);
      }
    }
    // 雲は濃い色の小さな塊で重ね、月の輪郭を邪魔しない。
    const clouds = [[20, 104, 45], [104, 124, 62], [334, 112, 49], [433, 81, 63]];
    clouds.forEach(function (a) {
      for (let i = 0; i < 20; i++) {
        const x = a[0] + integer(r, -a[2], a[2]);
        const y = a[1] + integer(r, -7, 7);
        const rx = integer(r, 6, 19), ry = integer(r, 2, 5);
        ellipse(t, x, y, rx, ry, i % 4 === 0 ? P.cloud[0] : P.sky[2]);
        for (let j = 0; j < 9; j++) {
          px(t, x + integer(r, -rx, rx), y + integer(r, -ry, ry), P.sky[3]);
        }
      }
    });
    for (let i = 0; i < 145; i++) {
      const x = integer(r, 0, 479), y = integer(r, 0, 138);
      px(t, x, y, i % 8 === 0 ? P.stone[5] : P.cloud[0]);
    }
    [[32, 27], [153, 44], [319, 19], [446, 39]].forEach(function (a) {
      px(t, a[0], a[1], P.cloud[2]);
      px(t, a[0] + 1, a[1], P.cloud[0]);
    });
    const cx = 245, cy = 56, radius = 34;
    for (let y = -38; y <= 38; y++) {
      for (let x = -38; x <= 38; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > radius && d < 38 && r() < (38 - d) * 0.13) {
          px(t, cx + x, cy + y, '#542444');
        }
        if (d > radius) continue;
        const light = (-x - y) / 68;
        let k = 2 + (light > 0.12 ? 1 : 0);
        if (r() < 0.16) k--;
        if (d > 31.5) k = light > -0.15 ? 4 : 2;
        px(t, cx + x, cy + y, P.moon[k]);
      }
    }
    // クレーターも月の円内だけに打つ。
    for (let i = 0; i < 78; i++) {
      const ox = integer(r, -30, 30), oy = integer(r, -29, 30);
      const rx = integer(r, 1, 6), ry = integer(r, 1, 4);
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          const mx = ox + x, my = oy + y;
          if (mx * mx + my * my > 31 * 31) continue;
          if (x * x / (rx * rx) + y * y / (ry * ry) > 1 || r() < 0.21) continue;
          const color = y === ry - 1 && r() < 0.65 ? P.moon[3] : P.moon[i % 3 === 0 ? 0 : 1];
          px(t, cx + mx, cy + my, color);
        }
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = integer(r, -32, 12), y = integer(r, -32, 4);
      if (x * x + y * y < 31 * 31 && r() > 0.35) px(t, cx + x, cy + y, P.moon[4]);
    }
    return t.canvas;
  }

  function neonTower(t, x, y, w, h, r, distant) {
    rect(t, x - 1, y - 1, w + 2, h + 1, P.sky[0]);
    rect(t, x, y, w, h, distant ? P.sky[2] : P.sky[1]);
    rect(t, x, y, 2, h, P.stone[2]);
    rect(t, x + w - 3, y, 3, h, P.sky[0]);
    rect(t, x, y, w, 1, P.cloud[0]);
    if (w > 9) rect(t, x + 3, y + 2, 1, h - 2, P.sky[3]);
    for (let yy = y + 4; yy < y + h - 2; yy += 6) {
      for (let xx = x + 3; xx < x + w - 3; xx += 4) {
        if (r() < (distant ? 0.48 : 0.28)) continue;
        const palette = r() < 0.56 ? P.cyan : P.pink;
        const ww = 1 + (r() < 0.28 ? 1 : 0), wh = integer(r, 1, 3), wc = palette[distant ? 0 : integer(r, 0, 2)];
        rect(t, xx, yy, ww, wh, wc);
        // タイトル画面で明かりを点け消しするため、窓の位置と、消したときの壁の色を覚えておく
        if (t.wins) t.wins.push([Math.round(xx), Math.round(yy), ww, wh, wc, distant ? P.sky[2] : P.sky[1]]);
      }
    }
    if (r() < 0.7) {
      const ax = x + Math.floor(w / 2), ah = integer(r, 4, 14);
      line(t, ax, y - ah, ax, y - 1, P.cloud[1]);
      px(t, ax, y - ah, r() < 0.5 ? P.pink[1] : P.cyan[1]);
    }
    if (!distant && r() < 0.4) {
      rect(t, x + w - 2, y + 7, 1, integer(r, 6, 17), P.cyan[0]);
      rect(t, x + 1, y + 3, 2, 4, P.pink[0]);
    }
  }
  function buildFar() {
    const t = make(960, 270, true), r = random(0x94b02e);
    t.wins = [];
    rect(t, 0, 183, 960, 18, P.sky[1]);
    // 各列は一周期だけ生成し、境界を越える部分は rect が反対側へ送る。
    for (let i = 0; i < 48; i++) {
      const x = i * 20 + integer(r, -8, 6);
      const y = integer(r, 101, 162), w = integer(r, 9, 22);
      neonTower(t, x, y, w, 201 - y, r, true);
    }
    for (let i = 0; i < 31; i++) {
      const x = i * 31 + integer(r, -9, 8);
      const y = integer(r, 78, 161), w = integer(r, 11, 24);
      neonTower(t, x, y, w, 201 - y, r, false);
    }
    [[69, 42], [275, 64], [515, 53], [783, 58]].forEach(function (a) {
      const x = a[0], y = a[1];
      neonTower(t, x - 3, y + 11, 7, 190 - y, r, false);
      line(t, x, y, x, y + 13, P.cyan[0]);
      line(t, x + 1, y + 5, x + 1, y + 62, P.pink[0]);
      px(t, x, y, P.cyan[2]);
      rect(t, x - 2, y + 14, 5, 2, P.pink[1]);
    });
    [[117, 73, 18], [356, 54, 23], [603, 68, 17], [873, 49, 24]].forEach(function (a) {
      const x = a[0], y = a[1], rx = a[2];
      neonTower(t, x - 6, y + 8, 13, 193 - y, r, false);
      rect(t, x - 2, y - 7, 5, 53, '#154878');
      rect(t, x, y - 8, 1, 55, P.cyan[0]);
      rect(t, x - 1, y + 3, 3, 12, P.cyan[1]);
      ring(t, x, y, rx + 2, 6, '#23549a', 1);
      ring(t, x, y, rx, 4, P.cyan[0], 1);
      ring(t, x, y, rx - 1, 3, P.cyan[1], 1);
      rect(t, x - 6, y - 3, 11, 1, P.cyan[2]);
      rect(t, x + rx - 3, y - 1, 4, 1, P.cyan[2]);
      rect(t, x - rx + 1, y + 1, 4, 1, P.cyan[2]);
      sparkle(t, x, y - 8, P.cyan[0]);
    });
    // 手前のビルに隠れた窓は外す（左上の 1 ドットが窓の色のまま残っているものだけ）。端で折り返す窓も外す
    const img = t.ctx.getImageData(0, 0, 960, 270).data;
    t.canvas.wins = t.wins.filter(function (w) {
      if (w[0] < 0 || w[0] + w[2] > 960 || w[1] < 1) return false;
      const i = (w[1] * 960 + w[0]) * 4, c = parseInt(w[4].slice(1), 16);
      if (!(img[i] === (c >> 16 & 255) && img[i + 1] === (c >> 8 & 255) && img[i + 2] === (c & 255))) return false;
      const j = i - 960 * 4;      // 消したときの色は、窓のすぐ上の壁の色
      w[5] = 'rgb(' + img[j] + ',' + img[j + 1] + ',' + img[j + 2] + ')';
      return true;
    });
    return t.canvas;
  }

  function buildVolcano() {
    const t = make(300, 130), r = random(0x428c71);
    // 煙は左上ほど大きく、奥の暗い房から描く。
    for (let i = 18; i >= 0; i--) {
      const x = 195 - i * 4 + integer(r, -6, 6);
      const y = 51 - i * 2 + integer(r, -5, 5);
      const rx = 5 + Math.floor(i * 0.43), ry = 4 + Math.floor(i * 0.24);
      ellipse(t, x + 2, y + 2, rx, ry, P.smoke[0]);
      ellipse(t, x, y, rx - 1, ry - 1, P.smoke[1]);
      for (let k = 0; k < rx * ry; k++) {
        const xx = integer(r, -rx, rx), yy = integer(r, -ry, ry);
        if (xx * xx / (rx * rx) + yy * yy / (ry * ry) > 0.84) continue;
        px(t, x + xx, y + yy, yy < 0 && r() < 0.7 ? P.smoke[2] : P.smoke[0]);
      }
    }
    const ridge = [[0, 123], [25, 115], [50, 108], [75, 98], [99, 94],
      [124, 83], [147, 75], [169, 64], [184, 54], [193, 57],
      [202, 53], [214, 62], [234, 72], [255, 82], [277, 95], [299, 106]];
    const surface = new Int16Array(300);
    for (let i = 0; i < ridge.length - 1; i++) {
      const a = ridge[i], b = ridge[i + 1];
      for (let x = a[0]; x <= b[0]; x++) {
        const y = Math.round(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
        surface[x] = y;
        rect(t, x, y, 1, 130 - y, P.mountain[1]);
      }
    }
    poly(t, [[184, 55], [145, 91], [102, 130], [164, 130], [191, 61]], P.mountain[0]);
    poly(t, [[202, 55], [218, 93], [252, 130], [209, 130], [194, 61]], P.mountain[2]);
    poly(t, [[176, 65], [111, 107], [57, 130], [116, 130]], P.mountain[2]);
    poly(t, [[207, 60], [258, 102], [299, 122], [299, 130], [249, 115]], P.mountain[0]);
    [[183, 61, 129, 125], [190, 64, 174, 129], [201, 61, 220, 127],
      [208, 63, 272, 122], [170, 70, 83, 126], [151, 80, 34, 128]].forEach(function (a) {
      line(t, a[0], a[1], a[2], a[3], P.mountain[0], 3);
      line(t, a[0] - 2, a[1] + 1, a[2] - 3, a[3], P.mountain[2]);
    });
    for (let i = 0; i < 2200; i++) {
      const x = integer(r, 0, 299), y = integer(r, 55, 129);
      if (y > surface[x] + 2) px(t, x, y, r() < 0.62 ? P.mountain[0] : '#4a386c');
    }
    for (let i = 1; i < ridge.length; i++) {
      const a = ridge[i - 1], b = ridge[i];
      line(t, a[0], a[1], b[0], b[1], P.mountain[2]);
    }
    line(t, 181, 55, 189, 58, P.moon[3], 2);
    line(t, 191, 58, 201, 54, '#ff5a6a', 2);
    line(t, 202, 54, 208, 59, P.pink[2]);
    line(t, 196, 60, 190, 71, P.moon[1]);
    for (let i = 0; i < 25; i++) {
      const x = integer(r, 174, 214), y = integer(r, 44, 78);
      if (r() < 0.6) px(t, x, y, y < 57 ? P.moon[3] : P.moon[1]);
    }
    return t.canvas;
  }

  function bannerAt(t, x, y) {
    const shape = [[x + 1, y + 3], [x + 16, y + 3], [x + 16, y + 59],
      [x + 9, y + 51], [x + 1, y + 59]];
    poly(t, shape, '#6e285d');
    // 燕尾の空白には描かず、背景の透過を保つ。
    for (let xx = 2; xx <= 15; xx++) {
      const bottom = xx <= 9 ? 59 - (xx - 1) : 51 + (xx - 9);
      rect(t, x + xx, y + 4, 1, bottom - 4,
        xx < 5 ? '#96356f' : (xx > 12 ? '#4b244e' : '#793061'));
    }
    outline(t, shape, P.pink[0]);
    line(t, x + 2, y + 4, x + 2, y + 55, P.pink[2]);
    line(t, x + 2, y + 57, x + 9, y + 49, P.pink[2]);
    line(t, x + 9, y + 49, x + 15, y + 56, P.pink[1]);
    rect(t, x, y + 1, 18, 1, P.stone[0]);
    rect(t, x, y, 18, 1, P.stone[6]);
    ring(t, x + 9, y + 27, 5, 6, P.pink[2]);
    line(t, x + 9, y + 16, x + 9, y + 38, P.pink[2]);
    line(t, x + 2, y + 27, x + 16, y + 27, P.pink[2]);
    outline(t, [[x + 9, y + 21], [x + 13, y + 27], [x + 9, y + 33], [x + 5, y + 27]], P.pink[0]);
    px(t, x + 9, y + 27, P.bloom[4]);
  }
  function windowAt(t, x, y, w, h, r) {
    const state = r(), lit = state > 0.22;
    const palette = state < 0.58 ? P.cyan : P.pink;
    const reflection = state < 0.58 ? '#284b70' : '#59325f';
    rect(t, x - 1, y - 1, w + 2, h + 3, P.stone[0]);
    rect(t, x, y, w, h, P.sky[0]);
    const split = Math.floor(w / 2);
    for (let row = 0; row < 3; row++) {
      const yy = y + 2 + row * Math.floor((h - 3) / 3);
      const hh = Math.floor((h - 3) / 3) - 2;
      for (let col = 0; col < 2; col++) {
        const xx = x + 2 + col * split, ww = split - 3;
        const on = lit && r() > 0.2;
        rect(t, xx, yy, ww, hh, on ? reflection : P.sky[1]);
        if (on) {
          rect(t, xx, yy, ww, hh, palette[0]);
          rect(t, xx + 1, yy, Math.max(1, ww - 2), 2, palette[1]);
          if (ww > 5) rect(t, xx + 3, yy + 2, 1, Math.max(1, hh - 2), reflection);
          if (r() < 0.57) rect(t, xx + ww - 2, yy, 1, hh, palette[2]);
          if (r() < 0.3) rect(t, xx + 1, yy + 3, 2, 2, reflection);
        } else if (r() < 0.6) {
          rect(t, xx, yy + 1, ww, 1, reflection);
        }
      }
    }
    rect(t, x + split, y, 1, h, P.stone[3]);
    rect(t, x, y, w, 2, P.stone[0]);
    rect(t, x - 1, y + h, w + 2, 1, P.stone[5]);
    rect(t, x, y + h + 1, w + 1, 1, P.stone[1]);
  }
  function crestAt(t, x, y) {
    const cx = x + 21, cy = y + 22;
    const hex = [[cx, y], [x + 40, y + 11], [x + 40, y + 33],
      [cx, y + 44], [x + 2, y + 33], [x + 2, y + 11]];
    poly(t, hex, P.sky[0]);
    outline(t, hex, P.stone[6]);
    const star = [];
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 6, radius = i % 2 ? 9 : 18;
      star.push([Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius)]);
    }
    outline(t, star, P.stone[5]);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const point = function (angle, radius) {
        return [Math.round(cx + Math.cos(angle) * radius), Math.round(cy + Math.sin(angle) * radius)];
      };
      outline(t, [point(a, 15), point(a + 0.48, 8), point(a, 3), point(a - 0.48, 8)], P.stone[6]);
    }
    ring(t, cx, cy, 3, 3, P.stone[6]);
    px(t, cx, cy, P.pink[2]);
  }

  function buildSchool() {
    const t = make(760, 200), r = random(0x5c401b);
    // 塔屋から地面まで160px。足元の y=199 をステージの y=192 に合わせる。
    rect(t, 4, 65, 752, 126, P.stone[0]);
    rect(t, 7, 61, 746, 123, P.stone[3]);
    rect(t, 7, 63, 746, 13, P.stone[4]);
    rect(t, 7, 77, 746, 69, P.stone[2]);
    rect(t, 7, 109, 746, 10, P.stone[3]);
    rect(t, 7, 147, 746, 37, P.stone[0]);
    grain(t, 8, 63, 744, 83, r, [P.stone[1], P.stone[4], P.stone[5]], 3200);
    for (let x = 12; x < 750; x += 17) {
      line(t, x, 64, x, 74, P.stone[2]);
      line(t, x + 8, 110, x + 8, 117, P.stone[1]);
    }
    for (let side = 0; side < 2; side++) {
      const start = side === 0 ? 14 : 444;
      for (let i = 0; i < 9; i++) {
        const x = start + i * 34;
        windowAt(t, x, 80, 26, 26, r);
        windowAt(t, x, 122, 26, 22, r);
        rect(t, x - 5, 77, 4, 69, P.stone[1]);
        rect(t, x - 4, 77, 2, 68, P.stone[4]);
        rect(t, x + 1, 150, 25, 31, P.sky[0]);
        windowAt(t, x + 2, 154, 22, 25, r);
        rect(t, x, 149, 25, 4, P.stone[1]);
      }
    }
    [77, 109, 147].forEach(function (y) {
      rect(t, 5, y - 2, 750, 2, P.stone[5]);
      rect(t, 6, y, 748, 3, P.stone[0]);
      rect(t, 8, y + 3, 744, 1, P.stone[1]);
    });
    // 屋上手すり、排水管、コンクリートの目地。
    rect(t, 6, 59, 748, 2, P.stone[5]);
    rect(t, 6, 61, 748, 2, P.stone[1]);
    line(t, 10, 52, 749, 52, P.stone[3]);
    line(t, 10, 58, 749, 58, P.stone[1]);
    for (let x = 10; x < 753; x += 13) {
      line(t, x, 52, x, 59, P.stone[3]);
      px(t, x, 52, P.stone[5]);
    }
    [111, 281, 552, 723].forEach(function (x) {
      rect(t, x, 63, 2, 83, P.stone[0]);
      rect(t, x, 63, 1, 83, P.stone[5]);
      rect(t, x - 1, 95, 4, 1, P.stone[4]);
      rect(t, x - 1, 132, 4, 1, P.stone[4]);
    });
    for (let x = 9; x < 750; x += 34) {
      rect(t, x, 150, 7, 36, P.stone[3]);
      rect(t, x, 150, 2, 35, P.stone[5]);
      rect(t, x + 6, 151, 2, 35, P.stone[1]);
      rect(t, x - 1, 181, 10, 5, P.stone[2]);
      if (r() < 0.65) rect(t, x + 2, 171, 2, 9, '#75416e');
    }
    rect(t, 341, 40, 85, 145, P.stone[0]);
    rect(t, 343, 43, 13, 141, P.stone[3]);
    rect(t, 356, 43, 61, 141, P.stone[5]);
    rect(t, 417, 43, 7, 141, P.stone[2]);
    rect(t, 357, 44, 2, 138, P.stone[6]);
    grain(t, 344, 44, 72, 93, r, [P.stone[3], P.stone[4], P.stone[6]], 730);
    for (let y = 61; y < 137; y += 19) {
      line(t, 344, y, 416, y, P.stone[3]);
      for (let x = 356 + ((y & 1) ? 9 : 0); x < 417; x += 22) {
        line(t, x, y - 18, x, y, P.stone[4]);
      }
    }
    rect(t, 339, 38, 89, 2, P.stone[6]);
    rect(t, 340, 40, 87, 3, P.stone[1]);
    line(t, 346, 32, 420, 32, P.stone[4]);
    for (let x = 346; x <= 420; x += 12) line(t, x, 32, x, 38, P.stone[4]);
    line(t, 352, 23, 352, 38, P.stone[5]);
    px(t, 352, 24, P.pink[2]);
    line(t, 408, 26, 408, 38, P.stone[5]);
    line(t, 405, 30, 411, 30, P.stone[3]);
    const schoolCrest = { x: 359, y: 46, w: 43, h: 45 };
    crestAt(t, schoolCrest.x, schoolCrest.y);
    windowAt(t, 351, 96, 25, 25, r);
    windowAt(t, 389, 96, 25, 25, r);
    rect(t, 379, 95, 7, 28, P.stone[4]);
    rect(t, 379, 95, 2, 28, P.stone[6]);
    // 看板の内側は文字や模様を一切入れない。
    rect(t, 291, 125, 181, 22, P.stone[0]);
    rect(t, 293, 123, 177, 21, P.stone[3]);
    rect(t, 294, 123, 175, 1, P.stone[6]);
    rect(t, 294, 124, 2, 19, P.stone[5]);
    rect(t, 297, 127, 169, 16, P.stone[4]);
    const schoolSign = { x: 300, y: 128, w: 162, h: 14 };
    rect(t, schoolSign.x, schoolSign.y, schoolSign.w, schoolSign.h, P.stone[5]);
    rect(t, 308, 149, 145, 36, P.sky[0]);
    rect(t, 315, 151, 131, 3, '#59325f');
    for (let x = 320; x < 441; x += 20) windowAt(t, x, 155, 18, 25, r);
    rect(t, 304, 148, 9, 37, P.stone[4]);
    rect(t, 304, 148, 2, 37, P.stone[6]);
    rect(t, 449, 148, 9, 37, P.stone[3]);
    rect(t, 449, 148, 2, 37, P.stone[5]);
    rect(t, 298, 146, 166, 3, P.stone[5]);
    rect(t, 301, 149, 160, 3, P.stone[1]);
    bannerAt(t, 253, 101);
    bannerAt(t, 490, 107);
    bannerAt(t, 686, 95);
    // 低い段床。左右端まで石の段をつなぐ。
    for (let i = 0; i < 4; i++) {
      const y = 184 + i * 4;
      rect(t, 5 - i, y, 750 + i * 2, 4, P.stone[i % 2 ? 2 : 3]);
      rect(t, 5 - i, y, 750 + i * 2, 1, P.stone[5]);
      grain(t, 6, y + 1, 748, 2, r, [P.stone[1], P.stone[4]], 140);
      for (let x = 18 + i * 13; x < 750; x += 39) px(t, x, y + 2, P.stone[0]);
    }
    for (let i = 0; i < 45; i++) {
      const x = integer(r, 292, 466), y = integer(r, 185, 198);
      rect(t, x, y, integer(r, 1, 4), 1, i % 2 ? '#75416e' : P.stone[6]);
    }
    return { canvas: t.canvas, sign: schoolSign, crest: schoolCrest };
  }

  function blossom(t, cx, cy, rx, ry, r, back) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const q = x * x / (rx * rx) + y * y / (ry * ry);
        if (q > 1 || (q > 0.78 && r() < 0.28)) continue;
        let k = y < -ry * 0.15 ? 2 : 1;
        if (y > ry * 0.48) k = 0;
        if (back) k = Math.max(0, k - 1);
        if (r() < 0.12) k = Math.min(4, k + 1);
        px(t, cx + x, cy + y, P.bloom[k]);
      }
    }
    for (let i = 0; i < rx * ry / 3; i++) {
      const x = integer(r, -rx, rx), y = integer(r, -ry, ry);
      if (x * x / (rx * rx) + y * y / (ry * ry) > 0.95) continue;
      const light = y < 0 && x < rx * 0.65;
      const k = back ? integer(r, 0, 2) : (light ? integer(r, 3, 4) : integer(r, 1, 3));
      rect(t, cx + x - 1, cy + y, 3, 1, P.bloom[k]);
      rect(t, cx + x, cy + y - 1, 1, 3, P.bloom[k]);
      if (r() < 0.28) px(t, cx + x, cy + y, P.bloom[1]);
    }
  }
  function buildSakura() {
    const t = make(190, 190), r = random(0x7a9d31);
    [[29, 75, 25, 20], [65, 70, 29, 24], [106, 49, 32, 27],
      [146, 65, 28, 24], [160, 99, 22, 19], [47, 110, 27, 16]].forEach(function (a) {
      blossom(t, a[0], a[1], a[2], a[3], r, true);
    });
    const trunk = [[101, 189], [109, 169], [110, 142], [102, 123], [93, 107],
      [100, 90], [112, 74], [118, 77], [109, 105], [120, 129], [122, 156],
      [123, 176], [134, 189]];
    poly(t, trunk, P.trunk[0]);
    poly(t, [[107, 189], [115, 161], [114, 139], [105, 121], [101, 107],
      [106, 93], [105, 112], [117, 133], [119, 163], [118, 188]], P.trunk[1]);
    const branches = [
      [111, 143, 82, 115, 8], [82, 115, 54, 105, 6], [54, 105, 17, 97, 4],
      [94, 111, 67, 85, 7], [67, 85, 37, 76, 5], [37, 76, 11, 57, 3],
      [67, 85, 64, 53, 4], [64, 53, 46, 35, 2],
      [102, 106, 120, 80, 6], [120, 80, 148, 67, 4], [148, 67, 174, 47, 2],
      [112, 86, 103, 51, 5], [103, 51, 91, 27, 3],
      [119, 133, 144, 116, 5], [144, 116, 175, 104, 3]
    ];
    branches.forEach(function (a) {
      line(t, a[0], a[1], a[2], a[3], P.trunk[0], a[4]);
      line(t, a[0] - 1, a[1], a[2] - 1, a[3], P.trunk[1], Math.max(1, a[4] - 3));
      if (a[4] > 4) line(t, a[0] - 2, a[1], a[2] - 2, a[3], P.trunk[2]);
    });
    const clumps = [
      [18, 54, 16, 13], [39, 40, 22, 17], [65, 36, 21, 18],
      [87, 24, 22, 17], [113, 29, 24, 20], [139, 38, 21, 17],
      [163, 49, 19, 15], [174, 69, 13, 15], [145, 66, 20, 16],
      [117, 57, 24, 19], [84, 54, 19, 17], [54, 65, 22, 16],
      [25, 75, 20, 14], [13, 94, 11, 13], [39, 96, 18, 13],
      [64, 107, 19, 13], [83, 87, 17, 13], [129, 91, 17, 14],
      [154, 98, 18, 14], [176, 111, 12, 13], [146, 122, 17, 11],
      [43, 120, 13, 10], [97, 71, 11, 9]
    ];
    clumps.forEach(a => blossom(t, a[0], a[1], a[2], a[3], r, false));
    for (let i = 0; i < 130; i++) {
      const y = integer(r, 126, 187);
      const mid = 112 + Math.floor((y - 126) * 0.06), x = mid + integer(r, -2, 5);
      rect(t, x, y, 1, integer(r, 1, 3), i % 3 ? P.trunk[0] : P.trunk[2]);
    }
    line(t, 113, 182, 96, 189, P.trunk[1], 2);
    line(t, 119, 180, 138, 189, P.trunk[0], 2);
    rect(t, 101, 188, 33, 2, P.trunk[0]);
    for (let i = 0; i < 34; i++) {
      const x = integer(r, 5, 185), y = integer(r, 131, 184);
      rect(t, x, y, i % 3 ? 1 : 2, 1, P.bloom[integer(r, 1, 4)]);
    }
    return { canvas: t.canvas, base: { x: 117, y: 189 } };
  }

  function buildGate() {
    const t = make(130, 60), r = random(0x716c3a);
    const leaves = ['#343e44', '#626746', '#98934e', '#d5b752', P.gold];
    for (let i = 0; i < 110; i++) {
      const x = integer(r, 0, 129), y = integer(r, 9, 25);
      ellipse(t, x, y, integer(r, 2, 5), integer(r, 2, 4), leaves[integer(r, 0, 2)]);
      if (r() < 0.7) {
        rect(t, x - 1, y - 2, 3, 2, leaves[integer(r, 3, 4)]);
        px(t, x, y - 3, P.gold);
      }
    }
    rect(t, 0, 25, 130, 35, P.stone[0]);
    for (let row = 0; row < 4; row++) {
      const yy = 26 + row * 9;
      for (let col = -1; col < 9; col++) {
        const xx = col * 18 + (row % 2 ? 9 : 0);
        rect(t, xx + 1, yy, 16, 8, P.stone[integer(r, 2, 4)]);
        rect(t, xx + 1, yy, 16, 1, P.stone[5]);
        rect(t, xx + 1, yy + 1, 1, 6, P.stone[4]);
        rect(t, xx + 16, yy + 2, 1, 6, P.stone[1]);
        grain(t, xx + 2, yy + 1, 14, 6, r, [P.stone[1], P.stone[5]], 15);
      }
    }
    rect(t, 0, 22, 130, 3, P.stone[4]);
    rect(t, 0, 22, 130, 1, P.stone[6]);
    rect(t, 11, 18, 23, 42, P.stone[4]);
    rect(t, 11, 18, 3, 42, P.stone[6]);
    rect(t, 31, 19, 4, 41, P.stone[1]);
    grain(t, 14, 20, 16, 39, r, [P.stone[2], P.stone[5], P.stone[6]], 160);
    rect(t, 9, 16, 26, 3, P.stone[5]);
    rect(t, 9, 16, 26, 1, P.stone[6]);
    rect(t, 38, 29, 78, 26, P.stone[0]);
    rect(t, 37, 27, 78, 26, P.stone[5]);
    rect(t, 38, 28, 76, 24, P.stone[1]);
    rect(t, 38, 28, 76, 1, P.stone[6]);
    rect(t, 113, 29, 1, 23, P.stone[3]);
    const plaque = { x: 42, y: 31, w: 68, h: 18 };
    rect(t, plaque.x, plaque.y, plaque.w, plaque.h, P.stone[2]);
    rect(t, 0, 58, 130, 2, P.stone[1]);
    for (let i = 0; i < 16; i++) {
      rect(t, integer(r, 0, 129), integer(r, 55, 59), 2, 1, P.bloom[integer(r, 1, 3)]);
    }
    return { canvas: t.canvas, plaque: plaque };
  }

  function build() {
    const sky = buildSky();
    const far = buildFar();
    const volcano = buildVolcano();
    const school = buildSchool();
    const sakura = buildSakura();
    const gate = buildGate();
    const banner = make(18, 60), petal = make(5, 4);
    bannerAt(banner, 0, 0);
    rect(petal, 1, 0, 2, 1, P.bloom[4]);
    rect(petal, 0, 1, 4, 1, P.bloom[3]);
    rect(petal, 1, 2, 4, 1, P.bloom[2]);
    rect(petal, 2, 3, 2, 1, P.bloom[0]);
    px(petal, 1, 1, P.bloom[4]);
    return {
      sky: sky,
      far: far,
      volcano: volcano,
      school: school.canvas,
      schoolSign: school.sign,
      schoolCrest: school.crest,
      sakura: sakura.canvas,
      sakuraBase: sakura.base,
      gate: gate.canvas,
      gatePlaque: gate.plaque,
      banner: banner.canvas,
      petal: petal.canvas
    };
  }

  window.REBELL_BG_SCHOOL = { build: build };
}());

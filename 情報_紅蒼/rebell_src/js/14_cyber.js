// サイバーパンクの演出（R.Cyber）: 3 つのステージの背景に重ねる、動く飾り。当たり判定はなく、遊び方は変えない。
//   sky   … 空（遠景の街より奥）: サーチライトの光の筋・広告飛行船（電光掲示板が流れる）
//   mid   … 遠景の街の手前: 空を走るエアカーの車列（ライトの尾を引く）
//   near  … 地形の上（主人公より奥）: 地面近くのネオンの霧・蒸気の噴き出し・鉄塔の雲
//   holo  … ホログラムの看板（高い解像度で描く。ときどきちらつき、走査線と横ずれのノイズが入る）
//   rain  … 雨（いちばん手前。主人公にもかかる）
// どれも G.t（フレーム数）とカメラの位置だけで決まる（状態を持たない）ので、ポーズや巻き戻しでずれない。
(function () {
  'use strict';
  var R = window.REBELL, GY = R.GY, W = R.W, H = R.H, PI = Math.PI;

  // 0〜1 の決まった乱数（同じ n なら同じ値）
  function hash(n) { n = (n | 0) ^ 0x5bd1e995; n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
  function wrap(v, m) { return ((v % m) + m) % m; }

  // ステージごとの雰囲気
  //   beam = サーチライトの色、rain = 雨粒の数、slant = 雨の傾き、rainCol = 雨の色、fog = 地面近くの霧の色、cars = 車列の数
  var THEME = {
    city: { beam: '#9ae8ff', beams: 4, rain: 110, slant: 0.2, rainCol: ['#9ae8ff', '#ff9ad8', '#c8c0ff'], fog: ['255,60,170', '40,200,255'], cars: 4, blimp: true },
    tower: { beam: '#c8f4ff', beams: 3, rain: 80, slant: 0.55, rainCol: ['#c8f4ff', '#9ae8ff', '#ffb0e0'], fog: null, cars: 5, blimp: true },
    sky: { beam: '#ffb0e0', beams: 2, rain: 0, slant: 0, rainCol: [], fog: null, cars: 5, blimp: true },
    taniyama: { beam: '#ffffff', beams: 0, rain: 0, slant: 0, rainCol: [], fog: null, cars: 0, blimp: false },      // 第2章 第1話（昼）: 雨もネオンも出さない
    hirakawa: { beam: '#ffffff', beams: 0, rain: 0, slant: 0, rainCol: [], fog: null, cars: 0, blimp: false },      // 第2章 第2話（夕方）
    school: { beam: '#ff3a5a', beams: 3, rain: 40, slant: 0.12, rainCol: ['#ffb0c8', '#c8c0ff'], fog: ['255,40,90', '160,60,255'], cars: 3, blimp: false }
  };
  function theme(S) { return THEME[S.id] || THEME.city; }

  // ---- 空: サーチライトと広告飛行船 ----
  function sky(g, S, cam, t, oy) {
    var T = theme(S), i;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (i = 0; i < T.beams; i++) {      // 街の下から伸びる光の筋が、ゆっくり首を振る
      var bx = wrap(i * 197 + 70 - cam * 0.05, W + 160) - 80, by = H + 30, a = -PI / 2 + 0.5 * Math.sin(t * 0.0047 + i * 2.3), sp = 0.08, L = 340;
      var gr = g.createLinearGradient(bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L);
      gr.addColorStop(0, hexA(T.beam, 0.28)); gr.addColorStop(1, hexA(T.beam, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 3, by);
      g.lineTo(bx + Math.cos(a - sp) * L, by + Math.sin(a - sp) * L); g.lineTo(bx + Math.cos(a + sp) * L, by + Math.sin(a + sp) * L); g.lineTo(bx + 3, by); g.closePath(); g.fill();
    }
    g.restore();
    if (T.blimp) blimp(g, S, cam, t, oy);
  }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  // 広告飛行船: 腹に電光掲示板。文字が右から左へ流れる
  var MARQ = null, MARQ_TXT = '  NEO KAGOSHIMA  //  夜間外出禁止令 22:00  //  紅い月に注意  //  CYBER-SHRINE  OPEN 24H  //';
  function marquee() {
    if (MARQ) return MARQ;
    var c = R.mk(10, 10), x = c.getContext('2d'), w;
    x.font = 'bold 14px "Yu Gothic UI","Meiryo",sans-serif'; w = Math.ceil(x.measureText(MARQ_TXT).width) + 4;
    var big = R.mk(w, 16), b = big.getContext('2d');
    b.font = x.font; b.fillStyle = '#ffffff'; b.textBaseline = 'middle'; b.fillText(MARQ_TXT, 2, 8.5);
    // 半分に縮めて、くっきりした点の文字にする（明るい所だけ残す）
    var sm = R.mk(Math.ceil(w / 2), 8), s = sm.getContext('2d'); s.imageSmoothingEnabled = true; s.drawImage(big, 0, 0, sm.width, 8);
    var d = s.getImageData(0, 0, sm.width, 8), p = d.data, i;
    for (i = 0; i < p.length; i += 4) { var on = p[i + 3] > 70; p[i] = 255; p[i + 1] = 214; p[i + 2] = 106; p[i + 3] = on ? 255 : 0; }
    s.putImageData(d, 0, 0);
    return (MARQ = sm);
  }
  function blimp(g, S, cam, t, oy) {
    var x = wrap(t * 0.11 - cam * 0.06, W + 220) - 110, y;
    if (S.vertical) { y = 46 + (oy - 1150) * 0.4; if (y < -40 || y > H) return; }      // 鉄塔: 途中の高さで、横を通り過ぎる
    else y = 30 + Math.round(oy * 0.2);
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#17123a'; g.beginPath(); g.ellipse(x + 34, y + 8, 34, 9, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#2a2266'; g.beginPath(); g.ellipse(x + 34, y + 6, 31, 5, 0, PI, 0); g.fill();
    g.fillStyle = '#17123a'; g.fillRect(x - 3, y + 2, 6, 3); g.fillRect(x - 4, y + 10, 7, 3);      // 尾びれ
    g.fillStyle = '#0d0a26'; g.fillRect(x + 25, y + 16, 16, 4);                                   // ゴンドラ
    g.fillStyle = '#ffd36a'; g.fillRect(x + 27, y + 17, 2, 1); g.fillRect(x + 31, y + 17, 2, 1); g.fillRect(x + 35, y + 17, 2, 1);
    // 電光掲示板
    var M = marquee(), bw = 40, sx = wrap(t * 0.5, M.width);
    g.fillStyle = '#050314'; g.fillRect(x + 14, y + 4, bw, 9);
    g.save(); g.beginPath(); g.rect(x + 15, y + 4, bw - 2, 9); g.clip();
    g.drawImage(M, x + 15 - sx, y + 4); g.drawImage(M, x + 15 - sx + M.width, y + 4);
    g.restore();
    if ((t >> 4) % 2) { g.fillStyle = '#ff3048'; g.fillRect(x + 66, y + 7, 2, 2); }      // 航空灯
    g.fillStyle = '#37e6ff'; g.fillRect(x + 1, y + 6, 1, 1);
    // 下へ照らす光
    g.save(); g.globalCompositeOperation = 'lighter'; var gr = g.createLinearGradient(0, y + 20, 0, y + 80); gr.addColorStop(0, 'rgba(255,214,106,.16)'); gr.addColorStop(1, 'rgba(255,214,106,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + 30, y + 20); g.lineTo(x + 18, y + 80); g.lineTo(x + 50, y + 80); g.lineTo(x + 38, y + 20); g.fill(); g.restore();
  }

  // ---- 遠景の手前: エアカーの車列 ----
  //   y = 車線の高さ、v = 速さ（負 = 左へ）、d = 奥行き（カメラにつられる量。大きいほど手前で大きい）、n = 台数
  var LANES = [{ y: 52, v: 0.55, d: 0.12, n: 3, s: 1 }, { y: 64, v: -0.75, d: 0.16, n: 3, s: 1 }, { y: 96, v: 1.35, d: 0.3, n: 2, s: 2 }, { y: 122, v: -1.6, d: 0.45, n: 1, s: 3 }, { y: 40, v: -0.4, d: 0.08, n: 4, s: 1 }];
  function mid(g, S, cam, t, oy) {
    var T = theme(S), i, j, L, span = W + 140;
    for (i = 0; i < Math.min(T.cars, LANES.length); i++) {
      L = LANES[i];
      var ly = S.vertical ? wrap(L.y + oy * L.d * 1.6, 330) - 30 : L.y + Math.round(oy * L.d * 0.6);
      for (j = 0; j < L.n; j++) {
        var x = wrap(j * span / L.n + hash(i * 31 + j) * 60 + t * L.v - cam * L.d, span) - 70;
        car(g, Math.round(x), Math.round(ly + Math.sin((t + j * 50) * 0.03) * 1.2), L.v > 0 ? 1 : -1, L.s, hash(i * 7 + j * 13));
      }
    }
  }
  // エアカー 1 台。s = 大きさ（1 = 遠い、2 = 近い）、k = 色の選び方
  function car(g, x, y, dir, s, k) {
    var w = 9 * s, body = k < 0.5 ? '#1c1846' : '#2a1640', glow = k < 0.33 ? '#ff4fb0' : k < 0.66 ? '#37e6ff' : '#b49cff';
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = dir > 0 ? 'rgba(255,60,80,.28)' : 'rgba(255,60,80,.28)'; g.fillRect(dir > 0 ? x - 12 * s : x + w, y + s, 12 * s, 1);      // 尾灯の光の尾
    g.fillStyle = 'rgba(255,255,230,.18)'; g.fillRect(dir > 0 ? x + w : x - 8 * s, y + s - (s > 1 ? 1 : 0), 8 * s, s);                    // 前照灯の光
    g.restore();
    g.fillStyle = body; g.fillRect(x, y, w, 2 * s); g.fillRect(x + 2 * s, y - s, 4 * s, s);
    g.fillStyle = '#7af3ff'; g.fillRect(x + (dir > 0 ? 4 * s : 3 * s), y - s, 2 * s, s);      // 窓
    g.fillStyle = '#ff3048'; g.fillRect(dir > 0 ? x : x + w - s, y, s, s);                      // 尾灯
    g.fillStyle = '#ffffff'; g.fillRect(dir > 0 ? x + w - s : x, y, s, s);                      // 前照灯
    g.fillStyle = glow; g.fillRect(x + s, y + 2 * s, w - 2 * s, s > 1 ? 2 : 1);                 // 車体の下のネオン
    g.fillStyle = glow; g.fillRect(x, y, w, 1); g.globalAlpha = 1;                                // 屋根のふち（夜空に沈まないように）
  }

  // ---- 地形の上: 霧・蒸気・雲 ----
  var VENTS = { city: [260, 700, 1240, 1990, 2500, 3300], school: [500, 1600, 2400], tower: [] };
  function near(g, S, cam, t, oy) {
    var T = theme(S), i, k;
    if (T.fog && !S.vertical) {      // 地面すれすれのネオンの霧（ゆっくり色が入れ替わる）
      var u = 0.5 + 0.5 * Math.sin(t * 0.01), y0 = GY - 26 + oy, gr = g.createLinearGradient(0, y0, 0, y0 + 40);
      gr.addColorStop(0, 'rgba(' + T.fog[0] + ',0)'); gr.addColorStop(0.6, 'rgba(' + T.fog[0] + ',' + (0.05 + 0.04 * u) + ')'); gr.addColorStop(1, 'rgba(' + T.fog[1] + ',' + (0.09 - 0.04 * u) + ')');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, y0, W, 40); g.restore();
    }
    // 地面の割れ目から噴き出す蒸気
    var V = VENTS[S.id] || [];
    for (i = 0; i < V.length; i++) {
      var vx = V[i] - cam; if (vx < -30 || vx > W + 30) continue;
      if (!groundAt(S, V[i])) continue;
      g.fillStyle = '#0c0a24'; g.fillRect(Math.round(vx) - 5, GY + oy - 1, 10, 2); g.fillStyle = '#ff4fb0'; g.fillRect(Math.round(vx) - 4, GY + oy - 1, 8, 1);
      for (k = 0; k < 7; k++) {
        var life = 70, ph = wrap(t + k * 10 + i * 17, life), u2 = ph / life;
        var px = vx + Math.sin(ph * 0.08 + k) * 4 * u2 + (hash(k + i * 9) - 0.5) * 6, py = GY + oy - 2 - ph * 0.9;
        g.fillStyle = 'rgba(200,190,255,' + (0.22 * (1 - u2)) + ')'; var r = 2 + u2 * 7; g.fillRect(Math.round(px - r / 2), Math.round(py - r / 2), Math.round(r), Math.round(r));
      }
    }
    if (S.vertical) {      // 鉄塔: 登る途中で、雲の層を抜ける
      var C = [-560, -1240, -1880];
      for (i = 0; i < C.length; i++) {
        var cy = C[i] + oy; if (cy < -60 || cy > H + 60) continue;
        for (k = 0; k < 9; k++) {
          var cx = wrap(k * 70 + t * (0.15 + 0.05 * (k % 3)) + i * 40, W + 140) - 70, rr = 18 + hash(k + i * 11) * 16;
          g.fillStyle = 'rgba(140,130,220,' + (0.1 + 0.05 * (k % 2)) + ')'; g.beginPath(); g.ellipse(cx, cy + (k % 3) * 6 - 6, rr * 1.8, rr * 0.5, 0, 0, PI * 2); g.fill();
        }
      }
    }
  }
  function groundAt(S, x) { for (var i = 0; i < S.ground.length; i++) if (x >= S.ground[i][0] && x <= S.ground[i][1]) return true; return false; }

  // ---- ホログラムの看板 ----
  //   [x, y, 文字, 色, 縦書き, 文字の大きさ（ゲームのドット）, 奥行き（1 = 地形と一緒に動く。小さいほど奥）]。鉄塔の y は世界の y
  var SIGNS = {
    city: [[120, 70, '電脳街', '#ff4fb0', 1, 15, 0.7], [380, 96, 'NEON MARKET', '#37e6ff', 0, 13, 0.7], [640, 40, '義体', '#ffd36a', 1, 14, 0.5], [800, 84, '義体修理', '#ffd36a', 1, 13, 0.85],
      [1050, 110, '電脳', '#b49cff', 0, 12, 0.95], [1180, 60, 'らぁめん 夜鳴き', '#ff9a3a', 0, 13, 0.6], [1500, 96, '立入禁止', '#ff3048', 0, 14, 0.9], [1760, 40, 'HOLO-BAR', '#ff4fb0', 0, 12, 0.5],
      [1900, 78, '24H 電脳診療所', '#7af3ff', 0, 12, 0.7], [2330, 70, '夜市', '#ff4fb0', 1, 17, 0.8], [2560, 104, '回線不通', '#ff3048', 0, 11, 0.95], [2700, 50, 'NEO KAGOSHIMA', '#b49cff', 0, 14, 0.6],
      [3100, 80, '回路', '#37e6ff', 1, 16, 0.85], [3300, 40, '義眼', '#7af3ff', 1, 12, 0.5], [3450, 96, 'DANGER', '#ff3048', 0, 14, 0.9]],
    sky: [[330, 70, 'SKY LANE 07', '#37e6ff', 0, 10, 1], [1290, -150, '結界まで 1.8 km', '#ff4fb0', 0, 11, 1], [2200, -420, '玉龍学園 →', '#ffd36a', 0, 12, 1], [3200, -660, '着艦デッキ', '#7af3ff', 0, 12, 1]],
    tower: [[40, 100, '電波塔', '#37e6ff', 1, 13, 1], [330, 120, 'TOWER-7', '#b49cff', 0, 10, 1], [380, -1530, '高電圧', '#ff3048', 1, 11, 1], [300, -2190, '屋上', '#ffd36a', 0, 12, 1]],
    school: [[260, 70, '夜間戒厳令', '#ff3048', 1, 13, 0.75], [700, 60, '警報：龍の出現', '#ff3048', 0, 13, 0.6], [1150, 96, '避難経路 →', '#7af3ff', 0, 12, 0.9],
      [1450, 36, '生徒は直ちに退避せよ', '#ffd36a', 0, 11, 0.55], [1700, 80, 'GYOKURYU ACADEMY', '#37e6ff', 0, 12, 0.5], [2150, 66, '結界', '#ff4fb0', 1, 17, 0.85],
      [2520, 110, '電脳結界 稼働中', '#b49cff', 0, 11, 0.95], [2900, 60, '危険', '#ff3048', 1, 17, 0.85], [3150, 50, '龍', '#ff3048', 0, 20, 0.45]]
  };
  // 鉄塔の高さの印（20 m ごと）
  (function () { var m; for (m = 20; m <= 160; m += 20) SIGNS.tower.push([m % 40 ? 22 : 432, GY - m * 14 - 6, 'ALT ' + ('00' + m).slice(-3) + 'm', '#7af3ff', 0, 8, 1]); })();
  var holoCache = {};
  // 看板を 4 倍の細かさで作っておく（文字・枠・光のにじみ・走査線）
  function holoImg(sg) {
    var key = sg[2] + sg[3] + sg[4] + sg[5]; if (holoCache[key]) return holoCache[key];
    var Z = 4, fs = sg[5] * Z, txt = sg[2], vert = !!sg[4], pad = 3 * Z, i, c, x;
    var meas = R.mk(10, 10).getContext('2d'); meas.font = 'bold ' + fs + 'px "Yu Gothic UI","Meiryo",sans-serif';
    var tw = vert ? fs : Math.ceil(meas.measureText(txt).width), th = vert ? fs * txt.length * 1.05 : fs * 1.2;
    var w = tw + pad * 2 + 16, h = th + pad * 2 + 16;
    c = R.mk(Math.ceil(w), Math.ceil(h)); x = c.getContext('2d');
    x.font = meas.font; x.textAlign = 'center'; x.textBaseline = 'middle';
    // 枠
    x.strokeStyle = sg[3]; x.lineWidth = Z * 0.8; x.globalAlpha = 0.7; x.shadowColor = sg[3]; x.shadowBlur = 12;
    x.strokeRect(8 + Z, 8 + Z, w - 16 - Z * 2, h - 16 - Z * 2);
    x.globalAlpha = 0.12; x.fillStyle = sg[3]; x.fillRect(8 + Z, 8 + Z, w - 16 - Z * 2, h - 16 - Z * 2);
    // 文字（光のにじみ → 芯の白）
    x.globalAlpha = 1; x.shadowBlur = 18; x.fillStyle = sg[3];
    function put() { if (vert) { for (i = 0; i < txt.length; i++) x.fillText(txt[i], w / 2, 8 + pad + fs * 0.55 + i * fs * 1.05); } else x.fillText(txt, w / 2, h / 2 + Z * 0.5); }
    put(); x.shadowBlur = 0; x.globalAlpha = 0.3; x.fillStyle = '#ffffff'; put();
    // 走査線
    x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 0.4; x.fillStyle = '#000';
    for (i = 0; i < h; i += Z * 2) x.fillRect(0, i, w, Z * 0.7);
    return (holoCache[key] = c);
  }
  // F = 表示用のキャンバス（拡大後の大きさ）、SC = 1 ドットの大きさ
  function holo(F, SC, S, cam, oy, t) {
    var L = SIGNS[S.id] || [], i, sg, im, sx, sy, a, k;
    F.save(); F.globalCompositeOperation = 'lighter'; F.imageSmoothingEnabled = true;
    for (i = 0; i < L.length; i++) {
      sg = L[i]; sx = sg[0] - cam * sg[6]; sy = sg[1] + oy * (S.vertical ? 1 : sg[6]);
      im = holoImg(sg); var w = im.width / 4, h = im.height / 4;
      if (sx > W + 10 || sx + w < -10 || sy > H + 10 || sy + h < -10) continue;
      a = (0.72 + 0.25 * sg[6]) * (0.85 + 0.15 * Math.sin(t * 0.09 + i * 1.7));
      k = hash(Math.floor(t / 5) * 131 + i * 977);
      if (k < 0.05) a *= 0.25;      // ちらつき
      F.globalAlpha = a;
      if (k > 0.975) {      // 横ずれのノイズ: 上下に切って、ずらして描く
        var cut = Math.floor(im.height * (0.3 + 0.4 * hash(t + i)));
        F.drawImage(im, 0, 0, im.width, cut, (sx - 2) * SC, sy * SC, w * SC, cut / 4 * SC);
        F.drawImage(im, 0, cut, im.width, im.height - cut, (sx + 3) * SC, (sy + cut / 4) * SC, w * SC, (im.height - cut) / 4 * SC);
      } else F.drawImage(im, sx * SC, sy * SC, w * SC, h * SC);
    }
    F.restore();
  }

  // ---- 雨（画面の手前。fg = 480x270 のキャンバス）----
  function rain(g, S, cam, oy, t) {
    var T = theme(S), i, n = T.rain, cols = T.rainCol;
    if (!n) return;
    g.save(); g.globalAlpha = 0.58;
    for (i = 0; i < n; i++) {
      var sp = 5.5 + hash(i * 3) * 2.5, len = 4 + Math.floor(hash(i * 5) * 4), y = wrap(hash(i * 7) * 320 + t * sp + (S.vertical ? oy * 0.9 : 0), 320) - 30;
      var x = wrap(hash(i * 11) * (W + 60) - cam * 1.0 + y * T.slant, W + 60) - 30;
      g.fillStyle = cols[i % cols.length];
      for (var k = 0; k < len; k++) g.fillRect(Math.round(x + k * T.slant), Math.round(y + k), 1, 1);
    }
    g.globalAlpha = 1;
    if (!S.vertical) {      // 地面で跳ねるしぶき
      for (i = 0; i < 18; i++) {
        var ph = wrap(t + i * 11, 22); if (ph > 5) continue;
        var wx = wrap(hash(i * 13 + Math.floor((t + i * 11) / 22) * 7) * (W + 40), W + 40) - 20 + cam;
        if (!groundAt(S, wx)) continue;
        var px = Math.round(wx - cam), py = GY + oy - 1;
        g.fillStyle = 'rgba(200,230,255,.6)'; g.fillRect(px - ph, py - (ph > 2 ? 1 : 2), 1, 1); g.fillRect(px + ph, py - (ph > 2 ? 1 : 2), 1, 1); if (ph < 2) g.fillRect(px, py - 2, 1, 1);
      }
    }
    g.restore();
  }

  R.Cyber = { sky: sky, mid: mid, near: near, holo: holo, rain: rain, SIGNS: SIGNS };
})();

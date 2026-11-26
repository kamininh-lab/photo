// 紅い月（R.Moon）: 物語が進むほど、空の紅い月が大きく、不気味になっていく。
//   月そのものは空の絵（12_codex_bg_school.js の buildSky、中心 245,56・半径 34）に描かれている。
//   その月を切り抜いて、進み具合（0〜1）に合わせて拡大し、上から重ねる。
//   進み具合 = ステージ 1 の始め 0 → 鉄塔 → 学園（最終ステージ）の奥で 1。ステージの中でも、進むほど少しずつ大きくなる。
//   大きくなるにつれて: 空が赤黒く沈む / 月のまわりの光が心臓の鼓動のように脈打つ / 月の色が血の色に濁る /
//   月の表面を黒い雲の筋が横切る / 最終ステージでは、月の下側から影が食い込み（欠けていく）、赤い光の滴が垂れる
// G.t とカメラだけで決まる（状態を持たない）。当たり判定はない。
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, PI = Math.PI;
  var CX = 245, CY = 56, RAD = 34;
  var SRC = null, TMP = null;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(n) { n = (n | 0) ^ 0x5bd1e995; n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

  // 空の絵から、月のまわりを切り抜いておく
  function src() {
    if (SRC) return SRC;
    var sky = R.BG && R.BG.sky; if (!sky) return null;
    SRC = R.mk(RAD * 2 + 8, RAD * 2 + 8);
    SRC.getContext('2d').drawImage(sky, CX - RAD - 4, CY - RAD - 4, RAD * 2 + 8, RAD * 2 + 8, 0, 0, RAD * 2 + 8, RAD * 2 + 8);
    TMP = R.mk(260, 260);
    return SRC;
  }

  // 進み具合（0〜1）
  function progress(S, camX, oy) {
    var i = R.STAGES.indexOf(S), n = R.STAGES.length, f;
    if (i < 0) return 0;
    if (S.vertical) f = clamp(oy / Math.max(1, 165 - S.goal[1] + 20), 0, 1);
    else f = clamp(camX / Math.max(1, S.len - R.W), 0, 1);
    return clamp((i + f * 0.85) / (n - 0.15), 0, 1);      // 最終ステージの奥（龍の手前あたり）で 1
  }
  R.moonProgress = progress;

  function draw(g, S, camX, t, oy) {
    var im = src(); if (!im) return;
    var k = progress(S, camX, oy), e = k * k * (3 - 2 * k);
    var s = 1 + 1.55 * e, r = RAD * s;                       // 半径 34 → 約 87
    var cx = CX + Math.round(10 * e), cy = CY + Math.round(34 * e);      // 大きくなるほど、少し下へ降りてくる（迫ってくる）
    if (S.id === 'school') { cx = 272; cy = 52; }      // 学園は校舎が空のほとんどを隠すので、巨大な月が屋根の上にのしかかるように見せる
    // 鼓動（ドクン、ドクン……と 2 回打って休む）
    var ph = (t % 110) / 110, beat = Math.exp(-Math.pow((ph - 0.08) / 0.05, 2)) + 0.7 * Math.exp(-Math.pow((ph - 0.27) / 0.05, 2));
    g.save();
    // 空を赤黒く沈める（上ほど暗く）
    if (e > 0.02) {
      var sg = g.createLinearGradient(0, 0, 0, R.H);
      sg.addColorStop(0, 'rgba(20,0,10,' + (0.45 * e) + ')'); sg.addColorStop(0.6, 'rgba(90,0,30,' + (0.28 * e) + ')'); sg.addColorStop(1, 'rgba(120,10,40,' + (0.15 * e) + ')');
      g.fillStyle = sg; g.fillRect(0, 0, R.W, R.H);
    }
    // 月のまわりの光（脈打つ）
    g.globalCompositeOperation = 'lighter';
    var hr = r * (1.9 + 0.12 * beat * e), hg = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, hr);
    hg.addColorStop(0, 'rgba(255,40,70,' + (0.10 + 0.22 * e + 0.12 * beat * e) + ')'); hg.addColorStop(1, 'rgba(255,0,40,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, hr, 0, PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    // 月の本体（切り抜いた月を拡大し、別のキャンバスで色を濁らせ・影を落としてから重ねる）
    var D = Math.ceil(r * 2 + 10), T = TMP.getContext('2d'), m = D / 2;
    if (D > TMP.width) { TMP = R.mk(D, D); T = TMP.getContext('2d'); }
    T.setTransform(1, 0, 0, 1, 0, 0); T.globalCompositeOperation = 'source-over'; T.globalAlpha = 1; T.clearRect(0, 0, TMP.width, TMP.height);
    T.save(); T.beginPath(); T.arc(m, m, r + 0.5, 0, PI * 2); T.clip();
    T.imageSmoothingEnabled = false;
    T.drawImage(im, m - (RAD + 4) * s, m - (RAD + 4) * s, (RAD * 2 + 8) * s, (RAD * 2 + 8) * s);
    T.restore();
    T.globalCompositeOperation = 'source-atop';
    // 血の色に濁る（下側ほど濃い）
    var bg = T.createLinearGradient(0, m - r, 0, m + r);
    bg.addColorStop(0, 'rgba(255,40,60,' + (0.12 * e) + ')'); bg.addColorStop(1, 'rgba(70,0,16,' + (0.55 * e) + ')');
    T.fillStyle = bg; T.fillRect(0, 0, D, D);
    // 黒い雲の筋が、月の前をゆっくり横切る
    var i, n = Math.round(1 + 4 * e);
    for (i = 0; i < n; i++) {
      var yy = m - r + (hash(i * 7 + 3) * 1.6 + 0.2) * r, ww = r * (0.8 + hash(i * 13) * 1.2), xx = ((t * (0.05 + hash(i) * 0.08) + hash(i * 5) * 400) % (D + ww)) - ww;
      T.fillStyle = 'rgba(12,0,8,' + (0.35 + 0.35 * e) + ')';
      T.fillRect(Math.round(xx), Math.round(yy), Math.round(ww), Math.max(1, Math.round(r * 0.06)));
      T.fillRect(Math.round(xx + ww * 0.2), Math.round(yy + r * 0.06), Math.round(ww * 0.55), 1);
    }
    // 最終ステージ: 右から影が食い込み、欠けていく（赤い縁だけが光る）
    var ec = clamp((k - 0.62) / 0.38, 0, 1);
    if (ec > 0) {
      T.fillStyle = 'rgba(8,0,6,' + (0.55 + 0.35 * ec) + ')';
      T.beginPath(); T.arc(m + r * (1.6 - 0.75 * ec), m - r * 0.2, r * 1.05, 0, PI * 2); T.fill();
    }
    g.globalAlpha = 1; g.drawImage(TMP, 0, 0, D, D, Math.round(cx - m), Math.round(cy - m), D, D);
    // 縁の赤い光（鼓動に合わせて強まる）
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,60,80,' + (0.12 + 0.3 * e * (0.5 + 0.5 * beat)) + ')'; g.lineWidth = 1 + e;
    g.beginPath(); g.arc(cx, cy, r + 0.5, 0, PI * 2); g.stroke();
    g.globalCompositeOperation = 'source-over';
    // 最終ステージ: 月の下の縁から、赤い光の滴が垂れる
    if (ec > 0) {
      for (i = 0; i < 6; i++) {
        var per = 150 + Math.floor(hash(i * 31) * 120), u = ((t + hash(i * 17) * per) % per) / per;
        var dx = cx + (hash(i * 3 + 1) - 0.5) * r * 1.2, dy0 = cy + Math.sqrt(Math.max(0, r * r - (dx - cx) * (dx - cx))) - 1;
        var len = 3 + u * 26 * ec, a = (1 - u) * 0.75 * ec;
        g.fillStyle = 'rgba(200,10,40,' + a + ')'; g.fillRect(Math.round(dx), Math.round(dy0 + u * 30 * ec), 1, Math.round(len * 0.4) + 1);
        if (u < 0.35) { g.fillStyle = 'rgba(150,0,30,' + (0.6 * ec) + ')'; g.fillRect(Math.round(dx), Math.round(dy0), 1, Math.round(u * 10) + 1); }
      }
    }
    g.restore();
  }
  R.Moon = { draw: draw, progress: progress };
})();

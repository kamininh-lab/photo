// ボス「玉龍」（紅蒼の終焉龍）の絵。art/source/DRAGON.png の立ち絵（08_dragon_art.js）を使う。左向き。
// 絵は 1 枚なので、動きは絵ごと動かして付ける: 身を乗り出す（lunge）・のけぞる（rear）・前足を出す（claw）・翼のゆれ（wing）。
// 口を開ける（jaw）・炎（fire）は、口もとの光で表す。
(function () {
  'use strict';
  var R = window.REBELL, PI = Math.PI;
  var W = 440, H = 236, OX = 160, OY = 208;      // 描くキャンバスの大きさと、その中の基準点（足元）
  var D = window.REBELL_DRAGON || { w: 1, h: 1, feet: [0, 0], core: [0, 0], mouth: [0, 0], head: [0, 0] };
  var img = null, raw = null, ctx = null;
  var PV = [44, -6];      // 回す中心（後ろ足のあたり。足元の基準点から）

  // 絵を読み込む（90_main.js から。終わったら done）
  R.loadDragon = function (done) {
    if (!window.REBELL_DRAGON) { done(); return; }
    var im = new Image();
    im.onload = function () { img = im; done(); };
    im.onerror = function () { var el = document.getElementById('err'); if (el) el.textContent += 'スプライトを読み込めませんでした: 龍\n'; done(); };
    im.src = D.img;
  };

  // いまの姿勢 → 絵のずれと傾き
  function xform(st) {
    return {
      dx: -26 * st.lunge - 5 * st.claw + Math.sin(st.t * 0.04) * 1.2,
      dy: 10 * st.lunge - 7 * st.rear + Math.sin(st.wing) * 1.6,
      a: 0.10 * st.rear - 0.05 * st.lunge      // 正 = 頭が上がる（絵は左向きなので、時計回り）
    };
  }
  // 絵の中の点（左上から）→ 足元の基準点からの位置（姿勢をかけたあと）
  function at(st, p) {
    var f = xform(st), x = p[0] - D.feet[0] - PV[0], y = p[1] - D.feet[1] - PV[1], s = Math.sin(f.a), c = Math.cos(f.a);
    return [PV[0] + x * c - y * s + f.dx, PV[1] + x * s + y * c + f.dy];
  }

  function render(st) {
    if (!raw) { raw = R.mk(W, H); ctx = raw.getContext('2d'); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (!img) return raw;
    var f = xform(st), m, r, k;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(OX + f.dx + PV[0], OY + f.dy + PV[1]); ctx.rotate(f.a); ctx.translate(-PV[0], -PV[1]);
    ctx.drawImage(img, -D.feet[0], -D.feet[1]);
    ctx.restore();
    // 口もとの光（口を開けるほど強い。炎を吐いている間は黄色い）
    if (st.jaw > 0.2 || st.fire) {
      m = at(st, D.mouth); r = 5 + st.jaw * 9 + (st.fire ? 4 : 0);
      ctx.globalCompositeOperation = 'lighter';
      for (k = 0; k < 3; k++) {
        ctx.globalAlpha = [0.35, 0.55, 0.9][k]; ctx.fillStyle = st.fire ? ['#ff3a6c', '#ff9a3a', '#fff3b0'][k] : ['#ff2e88', '#ff8ad0', '#ffffff'][k];
        ctx.beginPath(); ctx.arc(OX + m[0], OY + m[1], r * (1 - k * 0.3), 0, PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    // 胸のコアのまたたき
    m = at(st, D.core);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.3 * Math.sin(st.t * 0.2); ctx.fillStyle = '#ffd0ec';
    ctx.beginPath(); ctx.arc(OX + m[0], OY + m[1], 6, 0, PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return raw;
  }

  R.Dragon = {
    w: W, h: H, ox: OX, oy: OY, render: render,
    // 口の位置と、炎の向き（[x, y, 角度]。角度は 0 で真左、正で下向き）
    mouth: function (st) { var m = at(st, D.mouth); return [m[0], m[1], 0.22 + 0.33 * st.lunge - 0.5 * st.rear + (st.aim || 0)]; },
    // 頭の中心（弱点の当たり判定）
    head: function (st) { return at(st, D.head); },
    core: function (st) { return at(st, D.core); }
  };
})();

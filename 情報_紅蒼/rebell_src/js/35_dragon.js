// ボス「玉龍」のドット絵。首・あご・翼・尾・前足が動くので毎フレーム描く。左向き。
// モックに合わせて: 青紫のうろこ、桃色に光る腹と背びれ、まだら模様の赤い翼膜、長い角、大きな爪。
(function () {
  'use strict';
  var R = window.REBELL, lerp = R.lerp, PI = Math.PI;
  var W = 424, H = 292, OX = 200, OY = 272, HS = 1.25, WS = 1.3;      // HS: 頭の倍率、WS: 翼の倍率
  var raw = null, out = null, P = null;
  var C = {
    body: '#34349c', bodyL: '#5560cc', bodyH: '#8a96f2', bodyS: '#1e1c5c', bodyD: '#141242',
    belly: '#d83c8c', bellyL: '#ff7ab8', bellyH: '#ffc4e2', bellyS: '#8a2068',
    wing: '#e0407c', wingL: '#ff6c9a', wingS: '#a8245e', wingD: '#6e1848', wingFar: '#8a1c50', wingFarS: '#5c1238',
    bone: '#2c2c8a', boneL: '#6a74dc', spike: '#ff6ec4', spikeL: '#ffc6ea', spikeS: '#b83888',
    claw: '#fff0f8', clawS: '#f0a8d0', horn: '#ffe2f2', hornS: '#e89ac8',
    eye: '#ff2a3a', eyeL: '#ffe04a', mouth: '#8a1444', fire: '#ff8a3a', fireL: '#fff0a0'
  };

  function rot(p, c, a) { var s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k]; }
  function mid(p, q, c, d) { return [(p[0] + q[0]) / 2 + (c[0] - (p[0] + q[0]) / 2) * d, (p[1] + q[1]) / 2 + (c[1] - (p[1] + q[1]) / 2) * d]; }

  // 翼膜のまだら模様（翼の中の決まった場所に置くので、羽ばたいても模様がずれない）
  var WP = { E: [27, -52], Wr: [78, -74], F1: [136, -46], F2: [116, 4], F3: [74, 30], A: [34, 24] };
  var SPOTS = (function () {
    var r = R.rng(20261123), tris = [['Wr', 'F1', 'F2'], ['Wr', 'F2', 'F3'], ['E', 'Wr', 'F3'], ['E', 'F3', 'A']], list = [], S = [0, 0];
    tris.forEach(function (t, ti) {
      for (var i = 0; i < 9; i++) {
        var a = 0.34 + r() * 0.5, b = (1 - a) * r(), c = 1 - a - b, p0 = WP[t[0]], p1 = WP[t[1]], p2 = WP[t[2]];
        list.push([p0[0] * a + p1[0] * b + p2[0] * c, p0[1] * a + p1[1] * b + p2[1] * c, 1.2 + r() * 3.2, r() < 0.55 ? 0 : (r() < 0.6 ? 1 : 2)]);
      }
    });
    for (var j = 0; j < 6; j++) { var k = 0.25 + r() * 0.5; list.push([WP.E[0] * k + WP.A[0] * (1 - k) * 0.8, WP.E[1] * k + WP.A[1] * (1 - k) * 0.8, 1.5 + r() * 2, 0]); }
    return list;
  })();

  function wing(st, far) {
    var S = far ? [28, -84] : [10, -90], a = Math.sin(st.wing) * 0.26 - 0.2 + (far ? 0.16 : 0) - st.rear * 0.2, k, i, ws = WS * (far ? 0.9 : 1);
    var pts = {};
    for (k in WP) pts[k] = rot([S[0] + WP[k][0] * ws, S[1] + WP[k][1] * ws], S, a);
    var poly = [S, pts.E, pts.Wr, pts.F1, mid(pts.F1, pts.F2, pts.Wr, 0.28), pts.F2, mid(pts.F2, pts.F3, pts.Wr, 0.3), pts.F3, mid(pts.F3, pts.A, pts.E, 0.3), pts.A];
    P.poly(poly, far ? C.wingFar : C.wing);
    if (far) {
      P.poly([pts.E, mid(pts.F3, pts.A, pts.E, 0.4), pts.A, S], C.wingFarS);
    } else {
      // 明るい面と暗い面
      P.poly([pts.Wr, pts.F1, mid(pts.F1, pts.F2, pts.Wr, 0.55), mid(pts.Wr, pts.F2, pts.F1, 0.25)], C.wingL);
      P.poly([pts.E, mid(pts.F3, pts.A, pts.E, 0.42), pts.A, S], C.wingS);
      P.poly([mid(pts.Wr, pts.F2, pts.F3, 0.25), pts.F2, mid(pts.F2, pts.F3, pts.Wr, 0.5), mid(pts.Wr, pts.F3, pts.F2, 0.2)], C.wingS);
      for (i = 0; i < SPOTS.length; i++) {
        var sp = SPOTS[i], q = rot([S[0] + sp[0] * ws, S[1] + sp[1] * ws], S, a);
        P.disc(q[0], q[1], sp[2] * 1.2, sp[3] === 0 ? C.wingS : sp[3] === 1 ? C.wingL : C.wingD);
      }
    }
    // 骨
    var b = far ? C.bodyD : C.bone;
    P.line(S[0], S[1], pts.E[0], pts.E[1], far ? 5 : 7, b); P.line(pts.E[0], pts.E[1], pts.Wr[0], pts.Wr[1], far ? 4 : 5, b);
    P.line(pts.Wr[0], pts.Wr[1], pts.F1[0], pts.F1[1], 3, b); P.line(pts.Wr[0], pts.Wr[1], pts.F2[0], pts.F2[1], 3, b);
    P.line(pts.Wr[0], pts.Wr[1], pts.F3[0], pts.F3[1], 2, b);
    if (!far) {
      P.line(S[0] - 1, S[1] - 3, pts.E[0] - 1, pts.E[1] - 3, 1, C.boneL); P.line(pts.E[0], pts.E[1] - 2, pts.Wr[0], pts.Wr[1] - 2, 1, C.boneL);
      P.line(pts.Wr[0], pts.Wr[1] - 1, lerp(pts.Wr[0], pts.F1[0], 0.7), lerp(pts.Wr[1], pts.F1[1], 0.7) - 1, 1, C.boneL);
      P.disc(pts.E[0], pts.E[1], 4, C.bone); P.px(pts.E[0] - 1, pts.E[1] - 2, C.boneL);
      P.poly([[pts.E[0] - 3, pts.E[1] - 2], [pts.E[0] - 9, pts.E[1] - 12], [pts.E[0] + 2, pts.E[1] - 4]], C.spike);       // ひじのとげ
    }
    // 翼の先の大きな爪
    P.poly([[pts.Wr[0] - 5, pts.Wr[1] + 2], [pts.Wr[0] - 12, pts.Wr[1] - 18], [pts.Wr[0] + 5, pts.Wr[1] - 3]], far ? C.hornS : C.horn);
    if (!far) P.line(pts.Wr[0] - 3, pts.Wr[1] - 2, pts.Wr[0] - 9, pts.Wr[1] - 13, 1, C.hornS);
    P.poly([[pts.F1[0] - 2, pts.F1[1] - 2], [pts.F1[0] + 8, pts.F1[1] + 3], [pts.F1[0] - 1, pts.F1[1] + 3]], far ? C.hornS : C.horn);
  }
  function claws(x, y, dir, n, big) {
    var w = big ? 8 : 6, h = big ? 10 : 6;
    for (var i = 0; i < (n || 3); i++) {
      P.poly([[x + dir * i * w, y - h], [x + dir * (i * w + w + 4), y], [x + dir * i * w, y]], C.claw);
      P.line(x + dir * (i * w + 1), y - 1, x + dir * (i * w + w), y - 1, 1, C.clawS);
    }
  }
  // 鎖のように並べた円で首や尾を描く。うろこの光と、背びれもつける
  function chain(pts, spikes, sz) {
    var i, p;
    for (i = 0; i < pts.length; i++) P.disc(pts[i][0] + 1, pts[i][1] + 3, pts[i][2], C.bodyD);
    for (i = 0; i < pts.length; i++) P.disc(pts[i][0], pts[i][1], pts[i][2], C.body);
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      P.disc(p[0] - 1, p[1] - p[2] * 0.36, p[2] * 0.52, C.bodyL);
      P.disc(p[0], p[1] - p[2] * 0.2, p[2] * 0.42, C.body);
      P.rect(p[0] - 2, p[1] - p[2] * 0.82, 3, 1, C.bodyH);
      P.rect(p[0] - p[2] * 0.7, p[1] + p[2] * 0.25, p[2] * 1.2, 1, C.bodyS);
    }
    if (!spikes) return;
    for (i = 1; i < pts.length - 1; i += spikes) {
      p = pts[i]; var q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dy / L, ny = -dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
      var r = p[2], s = sz * (0.65 + 0.35 * (1 - i / pts.length));
      var tip = [p[0] + nx * (r + s) - dx / L * s * 0.35, p[1] + ny * (r + s) - dy / L * s * 0.35];
      P.poly([[p[0] + nx * (r - 2) - dx / L * 4, p[1] + ny * (r - 2) - dy / L * 4], tip, [p[0] + nx * (r - 2) + dx / L * 4, p[1] + ny * (r - 2) + dy / L * 4]], C.spike);
      P.line(p[0] + nx * r, p[1] + ny * r, tip[0], tip[1], 1, C.spikeL);
    }
  }

  // 頭の位置と向きを決める（当たり判定・炎の出どころにも使う）
  function headState(st) {
    var hx = lerp(-68, -106, st.lunge) + Math.sin(st.t * 0.04) * 2, hy = lerp(-108, -58, st.lunge) - st.rear * 34 + Math.sin(st.t * 0.05) * 3;
    var ha = lerp(0.18, 0.55, st.lunge) - st.rear * 0.5 + (st.aim || 0);
    return { x: hx, y: hy, a: ha };
  }

  function render(st) {
    if (!raw) { raw = R.mk(W, H); out = R.mk(W, H); P = R.painter(raw.getContext('2d')); P.ox = OX; P.oy = OY; }
    P.ctx.clearRect(0, 0, W, H);
    var i, t, hs = headState(st);
    wing(st, true);
    wing(st, false);
    // 尾
    var tail = [];
    for (i = 0; i < 16; i++) {
      t = i / 15;
      tail.push([58 + i * 6.4, -46 + i * i * 0.19 + Math.sin(st.t * 0.07 + i * 0.45) * (2 + i * 0.5) - st.tail * i * 4 * Math.sin(Math.min(1, t * 1.4) * PI * 0.5), 15 - i * 0.8]);
    }
    chain(tail, 2, 11);
    var tp = tail[15]; P.poly([[tp[0] - 1, tp[1] - 7], [tp[0] + 18, tp[1] - 3], [tp[0] - 1, tp[1] + 6]], C.spike); P.line(tp[0], tp[1] - 4, tp[0] + 14, tp[1] - 3, 1, C.spikeL);
    // 奥の後ろ足
    P.disc(64, -32, 16, C.bodyD); P.line(68, -22, 60, -6, 9, C.bodyD); P.rect(44, -9, 26, 9, C.bodyD); claws(34, 0, -1, 3);
    // 胴
    P.ell(26, -58, 49, 32, C.bodyD);
    P.ell(24, -60, 47, 29, C.body);
    P.ell(16, -72, 32, 13, C.bodyL);
    P.ell(22, -72, 28, 10, C.body);
    for (i = 0; i < 36; i++) {       // うろこ
      var row = i / 9 | 0, sx = -14 + (i % 9) * 9 + (row % 2) * 4, sy = -80 + row * 8;
      P.rect(sx, sy, 5, 1, row < 2 ? C.bodyH : C.bodyL); P.px(sx - 1, sy + 1, C.bodyL); P.px(sx + 5, sy + 1, C.bodyL); P.rect(sx + 1, sy + 3, 3, 1, C.bodyS);
    }
    // 胸（前にせり出す）と、桃色に光る腹
    P.ell(-12, -58, 25, 31, C.bodyD); P.ell(-13, -60, 23, 29, C.body); P.ell(-18, -74, 13, 9, C.bodyL); P.ell(-15, -73, 12, 8, C.body);
    P.ell(-18, -50, 13, 24, C.bellyS);
    for (i = 0; i < 7; i++) {
      var by = -72 + i * 7, bw = 11 - Math.abs(i - 3) * 1.2;
      P.ell(-19, by, bw, 3.4, C.belly); P.rect(-19 - bw + 2, by - 2, bw * 1.3, 1, C.bellyL); P.rect(-19 - bw + 3, by - 3, bw * 0.6, 1, C.bellyH);
    }
    // 背中のとげ
    for (i = 0; i < 7; i++) {
      var kx = -2 + i * 11, ky = -88 + i * 1.6;
      P.poly([[kx, ky + 2], [kx + 8, ky - 15 + i], [kx + 12, ky + 3]], C.spike); P.line(kx + 3, ky, kx + 8, ky - 13 + i, 1, C.spikeL);
    }
    // 手前の後ろ足
    P.disc(52, -36, 21, C.bodyD); P.disc(51, -38, 19, C.body); P.disc(46, -44, 10, C.bodyL); P.disc(48, -42, 8, C.body);
    P.rect(40, -50, 6, 1, C.bodyH); P.rect(44, -34, 5, 1, C.bodyL); P.rect(54, -30, 5, 1, C.bodyL); P.rect(38, -28, 5, 1, C.bodyL);
    P.line(60, -22, 47, -8, 11, C.body); P.rect(27, -10, 33, 10, C.body); P.rect(27, -10, 33, 2, C.bodyL); P.rect(30, -4, 26, 1, C.bodyS);
    claws(16, 0, -1, 3, true);
    // 首（胸から頭へ、S 字にカーブ）
    var n0 = [-14, -80], cp = [lerp(-34, -66, st.lunge), lerp(-138, -96, st.lunge) - st.rear * 30], neck = [];
    for (i = 0; i <= 11; i++) {
      t = i / 11;
      neck.push([(1 - t) * (1 - t) * n0[0] + 2 * t * (1 - t) * cp[0] + t * t * hs.x, (1 - t) * (1 - t) * n0[1] + 2 * t * (1 - t) * cp[1] + t * t * hs.y, 21 - t * 8]);
    }
    chain(neck.slice().reverse(), 2, 14);
    for (i = 1; i < neck.length - 1; i++) {       // のどの桃色の板
      var np = neck[i], nq = neck[i + 1], ndx = nq[0] - np[0], ndy = nq[1] - np[1], nL = Math.sqrt(ndx * ndx + ndy * ndy) || 1, ux = -ndy / nL, uy = ndx / nL;
      if (uy < 0) { ux = -ux; uy = -uy; }
      P.disc(np[0] + ux * np[2] * 0.55, np[1] + uy * np[2] * 0.55, np[2] * 0.5, C.belly);
      P.px(np[0] + ux * np[2] * 0.5 - 1, np[1] + uy * np[2] * 0.5 - 1, C.bellyL);
    }
    // 肩の装甲と、手前の前足（爪攻撃で前に伸びる）
    var sh = [-12, -56], paw = [lerp(-40, -84, st.claw), lerp(-7, -46, Math.sin(st.claw * PI))];
    var elb = R.ik(sh[0], sh[1], paw[0], paw[1], 34, 34, 1);
    P.line(sh[0], sh[1], elb[0], elb[1], 19, C.bodyD); P.line(elb[0], elb[1], paw[0], paw[1] - 2, 15, C.bodyD);
    P.line(sh[0], sh[1] - 1, elb[0], elb[1] - 1, 17, C.body); P.line(elb[0], elb[1] - 1, paw[0], paw[1] - 3, 13, C.body);
    P.line(sh[0] - 4, sh[1] - 4, elb[0] - 4, elb[1] - 4, 4, C.bodyL); P.line(elb[0] - 3, elb[1] - 3, paw[0] - 3, paw[1] - 5, 3, C.bodyL);
    P.disc(sh[0], sh[1], 15, C.bodyD); P.disc(sh[0] - 1, sh[1] - 1, 13.5, C.bodyL); P.disc(sh[0], sh[1], 12, C.body);
    P.rect(sh[0] - 7, sh[1] - 8, 6, 2, C.bodyH); P.rect(sh[0] - 9, sh[1] - 4, 2, 4, C.bodyH); P.rect(sh[0] + 2, sh[1] + 3, 5, 1, C.bodyS);
    P.disc(elb[0], elb[1], 9, C.bodyL); P.disc(elb[0] + 1, elb[1] + 1, 8, C.body);
    P.poly([[elb[0] + 4, elb[1] - 4], [elb[0] + 16, elb[1] - 9], [elb[0] + 6, elb[1] + 3]], C.spike);
    P.disc(paw[0], paw[1] - 2, 9, C.bodyD); P.disc(paw[0], paw[1] - 3, 8, C.body); P.rect(paw[0] - 6, paw[1] - 9, 8, 1, C.bodyL);
    claws(paw[0] - 5, paw[1] + 6, -1, 3, true);
    // 弱点の印（胸）
    var wk = (Math.sin(st.t * 0.2) > 0) ? '#ffffff' : '#ffd0ec';
    P.disc(-22, -58, 8, wk); P.disc(-22, -58, 6, C.belly); P.rect(-23, -68, 2, 20, wk); P.rect(-32, -59, 20, 2, wk); P.disc(-22, -58, 2.4, '#ffffff');
    // 頭
    var f = [-Math.cos(hs.a), Math.sin(hs.a)], d = [f[1], -f[0]];
    function hp(u, v) { u *= HS; v *= HS; return [hs.x + f[0] * u + d[0] * v, hs.y + f[1] * u + d[1] * v]; }
    var ja = 0.1 + st.jaw * 0.6, fj = [-Math.cos(hs.a + ja), Math.sin(hs.a + ja)], dj = [fj[1], -fj[0]], hg = hp(0, 3);
    function jp(u, v) { u *= HS; v *= HS; return [hg[0] + fj[0] * u + dj[0] * v, hg[1] + fj[1] * u + dj[1] * v]; }
    function horn(a0, a1, w) { P.line(a0[0], a0[1], lerp(a0[0], a1[0], 0.55), lerp(a0[1], a1[1], 0.55), w, C.hornS); P.line(lerp(a0[0], a1[0], 0.3), lerp(a0[1], a1[1], 0.3), a1[0], a1[1], w - 1, C.horn); }
    // 角・えりのとげ
    horn(hp(-6, -2), hp(-30, -4), 4); horn(hp(-5, -7), hp(-36, -18), 5); horn(hp(-2, -11), hp(-28, -30), 4);
    P.poly([hp(-6, 3), hp(-22, 12), hp(-4, 10)], C.spike); P.poly([hp(-2, 8), hp(-14, 20), hp(3, 12)], C.spikeS);
    // 口の中（いつも少し光っている）
    P.poly([hp(2, 2), hp(33, 3), jp(30, 0), jp(2, 1)], st.fire ? C.fire : C.mouth);
    if (st.jaw > 0.15) P.poly([hp(8, 3), hp(30, 3), jp(27, 0), jp(8, 0)], st.fire ? C.fireL : '#ff5a3a');
    if (st.jaw > 0.4) P.poly([hp(12, 4), hp(26, 4), jp(23, -1), jp(12, -1)], st.fire ? '#ffffff' : C.fire);
    // 下あご
    P.poly([jp(-3, 0), jp(31, 0), jp(29, 5), jp(9, 9), jp(-4, 8)], C.bodyD);
    P.poly([jp(0, 1), jp(29, 1), jp(27, 4), jp(7, 7)], C.body);
    P.line(jp(4, 6)[0], jp(4, 6)[1], jp(24, 4)[0], jp(24, 4)[1], 1, C.belly);
    for (i = 0; i < 6; i++) { var tl = jp(8 + i * 4, 0); P.poly([[tl[0] - 2, tl[1]], [tl[0], tl[1] - 5], [tl[0] + 2, tl[1]]], '#ffffff'); }
    // 上あご・頭
    var sk = hp(0, -3);
    P.disc(sk[0], sk[1], 12 * HS, C.bodyD); P.disc(sk[0], sk[1] - 1, 11 * HS, C.body);
    P.poly([hp(4, -12), hp(32, -6), hp(37, -1), hp(34, 4), hp(4, 4)], C.body);
    P.poly([hp(6, -11), hp(30, -6), hp(28, -4), hp(8, -7)], C.bodyL);
    P.line(hp(8, -10)[0], hp(8, -10)[1], hp(24, -7)[0], hp(24, -7)[1], 1, C.bodyH);
    P.poly([hp(4, 1), hp(34, 2), hp(33, 4), hp(4, 4)], C.bodyS);
    for (i = 0; i < 7; i++) { var tu = hp(9 + i * 4, 4); P.poly([[tu[0] - 2, tu[1]], [tu[0], tu[1] + 5], [tu[0] + 2, tu[1]]], '#ffffff'); }
    var fang = hp(33, 4); P.poly([[fang[0] - 2, fang[1]], [fang[0] - 1, fang[1] + 8], [fang[0] + 3, fang[1]]], '#ffffff');
    var nz = hp(33, -3); P.px(nz[0], nz[1], C.bodyD); P.px(nz[0] + 1, nz[1], C.bodyD);
    // 目（赤く光る）
    var ey = hp(11, -4);
    P.poly([hp(4, -9), hp(18, -6), hp(16, -3), hp(5, -5)], C.bodyD);
    P.rect(ey[0] - 4, ey[1] - 2, 9, 5, C.eye); P.rect(ey[0] - 3, ey[1] - 1, 5, 3, C.eyeL); P.rect(ey[0] - 1, ey[1] - 1, 2, 2, '#ffffff');
    // 鼻先と頭のとげ
    var s1 = hp(26, -7); P.poly([[s1[0] - 3, s1[1] + 1], [s1[0] - 1, s1[1] - 8], [s1[0] + 3, s1[1] + 2]], C.spike);
    var s2 = hp(16, -10); P.poly([[s2[0] - 3, s2[1] + 1], [s2[0] - 2, s2[1] - 7], [s2[0] + 3, s2[1] + 2]], C.spikeS);
    R.outline(raw, R.OUT, out);
    return out;
  }

  R.Dragon = {
    w: W, h: H, ox: OX, oy: OY, render: render,
    mouth: function (st) { var hs = headState(st); return [hs.x - Math.cos(hs.a) * 40 + Math.sin(hs.a) * 5, hs.y + Math.sin(hs.a) * 40 + Math.cos(hs.a) * 5, hs.a]; },
    head: function (st) { var hs = headState(st); return [hs.x - Math.cos(hs.a) * 15, hs.y + Math.sin(hs.a) * 15]; }
  };
})();

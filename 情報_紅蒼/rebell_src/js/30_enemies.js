// 敵（機兵・ドローン・ガーディアン）とアイテム類のドット絵
(function () {
  'use strict';
  var R = window.REBELL, lerp = R.lerp, PI = Math.PI;

  var ROBO = {
    normal: { a: '#ebe6fb', b: '#b2aadc', c: '#7b72b6', d: '#241e50', dL: '#3e377c', o: '#f8b430', oS: '#c07818', eye: '#ff2036', eyeM: '#ff7a86', eyeL: '#ffffff' },
    guard: { a: '#c0b8ff', b: '#8278e0', c: '#4c44a0', d: '#161238', dL: '#2c266a', o: '#ff4fb0', oS: '#a8286e', eye: '#37e6ff', eyeM: '#9af4ff', eyeL: '#ffffff' }
  };

  // 機兵。モックに合わせ、黒いフレームの上に丸い装甲板を重ねた、ずんぐりした体つきにする。
  // s は大きさの倍率（ふつうの機兵 1.3、ガーディアン 1.8）
  function drawRobot(P, C, s, q) {
    var hipx = q.hx || 0, hipy = -q.hy * s, sn = Math.sin(q.lean), cs = Math.cos(q.lean);
    var chx = hipx + sn * 10 * s, chy = hipy - cs * 10 * s;             // 胸の中心
    var shF = [chx + 1 * s, chy - 1 * s], shB = [chx - 5 * s, chy - 1 * s];
    var fF = [q.fF[0] * s, q.fF[1] * s], fB = [q.fB[0] * s, q.fB[1] * s];
    var hF = [q.hF[0] * s, q.hF[1] * s], hB = [q.hB[0] * s, q.hB[1] * s];
    var W = function (v) { return Math.max(2, Math.round(v * s)); };
    // 丸い装甲板（暗→中→明の 3 段と、左上の白い光）
    function plate(x, y, rx, ry, dark) {
      P.ell(x, y, rx * s, ry * s, dark ? C.dL : C.c);
      if (dark) { P.ell(x - 0.5 * s, y - 0.6 * s, (rx - 0.8) * s, (ry - 0.8) * s, C.c); return; }
      P.ell(x - 0.4 * s, y - 0.5 * s, (rx - 0.7) * s, (ry - 0.7) * s, C.b);
      P.ell(x - 1.1 * s, y - 1.4 * s, rx * 0.46 * s, ry * 0.4 * s, C.a);
      P.rect(x - rx * 0.55 * s, y - ry * 0.62 * s, Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), '#ffffff');
    }
    function lamp(x, y, r) {      // 赤く光る目
      P.disc(x, y, (r + 1) * s, C.d); P.disc(x, y, r * s, C.eye); P.disc(x, y, r * 0.55 * s, C.eyeM);
      P.rect(x - 0.5 * s, y - 0.9 * s, Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), C.eyeL);
    }
    function claw(h, dark) {
      var c = dark ? C.c : C.a;
      P.disc(h[0], h[1], 2.6 * s, C.d);
      P.line(h[0], h[1] - 1 * s, h[0] + 4.5 * s, h[1] - 2.5 * s, W(1.6), c);
      P.line(h[0] + 1 * s, h[1] + 1 * s, h[0] + 5 * s, h[1] + 1 * s, W(1.6), c);
      P.line(h[0], h[1] + 2 * s, h[0] + 3 * s, h[1] + 4.5 * s, W(1.6), c);
    }
    function foot(f, dark) {
      P.rect(f[0] - 4 * s, f[1] - 1.5 * s, 11 * s, 4.5 * s, dark ? C.dL : C.c);
      if (!dark) { P.rect(f[0] - 4 * s, f[1] - 1.5 * s, 10 * s, 2.5 * s, C.b); P.rect(f[0] - 3 * s, f[1] - 1.5 * s, 6 * s, 1 * s, C.a); }
      P.rect(f[0] + 4 * s, f[1] - 0.5 * s, 4 * s, 3.5 * s, dark ? C.oS : C.o);
      if (!dark) P.rect(f[0] + 4 * s, f[1] - 0.5 * s, 3 * s, 1 * s, '#ffe9a0');
    }
    var j, m;
    // 奥の腕
    j = R.ik(shB[0], shB[1], hB[0], hB[1], 7 * s, 8 * s, 1);
    P.bar(shB[0], shB[1], j[0], j[1], W(3), C.d); P.bar(j[0], j[1], hB[0], hB[1], W(3), C.d);
    plate(lerp(j[0], hB[0], 0.45), lerp(j[1], hB[1], 0.45), 3.2, 3.2, true);
    claw(hB, true);
    // 奥の脚
    j = R.ik(hipx - 3 * s, hipy, fB[0], fB[1], 8 * s, 8 * s, -1);
    P.bar(hipx - 3 * s, hipy, j[0], j[1], W(4), C.d); P.bar(j[0], j[1], fB[0], fB[1], W(4), C.d);
    plate(lerp(hipx - 3 * s, j[0], 0.5), lerp(hipy, j[1], 0.5), 3.6, 4, true);
    plate(lerp(j[0], fB[0], 0.5), lerp(j[1], fB[1], 0.5), 3.2, 4.2, true);
    foot(fB, true);
    // 腰と胴のフレーム
    P.bar(hipx, hipy - 1 * s, chx, chy + 2 * s, W(7), C.d);
    P.ell(hipx, hipy, 5.5 * s, 3.5 * s, C.d);
    P.rect(hipx - 3 * s, hipy - 1.5 * s, 7 * s, 2 * s, C.o); P.rect(hipx - 3 * s, hipy - 1.5 * s, 7 * s, Math.max(1, Math.round(0.7 * s)), '#ffe9a0');
    // 背中のポッド（もう 1 つの赤い灯）
    plate(chx - 4.5 * s, chy - 3 * s, 6.8, 6);
    lamp(chx - 5 * s, chy - 2.5 * s, 2 * (q.eye || 1));
    P.rect(chx - 9 * s, chy + 1 * s, 4 * s, 1.5 * s, C.o);
    // 胸の装甲
    plate(chx + 3 * s, chy + 1.5 * s, 5.5, 5);
    P.rect(chx + 1 * s, chy + 4.5 * s, 5 * s, 1 * s, C.d);
    // 手前の脚
    j = R.ik(hipx + 2 * s, hipy, fF[0], fF[1], 8 * s, 8 * s, -1);
    P.bar(hipx + 2 * s, hipy, j[0], j[1], W(4), C.d); P.bar(j[0], j[1], fF[0], fF[1], W(4), C.d);
    plate(lerp(hipx + 2 * s, j[0], 0.5), lerp(hipy, j[1], 0.5), 4, 4.6);
    plate(lerp(j[0], fF[0], 0.55), lerp(j[1], fF[1], 0.55), 3.6, 4.6);
    P.disc(j[0], j[1], 2.3 * s, C.oS); P.disc(j[0], j[1] - 0.5 * s, 1.6 * s, C.o);
    foot(fF, false);
    // 頭（丸いドーム。前下がりの黒い顔に赤い目）
    var hdx = chx + 6 * s + sn * 4 * s, hdy = chy - 7.5 * s;
    P.disc(hdx, hdy, 6.5 * s, C.c);
    P.disc(hdx - 0.5 * s, hdy - 0.6 * s, 5.7 * s, C.b);
    P.ell(hdx - 1.6 * s, hdy - 3 * s, 3.4 * s, 2 * s, C.a);
    P.rect(hdx - 4 * s, hdy - 4.4 * s, 3 * s, Math.max(1, Math.round(s)), '#ffffff');
    P.poly([[hdx - 1 * s, hdy + 0.5 * s], [hdx + 6.5 * s, hdy - 1.5 * s], [hdx + 6.5 * s, hdy + 3.5 * s], [hdx + 3 * s, hdy + 6 * s], [hdx - 1 * s, hdy + 5 * s]], C.d);
    lamp(hdx + 3.4 * s, hdy + 2.2 * s, 2.2 * (q.eye || 1));
    P.rect(hdx - 5.5 * s, hdy + 4 * s, 4 * s, 1.5 * s, C.o);
    // 手前の腕
    j = R.ik(shF[0], shF[1], hF[0], hF[1], 7 * s, 8 * s, 1);
    P.bar(shF[0], shF[1], j[0], j[1], W(3), C.d); P.bar(j[0], j[1], hF[0], hF[1], W(3), C.d);
    plate(lerp(shF[0], j[0], 0.4), lerp(shF[1], j[1], 0.4), 3.6, 3.8);
    plate(lerp(j[0], hF[0], 0.45), lerp(j[1], hF[1], 0.45), 3.4, 3.6);
    P.disc(j[0], j[1], 1.8 * s, C.o);
    claw(hF, false);
  }  function robotAnims() {
    var G = -3, A = {};
    A.walk = {
      n: 6, fps: 8, loop: true, f: function (i) {
        var th = i / 6 * PI * 2, s = Math.sin(th), c = Math.cos(th);
        return { hy: 15 + Math.abs(s), lean: 0.28, fF: [6 * c + 1, G - Math.max(0, -s) * 4], fB: [-6 * c - 1, G - Math.max(0, s) * 4], hF: [12 - 2 * c, -11], hB: [3 + 2 * c, -10] };
      }
    };
    A.attack = {
      n: 5, f: function (i) {
        return [
          { hy: 15, lean: 0.1, fF: [5, G], fB: [-6, G], hF: [-2, -20], hB: [6, -12], eye: 1.3 },
          { hy: 15, lean: 0.05, fF: [5, G], fB: [-6, G], hF: [-6, -24], hB: [7, -13], eye: 1.5 },
          { hy: 14, lean: 0.45, fF: [8, G], fB: [-7, G], hF: [20, -18], hB: [2, -10], eye: 1.3 },
          { hy: 14, lean: 0.5, fF: [8, G], fB: [-7, G], hF: [22, -16], hB: [2, -10] },
          { hy: 15, lean: 0.3, fF: [6, G], fB: [-6, G], hF: [14, -12], hB: [3, -10] }
        ][i];
      }
    };
    A.slam = {      // ガーディアンの叩きつけ
      n: 5, f: function (i) {
        return [
          { hy: 16, lean: -0.1, fF: [5, G], fB: [-6, G], hF: [4, -30], hB: [-2, -28], eye: 1.4 },
          { hy: 17, lean: -0.2, fF: [5, G], fB: [-6, G], hF: [2, -34], hB: [-4, -32], eye: 1.6 },
          { hy: 13, lean: 0.55, fF: [8, G], fB: [-7, G], hF: [18, -6], hB: [12, -5], eye: 1.3 },
          { hy: 13, lean: 0.55, fF: [8, G], fB: [-7, G], hF: [18, -5], hB: [12, -4] },
          { hy: 15, lean: 0.3, fF: [6, G], fB: [-6, G], hF: [14, -11], hB: [4, -10] }
        ][i];
      }
    };
    A.hurt = { n: 1, f: function () { return { hy: 15, lean: -0.3, fF: [5, G], fB: [-5, G], hF: [4, -22], hB: [-6, -16], eye: 0.6 }; } };
    return A;
  }
  function bakeRobot(kind, s, w, h, ox, oy) {
    var A = robotAnims(), out = { ox: ox, oy: oy, w: w, h: h };
    for (var k in A) {
      var fr = [];
      for (var i = 0; i < A[k].n; i++) {
        var raw = R.mk(w, h), P = R.painter(raw.getContext('2d')); P.ox = ox; P.oy = oy;
        drawRobot(P, ROBO[kind], s, A[k].f(i));
        fr.push(R.outline(raw));
      }
      out[k] = { frames: fr, n: A[k].n, fps: A[k].fps || 10, loop: !!A[k].loop };
    }
    return out;
  }
  function bakeDrone() {
    var fr = [];
    for (var i = 0; i < 2; i++) {
      var raw = R.mk(32, 32), P = R.painter(raw.getContext('2d')); P.ox = 16; P.oy = 16;
      P.rect(-12, -2, 24, 3, '#6a6498'); P.rect(-13, -3, 4, 5, '#9d97c4'); P.rect(9, -3, 4, 5, '#9d97c4');     // 羽
      P.disc(0, 0, 7, '#9d97c4'); P.disc(-1, -1, 5.6, '#cfc9e4');
      P.rect(-3, -6, 3, 1, '#ffffff');
      P.rect(-6, 0, 13, 3, '#2c2752');
      P.disc(2, 1, 2.4, '#37e6ff'); P.px(2, 0, '#e8fdff');
      P.rect(0, -11, 1, 4, '#9d97c4'); P.px(0, -12, '#ff4fb0');
      P.rect(-2, 7, 4, 2 + i * 2, i ? '#ff7ad1' : '#ff4fb0'); P.rect(-1, 9 + i * 2, 2, 2, '#ffd0ec');           // 噴射
      fr.push(R.outline(raw));
    }
    return { ox: 16, oy: 16, w: 32, h: 32, fly: { frames: fr, n: 2, fps: 10, loop: true } };
  }

  // ---- アイテム・仕掛け ----
  function bakeItems() {
    var S = {}, raw, P, i;
    // クリスタル（青い菱形）: 4 コマで光がまわる
    S.crystal = [];
    for (i = 0; i < 4; i++) {
      raw = R.mk(15, 19); P = R.painter(raw.getContext('2d'));
      P.poly([[7.5, 0], [14, 9], [7.5, 19], [1, 9]], '#1a8fe0');
      P.poly([[7.5, 2], [12, 9], [7.5, 16], [3, 9]], '#37c6ff');
      P.poly([[7.5, 2], [7.5, 16], [3, 9]], '#7ae8ff');
      P.rect(7, 4 + i * 2, 1, 4, '#ffffff'); P.rect(5 + (i % 2), 8, 4, 1, '#ffffff');
      S.crystal.push(R.outline(raw, '#0c2f8a'));
    }
    // ポーション（赤いフラスコ）
    raw = R.mk(13, 16); P = R.painter(raw.getContext('2d'));
    P.rect(5, 1, 4, 2, '#c8a070'); P.rect(5, 3, 4, 3, '#e8f4ff'); P.disc(6.5, 10, 5, '#e8f4ff'); P.disc(6.5, 10.5, 4, '#ff3a5c');
    P.rect(3, 7, 8, 2, '#e8f4ff'); P.rect(4, 9, 2, 2, '#ffb0c0'); P.rect(8, 12, 2, 1, '#a81838');
    S.potion = R.outline(raw);
    // 宝箱（閉・開）
    S.chest = [];
    for (i = 0; i < 2; i++) {
      raw = R.mk(26, 22); P = R.painter(raw.getContext('2d'));
      P.rect(2, 10, 22, 11, '#b8782a'); P.rect(2, 10, 22, 2, '#e8a840'); P.rect(2, 19, 22, 2, '#7a4a18');
      P.rect(2, 10, 2, 11, '#ffd36a'); P.rect(22, 10, 2, 11, '#ffd36a'); P.rect(11, 12, 4, 5, '#ffd36a'); P.px(12, 14, '#7a4a18');
      if (i === 0) { P.rect(2, 4, 22, 6, '#c8882e'); P.rect(3, 3, 20, 1, '#e8a840'); P.rect(2, 4, 2, 6, '#ffd36a'); P.rect(22, 4, 2, 6, '#ffd36a'); P.rect(2, 9, 22, 1, '#7a4a18'); }
      else { P.rect(3, 1, 20, 4, '#7a4a18'); P.rect(3, 0, 20, 2, '#c8882e'); P.rect(4, 6, 18, 4, '#fff3b0'); P.rect(6, 5, 14, 2, '#ffffff'); }
      S.chest.push(R.outline(raw));
    }
    // 端末（チェックポイント）: 石の台座の上にシアンのホログラム。2 コマ
    S.terminal = [];
    for (i = 0; i < 2; i++) {
      raw = R.mk(34, 56); P = R.painter(raw.getContext('2d'));
      P.rect(4, 44, 26, 12, '#3d3868'); P.rect(2, 52, 30, 4, '#2f2b55'); P.rect(4, 44, 26, 2, '#8078b8'); P.rect(6, 47, 22, 1, '#24213f');
      P.rect(6, 10, 22, 4, '#4f4984'); P.rect(6, 40, 22, 4, '#4f4984'); P.rect(6, 10, 22, 1, '#a39bd0');
      P.rect(7, 14, 20, 26, i ? '#1aa6c8' : '#168fb0');
      P.rect(9, 16, 16, 22, i ? '#37e6ff' : '#2cc8e6');
      P.rect(10, 17, 14, 20, '#0d5a78');
      P.disc(17, 27, 6, '#7af3ff'); P.disc(17, 27, 4.5, '#0d5a78'); P.disc(17, 27, 1.6, '#e8fdff');
      P.rect(16, 19, 2, 16, '#7af3ff'); P.rect(9, 26, 16, 2, '#7af3ff'); P.disc(17, 27, 2.4, '#0d5a78'); P.disc(17, 27, 1.2, '#ffffff');
      P.rect(7, 14, 1, 26, '#bff8ff'); P.rect(26, 14, 1, 26, '#0d6a8a');
      S.terminal.push(R.outline(raw));
    }
    // 敵の弾
    raw = R.mk(9, 9); P = R.painter(raw.getContext('2d'));
    P.disc(4, 4, 4, '#ff2e88'); P.disc(4, 4, 2.6, '#ff9ad0'); P.disc(4, 4, 1.2, '#ffffff');
    S.bullet = raw;
    // 火球
    raw = R.mk(17, 17); P = R.painter(raw.getContext('2d'));
    P.disc(8, 8, 8, '#ff3a5c'); P.disc(8, 8, 6, '#ff8a3a'); P.disc(7, 7, 4, '#ffd36a'); P.disc(7, 7, 2, '#ffffff');
    S.fireball = raw;
    return S;
  }

  R.buildEnemies = function () {
    R.SPR.robot = bakeRobot('normal', 1.3, 104, 84, 44, 76);
    R.SPR.guard = bakeRobot('guard', 1.8, 150, 122, 62, 112);
    R.SPR.drone = bakeDrone();
    R.SPR.items = bakeItems();
  };
})();

// ステージの地形データと、地形・遠景のドット絵
(function () {
  'use strict';
  var R = window.REBELL, GY = R.GY;
  var ST = ['#24213f', '#2f2b55', '#3d3868', '#4f4984', '#655e9e', '#8078b8', '#a39bd0'];

  R.STAGES = [
    {
      id: 'city', title: '第一章　ネオン廃都の水道橋', sub: 'STAGE 1  -  NEON RUINS AQUEDUCT', bgm: 'city', len: 3840,
      // 高低差のある地形: blocks = 石の段 [x, 幅, 高さ]（地面から積み上がった、乗れる壁）、spikes = トゲ [x, 幅]、plats = 下からすり抜けられる足場 [x, y, 幅]
      // 段の高さは、ひとつ前の足場から 48 ドット以内（1 回のジャンプで届く）。穴は 100〜120 ドット（途中の足場か、二段ジャンプで越える）。
      // 落ちると即ゲームオーバーなので、穴の手前には 40 ドット以上の助走を残す
      ground: [[0, 880], [990, 1480], [1600, 2290], [2390, 3840]],
      blocks: [[300, 48, 24], [348, 44, 48], [640, 60, 36], [780, 56, 44],
      [1060, 60, 40], [1120, 72, 72], [1372, 52, 48],
      [1730, 56, 32], [1786, 56, 64], [1842, 72, 96], [2196, 48, 44],
      [2470, 64, 48], [2760, 84, 56]],
      spikes: [[708, 44], [1300, 48], [1930, 56], [2100, 48], [2852, 44]],
      plats: [[906, 156, 60], [1218, 96, 60], [1500, 152, 40], [1552, 128, 40], [1940, 122, 56], [2030, 96, 56], [2318, 142, 46],
      [2560, 112, 56], [2650, 84, 56], [3180, 138, 64], [3560, 138, 64]],
      enemies: [['robot', 560], ['robot', 668], ['drone', 730, 96], ['robot', 770], ['drone', 935, 100],
      ['drone', 1100, 70], ['robot', 1156], ['robot', 1260], ['drone', 1330, 100], ['robot', 1440], ['drone', 1540, 84],
      ['robot', 1700], ['robot', 1878], ['drone', 1970, 70], ['robot', 2040], ['robot', 2170], ['drone', 2250, 96], ['drone', 2340, 104],
      ['robot', 2440], ['drone', 2600, 60], ['robot', 2700], ['robot', 2800], ['drone', 2700, 50], ['robot', 2910]],
      items: [['crystal', 370, 126], ['crystal', 808, 130], ['crystal', 935, 134], ['crystal', 1156, 100], ['chest', 1248, 96],
      ['crystal', 1520, 132], ['crystal', 1572, 108], ['crystal', 1878, 76], ['crystal', 1968, 102], ['chest', 2058, 96],
      ['crystal', 2341, 122], ['crystal', 2588, 92], ['crystal', 2678, 64], ['potion', 2802, 122], ['potion', 2980, 176]],
      checkpoints: [150, 1650, 2920],
      ruins: [[24, 3], [1610, 2], [2880, 2], [3700, 1]],
      boss: { type: 'guard', x: 3560, arena: [3040, 3800], trigger: 3130, name: '重機兵ガーディアン', sub: 'HEAVY GUARDIAN' }
    },
    {
      id: 'school', title: '第二章　玉龍学園　紅い月の下で', sub: 'STAGE 2  -  GYOKURYU ACADEMY', bgm: 'school', len: 3360,
      ground: [[0, 1080], [1190, 1990], [2090, 3360]],
      blocks: [[420, 56, 28], [476, 56, 56], [690, 64, 44], [840, 48, 36], [888, 52, 72],
      [1250, 44, 40], [1580, 60, 56], [1640, 72, 92], [1896, 44, 40]],
      spikes: [[560, 48], [980, 56], [1716, 52], [1810, 52]],
      plats: [[610, 120, 50], [1112, 152, 52], [1300, 150, 56], [1400, 114, 64], [1490, 84, 56], [1740, 94, 56], [1836, 122, 56],
      [2018, 150, 50], [2790, 136, 60], [2930, 136, 60]],
      enemies: [['robot', 380], ['robot', 504], ['drone', 620, 80], ['robot', 722], ['robot', 800], ['drone', 780, 96], ['robot', 914], ['drone', 1010, 84], ['drone', 1135, 100],
      ['robot', 1310], ['drone', 1440, 60], ['robot', 1460], ['robot', 1540], ['robot', 1676], ['drone', 1700, 50], ['drone', 1790, 76], ['robot', 1880], ['drone', 1960, 90], ['drone', 2040, 100]],
      items: [['crystal', 504, 114], ['crystal', 635, 98], ['crystal', 914, 98], ['crystal', 1138, 130], ['crystal', 1328, 128], ['chest', 1432, 114], ['crystal', 1518, 62],
      ['crystal', 1676, 78], ['chest', 1768, 94], ['crystal', 1864, 100], ['crystal', 2043, 128], ['crystal', 2820, 114], ['crystal', 2960, 114]],
      checkpoints: [340, 2150, 2704],
      sakura: [96, 1240, 2170, 2600],
      gate: 196,
      // 中ボス: 桜の下で立ちはだかる空手使い（一騎打ち。画面 1 枚ぶんの広さで、カメラは動かない）。
      // ここにいた機兵 2 体とドローン 1 体・薬は外し、薬は中ボスが置いていく。3 つ目の端末は、中ボスの先（龍の手前）へ移した
      mid: { type: 'karate', x: 2545, arena: [2190, 2670], trigger: 2300, name: '黒瀬 龍士', sub: 'MID BOSS  -  KUROSE RYUJI', bgm: 'midboss' },
      boss: { type: 'dragon', x: 3170, arena: [2740, 3360], trigger: 2830, name: '玉　龍', sub: 'GYOKURYU  -  THE JADE DRAGON' }
    }
  ];

  // 石積みの壁
  function bricks(P, r, x, y, w, h, bright) {
    var c = P.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    var o = bright ? 1 : 0;
    P.rect(x, y, w, h, ST[1 + o]);
    for (var by = y, row = 0; by < y + h; by += 8, row++) {
      for (var bx = x - (row % 2) * 8 - (x % 16); bx < x + w; bx += 16) {
        var k = r();
        P.rect(bx, by, 15, 7, ST[(k < 0.25 ? 1 : k < 0.75 ? 2 : 3) + o]);
        P.rect(bx, by, 15, 1, ST[(k < 0.5 ? 3 : 4) + o]);
        if (k > 0.9) P.rect(bx + 3, by + 3, 4, 2, ST[1 + o]);
        if (k < 0.08) P.rect(bx + 6, by + 2, 5, 3, ST[4 + o]);
      }
    }
    c.restore();
  }
  function moss(P, r, x0, x1, y) {
    for (var x = x0; x < x1; x += 3) {
      if (r() < 0.16) {
        var n = 2 + (r() * 5 | 0);
        for (var i = 0; i < n; i++) P.rect(x + (r() * 5 | 0), y + i, 1 + (r() * 2 | 0), 1, r() < 0.5 ? '#5d6a3a' : '#3f4a2c');
      }
    }
  }
  function platform(P, x, y, w, school) {
    P.rect(x, y, w, 8, ST[3]); P.rect(x, y, w, 1, school ? '#ffe0f6' : '#f6d2ff'); P.rect(x, y + 1, w, 1, ST[5]);
    P.rect(x, y + 6, w, 2, ST[1]);
    for (var i = x + 6; i < x + w - 4; i += 12) P.rect(i, y + 3, 1, 3, ST[1]);
    P.rect(x + 2, y + 8, w - 4, 1, '#37e6ff'); P.rect(x + 6, y + 9, w - 12, 1, '#1aa6c8');
    P.rect(x + 3, y + 10, 3, 3, '#7af3ff'); P.rect(x + w - 6, y + 10, 3, 3, '#7af3ff');
    P.px(x + 4, y + 13, '#37e6ff'); P.px(x + w - 5, y + 13, '#37e6ff');
  }
  // 石の段（地面から積み上がった、乗れる壁）
  function block(P, r, x, h, w) {
    var y = GY - h;
    bricks(P, r, x, y, w, h, true);
    P.rect(x, y, 2, h, ST[5]); P.rect(x + w - 2, y, 2, h, ST[1]);
    P.rect(x, y, w, 1, '#ffe2ff'); P.rect(x, y + 1, w, 1, '#c79ae8'); P.rect(x, y + 2, w, 1, ST[4]);
    moss(P, r, x, x + w, y + 3);
  }
  // トゲ（桃色に光る結晶の牙）
  function spikes(P, x, w) {
    for (var i = 0; i + 6 <= w; i += 6) {
      P.poly([[x + i, GY], [x + i + 3, GY - 9], [x + i + 6, GY]], '#ff2e88');
      P.poly([[x + i + 2, GY], [x + i + 3, GY - 7], [x + i + 4, GY]], '#ffb0e0');
      P.px(x + i + 3, GY - 9, '#ffffff');
    }
  }
  function terrain(P, r, S) {
    (S.blocks || []).forEach(function (b) { block(P, r, b[0], b[2], b[1]); });
    (S.spikes || []).forEach(function (k) { spikes(P, k[0], k[1]); });
  }
  // 崩れた石のアーチ（ステージ1 冒頭の遺跡）
  function ruin(P, r, x, n, banner) {
    var span = 78, pw = 20, top = 46, w = n * span + pw, c = P.ctx, i, k;
    bricks(P, r, x, top, w, GY - top, true);
    c.globalCompositeOperation = 'destination-out';
    for (i = 0; i < n; i++) {
      var ax = x + pw + i * span, aw = span - pw;
      P.rect(ax, 108, aw, GY - 108, '#000'); P.ell(ax + aw / 2 - 0.5, 108, aw / 2, 30, '#000');
    }
    for (k = x; k < x + w; k += 6) { if (r() < 0.55) P.rect(k, top, 6, 2 + (r() * 9 | 0), '#000'); }     // 崩れた上端
    P.rect(x + w - 10, top, 10, 20 + (r() * 20 | 0), '#000');
    c.globalCompositeOperation = 'source-over';
    for (i = 0; i <= n; i++) {       // 柱の陰影
      var px = x + i * span;
      P.rect(px, 110, 2, GY - 110, ST[5]); P.rect(px + pw - 3, 110, 3, GY - 110, ST[1]);
      P.rect(px - 2, 104, pw + 4, 5, ST[4]); P.rect(px - 2, 104, pw + 4, 1, ST[6]); P.rect(px - 2, GY - 6, pw + 4, 6, ST[3]); P.rect(px - 2, GY - 6, pw + 4, 1, ST[5]);
    }
    moss(P, r, x, x + w, top + 10);
    for (i = 0; i < n * 3; i++) {      // つた
      var vx = x + (r() * w | 0), vl = 10 + (r() * 34 | 0);
      for (k = 0; k < vl; k += 2) P.rect(vx + Math.round(Math.sin(k * 0.4 + i) * 1.5), top + 12 + k, 2, 2, k % 4 ? '#4a5a34' : '#6a7a40');
    }
    if (banner) for (i = 0; i < n; i += 2) c.drawImage(banner, x + pw + i * span + 20, 86);
  }

  function buildCity(S, BG) {
    var cv = R.mk(S.len, R.H), P = R.painter(cv.getContext('2d')), r = R.rng(7741), i, x;
    S.ruins.forEach(function (q) { ruin(P, r, q[0], q[1], BG.banner); });
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      // 欄干
      for (x = x0 + 10; x < x1 - 6; x += 40) { P.rect(x, 175, 5, 17, ST[2]); P.rect(x, 175, 1, 17, ST[4]); P.rect(x - 1, 173, 7, 2, ST[3]); P.rect(x - 1, 173, 7, 1, ST[5]); }
      P.rect(x0 + 6, 179, w - 12, 2, ST[2]); P.rect(x0 + 6, 179, w - 12, 1, ST[4]); P.rect(x0 + 6, 186, w - 12, 1, ST[1]);
      // 橋の下のトラス
      for (x = x0; x < x1; x += 32) {
        P.rect(x, GY + 20, 3, 58, '#17143a'); P.line(x + 1, GY + 22, x + 32, GY + 52, 2, '#17143a'); P.line(x + 32, GY + 22, x + 1, GY + 52, 2, '#17143a');
        P.rect(x, GY + 20, 1, 58, '#2a2660');
      }
      P.rect(x0, GY + 52, w, 4, '#17143a'); P.rect(x0, GY + 52, w, 1, '#2f2b66');
      for (x = x0 + 48; x < x1 - 20; x += 96) {      // ピンクの灯り
        P.rect(x, GY + 26, 3, 3, '#ff7ad1'); P.rect(x + 4, GY + 26, 3, 3, '#ff7ad1'); P.rect(x, GY + 28, 7, 3, '#ff4fb0'); P.rect(x + 1, GY + 31, 5, 2, '#d9368f'); P.rect(x + 2, GY + 33, 3, 1, '#d9368f');
      }
      // 橋げたと橋脚
      bricks(P, r, x0, GY, w, 17, true);
      P.rect(x0, GY + 17, w, 5, ST[1]); P.rect(x0, GY + 17, w, 1, ST[4]);
      bricks(P, r, x0, GY + 17, 16, 62, false); bricks(P, r, x1 - 16, GY + 17, 16, 62, false);
      for (x = x0 + 208; x < x1 - 120; x += 208) bricks(P, r, x, GY + 17, 18, 62, false);
      P.rect(x0, GY, w, 1, '#ffe2ff'); P.rect(x0, GY + 1, w, 1, '#c79ae8'); P.rect(x0, GY + 2, w, 1, ST[4]);
      for (x = x0; x < x1; x += 5) if (r() < 0.3) P.rect(x, GY, 2 + (r() * 4 | 0), 1, '#ff9ad8');
      moss(P, r, x0, x1, GY + 3); moss(P, r, x0, x1, GY + 18);
    });
    terrain(P, r, S);
    S.plats.forEach(function (p) { platform(P, p[0], p[1], p[2], false); });
    return cv;
  }

  function buildSchool(S, BG) {
    var cv = R.mk(S.len, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(9931), x, i;
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      // 奥の柵
      for (x = x0 + 6; x < x1 - 6; x += 30) { P.rect(x, 168, 6, 24, ST[1]); P.rect(x, 168, 1, 24, ST[3]); P.rect(x - 1, 166, 8, 2, ST[2]); }
      P.rect(x0 + 4, 173, w - 8, 3, ST[1]); P.rect(x0 + 4, 173, w - 8, 1, ST[3]); P.rect(x0 + 4, 182, w - 8, 3, ST[1]); P.rect(x0 + 4, 182, w - 8, 1, ST[3]);
    });
    S.sakura.forEach(function (sx) { c.drawImage(BG.sakura, sx - BG.sakuraBase.x, GY - BG.sakuraBase.y); });
    c.drawImage(BG.gate, S.gate, GY - 60);
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      bricks(P, r, x0, GY + 8, w, 70, false);
      for (x = x0 + 60; x < x1 - 40; x += 104) {      // 石橋のアーチ
        P.ell(x, R.H + 4, 30, 44, ST[4]); P.ell(x, R.H + 4, 27, 41, '#100e2a');
        P.ell(x, R.H + 10, 20, 30, '#1b1740');
      }
      // ぬれた路面にネオンが映る
      P.rect(x0, GY, w, 8, '#4a3f8c');
      for (x = x0; x < x1; x += 2) {
        var k = r();
        if (k < 0.5) P.rect(x, GY + 1 + (r() * 7 | 0), 2 + (r() * 7 | 0), 1, k < 0.2 ? '#ff7ad1' : k < 0.3 ? '#37e6ff' : k < 0.4 ? '#8a6ad0' : '#6a55b4');
      }
      P.rect(x0, GY, w, 1, '#ffe6f8'); P.rect(x0, GY + 1, w, 1, '#d8a6ee');
      for (x = x0; x < x1; x += 4) if (r() < 0.35) P.rect(x, GY, 2 + (r() * 5 | 0), 1, '#ff9ad8');
      P.rect(x0, GY + 8, w, 2, ST[4]); P.rect(x0, GY + 10, w, 1, ST[0]);
      bricks(P, r, x0, GY + 8, 14, 70, true); bricks(P, r, x1 - 14, GY + 8, 14, 70, true);
    });
    terrain(P, r, S);
    S.plats.forEach(function (p) { platform(P, p[0], p[1], p[2], true); });
    return cv;
  }

  // ステージ1 の中景: 二段アーチの水道橋（左右がつながる 960px）。石積みの目地・アーチのふち・灯りまで描き込む
  function buildViaduct() {
    var cv = R.mk(960, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(4242), x, y, i;
    function tier(y0, pierW, span, deck, pal, bottom, lights) {
      var top = y0 + deck, aw = span - pierW, ar = aw / 2, ay = top + ar + 5;
      // 壁（石積み）
      P.rect(0, top, 960, bottom - top, pal[1]);
      for (y = top; y < bottom; y += 6) {
        for (x = -((y / 6 | 0) % 2) * 6; x < 960; x += 12) {
          var k = r();
          P.rect(x, y, 11, 5, k < 0.3 ? pal[0] : k < 0.8 ? pal[1] : pal[2]);
          if (k > 0.86) P.rect(x + 2, y + 1, 5, 1, pal[3]);
        }
      }
      // アーチのふち（明るい石）を描いてから、開口部を抜く
      for (x = 0; x < 960; x += span) {
        P.ell(x + pierW + ar - 0.5, ay, ar + 2, ar + 2, pal[3]); P.rect(x + pierW - 2, ay, aw + 4, bottom - ay, pal[3]);
      }
      c.globalCompositeOperation = 'destination-out';
      for (x = 0; x < 960; x += span) { P.rect(x + pierW, ay, aw, 300, '#000'); P.ell(x + pierW + ar - 0.5, ay, ar, ar, '#000'); }
      c.globalCompositeOperation = 'source-over';
      // 橋げた
      P.rect(0, y0, 960, deck, pal[2]); P.rect(0, y0, 960, 1, pal[4]); P.rect(0, y0 + 1, 960, 1, pal[3]); P.rect(0, top - 2, 960, 2, pal[0]);
      for (x = 0; x < 960; x += 8) P.rect(x, y0 + 3, 1, deck - 5, pal[1]);
      // 橋脚の陰影と灯り
      for (x = 0; x < 960; x += span) {
        P.rect(x, top, 2, bottom - top, pal[3]); P.rect(x + pierW - 2, top, 2, bottom - top, pal[0]);
        P.rect(x - 2, ay - 1, pierW + 4, 3, pal[3]); P.rect(x - 2, ay - 1, pierW + 4, 1, pal[4]);
        if (lights && r() < 0.75) {
          var lc = r() < 0.5 ? ['#ff4fb0', '#ffb0e0'] : ['#37e6ff', '#c0f8ff'], ly = top + 10 + (r() * 14 | 0);
          P.rect(x + (pierW >> 1) - 1, ly, 3, 4, lc[0]); P.rect(x + (pierW >> 1), ly + 1, 1, 2, lc[1]);
        }
      }
      // 欄干と、ところどころ崩れた縁
      P.rect(0, y0 - 6, 960, 1, pal[2]); P.rect(0, y0 - 6, 960, 1, pal[3]);
      for (x = 4; x < 960; x += 16) { P.rect(x, y0 - 6, 2, 6, pal[2]); P.px(x, y0 - 6, pal[4]); }
      c.globalCompositeOperation = 'destination-out';
      for (x = 0; x < 960; x += 3) if (r() < 0.12) P.rect(x, y0 - 6, 3 + (r() * 14 | 0), 6 + (r() < 0.3 ? 2 : 0), '#000');
      c.globalCompositeOperation = 'source-over';
      // つた
      for (i = 0; i < 26; i++) {
        var vx = r() * 960 | 0, vl = 4 + (r() * 14 | 0);
        for (y = 0; y < vl; y += 2) P.rect(vx + Math.round(Math.sin(y * 0.5 + i) * 1.2), top + y, 2, 2, y % 4 ? '#3c4a3a' : '#55663e');
      }
    }
    tier(82, 10, 44, 8, ['#1e1a4c', '#262158', '#2e2866', '#3d3684', '#5a50a8'], 200, false);
    tier(116, 16, 80, 12, ['#2a2462', '#352e78', '#40388c', '#5a50b0', '#9a8ae0'], 200, true);
    return cv;
  }
  R.buildStages = function () {
    var BG = R.BG = window.REBELL_BG_SCHOOL.build();
    BG.viaduct = buildViaduct();
    R.STAGES.forEach(function (S) {
      S.layer = S.id === 'city' ? buildCity(S, BG) : buildSchool(S, BG);
      S.solids = S.ground.map(function (g) { return { x: g[0], y: GY, w: g[1] - g[0], h: 120 }; });
      S.blockRects = (S.blocks || []).map(function (b) { return { x: b[0], y: GY - b[2], w: b[1], h: b[2] + 60 }; });      // 石の段も、ぶつかる地形に入れる
      S.solids = S.solids.concat(S.blockRects);
      S.platRects = S.plats.map(function (p) { return { x: p[0], y: p[1], w: p[2] }; });
    });
  };

  // 学園ステージの校舎の位置（カメラ位置から決まる）
  R.schoolX = function (camX) { return Math.round(150 - camX * 0.22); };

  // 遠景を描く
  R.drawBackdrop = function (g, S, camX, t, rage) {
    var BG = R.BG, x;
    g.drawImage(BG.sky, 0, 0);
    if (S.id === 'school') g.drawImage(BG.volcano, Math.round(250 - camX * 0.03), 28);
    x = -Math.round(camX * 0.1) % 960; g.drawImage(BG.far, x, 0); g.drawImage(BG.far, x + 960, 0);
    if (S.id === 'city') {
      x = -Math.round(camX * 0.32) % 960; g.drawImage(BG.viaduct, x, 0); g.drawImage(BG.viaduct, x + 960, 0);
    } else {
      g.drawImage(BG.school, R.schoolX(camX), -7);
    }
    if (rage) { g.fillStyle = 'rgba(255,30,70,' + (0.10 + 0.05 * Math.sin(t * 0.08)) + ')'; g.fillRect(0, 0, R.W, R.H); }
  };
})();

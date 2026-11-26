// ステージ 2（鉄塔）のボス「井立 快晴」（いだち かいせい）: 《龍》を守る空手家。鉄塔のてっぺんで待ち受ける。
// 絵はフォルダのシート（art/source/E9752ECD-….png）から make_idachi.py が切り出したコマ（07_idachi_art.js）。
// 大きさは主人公と同じ: 主人公と同じく、細かい解像度の層（55_render.js の renderChars）に K 倍で描く（シートの 1 ドット = ゲームの K ドット）。
//   当たり判定の数字はシートの大きさで書いてあり、KB 倍して使う。
// 戦う場所は地面ではなく、てっぺんの足場（世界の y = S.goal[1]）。足場の高さは e.fy に持つ。
//
// 戦い方: 落ち着いたカウンター型。自分からはあまり仕掛けず、構えて待ち、打ってきた攻撃を受け流して反撃する。
//   ・見切りの構え … 腕を上げて構え、青く光る。正面からのふつうの攻撃・飛ぶ刃は受け流され、すぐに反撃が来る（PARRY!）。
//       → 構えが解けるまで待つ / 背後から打つ / チャージ攻撃・特技・鎖鎌・合体技で構えごと崩す（構えが崩れると大きなスキ）
//   ・こちらが近くで振りかぶると、その場で構えて受け流すことがある（本気だと多い）
//   ・殴られ続けても、ひるまずに構え直す。軽い攻撃ではひるまない（重い一撃・技の終わりのスキだけが崩す）
//   ・離れて様子を見ていると、旋風脚（風の刃）や飛び蹴り・真・飛燕蹴で間合いを詰めてくる
//   ・本気（体力が半分以下）… 気合いのカットインのあと、青い闘気をまとう。反撃が速く鋭くなり、連撃突と蒼天破（青い衝撃の柱。跳んでかわす）が加わる
//   ・倒すと、膝をついて会話（65_talk.js の idachi_end）。終わると「登頂」してステージクリア
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, clamp = R.clamp, rand = R.rand, sign = R.sign, PI = Math.PI;
  var X = null, SP = null;
  var K = 0.6, KB = 0.62;      // 絵を描く倍率 / 当たり判定の倍率（主人公と同じ背丈になる）
  var HP = 1700, STAGGER = 70, CALM = 170;      // 体力 / 構えを崩されてよろける長さ / これだけ打ってこなければ、自分から攻める
  var BLUE = ['#1a6ad8', '#7af3ff', '#ffffff'];
  var ICONS = { normal: 0, smile: 1, serious: 2, surprise: 3, anger: 4, sad: 5, silly: 6, shy: 7, confused: 8, resolve: 9 };
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  // 戦いの最中のカットイン（60_hud.js の bossCut が描く）。青い帯に、井立の絵とひとこと
  function bossCut(pic, line, line2) { G.bossCut = { pic: pic, img: 'idaPic_', name: '井立', blue: true, line: line, line2: line2, t: 0 }; }

  // ---- 絵の読み込み ----
  function slice(img, f) {
    var c = R.mk(f[2], f[3]);
    c.getContext('2d').drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    return { c: c, w: f[2], h: f[3], ox: f[4], oy: f[5], tint: {} };
  }
  R.loadIdachi = function (done) {
    var D = window.REBELL_IDACHI, left = 2;
    function fin() { if (--left === 0) done(); }
    if (!D) { done(); return; }
    var img = new Image();
    img.onload = function () {
      var out = {};
      for (var k in D.frames) out[k] = D.frames[k].map(function (f) { return slice(img, f); });
      SP = R.SPR.idachi = out; fin();
    };
    img.onerror = function () { var el = document.getElementById('err'); if (el) el.textContent += 'スプライトを読み込めませんでした: 井立\n'; fin(); };
    img.src = D.img;
    var ic = new Image(); ic.onload = fin; ic.onerror = fin; ic.src = D.icons; R.IMG.idaIcons = ic;
    if (D.pics) Object.keys(D.pics).forEach(function (k) { var im = new Image(); im.src = D.pics[k]; R.IMG['idaPic_' + k] = im; });
  };

  // ---- 小物 ----
  function F(g, i) { var a = SP[g]; return a[i < a.length ? i : a.length - 1]; }
  function seqF(seq, t) { var s = seq[0]; for (var i = 1; i < seq.length && t >= seq[i][0]; i++) s = seq[i]; return F(s[1], s[2]); }
  function rage(e) { return e.phase >= 2; }
  function go(e, st) { e.st = st; e.stT = 0; e.mv = null; e.mvName = ''; e.q = {}; }
  function faceTo(e, p) { e.face = p.x >= e.x ? 1 : -1; }
  function hbox(e, b) { var x = b[0] * KB, w = b[2] * KB; return { x: e.face > 0 ? e.x + x : e.x - x - w, y: e.y + b[1] * KB, w: w, h: b[3] * KB }; }
  function strike(e, b, dmg, big) {
    if (!R.overlap(hbox(e, b), X.box(G.pl))) return false;
    if (!X.hurtPlayer(dmg, e.face, !!big)) return false;
    e.expr = big ? 'smile' : 'serious'; e.exprT = 70;
    return true;
  }
  function ghost(e, life) { if (e.fr) e.trail.push({ f: e.fr, x: e.x, y: e.y, face: e.face, t: 0, life: life || 12 }); }
  function aura(e, n) { for (var i = 0; i < n; i++) X.part(e.x + rand(-8, 8), e.y - rand(0, 34), rand(-0.3, 0.3), rand(-1.6, -0.5), rand(12, 20), i % 2 ? BLUE[1] : BLUE[0], 1, 0, true); }
  function arena(e) { return G.arena || [e.x - 200, e.x + 200]; }
  function hint(key, str) { var H = G.idaHint || (G.idaHint = {}); if (H[key]) return; H[key] = 1; X.toast(str, '#bff4ff'); }
  function slashFx(e, a0, a1, r, dy) { X.fx({ type: 'slash', x: e.x + e.face * 3, y: e.y - (dy || 20), face: e.face, a0: a0, a1: a1, r: r, wd: 0.8, life: 11, col: 'blue' }); }

  // ---- 飛び道具（旋風脚の風の刃・蒼天破の衝撃の柱）。動きと絵を自分で持つ（50_game.js の updShots / 55_render.js の drawShot から）----
  function waveUpd(s, p, pb) {
    var A = G.arena;
    if (A && (s.x < A[0] + 2 || s.x > A[1] - 2)) { s.dead = true; X.burst(s.x, s.y - 12, 8, BLUE, 3, 14); return false; }
    if (s.t % 2 === 0) X.part(s.x - s.vx * 2 + rand(-3, 3), s.y - rand(2, s.h), -s.vx * 0.15, rand(-0.6, 0.2), 12, s.t % 4 ? BLUE[1] : BLUE[2], 2, 0, true);
    return R.overlap({ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h }, pb);
  }
  function waveDraw(g, s, cam) {
    var x = Math.round(s.x - cam), d = s.vx > 0 ? 1 : -1, k, yy, v, w, bx, grow = Math.min(1, s.t / 5);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (k = 0; k < 3; k++) {
      g.fillStyle = BLUE[k]; g.globalAlpha = [0.6, 0.85, 1][k];
      for (yy = 0; yy < s.h * grow; yy += 2) {
        v = Math.sin(PI * (yy + 1) / (s.h * grow));
        bx = x + d * (v * 10 - 4); w = Math.max(1, Math.round(v * [10, 7, 3][k]));
        g.fillRect(d > 0 ? Math.round(bx - w) : Math.round(bx), Math.round(s.y - yy - 2), w, 2);
      }
    }
    g.globalAlpha = 0.6; g.fillStyle = BLUE[1];
    for (k = 0; k < 3; k++) g.fillRect(Math.round(x - d * (10 + k * 6 + (s.t * 3 + k * 5) % 9)) - (d > 0 ? 8 : 0), Math.round(s.y - 6 - k * 8), 8, 1);
    g.restore();
  }
  function pillarUpd(s, p, pb) {
    if (s.t === s.warn && s.loud) { R.snd('explosion'); X.shake(4); }
    return s.t > s.warn && s.t < s.life - 4 && R.overlap({ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h }, pb);
  }
  function tri(g, x0, y0, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill(); }
  function pillarDraw(g, s, cam) {
    var x = Math.round(s.x - cam), y = s.y, u, h;
    g.save();
    if (s.t < s.warn) {      // 前ぶれ: 足場が青く光る
      if ((s.t >> 1) % 2) { g.fillStyle = BLUE[1]; g.fillRect(x - 9, y - 1, 18, 2); g.fillStyle = BLUE[2]; g.fillRect(x - 4, y - 2, 8, 1); }
    } else {
      u = (s.t - s.warn) / (s.life - s.warn); h = s.h * Math.sin(Math.min(1, u * 2.6) * PI / 2) * (1 - u * 0.3);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u * u;
      g.fillStyle = BLUE[0]; tri(g, x - 9, y, x + 2, y - h, x + 9, y);
      g.fillStyle = BLUE[1]; tri(g, x - 6, y, x - 1, y - h * 0.8, x + 5, y);
      g.fillStyle = BLUE[2]; tri(g, x - 2, y, x, y - h * 0.55, x + 2, y);
    }
    g.restore();
  }
  function fireWave(e, v) {
    X.shoot({ type: 'iwave', x: e.x + e.face * 20, y: e.y - 4, vx: e.face * v, vy: 0, life: 140, dmg: 12, w: 12, h: 28, big: true, upd: waveUpd, draw: waveDraw });
    R.snd('wave'); X.shake(3);
    X.fx({ type: 'ring', x: e.x + e.face * 20, y: e.y - 16, life: 12, r: 20, col: BLUE[1] });
  }

  // ---- 技の表（52_karate.js と同じ書き方。当たり判定・踏み込みの距離は、シートの大きさの数字）----
  //   seq = コマの並び / warn = この時刻まで「！」/ hits = [[始まり, 終わり, [x, y, w, h], ダメージ, 吹き飛ばすか], …]
  //   lunge = 踏み込み [[時刻, 速さ], …] / snd = 音 / rec = ここから先は殴られるとひるむ / dur = 長さ / cd = 次に動くまでの間 [ふだん, 本気]
  var MV = {
    // ---- 受け流したあとの反撃（前ぶれなし。速い）----
    // 正拳: まっすぐ突く
    riposte: {
      seq: [[0, 'combo1', 2], [3, 'combo1', 3], [14, 'combo1', 0], [20, 'stance', 0]], warn: 0,
      hits: [[3, 8, [0, -48, 54, 30], 14, 1]], lunge: [[2, 3.6]], snd: [[1, 'slash_red1']], rec: 16, dur: 28, cd: [46, 30],
      upd: function (e, p, t) { if (t === 3) slashFx(e, -0.6, 0.6, 22, 22); }
    },
    // 上段蹴り: 高く蹴り上げる（跳んでいる相手にも届く）
    rikick: {
      seq: [[0, 'combo3', 3], [4, 'combo3', 4], [16, 'combo3', 3], [22, 'stance', 0]], warn: 0,
      hits: [[4, 10, [-4, -72, 52, 66], 15, 1]], lunge: [[3, 2.6]], snd: [[2, 'slash_red2']], rec: 18, dur: 30, cd: [48, 30],
      upd: function (e, p, t) { if (t === 4) slashFx(e, 1.3, -2.2, 26, 26); }
    },
    // 二段突き（本気）: 突きを 2 度、深く踏み込んで
    ridouble: {
      seq: [[0, 'combo1', 2], [3, 'combo1', 3], [9, 'combo1', 1], [12, 'combo1', 3], [22, 'stance', 0]], warn: 0,
      hits: [[3, 7, [0, -48, 54, 30], 10, 0], [12, 17, [0, -50, 58, 32], 13, 1]], lunge: [[2, 3.4], [11, 3.4]], snd: [[1, 'slash_blue1'], [10, 'slash_red1']], rec: 24, dur: 34, cd: [48, 32]
    },
    // 打ち上げ（対空）: 跳んでくる相手を、突き上げで落とす
    upper: {
      seq: [[0, 'combo2', 1], [5, 'combo2', 2], [8, 'combo2', 3], [22, 'stance', 0]], warn: 5,
      hits: [[7, 14, [0, -80, 46, 76], 14, 1]], lunge: [[6, 2.2]], snd: [[6, 'slash_red2']], rec: 18, dur: 32, cd: [44, 28],
      upd: function (e, p, t) { if (t === 8) { X.fx({ type: 'ring', x: e.x + e.face * 14, y: e.y - 34, life: 12, r: 16, col: BLUE[1] }); X.burst(e.x + e.face * 14, e.y - 34, 8, BLUE, 2.6, 14); } }
    },
    // ---- 自分から出す技（相手が様子を見ているとき）----
    // 三連突き
    combo: {
      seq: [[0, 'stance', 0], [14, 'combo1', 1], [20, 'combo1', 2], [26, 'combo1', 1], [32, 'combo1', 3], [40, 'combo1', 0], [46, 'combo1', 3], [56, 'stance', 0]],
      warn: 14, hits: [[15, 19, [4, -46, 44, 26], 9, 0], [32, 36, [4, -46, 48, 26], 9, 0], [46, 51, [2, -48, 52, 30], 12, 1]],
      lunge: [[14, 2], [31, 2], [45, 2.8]], snd: [[14, 'slash_blue1'], [30, 'slash_blue1'], [44, 'slash_blue2']], rec: 54, dur: 72, cd: [60, 38]
    },
    // 飛び蹴り: 構えてから、低く長く跳び込む（跳び越えるか、ダッシュですり抜ける）
    tobi: {
      warn: 20, fric: 1, cd: [60, 38],
      upd: function (e, p, t, A) {
        var q = e.q;
        if (t < 20) { e.fr = F('finish', 0); e.vx = -e.face * 0.3; return; }
        if (t === 20) { faceTo(e, p); e.vy = -3.2; e.vx = e.face * (rage(e) ? 5.8 : 5.0); R.snd('dash'); X.dust(e.x, e.y, 6); }
        if (!q.land) {
          e.fr = F('finish', t < 24 ? 1 : 2);
          if (t >= 22) strike(e, [-4, -50, 54, 40], 14, 1);
          if (t % 2 === 0) ghost(e, 12);
          if (t === 24) { R.snd('slash_red3'); X.fx({ type: 'slash', x: e.x + e.face * 8, y: e.y - 22, face: e.face, a0: -1.2, a1: 1.4, r: 28, wd: 1, life: 12, col: 'blue' }); }
          if ((e.ground && t > 24) || e.x <= A[0] + 12 || e.x >= A[1] - 12) { q.land = t; q.rec = true; e.vx *= 0.3; X.dust(e.x, e.y, 6); R.snd('land'); }
        } else {
          e.vx *= 0.7; e.fr = F('land', t - q.land < 10 ? 0 : t - q.land < 18 ? 1 : 2);
          if (t - q.land >= 28) finish(e);
        }
      }
    },
    // 旋風脚（遠距離）: 回し蹴りで、青い風の刃を飛ばす。本気のときは 2 発
    senpu: {
      seq: [[0, 'senpu', 0], [24, 'senpu', 1], [38, 'senpu', 0], [46, 'stance', 0]], warn: 24, hits: [[24, 30, [-6, -46, 62, 30], 12, 1]], lunge: [[23, 1.8]], rec: 38, dur: 56, cd: [64, 40],
      upd: function (e, p, t) {
        if (t < 24 && t % 3 === 0) X.part(e.x + e.face * rand(3, 10), e.y - rand(6, 28), -e.face * 0.6, rand(-0.6, 0.2), 10, t % 6 ? BLUE[1] : BLUE[2], 2, 0, true);
        if (t === 24) { fireWave(e, rage(e) ? 5 : 4.3); slashFx(e, -2.6, 0.9, 30, 18); }
        if (t === 36 && rage(e)) { e.fr = F('senpu', 1); fireWave(e, 3.8); }
      }
    },
    // 真・飛燕蹴: 跳び上がりながら蹴り上げ、頂点で相手を見定めて、斜めに蹴り落ちる（ダッシュで横へ逃げる）
    hien: {
      warn: 18, fric: 1, cd: [64, 40],
      upd: function (e, p, t, A) {
        var q = e.q, d;
        if (t < 18) { e.fr = F('hien', 0); e.vx *= 0.5; return; }
        if (t === 18) { e.vy = -7.6; e.vx = e.face * 1.4; R.snd('slash_blue2'); X.dust(e.x, e.y, 6); }
        if (!q.dive && !q.land) {
          e.fr = F('hienair', 0);
          if (e.vy < 0) { strike(e, [-6, -66, 46, 60], 11, 1); if (t % 2 === 0) ghost(e, 9); }
          if (e.vy > -1.2 && t > 22) {
            faceTo(e, p); d = Math.abs(p.x - e.x);
            var hh = Math.max(10, e.fy - e.y), tt = Math.max(hh / (rage(e) ? 5.8 : 5.0), d / 6.4);
            q.dive = t; q.vy = hh / tt; e.vy = q.vy; e.vx = e.face * Math.max(1.2, d / tt); R.snd('slash_red3');
            X.fx({ type: 'ring', x: e.x, y: e.y - 18, life: 10, r: 16, col: BLUE[1] });
          }
          if (e.ground && t > 22) { q.land = t; q.rec = true; }
          return;
        }
        if (q.dive && !q.land) {
          e.fr = F('hienair', 1); e.vy = q.vy - 0.45;
          strike(e, [0, -44, 52, 44], 15, 1);
          if (t % 2 === 0) ghost(e, 12);
          if (e.ground) {
            q.land = t; q.rec = true; e.vx = 0; X.shake(5); X.dust(e.x, e.y, 10); R.snd('special_red');
            X.fx({ type: 'ring', x: e.x + e.face * 8, y: e.y - 2, life: 14, r: 26, col: BLUE[1], flat: true });
            if (p.ground && Math.abs(p.x - e.x) < 30) X.hurtPlayer(9, sign(p.x - e.x), false);
          }
          return;
        }
        e.vx *= 0.7; e.fr = F('land', t - q.land < 12 ? 1 : 2);
        if (t - q.land >= 32) finish(e);
      }
    },
    // 連撃突（本気）: 気合いをためてから、残像を引いて 2 度駆け抜ける。出しきると息が上がる（大きなスキ）
    rush: {
      warn: 0, fric: 1, cd: [70, 52],
      upd: function (e, p, t, A) {
        var q = e.q, u;
        if (t === 1) { q.ph = 'charge'; q.t0 = 0; q.n = 0; R.snd('roar'); }
        u = t - q.t0;
        if (q.ph === 'charge') {
          e.fr = F('kiai', 0); e.vx *= 0.5; e.warn = true;
          if (t % 3 === 0) aura(e, 2);
          if (u >= 40) { q.ph = 'prep'; q.t0 = t; }
        } else if (q.ph === 'prep') {
          if (u === 1) faceTo(e, p);
          e.fr = F('dash', 0); e.vx = -e.face * 0.4; e.warn = true;
          if (u >= 14) { q.ph = 'run'; q.t0 = t; q.dir = e.face; q.tx = clamp(p.x + q.dir * 90, A[0] + 24, A[1] - 24); R.snd('dash'); }
        } else if (q.ph === 'run') {
          e.vx = q.dir * 7.6; e.fr = (u >> 2) % 2 ? F('rush', 0) : F('combo1', 3);
          strike(e, [-12, -48, 50, 44], 13, 1);
          if (t % 2 === 0) ghost(e, 14);
          if ((q.dir > 0 ? e.x >= q.tx : e.x <= q.tx) || u > 60) { q.n++; q.ph = q.n < 2 ? 'brake' : 'rest'; q.t0 = t; if (q.ph === 'rest') q.rec = true; }
        } else if (q.ph === 'brake') {
          e.vx *= 0.6; e.fr = F('land', 0);
          if (u === 1) X.dust(e.x, e.y, 5);
          if (u >= 12) { q.ph = 'prep'; q.t0 = t; }
        } else {
          e.vx *= 0.7; e.fr = F('stagger', 0);      // 肩で息をする
          if (u >= 56) finish(e);
        }
      }
    },
    // 蒼天破（本気の大技）: 気合いをためて、足場じゅうに青い衝撃の柱を噴き上げる（足もとが光ったら跳ぶ）。撃ったあとは大きなスキ
    souten: {
      warn: 0, fric: 1, cd: [80, 64],
      upd: function (e, p, t, A) {
        var q = e.q, k, s, x;
        e.vx *= 0.6;
        if (t === 1) { bossCut('kick', '受けてみろ。', '――蒼天破！'); R.snd('roar'); hint('souten', '蒼天破だ！　足もとが光ったら、跳んでかわせ'); }
        if (t < 52) { e.fr = F('kiai', 0); e.warn = true; if (t % 2 === 0) aura(e, 2); if (t % 8 === 0) X.shake(2); return; }
        if (t === 52) {
          e.fr = F('souten', 0); R.snd('special_red'); X.shake(10); G.flash = Math.max(G.flash, 0.5);
          X.fx({ type: 'ring', x: e.x, y: e.y - 14, life: 22, r: 90, col: BLUE[1] });
          for (k = 0; k < 10; k++) for (s = -1; s <= 1; s += 2) {
            x = e.x + s * (16 + k * 30);
            if (x > A[0] + 4 && x < A[1] - 4) X.shoot({ type: 'ipillar', x: x, y: e.fy, vx: 0, vy: 0, warn: 8 + k * 6, life: 8 + k * 6 + 20, dmg: 14, w: 18, h: 52, big: true, loud: s < 0 && k % 3 === 0, upd: pillarUpd, draw: pillarDraw });
          }
          q.rec = true;
        }
        if (t > 52) e.fr = t < 104 ? F('souten', 0) : F('stagger', 0);
        if (t >= 140) finish(e);
      }
    }
  };

  function start(e, name) {
    go(e, 'move'); e.mv = MV[name]; e.mvName = name;
    faceTo(e, G.pl);
    if (name === 'rush') { e.rushCd = 720; bossCut('shout', '――受けてばかりだと、思うなよ。'); }
    if (name === 'souten') e.soutenCd = 840;
    if (name === 'senpu') hint('senpu', '風の刃だ！　跳び越えるか、ダッシュですり抜けろ');
  }
  function finish(e) {
    var m = e.mv;
    e.last = e.mvName; go(e, 'idle'); e.cd = Math.round(m.cd[rage(e) ? 1 : 0] * rand(0.8, 1.2));
  }

  // ---- 見切りの構え（カウンター）----
  //   dur = 構えている長さ。この間に正面から打たれると、受け流して（PARRY!）反撃する。
  //   構えている間は、ゆっくり向き直る（背後へ回る余地がある）
  function startKamae(e, dur) {
    go(e, 'kamae'); faceTo(e, G.pl);
    hint('kamae', '見切りの構えだ！　正面から打つと受け流され、反撃が来る ― 待つか、背後・チャージ攻撃・特技・鎖鎌で崩せ');
    e.kDur = dur || (rage(e) ? 70 : 84); e.gHits = 0; e.vx *= 0.3; e.kamCd = rage(e) ? 60 : 90;
  }
  function stKamae(e, p, dx, ad, t) {
    e.vx *= 0.7; e.fr = F('guard', 0);
    if (t % 20 === 0) faceTo(e, p);
    if (e.parry) {      // 受け流した: すぐに反撃
      e.parry = false; faceTo(e, p);
      var air = !p.ground && p.y < e.fy - 18;
      start(e, air ? 'rikick' : rage(e) ? pick(['ridouble', 'rikick', 'riposte']) : pick(['riposte', 'riposte', 'rikick']));
      e.vx = 0; return;
    }
    if (t >= e.kDur) {      // 何もしてこなかった: 構えを解く。離れていれば、こちらから詰める
      if (ad > 120 && Math.random() < 0.6) start(e, pick(['senpu', 'tobi'])); else { go(e, 'idle'); e.cd = 24; }
    }
  }
  // 受け流し（構えの最中に、正面からふつうの攻撃を受けたとき）
  function parry(e, opt) {
    var p = G.pl, x = e.x + e.face * 8, y = e.y - 22;
    e.parry = true; e.expr = 'serious'; e.exprT = 50; e.parries = (e.parries || 0) + 1;
    X.text(e.x, e.y - 48, 'PARRY!', '#9ae8ff', true); R.snd('guard'); X.shake(2);
    X.fx({ type: 'ring', x: x, y: y, life: 12, r: 18, col: BLUE[1] }); X.burst(x, y, 10, ['#ffffff', BLUE[1]], 3, 14);
    G.hitstop = Math.max(G.hitstop, 5);
    if (p.st === 'attack' && p.ground) p.vx = -sign(e.x - p.x) * 1.6;      // 受け流されて、体が流れる
  }
  // 構えを崩された（チャージ攻撃・特技・鎖鎌）: 大きくよろける
  function breakKamae(e, why) {
    go(e, 'stagger'); e.vx = -e.face * 2.2; e.gHits = 0; e.expr = 'surprise'; e.exprT = 100;
    X.text(e.x, e.y - 50, why || 'BREAK!', '#ffe04a', true); X.shake(6); G.hitstop = Math.max(G.hitstop, 7);
    X.burst(e.x + e.face * 8, e.y - 22, 16, ['#aebcff', '#ffffff', '#ffe04a'], 4.2, 24, 0.1);
    R.snd('hit_heavy');
  }

  // ---- 回避（ステップ）: 間合いの外へ下がる ----
  function startStep(e, p) {
    var A = arena(e), tx = clamp(e.x - sign(p.x - e.x) * 70, A[0] + 20, A[1] - 20);
    go(e, 'step'); e.sx = e.x; e.tx = tx; e.invul = 18; e.stepCd = rage(e) ? 80 : 120; e.gHits = 0;
    if (tx !== e.x) e.face = tx > e.x ? 1 : -1;
    R.snd('dash');
  }
  function stStep(e, p, dx, ad, t) {
    var nx = e.sx + (e.tx - e.sx) * R.ease(Math.min(1, t / 12));
    e.vx = nx - e.x; e.fr = F('step', t < 6 ? 0 : 1); e.invul = Math.max(e.invul, 2);
    if (t % 2 === 0) ghost(e, 12);
    if (t >= 13) { e.vx = 0; faceTo(e, p); startKamae(e, rage(e) ? 50 : 60); }      // 下がったら、すぐに構え直す
  }

  // ---- 攻撃を受けるとき（50_game.js の damageEnemy から）。false = 当たらない / { mul } = 倍率 / null = ふつうに受ける ----
  function onHit(e, dmg, dir, kb, opt) {
    var p = G.pl;
    if (e.st === 'intro' || e.st === 'kiai') return false;
    if (e.st === 'stagger') return { mul: 1.3 };
    if (e.st !== 'kamae' || opt.cross) return null;
    if (opt.chain) { breakKamae(e, '構えを崩した！'); return { mul: 1 }; }                                  // 鎖鎌は、構えごと引き崩す
    if (p.st === 'special' || (p.st === 'attack' && p.atk && p.atk.charge)) { breakKamae(e, '構えを崩した！'); return { mul: 1.1 }; }      // 特技・チャージ攻撃は受け流せない
    if ((p.x - e.x) * e.face < 0) { breakKamae(e, 'BACK!'); return { mul: 1.4 }; }                          // 背中は受け流せない
    if (!e.parry) parry(e, opt);
    return false;
  }
  function afterHit(e, d, dir, kb, opt) {
    e.gHits += opt.heavy ? 2 : 1; e.gT = 80; e.expr = e.hp < e.max * 0.3 ? 'resolve' : 'surprise'; e.exprT = 24;
    if (e.hp <= 0) return;
    if (e.phase === 1 && e.hp <= e.max * 0.5) e.pending = true;
    if (e.st === 'stagger') { e.vx = dir * Math.min(1.4, kb * 0.3); return; }
    var soft = e.st === 'idle' || e.st === 'hurt' || (e.st === 'move' && (e.q.rec || (e.mv.rec && e.stT >= e.mv.rec)));
    if (!soft || !opt.heavy) return;      // 技の最中と、軽い攻撃ではひるまない
    go(e, 'hurt'); e.big = true; e.vx = dir * Math.min(2, kb * 0.4);
  }
  function stHurt(e, p, dx, ad, t) {
    e.vx *= 0.82; e.fr = F(e.big ? 'hurtbig' : 'hurt', 0);
    if (t >= (e.big ? 18 : 12)) { if (e.gHits >= 3 && !e.pending) { if (e.stepCd <= 0 && Math.random() < 0.4) startStep(e, p); else startKamae(e); } else { go(e, 'idle'); e.cd = Math.min(e.cd, 18); } }
  }
  function stStagger(e, p, dx, ad, t) {
    e.vx *= 0.86; e.fr = F('stagger', 0);
    if (t >= STAGGER) { e.gHits = 0; startStep(e, p); }
  }

  // ---- 登場・本気・退場 ----
  // ボス戦の始まり（50_game.js の updGoal から）。空から降ってきて、てっぺんの足場に着地する
  function enter(e, b) {
    X = R.GX;
    var A = arena(e);
    e.fy = e.y; e.x = G.pl.x < (A[0] + A[1]) / 2 ? A[1] - 60 : A[0] + 60; e.y = e.fy - 170; e.vy = 2; e.ground = false;
    faceTo(e, G.pl); e.fr = F('jump', 3); e.invul = 9999;
    R.bgm(null); R.snd('roar'); X.shake(4);
    e.talkFirst = !G.idaMet; G.idaMet = true;
  }
  function stIntro(e, p, dx, ad, t) {
    e.invul = 2; e.vx = 0;
    if (!e.ground) { e.fr = F('jump', e.vy < 0 ? 2 : 4); if (t % 2 === 0) ghost(e, 10); e.stT = 0; return; }
    if (!e.landed) {
      e.landed = true; e.stT = t = 1; X.shake(9); R.snd('special_red'); X.dust(e.x, e.y, 14);
      X.fx({ type: 'ring', x: e.x, y: e.y - 2, life: 18, r: 48, col: BLUE[1], flat: true });
    }
    faceTo(e, p);
    if (t < 30) { e.fr = F('land', t < 12 ? 0 : t < 22 ? 1 : 2); return; }
    if (t === 30 && R.TALKS && R.beginTalk) {
      if (e.talkFirst) { R.beginTalk('idachi', { vs: e }); return; }
      bossCut('close', '――また来たか。', '何度でも、受けて立つ。');
    }
    if (t === 31) { R.bgm('boss'); G.bossIntro = 110; }
    e.fr = F('stance', (t >> 3) % 4);
    if (t >= 70) { go(e, 'idle'); e.cd = 30; e.invul = 0; e.calm = 0; }      // 登場と会話の間は、様子見の時間に数えない
  }
  // 本気（体力半分）: 気合いのカットイン → 青い闘気が噴き上がる → 反撃が速く鋭くなる
  function stKiai(e, p, dx, ad, t) {
    e.vx = 0; e.invul = 2;
    e.fr = t < 40 ? F('stance', 0) : F('kiai', 0);
    if (t === 1) { R.snd('roar'); G.shots = []; e.expr = 'resolve'; e.exprT = 150; bossCut('shout', '守るために、強くなる。', '――ここから先は、本気だ！'); }
    if (t > 40 && t % 3 === 0) { X.shake(3); aura(e, 3); }
    if (t === 60) {
      e.phase = 2; G.flash = Math.max(G.flash, 0.6); X.shake(9); R.snd('special_red');
      X.fx({ type: 'ring', x: e.x, y: e.y - 18, life: 24, r: 90, col: BLUE[1] }); X.burst(e.x, e.y - 18, 24, BLUE, 4.5, 28, 0.05);
      X.toast('井立が青い闘気をまとった…！　反撃が鋭くなる！', '#9ae8ff');
      if (ad < 80) { p.vx = sign(p.x - e.x) * 5; p.vy = Math.min(p.vy, -2.4); }
    }
    if (t >= 96) { go(e, 'idle'); e.cd = 20; e.stepCd = 0; e.rushCd = 200; e.soutenCd = 360; e.kamCd = 0; }
  }
  function onKill(e, dir) {
    e.dead = false; e.dying = true; e.hp = 0; G.kills++;
    go(e, 'die'); e.vx = (dir || -e.face) * 3; e.vy = -3; e.invul = 0; e.trail = []; e.expr = 'sad'; e.exprT = 9999;
    G.shots = []; G.bossCut = null; R.bgm(null); R.snd('hit_heavy');
    X.gainExp(e.exp);
    G.hitstop = Math.max(G.hitstop, 14); G.flash = Math.max(G.flash, 0.6); X.shake(10);
  }
  function stDie(e, p, dx, ad, t) {
    e.vx *= 0.9;
    if (t < 22) e.fr = F('blown', t < 10 ? 0 : 1);
    else if (t < 70) e.fr = F('down', t < 40 ? 0 : 1);
    else if (t < 100) e.fr = F('getup', 0);
    else e.fr = F('idle', 0);
    if (t === 100) faceTo(e, p);
    if (t === 110 && R.TALKS && R.beginTalk) { R.beginTalk('idachi_end', { vs: e }); return; }
    if (t >= 116) {
      e.dead = true; e.gone = true; e.dying = false;
      X.burst(e.x, e.y - 18, 18, BLUE.concat(['#ffffff']), 4, 26);
      for (var i = 0; i < 4; i++) X.dropItem('crystal', e.x + rand(-26, 26), e.y - 30);
      X.dropItem('potion', e.x, e.y - 40);
      if (R.idachiDone) R.idachiDone(e);
    }
  }

  // 待ち: 構えたまま、ゆっくり間合いを詰める（落ち着いて、相手の出方を待つ）
  function stIdle(e, p, dx, ad, t) {
    faceTo(e, p);
    if (ad > 74) { e.vx = e.face * (rage(e) ? 1.05 : 0.8); e.fr = F('walk', (e.animT >> 4) % 3); }      // 歩みは遅い
    else { e.vx *= 0.7; e.fr = F('stance', (e.animT >> 5) % 4); }
    if (react(e, p, ad)) return;
    if (e.cd > 0) { e.cd--; return; }
    choose(e, p, ad);
  }
  // 相手の出方を見て動く: 近くで振りかぶったら、その場で構えて受け流す
  function react(e, p, ad) {
    var a = p.atk, i, s;
    if (p.st === 'attack' && a && p.stT <= 2 && !a.dive && !a.charge && ad < 64 && e.kamCd <= 0 && Math.random() < (rage(e) ? 0.6 : 0.4)) { startKamae(e, rage(e) ? 36 : 44); return true; }
    for (i = 0; i < G.pshots.length; i++) {      // 飛んでくる刃は、構えて受け流す
      s = G.pshots[i];
      if (!s.dead && !s.big && (e.x - s.x) * s.vx > 0 && Math.abs(s.x - e.x) < 60 && Math.abs(s.y - (e.y - 18)) < 28) { startKamae(e, 30); return true; }
    }
    return false;
  }
  // 次の手: ふだんは構えて待つ。相手がしばらく打ってこなければ、自分から仕掛ける
  function choose(e, p, ad) {
    var r = rage(e), air = !p.ground && p.y < e.fy - 18, w = [], tot = 0, k, i, idle = e.calm > CALM;
    function add(name, wt) { if (wt > 0) { if (name === e.last) wt *= 0.3; w.push([name, wt]); tot += wt; } }
    if (air && ad < 70) { add('upper', 5); add('kamae', 2); }
    else if (ad < 70) { add('kamae', idle ? 2 : 6); add('combo', idle ? 3 : 0.8); add('souten', r && e.soutenCd <= 0 ? 1.5 : 0); }
    else if (ad < 150) { add('kamae', idle ? 1 : 3); add('tobi', idle ? 2.5 : 0.6); add('hien', idle ? 2 : 0.5); add('senpu', idle ? 2 : 0.8); add('rush', r && e.rushCd <= 0 ? 1.5 : 0); add('souten', r && e.soutenCd <= 0 ? 1.5 : 0); add('wait', 2); }
    else { add('senpu', 2.5); add('tobi', 1.5); add('hien', 1); add('wait', 3); add('rush', r && e.rushCd <= 0 ? 1.5 : 0); }
    k = Math.random() * tot;
    for (i = 0; i < w.length; i++) { k -= w[i][1]; if (k <= 0) break; }
    k = w[Math.min(i, w.length - 1)][0];
    if (k === 'wait') { e.cd = 30; return; }      // そのまま、ゆっくり詰める
    if (k === 'kamae') { startKamae(e); return; }
    e.calm = 0; start(e, k);
  }
  function stMove(e, p, dx, ad, t, A) {
    var m = e.mv, i, h;
    if (m.seq) e.fr = seqF(m.seq, t);
    e.warn = t <= m.warn;
    e.vx *= (m.fric != null ? m.fric : 0.8);
    if (m.lunge) for (i = 0; i < m.lunge.length; i++) if (t === m.lunge[i][0]) e.vx = e.face * m.lunge[i][1];
    if (m.snd) for (i = 0; i < m.snd.length; i++) if (t === m.snd[i][0]) R.snd(m.snd[i][1]);
    if (m.upd && m.upd(e, p, t, A, dx, ad) === true) return;
    if (e.mv !== m) return;
    if (m.hits) for (i = 0; i < m.hits.length; i++) { h = m.hits[i]; if (t >= h[0] && t <= h[1]) strike(e, h[2], h[3], h[4]); }
    if (m.dur && t >= m.dur) finish(e);
  }
  var ST = { intro: stIntro, idle: stIdle, move: stMove, step: stStep, kamae: stKamae, hurt: stHurt, stagger: stStagger, kiai: stKiai, die: stDie };

  function update(e) {
    if (!X) X = R.GX;
    tick(e);
  }
  function tick(e) {
    var p = G.pl, A = arena(e), i;
    e.stT++; e.animT++;
    if (e.invul > 0) e.invul--;
    ['stepCd', 'rushCd', 'soutenCd', 'kamCd', 'exprT'].forEach(function (k) { if (e[k] > 0) e[k]--; });
    e.calm = p.st === 'attack' || p.st === 'special' ? 0 : (e.calm || 0) + 1;      // 相手が打ってこない時間
    if (G.bossCut && G.bossCut.img === 'idaPic_' && ++G.bossCut.t > 84) G.bossCut = null;
    if (e.gT > 0 && --e.gT === 0) e.gHits = 0;
    e.warn = false;
    for (i = 0; i < e.trail.length; i++) e.trail[i].t++;
    if (e.trail.length) e.trail = e.trail.filter(function (q) { return q.t < q.life; });
    if (rage(e) && e.st !== 'die' && e.animT % 6 === 0) aura(e, 1);
    if (e.pending && (e.st === 'idle' || e.st === 'hurt' || e.st === 'kamae')) { e.pending = false; go(e, 'kiai'); }
    ST[e.st](e, p, p.x - e.x, Math.abs(p.x - e.x), e.stT, A);
    if (e.st === 'die' && e.gone) return;
    e.vy = Math.min(9, e.vy + 0.45); X.moveBody(e);
    e.x = clamp(e.x, A[0] + 12, A[1] - 12);
    if (e.y > e.fy + 120) { e.y = e.fy; e.vy = 0; }
  }

  function init(e) {
    if (e.type !== 'idachi') return false;
    e.w = 14; e.h = 34; e.hp = e.max = HP; e.exp = 240; e.armor = true;      // 主人公と同じくらいの体
    e.phase = 1; e.st = 'intro'; e.stT = 0; e.cd = 60; e.q = {}; e.mv = null; e.mvName = ''; e.last = '';
    e.gHits = 0; e.gT = 0; e.stepCd = 0; e.rushCd = 0; e.soutenCd = 0; e.kamCd = 0; e.calm = 0; e.parry = false; e.parries = 0;
    e.trail = []; e.fr = null; e.warn = false; e.expr = 'smile'; e.exprT = 0; e.pending = false; e.animT = 0; e.fy = e.y;
    e.onHit = onHit; e.afterHit = afterHit; e.onKill = onKill; e.upd = update;
    e.draw = function () { };      // 敵の層には描かない（主人公と同じ細かい層に、R.Idachi.drawHi で描く）
    e.talkWho = 'idachi'; e.talkPose = talkPose; e.iconOf = icon; e.iconImg = 'idaIcons'; e.iconData = window.REBELL_IDACHI;
    e.banner = '龍を守る者　―　空手家';
    return true;
  }

  // ---- 絵（細かい層。g は 1 ドット = S ピクセルに変換済み）----
  function put(g, c, x, y, face, f) {
    g.save(); g.translate(Math.round(x * 4) / 4, Math.round(y)); g.scale(face * K, K); g.drawImage(c, -f.ox, -f.oy); g.restore();
  }
  function star(g, x, y, r, col) { g.fillStyle = col; g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1); }
  function drawHi(g, cam) {
    var e = G.boss;
    if (!SP || !e || e.type !== 'idachi' || e.gone) return;
    var f = e.fr || F('stance', 0), x = e.x - cam, y = e.y, i, tr, a;
    for (i = 0; i < e.trail.length; i++) {      // 残像（青）
      tr = e.trail[i]; g.globalAlpha = 0.42 * (1 - tr.t / tr.life);
      put(g, R.tinted(tr.f, '#3a9aff'), tr.x - cam, tr.y, tr.face, tr.f);
    }
    g.globalAlpha = 1;
    if (G.state === 'gameover' && e.st !== 'die') f = F('victory', 0);
    put(g, e.flash > 0 && (e.flash >> 1) % 2 === 0 ? R.tinted(f, '#ffffff') : f.c, x, y, e.face, f);
    if (rage(e) && e.st !== 'die') {      // 本気: 体がうっすら青く光る
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16 + 0.07 * Math.sin(G.t * 0.22);
      put(g, R.tinted(f, '#4ab8ff'), x, y, e.face, f); g.restore();
    }
    if (e.st === 'kamae') {      // 見切りの構え: 正面に青い光の弧（脈打つ）。構えが解ける直前は点滅
      var end = e.kDur - e.stT < 14 && (G.t >> 2) % 2;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = end ? 0.25 : 0.55 + 0.25 * Math.sin(G.t * 0.4);
      g.strokeStyle = '#7af3ff'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + e.face * 4, y - 18, 16, e.face > 0 ? -1.1 : PI - 1.1 + 0.0, e.face > 0 ? 1.1 : PI + 1.1); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.6; g.beginPath(); g.arc(x + e.face * 4, y - 18, 14, e.face > 0 ? -0.8 : PI - 0.8, e.face > 0 ? 0.8 : PI + 0.8); g.stroke();
      g.restore();
    } else if (e.st === 'stagger') {
      for (i = 0; i < 3; i++) { a = G.t * 0.16 + i * 2.09; star(g, Math.round(x + Math.cos(a) * 8), Math.round(y - 40 + Math.sin(a) * 2), 1, i % 2 ? '#ffe04a' : '#ffffff'); }
    }
    if (e.warn && (G.t >> 2) % 2) {
      var hy = Math.round(y - e.h - 14);
      g.fillStyle = '#ff3048'; g.fillRect(x - 1, hy, 2.5, 6); g.fillRect(x - 1, hy + 7.5, 2.5, 2.5); g.fillStyle = '#ffd0d6'; g.fillRect(x - 0.3, hy + 1, 1, 4);
    }
  }
  // 会話のあいだの立ち姿（65_talk.js から）。話すときは構え、聞いているときは自然体
  function talkPose(e, speaking, T) { e.fr = e.st === 'die' ? F('getup', 0) : speaking ? F('stance', (T >> 4) % 4) : F('idle', (T >> 4) % 5); }
  // HUD に出す顔（表情アイコンの番号）
  function icon(e) {
    var k;
    if (e.st === 'die' || e.exprT > 0) k = e.expr;
    else if (G.state === 'gameover') k = 'smile';
    else if (e.st === 'kamae' || e.st === 'kiai') k = 'serious';
    else if (e.st === 'stagger') k = 'surprise';
    else if (e.st === 'intro') k = 'smile';
    else if (e.hp < e.max * 0.3) k = 'resolve';
    else if (rage(e)) k = e.st === 'move' ? 'anger' : 'serious';
    else k = e.st === 'move' ? 'serious' : 'normal';
    return ICONS[k] || 0;
  }

  R.Idachi = { init: init, enter: enter, drawHi: drawHi, ok: function () { return !!SP; }, MV: MV, start: start };
})();

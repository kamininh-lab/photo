// 中ボス「黒瀬 龍士」（くろせ りゅうじ）: カメラを手にした空手使い。
// 絵はフォルダの「中ボス.png」から切り出したコマ（07_midboss.js）。絵の 1 ドット = ゲームの 1 ドットで、敵と同じ 480x270 の画面に描く。
//
// トリッキーな戦い方（どれも、前ぶれを見てから対処できる）:
//   ・ひるまない … 軽い攻撃では体勢を崩さない（技の最中は、重い一撃でも崩れない）。殴られた数は数えていて、たまるとガードに入る
//   ・ガード … 腕を組んで守る。正面からの攻撃はほとんど通らない。
//       → 紅の重い一撃や鎖鎌で割る（GUARD BREAK で大きくよろける）か、蒼の速さで背後へ回って斬る（背中は 1.5 倍。数発で回り込み返してくる）
//   ・見切り … こちらの振りかぶりを見て、残像を残して背後へ回り込み、裏拳を返す
//   ・フラッシュ … カメラを構えてから光るまでに間がある。光った瞬間にそちらを向いていると、しばらく目がくらむ
//       → 背を向けるか、ダッシュでかわす。構えている間は無防備なので、殴れば止められる
//       → 光に紛れて姿を消し、背後から現れる。本気を出すと、元の場所に「写し身」（写真の残像）を残す。斬っても手応えはない
//   ・技 … 正拳連打 / 飛び込み前蹴り / 回し蹴り（対空）/ 下段蹴り / 昇天膝（対空）/ 衝撃掌打（飛ぶ衝撃波）/ 回転蹴り / 地裂撃
//          本気（体力が半分以下）: 連撃（ラピッドコンボ）/ 連撃ラッシュ / 衝撃掌打の 2 連発と、撃つと見せて回り込むフェイント
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, GY = R.GY, clamp = R.clamp, rand = R.rand, sign = R.sign, PI = Math.PI;
  var X = null;          // 50_game.js が貸してくれる部品（R.GX）
  var SP = null;         // コマ { 組の名前: [コマ…] }
  var HP = 1500, CAM_FLASH = 44, DAZZLE = 84, STAGGER = 70;      // 体力 / カメラが光るまでのフレーム数 / 目がくらむ長さ / ガードを割られてよろける長さ
  var PUR = ['#7a2be0', '#c98bff', '#ffffff'];
  // 表情アイコンの番号（0〜7 = 1 枚目のシート、8〜14 = 2 枚目のシート）
  var ICONS = { normal: 0, anger: 1, smirk: 2, rage: 3, hurt: 4, surprise: 5, laugh: 6, focus: 7,
    n_normal: 8, n_anger: 9, n_taunt: 10, n_calm: 11, n_surprise: 12, n_wounded: 13, n_laugh: 14 };
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  // 戦いの最中のカットイン（60_hud.js が描く）。pic = 絵（grin / reach / camera）、line = ひとこと
  function bossCut(pic, line) { G.bossCut = { pic: pic, line: line, t: 0 }; }

  // ---- 絵の読み込み（1 コマ = { c: 絵, w, h, ox, oy: 基準点, tint: 単色版の置き場 }）----
  function slice(img, f) {
    var c = R.mk(f[2], f[3]);
    c.getContext('2d').drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    return { c: c, w: f[2], h: f[3], ox: f[4], oy: f[5], tint: {} };
  }
  R.loadKarate = function (done) {
    var D = window.REBELL_MIDBOSS, left = 3;
    function fin() { if (--left === 0) done(); }
    if (!D) { done(); return; }
    var img = new Image();
    img.onload = function () {
      var out = {};
      for (var k in D.frames) out[k] = D.frames[k].map(function (f) { return slice(img, f); });
      SP = R.SPR.karate = out; fin();
    };
    img.onerror = function () { var el = document.getElementById('err'); if (el) el.textContent += 'スプライトを読み込めませんでした: 中ボス\n'; fin(); };
    img.src = D.img;
    [['icons', 'midIcons'], ['portrait', 'midPortrait']].forEach(function (q) {
      var im = new Image(); im.onload = fin; im.onerror = fin; im.src = D[q[0]]; R.IMG[q[1]] = im;
    });
    // 2 枚目のシートの大きな絵（会話と、戦いの最中のカットイン）。読み込みは待たない
    if (D.pics) Object.keys(D.pics).forEach(function (k) { var im = new Image(); im.src = D.pics[k]; R.IMG['midPic_' + k] = im; });
  };

  // ---- 小物 ----
  function F(g, i) { var a = SP[g]; return a[i < a.length ? i : a.length - 1]; }
  function seqF(seq, t) { var s = seq[0]; for (var i = 1; i < seq.length && t >= seq[i][0]; i++) s = seq[i]; return F(s[1], s[2]); }
  function rage(e) { return e.phase === 2; }
  function go(e, st) { e.st = st; e.stT = 0; e.mv = null; e.mvName = ''; e.q = {}; }
  function faceTo(e, p) { e.face = p.x >= e.x ? 1 : -1; }
  function hbox(e, b) { return { x: e.face > 0 ? e.x + b[0] : e.x - b[0] - b[2], y: e.y + b[1], w: b[2], h: b[3] }; }
  // 当たり判定。b = 向いている側を正にした [x, y, w, h]（y は足元が 0）
  function strike(e, b, dmg, big) {
    if (!R.overlap(hbox(e, b), X.box(G.pl))) return false;
    if (!X.hurtPlayer(dmg, e.face, !!big)) return false;
    e.expr = big ? pick(['n_taunt', 'n_laugh', 'smirk']) : pick(['smirk', 'n_taunt']); e.exprT = 80;      // 当てたら、にやりと笑う（大技なら高笑い）
    return true;
  }
  function ghost(e, life) { if (e.fr) e.trail.push({ f: e.fr, x: e.x, y: e.y, face: e.face, t: 0, life: life || 12 }); }
  function aura(e, n) { for (var i = 0; i < n; i++) X.part(e.x + rand(-12, 12), e.y - rand(0, 46), rand(-0.3, 0.3), rand(-1.7, -0.5), rand(12, 22), i % 2 ? PUR[1] : PUR[0], 2, 0, true); }
  function arena(e) { return G.arena || [e.x - 220, e.x + 220]; }
  // 仕掛けに初めて出会ったとき、対処のしかたを 1 度だけ知らせる
  function hint(key, str) { var H = G.midHint || (G.midHint = {}); if (H[key]) return; H[key] = 1; X.toast(str, '#e6ccff'); }

  // ---- 飛び道具（衝撃掌打の衝撃波・地裂撃の牙）。動きと絵を自分で持つ（50_game.js の updShots / 55_render.js の drawShot から呼ばれる）----
  function waveUpd(s, p, pb) {
    var A = G.arena;
    if (!X.groundAt(s.x) || (A && (s.x < A[0] + 2 || s.x > A[1] - 2))) { s.dead = true; X.burst(s.x, s.y - 16, 8, PUR, 3, 14); return false; }
    if (s.t % 2 === 0) X.part(s.x - s.vx * 2 + rand(-3, 3), s.y - rand(2, s.h), -s.vx * 0.15, rand(-0.6, 0.2), 12, s.t % 4 ? PUR[1] : PUR[2], 2, 0, true);
    return R.overlap({ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h }, pb);
  }
  function waveDraw(g, s, cam) {
    var x = Math.round(s.x - cam), d = s.vx > 0 ? 1 : -1, k, yy, v, w, bx, grow = Math.min(1, s.t / 5);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (k = 0; k < 3; k++) {
      g.fillStyle = PUR[k]; g.globalAlpha = [0.6, 0.85, 1][k];
      for (yy = 0; yy < s.h * grow; yy += 2) {
        v = Math.sin(PI * (yy + 1) / (s.h * grow));      // まん中がふくらむ三日月
        bx = x + d * (v * 13 - 5); w = Math.max(1, Math.round(v * [13, 9, 4][k]));
        g.fillRect(d > 0 ? Math.round(bx - w) : Math.round(bx), Math.round(s.y - yy - 2), w, 2);
      }
    }
    g.globalAlpha = 0.6; g.fillStyle = PUR[1];      // 後ろに引く光の筋
    for (k = 0; k < 4; k++) g.fillRect(Math.round(x - d * (12 + k * 6 + (s.t * 3 + k * 5) % 9)) - (d > 0 ? 8 : 0), Math.round(s.y - 7 - k * 9), 8, 1);
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
    if (s.t < s.warn) {      // 前ぶれ: 地面が紫に光る
      if ((s.t >> 1) % 2) { g.fillStyle = PUR[1]; g.fillRect(x - 10, y - 1, 20, 2); g.fillStyle = PUR[2]; g.fillRect(x - 5, y - 2, 10, 1); }
    } else {
      u = (s.t - s.warn) / (s.life - s.warn); h = s.h * Math.sin(Math.min(1, u * 2.6) * PI / 2) * (1 - u * 0.3);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u * u;
      g.fillStyle = PUR[0]; tri(g, x - 11, y, x + 2, y - h, x + 11, y);
      g.fillStyle = PUR[1]; tri(g, x - 7, y, x - 1, y - h * 0.8, x + 6, y);
      g.fillStyle = PUR[2]; tri(g, x - 3, y, x, y - h * 0.55, x + 3, y);
    }
    g.restore();
  }
  // 足刀蹴りの飛ぶ刃: 胸の高さを、横一文字に飛ぶ小さな三日月（跳び越えるか、ダッシュですり抜ける）
  function fireBlade(e, v) {
    X.shoot({ type: 'kblade', x: e.x + e.face * 34, y: e.y - 20, vx: e.face * v, vy: 0, life: 110, dmg: 12, w: 12, h: 24, big: false, upd: waveUpd, draw: waveDraw });
    R.snd('slash_red2');
    X.fx({ type: 'slash', x: e.x + e.face * 18, y: e.y - 32, face: e.face, a0: -1.2, a1: 1.2, r: 22, wd: 0.8, life: 9, col: 'purple' });
  }
  function fireWave(e, v) {
    X.shoot({ type: 'kwave', x: e.x + e.face * 28, y: e.y, vx: e.face * v, vy: 0, life: 140, dmg: 13, w: 14, h: 40, big: true, upd: waveUpd, draw: waveDraw });
    R.snd('wave'); X.shake(3);
    X.fx({ type: 'ring', x: e.x + e.face * 30, y: e.y - 24, life: 12, r: 28, col: PUR[1] });
  }

  // ---- 技の表 ----
  //   seq = コマの並び [[始まるフレーム, 組, 番号], …] / warn = この時刻まで「！」を出す
  //   hits = 当たり [[始まり, 終わり, [x, y, w, h], ダメージ, 大きく吹き飛ばすか], …] / lunge = 踏み込み [[時刻, 速さ], …] / snd = 音 [[時刻, 名前], …]
  //   rec = ここから先は、殴られるとひるむ（技の終わりのスキ）/ dur = 全体の長さ / cd = 次に動くまでの間 [ふだん, 本気]
  //   upd(e, p, t, A, dx, ad) = その技だけの動き（true を返したら、別の動きに移った）。e.q = その技の間だけの覚え書き
  var MV = {
    // 正拳連打: ジャブ → ストレート → フック
    combo: {
      seq: [[0, 'straight', 0], [14, 'straight', 1], [18, 'straight', 2], [25, 'straight', 1], [30, 'straight', 3], [38, 'hook', 0], [48, 'hook', 1], [58, 'straight', 0]],
      warn: 14, hits: [[18, 23, [4, -46, 40, 26], 10, 0], [30, 35, [4, -46, 44, 26], 10, 0], [48, 54, [2, -48, 46, 30], 13, 1]],
      lunge: [[17, 2.4], [29, 2.4], [47, 3.2]], snd: [[16, 'slash_blue1'], [28, 'slash_blue1'], [46, 'slash_red1']], rec: 56, dur: 76, cd: [37, 20]
    },
    // 飛び込み前蹴り: 少し下がってから、低く長く踏み込む（跳べばかわせる）
    kick: {
      seq: [[0, 'front', 0], [16, 'front', 1], [30, 'front', 0], [38, 'straight', 0]], warn: 16, hits: [[16, 27, [8, -32, 58, 30], 14, 1]], snd: [[14, 'dash']], rec: 30, dur: 46, cd: [40, 24],
      upd: function (e, p, t) { if (t < 16) e.vx = -e.face * 0.5; else if (t <= 25) { e.vx = e.face * 6.4; if (t % 3 === 0) ghost(e, 9); } }
    },
    // 回し蹴り: 高い蹴り。跳んでいる相手も落とす
    round: {
      seq: [[0, 'round', 0], [12, 'round', 1], [22, 'round', 0], [30, 'straight', 0]], warn: 12, hits: [[12, 20, [0, -68, 48, 46], 14, 1]], lunge: [[11, 2.2]], snd: [[10, 'slash_red1']], rec: 24, dur: 38, cd: [35, 20],
      upd: function (e, p, t) { if (t === 12) X.fx({ type: 'slash', x: e.x + e.face * 2, y: e.y - 40, face: e.face, a0: -2.5, a1: 0.5, r: 40, wd: 0.9, life: 11, col: 'purple' }); }
    },
    // 下段蹴り: 足もとを払う（跳べばかわせる）
    low: {
      seq: [[0, 'low', 0], [13, 'low', 1], [24, 'low', 0], [32, 'straight', 0]], warn: 13, hits: [[13, 21, [6, -13, 56, 13], 12, 0]], lunge: [[12, 2.6]], snd: [[11, 'slash_blue2']], rec: 26, dur: 40, cd: [35, 20],
      upd: function (e, p, t) { if (t === 13) X.dust(e.x + e.face * 30, e.y, 5); }
    },
    // 裏拳: 回り込んだ直後に出す
    backfist: {
      seq: [[0, 'backfist', 0], [13, 'backfist', 1], [22, 'backfist', 0], [30, 'straight', 0]], warn: 13, hits: [[13, 19, [0, -48, 42, 30], 12, 1]], lunge: [[12, 2.8]], snd: [[11, 'slash_blue2']], rec: 22, dur: 36, cd: [24, 14]
    },
    // 肘打ち: ガードを守りきったあとの反撃
    counter: {
      seq: [[0, 'elbow', 0], [9, 'elbow', 1], [20, 'elbow', 0], [28, 'straight', 0]], warn: 9, hits: [[9, 16, [0, -50, 36, 34], 13, 1]], lunge: [[8, 3]], snd: [[7, 'slash_red1']], rec: 20, dur: 34, cd: [24, 14]
    },
    // 昇天膝: 沈み込んでから、膝で跳び上がる（対空）。着地にスキがある
    knee: {
      warn: 10, fric: 1, cd: [40, 27],
      upd: function (e, p, t) {
        var q = e.q;
        if (t < 10) { e.fr = F('riseknee', 0); e.vx *= 0.6; return; }
        if (t === 10) { e.vy = -8.4; e.vx = clamp((p.x - e.x) * 0.07, -2.8, 2.8); R.snd('slash_red2'); X.dust(e.x, e.y, 5); }
        if (!q.land) {
          if (e.vy < 0) { e.fr = F('riseknee', t < 15 ? 1 : 2); strike(e, [-10, -62, 36, 58], 15, 1); if (t % 2 === 0) ghost(e, 9); }
          else e.fr = F('fall', e.vy < 3 ? 0 : 1);
          if (e.ground && t > 14) { q.land = t; q.rec = true; e.vx = 0; X.dust(e.x, e.y, 5); R.snd('land'); }
        } else {
          e.vx *= 0.7; e.fr = F('land', t - q.land < 8 ? 0 : t - q.land < 16 ? 1 : 2);
          if (t - q.land >= 26) finish(e);
        }
      }
    },
    // 衝撃掌打: 気をためて、衝撃波を飛ばす（跳び越えるか、ダッシュですり抜ける）。本気のときは、撃つと見せて背後へ回ることがある
    palm: {
      seq: [[0, 'palm', 0], [30, 'palm', 1], [50, 'palm', 0], [60, 'straight', 0]], warn: 30, rec: 52, dur: 68, cd: [43, 26],
      upd: function (e, p, t) { if (charge(e, p, t)) return true; if (t === 30) fireWave(e, 4.4); }
    },
    palm2: {      // 2 連発（本気）
      seq: [[0, 'palm', 0], [30, 'palm', 1], [40, 'palm', 0], [52, 'palm', 1], [70, 'palm', 0], [78, 'straight', 0]], warn: 30, rec: 70, dur: 86, cd: [43, 29],
      upd: function (e, p, t) { if (charge(e, p, t)) return true; if (t === 30) fireWave(e, 4.4); if (t === 52) fireWave(e, 5.6); }
    },
    // 回転蹴り: 回りながら突き進む（跳び越えるか、ダッシュですり抜ける）。終わりに目を回す
    spin: {
      warn: 18, fric: 1, cd: [46, 31],
      upd: function (e, p, t, A) {
        var q = e.q;
        if (t < 18) { e.fr = F('spin', 0); e.vx *= 0.6; return; }
        if (!q.end) {
          e.vx = e.face * (rage(e) ? 4.1 : 3.3); e.fr = F('spin', 1 + (Math.floor((t - 18) / 5) % 3));
          strike(e, [-24, -56, 50, 52], 14, 1);
          if (t % 3 === 0) ghost(e, 10);
          if ((t - 18) % 10 === 0) { R.snd('slash_red1'); X.fx({ type: 'ring', x: e.x, y: e.y - 26, life: 12, r: 30, col: PUR[1], flat: true }); }
          if (t >= 18 + (rage(e) ? 56 : 48) || e.x <= A[0] + 18 || e.x >= A[1] - 18) { q.end = t; q.rec = true; }
        } else {
          e.vx *= 0.75; e.fr = F('land', t - q.end < 14 ? 1 : 2);
          if (t - q.end >= 30) finish(e);
        }
      }
    },
    // 地裂撃: 相手めがけて跳び、地面を叩く。紫の牙が、左右へ順に噴き上がる（外へ逃げるか、跳んでやりすごす）。叩いたあとは大きなスキ
    smash: {
      warn: 14, fric: 1, cd: [50, 34],
      upd: function (e, p, t, A) {
        var q = e.q, k, s, x, n;
        if (t < 14) { e.fr = F('smash', 0); e.vx *= 0.6; return; }
        if (t === 14) { e.vy = -9.6; e.vx = clamp((p.x - e.x) / 42, -4.4, 4.4); R.snd('jump'); X.dust(e.x, e.y, 6); }
        if (!q.land) {
          e.fr = e.vy < -4 ? F('rise', 2) : e.vy < -1 ? F('rise', 3) : e.vy < 2 ? F('apex', 1) : F('fall', 1);
          if (t % 3 === 0) ghost(e, 9);
          if (e.ground && t > 18) {
            q.land = t; q.rec = true; e.vx = 0; X.shake(9); R.snd('special_red'); X.dust(e.x, e.y, 14);
            X.fx({ type: 'kfx', f: F('erupt', 0), x: e.x, y: GY, life: 28 });
            if (p.ground && Math.abs(p.x - e.x) < 34) X.hurtPlayer(15, sign(p.x - e.x), true);
            n = rage(e) ? 4 : 3;
            for (k = 1; k <= n; k++) for (s = -1; s <= 1; s += 2) {
              x = e.x + s * (22 + k * 38);
              if (x > A[0] + 6 && x < A[1] - 6) X.shoot({ type: 'kpillar', x: x, y: GY, vx: 0, vy: 0, warn: 8 + k * 9, life: 8 + k * 9 + 18, dmg: 14, w: 22, h: 60, big: true, loud: s < 0, upd: pillarUpd, draw: pillarDraw });
            }
          }
        } else {
          e.fr = F('smash', t - q.land < 36 ? 1 : 0);
          if (t - q.land >= 44) finish(e);
        }
      }
    },
    // 連撃（ラピッドコンボ）: 突きの連打 → 肘 → 膝 → 上段蹴り → 三日月蹴り。出しきると深く沈む（スキ）
    flurry: {
      warn: 12, rec: 92, dur: 122, cd: [50, 34],
      upd: function (e, p, t) {
        if (t < 12) { e.fr = F('rapid', 6); return; }
        if (t < 48) { e.fr = F('rapid', [1, 2, 3, 4, 5, 0][Math.floor((t - 12) / 4) % 6]); e.vx = e.face * 1.2; if ((t - 12) % 8 === 0) R.snd('slash_blue1'); strike(e, [2, -46, 44, 28], 7, 0); return; }
        if (t < 56) { e.fr = F('rapid', 7); if (t === 48) { e.vx = e.face * 2; R.snd('slash_blue2'); } if (t <= 53) strike(e, [0, -50, 36, 34], 9, 0); return; }
        if (t < 66) { e.fr = F('rapid', 10); if (t === 56) { e.vx = e.face * 2; R.snd('slash_blue2'); } if (t <= 62) strike(e, [0, -46, 36, 38], 9, 0); return; }
        if (t < 78) { e.fr = F('rapid', 12); if (t === 66) { e.vx = e.face * 2.4; R.snd('slash_red1'); } if (t <= 73) strike(e, [0, -64, 48, 42], 10, 1); return; }
        if (t < 92) {
          e.fr = F('rapid', t < 82 ? 13 : 14);
          if (t === 82) { e.vx = e.face * 3; R.snd('slash_red3'); X.shake(4); X.fx({ type: 'slash', x: e.x + e.face * 4, y: e.y - 28, face: e.face, a0: -2.5, a1: 1.3, r: 46, wd: 1.1, life: 14, col: 'purple' }); }
          if (t >= 82 && t <= 88) strike(e, [-4, -66, 58, 64], 16, 1);
          return;
        }
        e.fr = F('rapid', 16);
      }
    },
    // 連撃ラッシュ（本気）: 気合いをためてから、残像を引いて 3 度駆け抜け、三日月蹴りで締める。出しきると息が上がる（大きなスキ）
    rush: {
      warn: 0, fric: 1, cd: [56, 42],
      upd: function (e, p, t, A) {
        var q = e.q, u;
        if (t === 1) { q.ph = 'charge'; q.t0 = 0; q.n = 0; R.snd('roar'); }
        u = t - q.t0;
        if (q.ph === 'charge') {
          e.fr = F('roar', 0); e.vx *= 0.5; e.warn = true;
          if (t % 3 === 0) aura(e, 2);
          if (t % 6 === 0) X.shake(2.5);
          if (u >= 40) { q.ph = 'prep'; q.t0 = t; }
        } else if (q.ph === 'prep') {
          if (u === 1) faceTo(e, p);
          e.fr = F('dash', 0); e.vx = -e.face * 0.4; e.warn = true;
          if (u >= 13) { q.ph = 'run'; q.t0 = t; q.dir = e.face; q.tx = clamp(p.x + q.dir * 112, A[0] + 30, A[1] - 30); R.snd('dash'); }
        } else if (q.ph === 'run') {
          e.vx = q.dir * 8.6; e.fr = F('rush', 0);
          strike(e, [-12, -46, 46, 42], 15, 1);
          if (t % 2 === 0) ghost(e, 14);
          if ((q.dir > 0 ? e.x >= q.tx : e.x <= q.tx) || u > 60) { q.n++; q.ph = q.n < 3 ? 'brake' : 'fin'; q.t0 = t; }
        } else if (q.ph === 'brake') {
          e.vx *= 0.6; e.fr = F('stop', 0);
          if (u === 1) X.dust(e.x, e.y, 5);
          if (u >= 10) { q.ph = 'prep'; q.t0 = t; }
        } else if (q.ph === 'fin') {
          e.vx *= 0.7; e.fr = F('rapid', u < 5 ? 13 : 14);
          if (u === 1) { faceTo(e, p); e.vx = e.face * 3; }
          if (u === 5) { R.snd('slash_red3'); X.shake(5); X.fx({ type: 'slash', x: e.x + e.face * 4, y: e.y - 28, face: e.face, a0: -2.5, a1: 1.3, r: 50, wd: 1.2, life: 14, col: 'purple' }); }
          if (u >= 5 && u <= 11) strike(e, [-4, -66, 60, 64], 16, 1);
          if (u >= 18) { q.ph = 'rest'; q.t0 = t; q.rec = true; }
        } else {
          e.vx *= 0.7; e.fr = F('land', (u >> 4) % 2 ? 1 : 2);      // 肩で息をする
          if (u >= 56) finish(e);
        }
      }
    },
    // ---- 2 枚目のシートの技 ----
    // 飛び膝蹴り: 深く沈んでから、相手めがけて前へ跳び、膝を突き上げる（間合いを一気に詰める。ダッシュでくぐるか、下がってかわす）。着地にスキ
    hiza: {
      warn: 14, fric: 1, cd: [40, 26],
      upd: function (e, p, t) {
        var q = e.q;
        if (t < 14) { e.fr = F('hiza', 0); e.vx *= 0.5; return; }
        if (t === 14) { faceTo(e, p); e.vy = -6.6; e.vx = e.face * clamp(Math.abs(p.x - e.x) / 30, 2.4, rage(e) ? 5.4 : 4.6); R.snd('dash'); X.dust(e.x, e.y, 6); }
        if (!q.land) {
          e.fr = t < 18 ? F('hiza', 1) : F('hizaair', 0);
          if (t >= 16) strike(e, [-6, -54, 36, 44], 15, 1);
          if (t % 2 === 0) ghost(e, 10);
          if (e.ground && t > 18) { q.land = t; q.rec = true; e.vx *= 0.3; X.dust(e.x, e.y, 6); R.snd('land'); }
        } else {
          e.vx *= 0.7; e.fr = F('land', t - q.land < 10 ? 0 : t - q.land < 18 ? 1 : 2);
          if (t - q.land >= 24) finish(e);
        }
      }
    },
    // 足刀蹴り（遠距離）: 構えてから、真横へ蹴り抜き、三日月の刃を飛ばす。本気のときは 2 発
    sokuto: {
      seq: [[0, 'sokuto', 0], [18, 'sokuto', 1], [32, 'sokuto', 0], [40, 'straight', 0]], warn: 18, hits: [[18, 23, [6, -40, 52, 24], 12, 1]], lunge: [[17, 2.6]], rec: 32, dur: 48, cd: [38, 24],
      upd: function (e, p, t) {
        if (t < 18 && t % 3 === 0) X.part(e.x + e.face * rand(4, 14), e.y - rand(20, 40), -e.face * 0.6, rand(-0.6, 0.2), 10, t % 6 ? PUR[1] : PUR[2], 2, 0, true);      // 足もとに気が集まる
        if (t === 18) fireBlade(e, rage(e) ? 6.2 : 5.2);
        if (t === 30 && rage(e)) { e.fr = F('sokuto', 1); fireBlade(e, 4.4); }
      }
    },
    // 跳び蹴り（空中攻撃）: 高く跳び、頂点で相手を見定めて、斜めに蹴り落ちる（ダッシュで横へ逃げる）。着地にスキ
    akick: {
      warn: 12, fric: 1, cd: [42, 28],
      upd: function (e, p, t, A) {
        var q = e.q, d;
        if (t < 12) { e.fr = F('hiza', 0); e.vx *= 0.5; return; }
        if (t === 12) { e.vy = -8.4; e.vx = -e.face * 1.2; R.snd('jump'); X.dust(e.x, e.y, 6); }
        if (!q.dive && !q.land) {
          e.fr = e.vy < -3 ? F('akick', 2) : F('akick', 0);
          if (e.vy > -1.2 && t > 16) {      // 頂点: 相手の足もとめがけて、斜めに蹴り落ちる（落ちるまでの時間から、横の速さを決める）
            faceTo(e, p); d = Math.abs(p.x - e.x);
            var hh = Math.max(10, GY - e.y), tt = Math.max(hh / (rage(e) ? 6.4 : 5.6), d / 7.2);      // 遠いときは、浅い角度で長く滑空する
            q.dive = t; q.vy = hh / tt; e.vy = q.vy; e.vx = e.face * Math.max(1.4, d / tt); R.snd('slash_red3');
            X.fx({ type: 'ring', x: e.x, y: e.y - 26, life: 10, r: 22, col: PUR[1] });
          }
          if (e.ground && t > 16) { q.land = t; q.rec = true; }
          return;
        }
        if (q.dive && !q.land) {
          e.fr = F('akick', 1); e.vy = q.vy - 0.45;      // まっすぐ斜めに落ちる（このあと重力が足されて、ちょうどこの速さ）
          strike(e, [0, -42, 44, 42], 16, 1);
          if (t % 2 === 0) ghost(e, 12);
          if (e.ground) {
            q.land = t; q.rec = true; e.vx = 0; X.shake(6); X.dust(e.x, e.y, 10); R.snd('special_red');
            X.fx({ type: 'ring', x: e.x + e.face * 10, y: e.y - 2, life: 14, r: 34, col: PUR[1], flat: true });
            if (p.ground && Math.abs(p.x - e.x) < 40) X.hurtPlayer(10, sign(p.x - e.x), false);      // 着地の衝撃
          }
          return;
        }
        e.vx *= 0.7; e.fr = F('land', t - q.land < 12 ? 1 : 2);
        if (t - q.land >= 28) finish(e);
      }
    },
    // カメラのフラッシュ: 構える（無防備）→ 光る → 光に紛れて動く
    camera: {
      warn: 0, cd: [21, 12],
      upd: function (e, p, t, A) {
        if (t < CAM_FLASH) {
          e.fr = F('camera', t < 10 ? 0 : t < 22 ? 1 : 2);
          if (t === 22 || t === 33) R.snd('select');      // ピピッ（ピントが合う音）
          return;
        }
        e.fr = F('camera', 3);
        if (t === CAM_FLASH) flashNow(e, p);
        if (t === CAM_FLASH + 6) {
          if (rage(e)) spawnDecoy(e);      // 写し身を残す
          if (Math.random() < (e.q.seen ? 0.85 : 0.6) && startStep(e, p, 'behind', true)) return true;
          start(e, Math.abs(p.x - e.x) < 70 ? 'low' : 'kick'); return true;
        }
      }
    }
  };
  // 衝撃掌打のため: 光の粒が手元へ集まる。本気のときは、撃つと見せて背後へ回る（フェイント）
  function charge(e, p, t) {
    if (t >= 30) return false;
    if (t % 2 === 0) {
      var a = rand(0, PI * 2), r = rand(16, 30);
      X.part(e.x + e.face * 12 + Math.cos(a) * r, e.y - 24 + Math.sin(a) * r, -Math.cos(a) * r / 12, -Math.sin(a) * r / 12, 12, t % 4 ? PUR[1] : PUR[2], 2, 0, true);
    }
    return t === 22 && rage(e) && e.stepCd <= 0 && Math.random() < 0.34 && startStep(e, p, 'behind', false);
  }
  function flashNow(e, p) {
    // 光った瞬間にカメラのほうを向いていると、目がくらむ（ダッシュや技の最中は平気）
    var seen = (e.x - p.x) * p.face > 0 && p.st !== 'dash' && p.st !== 'special' && p.st !== 'cross' && !G.cross;
    R.snd('shutter'); G.flash = Math.max(G.flash, 1); X.shake(3);
    X.fx({ type: 'ring', x: e.x + e.face * 9, y: e.y - 38, life: 16, r: 70, col: '#ffffff' });
    X.burst(e.x + e.face * 9, e.y - 38, 14, ['#ffffff', '#cfe8ff'], 4, 16);
    if (seen) { G.dazzle = DAZZLE; X.text(p.x, p.y - 44, 'まぶしい！', '#ffffff', true); p.hurtFaceT = 40; }
    else X.text(p.x, p.y - 44, '見切った！', '#ffe04a', true);
    e.q.seen = seen;
  }

  function start(e, name) {
    go(e, 'move'); e.mv = MV[name]; e.mvName = name;
    faceTo(e, G.pl);
    if (name === 'camera') { e.camCd = rage(e) ? 400 : 500; hint('camera', 'カメラだ！　光る瞬間は背を向けろ（構えの間は、殴れば止まる）'); }
    if (name === 'rush') { e.rushCd = 640; bossCut('grin', 'この拳、見切れるか！'); }
    if (name === 'sokuto') hint('sokuto', '足刀の刃だ！　跳び越えるか、ダッシュですり抜けろ');
  }
  function finish(e) {
    var m = e.mv;
    e.last = e.mvName; go(e, 'idle'); e.cd = Math.round(m.cd[rage(e) ? 1 : 0] * rand(0.8, 1.25));
  }

  // ---- 見切り（サイドステップ）。mode: 'behind' = 相手の背後へ抜ける / 'back' = 間合いの外へ下がる。hide = 光に紛れて姿を消す ----
  function startStep(e, p, mode, hide) {
    var A = arena(e), tx;
    if (mode === 'behind') {
      tx = p.x - p.face * 46;
      if (tx < A[0] + 22 || tx > A[1] - 22) { tx = p.x + p.face * 46; if (tx < A[0] + 22 || tx > A[1] - 22) mode = 'back'; }
    }
    if (mode !== 'behind') tx = clamp(e.x - sign(p.x - e.x) * 78, A[0] + 22, A[1] - 22);
    go(e, 'step'); e.mode = mode; e.sx = e.x; e.tx = tx; e.hide = !!hide; e.invul = 18; e.stepCd = rage(e) ? 64 : 104; e.gHits = 0;
    if (tx !== e.x) e.face = tx > e.x ? 1 : -1;
    if (!hide) R.snd('dash');
    return true;
  }
  function stStep(e, p, dx, ad, t) {
    var nx = e.sx + (e.tx - e.sx) * R.ease(Math.min(1, t / 12));
    e.vx = nx - e.x; e.fr = F('step', t < 6 ? 0 : 1); e.invul = Math.max(e.invul, 2);
    if (!e.hide && t % 2 === 0) ghost(e, 12);
    if (t >= 13) {
      e.vx = 0; faceTo(e, p);
      if (e.hide) { e.hide = false; X.fx({ type: 'ring', x: e.x, y: e.y - 26, life: 12, r: 26, col: PUR[1] }); }
      if (e.mode === 'behind') start(e, Math.abs(p.x - e.x) < 66 ? 'backfist' : 'kick');
      else if (rage(e) && Math.random() < 0.45) start(e, 'palm');
      else { go(e, 'idle'); e.cd = 14; }
    }
  }

  // ---- ガード ----
  function startGuard(e, dur) {
    go(e, 'guard'); faceTo(e, G.pl);
    hint('guard', 'ガードだ！　正面は弾かれる ― 重い一撃で割るか、背後へ回れ');
    e.gDur = dur || (rage(e) ? 84 : 72); e.gp = rage(e) ? 92 : 72; e.gHits = 0; e.gIdle = 0; e.gTxt = 0; e.backN = 0; e.backT = 0; e.vx *= 0.3;
  }
  function stGuard(e, p, dx, ad, t) {
    e.vx *= 0.7; e.fr = F('guard', 0); e.gIdle++; if (e.gTxt > 0) e.gTxt--;
    if (e.backT > 0 && (--e.backT === 0 || e.backN >= 4)) { startStep(e, p, 'behind', false); return; }      // 背後を取られたら、すぐに回り込み返す
    if (t % 16 === 0 && !(e.backT > 0)) faceTo(e, p);      // 向き直るのは遅い（背後へ回る余地がある）
    if (t >= e.gDur || (e.gIdle > 34 && t > 20)) {      // 守りきったら、すかさず反撃
      faceTo(e, p);
      if (ad < 52) start(e, 'counter'); else if (ad < 124) start(e, 'kick'); else { go(e, 'idle'); e.cd = 10; }
    }
  }
  function breakGuard(e) {
    go(e, 'stagger'); e.vx = -e.face * 2.4; e.gHits = 0; e.expr = 'n_surprise'; e.exprT = 100;
    X.text(e.x, e.y - 66, 'GUARD BREAK!', '#ffe04a', true); X.shake(6); G.hitstop = Math.max(G.hitstop, 7);
    X.burst(e.x + e.face * 10, e.y - 30, 16, ['#aebcff', '#ffffff', '#ffe04a'], 4.5, 26, 0.1);
    R.snd('hit_heavy');
  }
  // 攻撃を受けるとき（50_game.js の damageEnemy から）。false = 当たらない / { mul, guard } = ダメージの倍率と、ガードしたか / null = ふつうに受ける
  function onHit(e, dmg, dir, kb, opt) {
    var p = G.pl;
    if (e.st === 'stagger') return { mul: 1.2 };
    if (e.st !== 'guard' || opt.cross) return null;
    if (opt.chain) { breakGuard(e); return { mul: 1 }; }                                  // 鎖鎌は、ガードごと引き崩す
    if ((p.x - e.x) * e.face < 0) {                                                       // 背中は守れない（ただし、すぐに回り込み返してくる）
      if (!(e.backN > 0)) X.text(e.x, e.y - 64, 'BACK!', '#ffe04a', true);
      e.backN = (e.backN || 0) + 1; if (!(e.backT > 0)) e.backT = 24;
      return { mul: 1.5 };
    }
    e.gp -= dmg * (opt.heavy ? 1.5 : 1); e.gIdle = 0;
    if (e.gp <= 0) { breakGuard(e); return { mul: 1 }; }                                  // 重い一撃で割れる
    if (!(e.gTxt > 0)) { X.text(e.x, e.y - 62, 'GUARD', '#aebcff'); e.gTxt = 26; }
    return { mul: 0.1, guard: true };
  }
  // 攻撃が通ったあと: ひるみ・殴られた回数（たまるとガードする）・本気への切り替え
  function afterHit(e, d, dir, kb, opt) {
    e.gHits += opt.heavy ? (rage(e) ? 3 : 2) : 1; e.gT = 90; e.expr = e.hp < e.max * 0.3 ? 'n_wounded' : 'hurt'; e.exprT = 40;
    if (e.hp <= 0) return;
    if (e.phase === 1 && e.hp <= e.max * 0.5) e.pending = true;      // 次に動けるとき、本気を出す
    if (e.st === 'stagger') { e.vx = dir * Math.min(1.6, kb * 0.3); return; }
    var cam = e.st === 'move' && e.mvName === 'camera' && e.stT < CAM_FLASH;
    var soft = e.st === 'idle' || e.st === 'hurt' || e.st === 'guard' || cam || (e.st === 'move' && (e.q.rec || (e.mv.rec && e.stT >= e.mv.rec)));
    if (!soft) return;                // 技の最中は、殴られてもひるまない
    if (cam) { X.text(e.x, e.y - 64, 'CANCEL!', '#ffe04a', true); e.expr = 'surprise'; e.exprT = 70; e.camCd = 260; }      // カメラを構えているところを殴れば、止められる
    else if (!opt.heavy) return;      // 軽い攻撃では、ひるまない（重い一撃だけが体勢を崩す）。数は数えていて、たまるとガードに入る
    go(e, 'hurt'); e.big = !!opt.heavy; e.vx = dir * Math.min(2.4, kb * 0.45);
  }
  function stHurt(e, p, dx, ad, t) {
    e.vx *= 0.82; e.fr = F(e.big ? 'hurtbig' : 'hurt', t < 6 ? 0 : 1);
    if (e.gHits >= (rage(e) ? 3 : 4) && t >= 4 && !e.pending) { startGuard(e); return; }      // 殴られ続けたら、割り込んでガード
    if (t >= (e.big ? 20 : 13)) { go(e, 'idle'); e.cd = Math.min(e.cd, 16); }
  }
  function stStagger(e, p, dx, ad, t) {
    e.vx *= 0.86; e.fr = F('stagger', t < 16 ? 0 : t < STAGGER - 22 ? 1 : 0);
    if (t >= STAGGER) { e.gHits = 0; startStep(e, p, 'back', false); }      // 立ち直ると、間合いの外へ跳びのく
  }

  // ---- 写し身（写真の残像）: 立っているだけ。斬ると、砕けて消える ----
  function spawnDecoy(e) {
    var d = X.spawn('photo', e.x, e.y);
    d.face = e.face; d.owner = e; d.fr = F('straight', 0); G.enemies.push(d);
    hint('decoy', '写し身だ！　本物は、別の場所から来る');
    X.fx({ type: 'ring', x: e.x, y: e.y - 26, life: 14, r: 34, col: '#cfe8ff' });
  }
  function killDecoys(e) { G.enemies.forEach(function (d) { if (d.type === 'photo' && d.owner === e) d.life = Math.min(d.life, 12); }); }
  function updPhoto(d) {
    var o = d.owner;
    d.life--; d.stT++; faceTo(d, G.pl); d.fr = F('straight', 0);
    if (o && (o.dead || o.st === 'die' || o.st === 'stagger' || o.st === 'roar')) d.life = Math.min(d.life, 12);
    if (d.life <= 0) { d.dead = true; X.burst(d.x, d.y - 26, 8, ['#cfe8ff', '#ffffff'], 2, 14); }
  }
  function killPhoto(d) {
    X.text(d.x, d.y - 62, 'ニセモノ！', '#cfe8ff', true); R.snd('enemy_die');
    X.burst(d.x, d.y - 28, 22, ['#ffffff', '#cfe8ff', PUR[1]], 4.2, 24, 0.14);
    X.fx({ type: 'ring', x: d.x, y: d.y - 26, life: 14, r: 40, col: '#ffffff' });
  }

  // ---- 登場・待ち・本気・退場 ----
  // 中ボス戦の始まり（50_game.js の updBossTrigger から）。フラッシュが光り、いつの間にか腕を組んで立っている
  function enter(e, m) {
    X = R.GX;
    faceTo(e, G.pl); e.fr = F('pose', 0); e.invul = 9999;
    R.bgm(null); G.flash = 1; R.snd('shutter'); X.shake(4);
    e.talkT = (!G.midMet && R.TALKS && R.TALKS.kurose && R.beginTalk) ? 36 : 0;      // はじめて会ったときは、姿を見せてから、短い会話をはさむ
    G.midMet = true;
  }
  function stIntro(e, p, dx, ad, t) {
    e.vx = 0; e.invul = 2; faceTo(e, p);
    if (e.talkT > 0) {      // 会話の前: 腕を組んで立っている
      e.fr = F('pose', 0); e.stT = 0;
      if (--e.talkT === 0) R.beginTalk('kurose', { vs: e });
      return;
    }
    if (t === 1) R.bgm((e.mid && e.mid.bgm) || 'midboss');
    if (t < 70) e.fr = F('pose', 0);
    else { e.fr = F('taunt', (t >> 4) % 2); if (t === 70) { e.expr = 'n_taunt'; e.exprT = 90; } }      // 手招き
    if (t >= 128) { go(e, 'idle'); e.cd = 26; e.invul = 0; }
  }
  function stRoar(e, p, dx, ad, t) {
    e.vx = 0; e.invul = 2; e.fr = F('roar', 0);
    if (t === 1) { e.phase = 2; R.snd('roar'); X.toast('黒瀬が本気を出した…！', '#d9a0ff'); e.expr = 'rage'; e.exprT = 150; G.flash = Math.max(G.flash, 0.4); bossCut('reach', '遊びは終わりだ。――本気で行くぞ！'); }
    if (t % 4 === 0) { X.shake(4); aura(e, 3); }
    if (t === 10) {      // 気合いで押し返す（ダメージはない）
      X.fx({ type: 'ring', x: e.x, y: e.y - 26, life: 20, r: 96, col: PUR[1] });
      if (ad < 84) { p.vx = sign(p.x - e.x) * 5.5; p.vy = Math.min(p.vy, -2.6); }
    }
    if (t >= 76) { go(e, 'idle'); e.cd = 18; e.camCd = Math.min(e.camCd, 70); e.stepCd = 0; }
  }
  function onKill(e, dir) {
    e.dead = false; e.dying = true; e.hp = 0; G.kills++;
    go(e, 'die'); e.vx = (dir || -e.face) * 3.2; e.vy = -3; e.invul = 0; e.trail = []; e.hide = false; e.expr = 'hurt'; e.exprT = 9999;
    G.shots = []; G.bossCut = null; R.bgm(null); R.snd('hit_heavy'); killDecoys(e);
    X.gainExp(e.exp);
    G.hitstop = Math.max(G.hitstop, 14); G.flash = Math.max(G.flash, 0.6); X.shake(10);
  }
  // 退場: 膝をつき、立ち上がって一枚撮り、光に紛れて去る（正体と目的は謎のまま）
  function stDie(e, p, dx, ad, t) {
    var i;
    e.vx *= 0.9;
    if (t < 26) e.fr = F('hurtbig', 1);
    else if (t < 50) e.fr = F('down', 0);
    else if (t < 130) e.fr = F('down', 1);
    else if (t < 150) e.fr = F('getup', 1);
    else if (t < 166) e.fr = F('getup', 2);
    else if (t < 196) e.fr = F('camera', t < 180 ? 1 : 2);
    else e.fr = F('camera', 3);
    if (t === 150) faceTo(e, p);
    if (t === 84) X.toast(p.chars.kurenai.down || p.chars.aoi.down ? '黒瀬「……いい腕だ。その覚悟、見せてもらった」' : '黒瀬「……いい腕だ。二人で、ひとつか」', '#d9b8ff');
    if (t === 170) R.snd('select');
    if (t === 130) { e.expr = 'n_wounded'; e.exprT = 9999; }
    if (t === 196) { R.snd('shutter'); G.flash = 1; e.expr = 'n_laugh'; X.toast('黒瀬「いい顔だ、撮らせてもらった。――行け。姫は、龍の足もとだ」', '#d9b8ff'); }
    if (t >= 204) {      // 薬と結晶を置いていく
      for (i = 0; i < 5; i++) X.dropItem('crystal', e.x + rand(-30, 30), e.y - 30);
      X.dropItem('potion', e.x, e.y - 40);
      X.burst(e.x, e.y - 26, 20, ['#ffffff', PUR[1], '#cfe8ff'], 4, 26);
      R.midBossDone(e);
    }
  }

  // 待ち: すり足で間合いを保ちながら、次の手を選ぶ
  function stIdle(e, p, dx, ad, t, A) {
    faceTo(e, p);
    var sp = rage(e) ? 1.3 : 1, ph = (e.animT % 24) / 24;
    e.bob = 0;
    if (ad > 112) { e.vx = e.face * 1.25 * sp; e.fr = F('walk', [0, 1, 2, 1][(e.animT >> 3) % 4]); }                              // 遠ければ、歩いて詰める
    else if (ad < 40) { e.vx = -e.face * (ph < 0.5 ? 1.3 : 0.2) * sp; e.fr = F(ph < 0.5 ? 'hook' : 'straight', 0); }              // 近すぎれば、すり足で下がる
    else { e.vx *= 0.7; e.fr = F('straight', 0); e.bob = (e.animT % 56) < 28 ? 0 : 1; }                                           // 構えたまま、息をする
    if (react(e, p, dx, ad)) return;
    if (e.cd > 0) { e.cd--; return; }
    choose(e, p, dx, ad);
  }
  // 相手の出方を見て動く（待っているときだけ）
  function react(e, p, dx, ad) {
    var a = p.atk, i, s, pr;
    if (e.gHits >= (rage(e) ? 3 : 4)) {      // 殴られ続けたら、ガードに入る（ときには、回り込んでかわす）
      if (e.stepCd <= 0 && Math.random() < (rage(e) ? 0.4 : 0.25)) startStep(e, p, 'behind', false); else startGuard(e);
      return true;
    }
    for (i = 0; i < G.pshots.length; i++) {      // 飛んでくる刃は、見切るか、受け止める
      s = G.pshots[i];
      if (!s.dead && (e.x - s.x) * s.vx > 0 && Math.abs(s.x - e.x) < 66 && Math.abs(s.y - (e.y - 24)) < 36) {
        if (e.stepCd <= 0 && Math.random() < (rage(e) ? 0.5 : 0.3)) startStep(e, p, 'behind', false); else startGuard(e, 36);
        return true;
      }
    }
    if (p.st === 'attack' && a && p.stT === 1 && !a.dive && e.stepCd <= 0 && ad < (a.kusari ? 150 : 86)) {      // 振りかぶりを見て、回り込む
      pr = (rage(e) ? 0.42 : 0.24) + (p.who === 'kurenai' ? 0.14 : 0);      // 紅の大振りは、読みやすい
      if (Math.random() < pr) { startStep(e, p, 'behind', false); return true; }
    }
    return false;
  }
  function choose(e, p, dx, ad) {
    var r = rage(e), air = !p.ground && p.y < GY - 26, w = [], tot = 0, k, i, cam = e.camCd <= 0;
    function add(name, wt) { if (wt > 0) { if (name === e.last) wt *= 0.3; w.push([name, wt]); tot += wt; } }
    if (air && ad < 86) { add('knee', 5); add('round', 4); }
    else if (air) { add('sokuto', 3); add('akick', 2.5); add('palm', 1.5); }      // 離れて跳んでいる相手: 刃を飛ばすか、上から蹴り落ちる
    else if (ad < 56) { add('combo', 4); add('low', 2.5); add('round', 2); add('flurry', r ? 3.5 : 0.8); add('camera', cam ? 2.5 : 0); add('spin', 1); add('akick', 1); }
    else if (ad < 140) { add('kick', 3.5); add('hiza', 3); add('spin', 2); add('palm', 2); add('sokuto', 2); add('low', ad < 84 ? 2 : 0); add('smash', r ? 2.5 : 1.2); add('akick', 1.5); add('camera', cam ? 3 : 0); add('rush', r && e.rushCd <= 0 ? 3 : 0); }
    else { add('palm', 3); add('sokuto', 3); add('hiza', 2); add('kick', 2); add('akick', 2.5); add('smash', 2.5); add('spin', 1.5); add('camera', cam ? 3 : 0); add('rush', r && e.rushCd <= 0 ? 4 : 0); }
    k = Math.random() * tot;
    for (i = 0; i < w.length; i++) { k -= w[i][1]; if (k <= 0) break; }
    k = w[Math.min(i, w.length - 1)][0];
    if (k === 'palm' && r && Math.random() < 0.6) k = 'palm2';
    start(e, k);
  }
  function stMove(e, p, dx, ad, t, A) {
    var m = e.mv, i, h;
    if (m.seq) e.fr = seqF(m.seq, t);
    e.warn = t <= m.warn;
    e.vx *= (m.fric != null ? m.fric : 0.8);
    if (m.lunge) for (i = 0; i < m.lunge.length; i++) if (t === m.lunge[i][0]) e.vx = e.face * m.lunge[i][1];
    if (m.snd) for (i = 0; i < m.snd.length; i++) if (t === m.snd[i][0]) R.snd(m.snd[i][1]);
    if (m.upd && m.upd(e, p, t, A, dx, ad) === true) return;
    if (e.mv !== m) return;      // 技の中で終わった（finish）
    if (m.hits) for (i = 0; i < m.hits.length; i++) { h = m.hits[i]; if (t >= h[0] && t <= h[1]) strike(e, h[2], h[3], h[4]); }
    if (m.dur && t >= m.dur) finish(e);
  }
  var ST = { intro: stIntro, idle: stIdle, move: stMove, step: stStep, guard: stGuard, hurt: stHurt, stagger: stStagger, roar: stRoar, die: stDie };

  function update(e) {
    if (!X) X = R.GX;
    if (e.type === 'photo') { updPhoto(e); return; }
    var p = G.pl, A = arena(e), i;
    e.stT++; e.animT++;
    if (e.invul > 0) e.invul--;
    if (e.stepCd > 0) e.stepCd--;
    if (e.camCd > 0) e.camCd--;
    if (e.rushCd > 0) e.rushCd--;
    if (e.exprT > 0) e.exprT--;
    if (G.bossCut && ++G.bossCut.t > 84) G.bossCut = null;
    if (e.gT > 0 && --e.gT === 0) e.gHits = 0;      // しばらく殴られなければ、数え直す
    e.warn = false;
    for (i = 0; i < e.trail.length; i++) e.trail[i].t++;
    if (e.trail.length) e.trail = e.trail.filter(function (q) { return q.t < q.life; });
    if (rage(e) && e.st !== 'die' && e.animT % 6 === 0) aura(e, 1);
    if (e.pending && (e.st === 'idle' || e.st === 'hurt' || e.st === 'guard')) { e.pending = false; go(e, 'roar'); }      // 体力が半分を切ったら、本気を出す
    ST[e.st](e, p, p.x - e.x, Math.abs(p.x - e.x), e.stT, A);
    e.vy = Math.min(9, e.vy + 0.45); X.moveBody(e);
    e.x = clamp(e.x, A[0] + 14, A[1] - 14);
    if (e.y > R.H + 60) { e.y = GY; e.vy = 0; }
  }

  function init(e) {
    if (e.type === 'karate') {
      e.w = 20; e.h = 50; e.hp = e.max = HP; e.exp = 220; e.armor = true;
      e.phase = 1; e.st = 'intro'; e.stT = 0; e.cd = 60; e.q = {}; e.mv = null; e.mvName = ''; e.last = '';      // mvName = いま出している技の名前（e.name は、HUD に出す名前）
      e.gHits = 0; e.gT = 0; e.gp = 0; e.stepCd = 0; e.camCd = 200; e.rushCd = 0; e.trail = []; e.fr = null; e.warn = false; e.hide = false;
      e.expr = 'smirk'; e.exprT = 0; e.pending = false;
      e.onHit = onHit; e.afterHit = afterHit; e.onKill = onKill; e.upd = update; e.draw = draw;
      return true;
    }
    if (e.type === 'photo') {
      e.w = 20; e.h = 50; e.hp = e.max = 1; e.exp = 0; e.armor = true; e.life = 260; e.trail = [];
      e.onKill = killPhoto; e.upd = update; e.draw = draw;
      return true;
    }
    return false;
  }

  // ---- 絵 ----
  function put(g, c, x, y, face, f) {
    x = Math.round(x); y = Math.round(y);
    if (face < 0) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(c, -f.ox, -f.oy); g.restore(); }
    else g.drawImage(c, x - f.ox, y - f.oy);
  }
  function star(g, x, y, r, col) {      // 十字の光
    g.fillStyle = col; g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
    if (r > 2) { g.fillRect(x - 1, y - 1, 3, 3); }
  }
  function draw(g, e, cam) {
    if (!SP) return;
    var f = e.fr || F('straight', 0), x = Math.round(e.x - cam), y = Math.round(e.y), i, tr, a, t = e.stT;
    if (e.type === 'photo') {      // 写し身: わずかに透けて、青白い。ときどき白い線が走る
      a = Math.min(1, e.life / 14) * (0.84 + 0.08 * Math.sin(G.t * 0.9));
      g.globalAlpha = a; put(g, f.c, x, y, e.face, f);
      g.globalAlpha = a * 0.34; put(g, R.tinted(f, '#9ad8ff'), x, y, e.face, f);
      g.globalAlpha = 1;
      if ((G.t + (e.x | 0)) % 43 < 3) { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x - 14, y - 6 - ((G.t * 3) % 44), 28, 1); }
      return;
    }
    for (i = 0; i < e.trail.length; i++) {      // 残像（紫）
      tr = e.trail[i]; g.globalAlpha = 0.42 * (1 - tr.t / tr.life);
      put(g, R.tinted(tr.f, '#a050ff'), tr.x - cam, tr.y, tr.face, tr.f);
    }
    g.globalAlpha = 1;
    if (e.hide) return;      // 光に紛れて、姿を消している
    if (G.state === 'gameover' && e.st !== 'die') f = F('victory', 0);      // 二人を倒したら、両腕を広げて勝ち誇る
    var c = e.flash > 0 && (e.flash >> 1) % 2 === 0 ? R.tinted(f, '#ffffff') : f.c;
    if (e.st === 'idle' && e.bob) {      // 構えの呼吸: ひざから上だけ、1 ドット沈める
      var kr = f.oy - 17;
      g.save(); g.translate(x, y); if (e.face < 0) g.scale(-1, 1);
      g.drawImage(c, 0, kr, f.w, f.h - kr, -f.ox, kr - f.oy, f.w, f.h - kr);
      g.drawImage(c, 0, 0, f.w, kr, -f.ox, 1 - f.oy, f.w, kr);
      g.restore();
    } else put(g, c, x, y, e.face, f);
    if (e.st === 'guard') {      // 守りの光
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 0.5);
      for (i = -5; i <= 5; i++) { g.fillStyle = i % 2 ? '#aebcff' : '#ffffff'; g.fillRect(Math.round(x + e.face * (18 - Math.abs(i) * 0.9)) - 1, Math.round(y - 28 + i * 4.4), 2, 4); }
      g.restore();
    } else if (e.st === 'stagger') {      // 目を回している
      for (i = 0; i < 3; i++) { a = G.t * 0.16 + i * 2.09; star(g, Math.round(x + Math.cos(a) * 10), Math.round(y - 56 + Math.sin(a) * 3), 1, i % 2 ? '#ffe04a' : '#ffffff'); }
    } else if (e.st === 'move' && e.mvName === 'camera' && t >= 22 && t < CAM_FLASH) {      // レンズが光りはじめる（フラッシュの前ぶれ）
      if ((t >> 1) % 2) star(g, x + e.face * 8, y - 33, t < 33 ? 2 : 4, '#ffffff');
    }
    if (e.warn && (G.t >> 2) % 2) {
      var hx = x, hy = Math.round(e.y - e.h - 18);
      g.fillStyle = '#ff3048'; g.fillRect(hx - 1, hy, 3, 7); g.fillRect(hx - 1, hy + 9, 3, 3); g.fillStyle = '#ffd0d6'; g.fillRect(hx, hy + 1, 1, 5);
    }
  }
  // 地裂撃の噴き上がり（シートのエフェクトの絵を、下から伸ばして消す）
  function drawFx(g, e, cam) {
    var f = e.f, u = e.t / e.life, sy = 0.35 + 0.65 * R.ease(Math.min(1, u * 3)), x = Math.round(e.x - cam);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u * u; g.imageSmoothingEnabled = false;
    g.drawImage(f.c, x - f.ox, Math.round(e.y - f.oy * sy), f.w, Math.round(f.h * sy));
    g.restore();
  }
  // 会話のあいだの立ち姿（65_talk.js から）。話すときは手招き、聞いているときは腕を組む
  function talkPose(e, speaking, T) { e.fr = speaking ? F('taunt', (T >> 4) % 2) : F('pose', 0); }
  // HUD に出す顔（表情アイコンの番号）
  //   場面ごとの顔: ガード中は真剣 → 守りきりそうなら余裕 / カメラは嘲り / 二人を倒したら高笑い / 体力わずかは血のにじむ顔 /
  //   本気は怒り（技を出す瞬間は激昂）/ ふだんは、待つときと技を出すときで別の顔
  function icon(e) {
    var k;
    if (e.st === 'die' || e.exprT > 0) k = e.expr;
    else if (G.state === 'gameover') k = 'n_laugh';
    else if (e.st === 'guard') k = e.stT > 30 ? 'n_calm' : 'focus';
    else if (e.st === 'intro') k = 'n_taunt';
    else if (e.st === 'move' && e.mvName === 'camera') k = 'smirk';
    else if (e.st === 'stagger') k = 'n_surprise';
    else if (e.hp < e.max * 0.3) k = 'n_wounded';
    else if (rage(e)) k = e.st === 'move' ? 'rage' : 'n_anger';
    else k = e.st === 'move' ? 'n_normal' : 'normal';
    return ICONS[k] || 0;
  }

  R.Karate = {
    init: init, enter: enter, drawFx: drawFx, icon: icon, talkPose: talkPose, MV: MV, start: start, startStep: startStep, startGuard: startGuard,
    ok: function () { return !!SP; }
  };
})();

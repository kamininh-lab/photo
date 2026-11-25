// ゲーム本体: プレイヤー操作・戦闘・敵 AI・ボス・アイテム・進行
(function () {
  'use strict';
  var R = window.REBELL, GY = R.GY, clamp = R.clamp, lerp = R.lerp, rand = R.rand, PI = Math.PI;
  var G = R.game = {
    state: 'title', t: 0, stageIdx: 0, S: null, cam: { x: 0, shake: 0 }, pl: null,
    enemies: [], shots: [], pshots: [], items: [], fx: [], parts: [], texts: [], ghosts: [], terminals: [],
    hitstop: 0, combo: 0, comboT: 0, comboPop: 0, maxCombo: 0, boss: null, arena: null, cross: null, cutin: null,
    helpT: 0, card: null, toast: null, flash: 0, slow: 0, fade: 0, fadeDir: 0, time: 0, kills: 0, respawn: null, stateT: 0, rage: false
  };

  // ---- 攻撃の定義 ----
  // 紅 = 大鎌。遅く、広く、重い（振っている間は攻撃を受けてもひるまない）
  // 蒼 = 刀。速く、手数が多い。一発は軽い
  // seq = 表示するコマの並び [[始まるフレーム, スプライトの組, 番号, (空中にいる間だけ使うコマ)], …]
  // box は「向いている側」を正にした相対矩形 [x, y, w, h]（y は足元が 0）。dur・h0・h1・cancel はフレーム数。
  // rise=自分も跳び上がる / slide=滑り込む速さ / air=空中用 / dive=急降下 / walk=移動で打ち切れる時間
  // rehit=この時刻にもう一度当たる（二段） / fin=とどめ級の重い音 / wd=斬撃の太さ / sndAt=風切り音を鳴らす時刻
  //
  // 遠距離攻撃（s = 地上で続けて出せる並び、as = 空中、asd = 空中で↓を押しながら、airShots = 一度の滞空で撃てる回数）
  //   紅 = 鎖鎌（kusari）。鎌を鎖で投げ、当てた敵を手元へ引きずり寄せる。空中では斜め下へ打ち込み、鎖をたぐって自分ごと叩きつける
  //     kusari = { ang: 投げる向き（0 = 水平、正 = 下向き）, len: 届く長さ, out・hold・back: 伸びる・止まる・戻るフレーム数, hy: 手の高さ, pull: 自分を引き寄せる速さ }
  //   蒼 = 飛ぶ斬撃（shot）。軽いが速く、離れたまま 3 発まで続けて撃てる。空中では同じ高さへ、↓を押しながらだと斜め下へ
  //     shot = { at: 撃つフレーム, vx・vy: 飛ぶ速さ, dmg, r: 大きさ, life: 飛ぶフレーム数, pierce: 貫く数, dx・y: 出る位置, big: 大きい刃 }
  //     back = 撃った反動で下がる速さ / hover = 撃つたびに浮く速さ
  var ATK = {
    kurenai: {
      g: [
        { seq: [[0, 'atk', 0], [4, 'atk', 1], [9, 'moon', 0], [11, 'moon', 1], [15, 'moon', 2], [21, 'atk', 3]], dur: 30, h0: 10, h1: 17, dmg: 22, box: [-14, -50, 78, 58], kb: 3.4, lunge: 2.6, fx: [-2.9, 1.3, 48], wd: 1.15, snd: 'slash_red1', cancel: 20, stop: 5, heavy: true },
        { seq: [[0, 'combo', 0], [5, 'combo', 1], [9, 'combo', 2], [17, 'atk', 2], [24, 'atk', 0]], dur: 30, h0: 9, h1: 16, dmg: 24, box: [-10, -60, 74, 64], kb: 3, lunge: 2.4, lift: -4, fx: [1.7, -2.6, 48], wd: 1.15, snd: 'slash_red2', cancel: 20, stop: 5, heavy: true, scrape: true },
        { seq: [[0, 'atk', 3], [4, 'leap', 1], [8, 'leap', 2], [18, 'leap', 3, ['airatk', 0]], [32, 'land', 1], [39, 'land', 2]], dur: 46, h0: 21, h1: 28, dmg: 44, box: [-16, -58, 88, 62], kb: 6, lunge: 2.2, hopAt: 8, hop: -4.4, slamAt: 18, fx: [-2.6, 1.2, 58], wd: 1.25, snd: 'slash_red3', sndAt: 14, cancel: 99, stop: 9, heavy: true, fin: true, shock: true, quake: 3 }
      ],
      a: [
        { seq: [[0, 'airatk', 0], [9, 'airatk', 1], [18, 'jump', 3]], air: true, dur: 28, h0: 10, h1: 17, dmg: 20, box: [-14, -52, 78, 62], kb: 2.4, lift: -2.8, fx: [-2.9, 1.3, 48], wd: 1.15, snd: 'slash_red1', cancel: 19, stop: 5, heavy: true },
        { seq: [[0, 'airatk', 1], [8, 'airatk', 2], [19, 'jump', 4]], air: true, dur: 30, h0: 9, h1: 16, dmg: 26, box: [-10, -60, 74, 68], kb: 3.6, lift: -4, fx: [1.7, -2.6, 50], wd: 1.15, snd: 'slash_red2', cancel: 99, stop: 6, heavy: true, fin: true }
      ],
      up: { seq: [[0, 'atk', 1], [6, 'atk', 2], [9, 'combo', 2], [16, 'leap', 2]], dur: 30, h0: 9, h1: 16, dmg: 20, box: [-10, -64, 74, 70], kb: 0.6, lunge: 1.8, lift: -7.4, rise: -6.8, fx: [1.7, -2.7, 50], wd: 1.15, snd: 'slash_red2', cancel: 13, stop: 5, heavy: true, scrape: true },
      dive: { dive: true, dur: 90, h0: 7, h1: 90, dmg: 16, land: 30, rad: 60, box: [-16, -32, 34, 40], kb: 1, snd: 'slash_red1', sndAt: 0, cancel: 99, stop: 2, heavy: true, fin: true },
      dash: { seq: [[0, 'step', 0], [4, 'step', 1], [14, 'atk', 3], [21, 'atk', 0]], dur: 26, h0: 4, h1: 12, dmg: 26, box: [-26, -50, 92, 56], kb: 4.5, slide: 4.8, fx: [-3.1, 1.5, 52], wd: 1.15, snd: 'slash_red1', sndAt: 0, cancel: 17, stop: 6, heavy: true, fin: true },
      swin: { seq: [[0, 'airatk', 2], [4, 'leap', 3, ['airatk', 2]], [16, 'land', 1], [23, 'land', 2]], dur: 29, h0: 4, h1: 11, dmg: 32, box: [-18, -58, 90, 62], kb: 5, lunge: 2.4, drop: true, fx: [-2.6, 1.2, 56], wd: 1.25, snd: 'slash_red1', sndAt: 0, cancel: 17, walk: 19, stop: 7, heavy: true, fin: true, shock: true, quake: 2 },
      // 遠距離「紅鎖」: 大きく振りかぶって鎖鎌を投げる（投げている間はひるまない）。戻るとき、当てた敵を引きずり寄せる
      s: [{ seq: [[0, 'combo', 0], [9, 'atk', 4], [15, 'atk', 3], [36, 'atk', 2], [42, 'atk', 0]], kusari: { ang: 0, len: 122, out: 10, hold: 5, back: 12, hy: -20 }, dur: 47, h0: 9, h1: 36, dmg: 10, kb: 0.6, snd: 'slash_red3', sndAt: 5, cancel: 38, stop: 2, heavy: true }],
      // 空中「流星鎖」: 斜め下へ打ち込み、鎖をたぐって落ちる。着地でまわりを吹き飛ばす
      as: { seq: [[0, 'leap', 2], [7, 'airatk', 1]], kusari: { ang: 0.86, len: 150, out: 8, back: 8, hy: -16, pull: 11.5 }, dur: 110, h0: 7, h1: 110, dmg: 10, land: 34, rad: 64, box: [-16, -34, 36, 42], kb: 1, snd: 'slash_red2', sndAt: 3, cancel: 999, stop: 2, heavy: true, fin: true },
      airShots: 1
    },
    aoi: {
      g: [
        { seq: [[0, 'atk', 1], [2, 'atk', 4], [8, 'atk', 3]], dur: 12, h0: 2, h1: 6, dmg: 5, box: [-4, -40, 44, 44], kb: 0.9, lunge: 2.6, fx: [-2.2, 0.9, 29], wd: 0.62, snd: 'slash_blue1', cancel: 6, stop: 1 },
        { seq: [[0, 'combo', 0], [2, 'combo', 1], [8, 'combo', 0]], dur: 12, h0: 2, h1: 6, dmg: 5, box: [-4, -48, 44, 50], kb: 0.9, lunge: 2.6, fx: [1.3, -1.9, 29], wd: 0.62, snd: 'slash_blue2', cancel: 6, stop: 1 },
        { seq: [[0, 'atk', 3], [2, 'combo', 2], [8, 'atk', 3]], dur: 12, h0: 2, h1: 6, dmg: 5, box: [-4, -42, 48, 46], kb: 0.9, lunge: 3, fx: [-2.4, 1.1, 32], wd: 0.62, snd: 'slash_blue1', cancel: 6, stop: 1 },
        { seq: [[0, 'thrust', 1], [2, 'thrust', 0], [5, 'thrust', 2], [9, 'thrust', 1]], dur: 13, h0: 2, h1: 8, dmg: 6, box: [2, -28, 58, 18], kb: 1.4, lunge: 4.8, thrust: 60, snd: 'slash_blue3', cancel: 8, stop: 1 },
        { seq: [[0, 'flash', 1], [4, 'combo', 3], [10, 'flash', 1], [12, 'flash', 2], [19, 'atk', 0]], dur: 24, h0: 5, h1: 16, rehit: 12, dmg: 6, box: [-22, -50, 72, 54], kb: 3.6, lunge: 2.6, fxs: [[4, 1.5, -2.4, 31], [11, -2.8, 1.3, 37]], wd: 0.7, snd: 'slash_blue4', cancel: 99, stop: 2, heavyLast: true }
      ],
      a: [
        { seq: [[0, 'airatk', 0], [7, 'jump', 3]], air: true, dur: 12, h0: 2, h1: 6, dmg: 5, box: [-4, -42, 44, 48], kb: 0.8, lift: -2.2, fx: [-2.2, 1.0, 29], wd: 0.62, snd: 'slash_blue1', cancel: 6, stop: 1 },
        { seq: [[0, 'airatk', 1], [7, 'jump', 3]], air: true, dur: 12, h0: 2, h1: 6, dmg: 5, box: [-4, -48, 44, 52], kb: 0.8, lift: -2.2, fx: [1.3, -1.9, 29], wd: 0.62, snd: 'slash_blue2', cancel: 6, stop: 1 },
        { seq: [[0, 'airatk', 0], [7, 'jump', 3]], air: true, dur: 12, h0: 2, h1: 6, dmg: 5, box: [-4, -42, 48, 48], kb: 0.8, lift: -2.2, fx: [-2.4, 1.1, 32], wd: 0.62, snd: 'slash_blue1', cancel: 6, stop: 1 },
        { seq: [[0, 'airatk', 1], [5, 'airatk', 2], [11, 'airatk', 1], [12, 'airatk', 2], [18, 'jump', 4]], air: true, dur: 24, h0: 5, h1: 16, rehit: 12, dmg: 6, box: [-22, -50, 72, 58], kb: 3.2, lift: -1, fxs: [[4, 1.5, -2.4, 31], [11, -2.8, 1.3, 37]], wd: 0.7, snd: 'slash_blue4', cancel: 99, stop: 2, heavyLast: true }
      ],
      up: { seq: [[0, 'atk', 1], [2, 'combo', 2], [9, 'jump', 1]], dur: 18, h0: 2, h1: 7, dmg: 5, box: [-4, -54, 44, 58], kb: 0.5, lunge: 1.8, lift: -7, rise: -7, fx: [1.4, -2.3, 32], wd: 0.62, snd: 'slash_blue2', cancel: 6, stop: 1 },
      dive: { dive: true, dur: 90, h0: 4, h1: 90, dmg: 6, land: 8, rad: 38, box: [-12, -28, 26, 34], kb: 1, snd: 'slash_blue3', cancel: 99, stop: 1 },
      dash: { seq: [[0, 'iai', 0], [3, 'iai', 1], [10, 'atk', 3]], dur: 15, h0: 1, h1: 9, dmg: 8, box: [0, -30, 80, 22], kb: 1.6, slide: 8.2, thrust: 96, snd: 'slash_blue3', cancel: 9, stop: 1 },
      swin: { seq: [[0, 'thrust', 0], [4, 'thrust', 2], [11, 'thrust', 1]], dur: 17, h0: 1, h1: 10, dmg: 9, box: [-10, -36, 94, 32], kb: 2.2, slide: 8.6, thrust: 116, snd: 'slash_blue3', cancel: 9, walk: 11, stop: 2 },
      // 遠距離「蒼燕」: 刀を振って、三日月の刃を飛ばす。3 発目は居合いの大きな刃で、敵を貫く
      s: [
        { seq: [[0, 'flash', 0], [3, 'combo', 1], [9, 'atk', 3]], shot: { at: 3, vx: 6.6, vy: 0, dmg: 4, r: 11, life: 28, pierce: 1, dx: 16, y: -21 }, dur: 15, h0: 3, h1: 3, kb: 0.5, snd: 'slash_blue1', sndAt: 0, cancel: 8, back: 0.7 },
        { seq: [[0, 'flash', 1], [3, 'combo', 2], [9, 'atk', 3]], shot: { at: 3, vx: 6.6, vy: 0, dmg: 4, r: 11, life: 28, pierce: 1, dx: 16, y: -25 }, dur: 15, h0: 3, h1: 3, kb: 0.5, snd: 'slash_blue2', sndAt: 0, cancel: 8, back: 0.7 },
        { seq: [[0, 'iai', 0], [5, 'iai', 1], [13, 'atk', 3]], shot: { at: 6, vx: 7.6, vy: 0, dmg: 8, r: 17, life: 30, pierce: 4, dx: 40, y: -20, big: true }, dur: 27, h0: 6, h1: 6, kb: 1.6, snd: 'slash_blue4', sndAt: 2, cancel: 21, back: 1.8 }
      ],
      // 空中: 同じ高さへまっすぐ / ↓を押しながらだと斜め下へ。撃つたびに少し浮いて、後ろへ下がる
      as: { seq: [[0, 'airatk', 1], [8, 'jump', 3]], shot: { at: 3, vx: 6.6, vy: 0, dmg: 4, r: 11, life: 28, pierce: 1, dx: 14, y: -20 }, dur: 14, h0: 3, h1: 3, kb: 0.5, snd: 'slash_blue1', sndAt: 0, cancel: 8, hover: -1.9, back: 0.9 },
      asd: { seq: [[0, 'airatk', 0], [8, 'jump', 3]], shot: { at: 3, vx: 5.4, vy: 3.9, dmg: 4, r: 11, life: 32, pierce: 1, dx: 12, y: -14 }, dur: 14, h0: 3, h1: 3, kb: 0.5, snd: 'slash_blue2', sndAt: 0, cancel: 8, hover: -2.4, back: 1.2 },
      airShots: 3
    }
  };
  ['kurenai', 'aoi'].forEach(function (k) {      // コンボのつながり
    var T = ATK[k], i;
    for (i = 0; i < T.g.length; i++) T.g[i].nextA = T.g[i + 1] || null;
    for (i = 0; i < T.a.length; i++) T.a[i].nextA = T.a[i + 1] || null;
    T.swin.nextA = T.g[1]; T.dash.nextA = T.g[1]; T.up.nextA = null; T.dive.nextA = null;
    // 遠距離: 続けて撃てる並び（nextS）。撃ったあとは、ふつうの攻撃へつなげられる
    for (i = 0; i < T.s.length; i++) { T.s[i].nextS = T.s[i + 1] || null; T.s[i].nextA = T.g[0]; }
    if (!T.asd) T.asd = T.as;
    T.as.nextS = null; T.asd.nextS = null; T.as.nextA = T.g[0]; T.asd.nextA = T.g[0];
  });
  // ---- チャージ攻撃（攻撃ボタンを押しっぱなしにして、離すと出る）----
  // 押した瞬間は、いつもどおりの攻撃が出る。そのまま押し続けると力がたまり（CH1 で 1 段目、CH2 で最大）、離した瞬間に大技を放つ。
  //   紅「紅月旋」= 大鎌を振り回しながら踏み込む回転斬り（5 回当たる）。最後に地面を叩き割る。振っている間はひるまない
  //   蒼「蒼月一閃」= 居合いで敵の中を斬り抜け（その間は無敵）、三日月の大きな刃を飛ばす
  //   rehits = この時刻ごとに、もう一度当たる / shockAt = 地面を叩き割る時刻
  var CH1 = 30, CH2 = 72;
  var CHG = {
    kurenai: {
      name: '紅月旋', seq: [[0, 'awaken', 2], [5, 'atk', 3], [8, 'senpu', 0], [11, 'senpu', 1], [14, 'senpu', 2], [17, 'senpu', 3], [20, 'senpu', 0], [23, 'senpu', 1], [26, 'senpu', 2], [29, 'moon', 1], [35, 'moon', 2], [44, 'atk', 0]],
      dur: 52, h0: 8, h1: 34, rehits: [14, 20, 26, 32], dmg: 14, box: [-42, -60, 110, 66], kb: 1.4, slide: 3.4,
      fxs: [[8, -2.9, 1.3, 52], [14, 1.7, -2.6, 52], [20, -2.9, 1.3, 54], [26, 1.7, -2.6, 54], [32, -2.6, 1.2, 62]], wd: 1.3,
      snd: 'slash_red3', sndAt: 6, cancel: 99, stop: 4, heavy: true, fin: true, shock: true, shockAt: 33, quake: 4
    },
    aoi: {
      name: '蒼月一閃', seq: [[0, 'iai', 0], [8, 'iai', 1], [16, 'flash', 2], [24, 'moon', 2], [30, 'atk', 3]],
      dur: 38, h0: 8, h1: 18, rehits: [13], dmg: 16, box: [-30, -46, 112, 50], kb: 3, slide: 10.5, thrust: 160,
      shot: { at: 18, vx: 8.2, vy: 0, dmg: 12, r: 22, life: 34, pierce: 8, dx: 30, y: -22, big: true },
      snd: 'slash_blue4', sndAt: 6, cancel: 99, stop: 3, heavyLast: true
    }
  };
  var chgCache = {};
  // lv = 1（1 段目）/ 2（最大。威力 1.6 倍、刃も大きい）
  function chgAtk(who, lv) {
    var key = who + lv, a = chgCache[key], k;
    if (a) return a;
    a = {}; for (k in CHG[who]) a[k] = CHG[who][k];
    a.charge = lv;
    if (lv === 2) {
      a.dmg = Math.round(a.dmg * 1.6); a.kb = a.kb * 1.4; if (a.quake) a.quake = 5;
      if (a.shot) { a.shot = Object.assign({}, a.shot, { dmg: Math.round(a.shot.dmg * 1.6), r: 30, life: 40 }); }
    }
    return (chgCache[key] = a);
  }
  var AOI_FIN = { dmg: 14, box: [-24, -50, 80, 56], kb: 4, heavy: true, stop: 4 };      // 蒼刃閃の締めの一太刀
  // 紅は重く、蒼は速い（走る速さ・ダッシュの速さと間隔・空中ダッシュの回数）
  var BASE = {
    kurenai: { hp: 120, sp: 100, speed: 2.05, dash: 5.2, dashCd: 30, airDash: 1 },
    aoi: { hp: 92, sp: 100, speed: 3.0, dash: 7.6, dashCd: 18, airDash: 2 }
  };
  // 走りのコマ送り。run のコマは「着地 → 足をそろえる → 蹴り出し → 宙に浮く」の順に並んでいる。
  //   rate = 速さ 1 あたりの進み（足の運びが地面の流れとだいたい合う値）
  //   w = コマごとの長さの比（着地は短く、宙に浮く間は長く）、start = 走り出しのコマ（蹴り出し）
  var RUN = {
    kurenai: { rate: 0.116, w: [0.75, 1.1, 1.0, 1.15], start: 2 },
    aoi: { rate: 0.098, w: [0.7, 1.0, 1.1, 1.2], start: 2 }
  };
  R.NAMES = { kurenai: '紅', aoi: '蒼' };
  var MID = 17, FLIP = 22;      // 体の中心の高さ（エフェクトの位置） / 宙返りにかけるフレーム数

  // ---- 小物 ----
  function fx(o) { o.t = 0; G.fx.push(o); return o; }
  function part(x, y, vx, vy, life, col, size, grav, glow) { G.parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, t: 0, col: col, size: size || 1, grav: grav || 0, glow: !!glow }); }
  function burst(x, y, n, cols, sp, life, grav) {
    for (var i = 0; i < n; i++) { var a = rand(0, PI * 2), v = rand(sp * 0.3, sp); part(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(life * 0.5, life), cols[i % cols.length], Math.random() < 0.3 ? 2 : 1, grav || 0, true); }
  }
  function text(x, y, str, col, big) { G.texts.push({ x: x + rand(-4, 4), y: y, vy: -1.1, str: String(str), col: col, t: 0, life: 44, big: !!big }); }
  function toast(str, col) { G.toast = { str: str, col: col || '#ffffff', t: 0 }; }
  function shake(n) { G.cam.shake = Math.max(G.cam.shake, n); }
  function box(b) { return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }; }
  // 画面に入っているか（y を渡すと、縦のステージでは高さも見る）
  function onScreen(x, m, y) {
    m = m || 40;
    if (y !== undefined && G.S && G.S.vertical && (y + G.cam.y < -m || y + G.cam.y > R.H + m)) return false;
    return x > G.cam.x - m && x < G.cam.x + R.W + m;
  }
  // その場所に、立てる床があるか（足場・動く足場・地形の上面。縦のステージの機兵が、足場から落ちないように）
  function standAt(x, y) {
    var P = G.plats || G.S.platRects, S = G.S.solids, i;
    for (i = 0; i < P.length; i++) if (x > P[i].x && x < P[i].x + P[i].w && Math.abs(P[i].y - y) < 3) return true;
    for (i = 0; i < S.length; i++) if (x > S[i].x && x < S[i].x + S[i].w && Math.abs(S[i].y - y) < 3) return true;
    return false;
  }
  function groundAt(x) { var g = G.S.ground; for (var i = 0; i < g.length; i++) if (x >= g[i][0] && x <= g[i][1]) return true; return false; }
  function inBlock(x, y) { var B = G.S.blockRects || [], i; for (i = 0; i < B.length; i++) if (x >= B[i].x && x <= B[i].x + B[i].w && y >= B[i].y) return true; return false; }
  // その x で立てる高さ（地面か、石の段のいちばん上）。穴の上なら null
  function floorAt(x) {
    var y = groundAt(x) ? GY : null, B = G.S.blockRects || [], i;
    for (i = 0; i < B.length; i++) if (x >= B[i].x && x <= B[i].x + B[i].w && (y === null || B[i].y < y)) y = B[i].y;
    return y;
  }
  function flipRot(p) { return p.flipT > 0 ? p.face * (1 - p.flipT / FLIP) * PI * 2 : 0; }
  R.flipRot = flipRot;
  // 残像を 1 枚置く
  function ghost(p, life, extra) {
    var f = curFrame(p); if (f.w > 104) f = FR(p.who, 'dash', 1);      // 大きな斬撃つきのコマは残像にしない（走る姿にする）
    var g = { who: p.who, f: f, x: p.x, y: p.y, face: p.face, rot: flipRot(p), t: 0, life: life || 12 };
    if (extra) for (var k in extra) g[k] = extra[k];
    G.ghosts.push(g); return g;
  }

  function moveBody(b) {
    var S = G.S.solids, i, s, bb;
    b.x += b.vx; b.hitWall = false;
    bb = box(b);
    for (i = 0; i < S.length; i++) {
      s = S[i];
      if (R.overlap(bb, s) && b.y > s.y + 2) {
        if (b.vx > 0) b.x = s.x - b.w / 2; else if (b.vx < 0) b.x = s.x + s.w + b.w / 2;
        if (b.vx) b.wallSide = b.vx > 0 ? 1 : -1;      // どちら側の壁に当たったか（壁キック用）
        b.vx = 0; b.hitWall = true; bb = box(b);
      }
    }
    var py = b.y; b.y += b.vy; b.ground = false; bb = box(b);
    for (i = 0; i < S.length; i++) {
      s = S[i];
      if (R.overlap(bb, s)) {
        if (b.vy >= 0 && py <= s.y + 6) { b.y = s.y; b.vy = 0; b.ground = true; }
        else if (b.vy < 0 && py - b.h >= s.y + s.h - 8) { b.y = s.y + s.h + b.h; b.vy = 0; }      // 宙に浮いた壁の下面に、頭をぶつける
        bb = box(b);
      }
    }
    if (b.vy >= 0 && !(b.drop > 0)) {
      var P = G.plats || G.S.platRects;      // 動く足場も含む
      for (i = 0; i < P.length; i++) {
        s = P[i];
        if (b.x + b.w / 2 > s.x && b.x - b.w / 2 < s.x + s.w && py <= (s.py === undefined ? s.y : Math.max(s.py, s.y)) + 0.01 && b.y >= s.y) { b.y = s.y; b.vy = 0; b.ground = true; }      // py = 動く足場の、前のフレームの上面
      }
    }
  }

  // ---- プレイヤー ----
  function newPlayer() {
    return {
      x: 80, y: GY, vx: 0, vy: 0, w: 11, h: 32, face: 1, ground: true, jumps: 0, coyote: 0, drop: 0,
      who: 'kurenai', st: 'free', stT: 0, atk: null, buf: false, hitSet: [], inv: 0, dashCd: 0, switchCd: 0, animT: 0,
      flipT: 0, landT: 0, skidT: 0, stretchT: 0, dashWin: 0, justCd: 0, runPh: 0, running: false, stopT: 0, airAtk: 0, airDashed: 0, rose: false,
      airShot: 0, kusari: null,      // 空中で遠距離攻撃を出した回数 / 紅の鎖鎌のようす
      chT: 0, chLv: 0, chQ: 0, chQT: 0,      // チャージ: 押している時間 / たまった段 / 放つのを待っている段と、待つ残り時間
      battleT: 0, angerT: 0, hurtFaceT: 0, joyT: 0, joyAll: false, hurtBig: false, landAnim: null,      // 構えを続ける時間 / 顔グラフィックの表情
      chars: { kurenai: { hp: BASE.kurenai.hp, max: BASE.kurenai.hp, sp: 60, maxsp: 100, down: false }, aoi: { hp: BASE.aoi.hp, max: BASE.aoi.hp, sp: 60, maxsp: 100, down: false } },
      lv: 1, exp: 0, potions: 3, crystals: 0, cross: 0, safeX: 80, hurtFlash: 0, spHits: {}
    };
  }
  function needExp(lv) { return 24 + lv * 20; }
  function atkMul() { return 1 + (G.pl.lv - 1) * 0.1; }
  function gainExp(n) {
    var p = G.pl; p.exp += n;
    while (p.exp >= needExp(p.lv) && p.lv < 30) {
      p.exp -= needExp(p.lv); p.lv++;
      ['kurenai', 'aoi'].forEach(function (k) { var c = p.chars[k], add = k === 'kurenai' ? 10 : 8; c.max += add; if (!c.down) c.hp = Math.min(c.max, c.hp + add + c.max * 0.25); });
      toast('LEVEL UP!  Lv.' + p.lv, '#ffe04a'); R.snd('levelup'); p.joyT = 90; p.joyAll = true;
      fx({ type: 'ring', x: p.x, y: p.y - MID, life: 26, r: 46, col: '#ffe04a' });
    }
  }
  function startAttack(a) {
    var p = G.pl;
    p.st = 'attack'; p.stT = 0; p.atk = a; p.buf = false; p.hitSet = []; p.fxDone = false; p.sndDone = false; p.flipT = 0; p.skidT = 0; p.landT = 0; p.landAnim = null;
    p.battleT = 150; p.angerT = 50; p.kusari = null;
    if (a.air) { p.airAtk++; if (p.airAtk <= ATK[p.who].a.length) p.vy = Math.min(p.vy, -1.4); }      // 空中で振るたびに少し浮く
    else if (a.dive) { p.vy = -2.2; p.vx *= 0.4; }
    else if (a.hover) { p.airShot++; p.vy = Math.min(p.vy, a.hover); }                                  // 蒼は、空中で撃つたびに少し浮く
    else if (a.kusari && a.kusari.pull) { p.airShot++; p.vy = Math.min(p.vy, -1.6); p.vx *= 0.5; }      // 紅は、空中で一瞬ためてから鎌を打ち込む
    else if (a.lunge) p.vx = p.face * a.lunge;
    if (p.who === 'aoi') ghost(p, 8);      // 蒼は一振りごとに残像を引く
  }
  // f = [始まりの角度, 終わりの角度, 半径]
  function slashFx(p, a, big, f) {
    var col = p.who === 'kurenai' ? 'red' : 'blue';
    if (a.thrust) fx({ type: 'thrust', x: p.x, y: p.y - MID - 2, face: p.face, life: 9, col: col, len: a.thrust });
    else if (f) fx({ type: 'slash', x: p.x + p.face * 2, y: p.y - MID - 4, face: p.face, a0: f[0], a1: f[1], r: f[2] * (big ? 1.15 : 1), wd: a.wd || 1, life: a.heavy ? 18 : 11, col: col, follow: p });
  }
  function atkBox(p, b) { return { x: p.face > 0 ? p.x + b[0] : p.x - b[0] - b[2], y: p.y + b[1], w: b[2], h: b[3] }; }

  // 敵へのダメージ。戻り値は当たったかどうか
  function damageEnemy(e, dmg, dir, kb, opt) {
    opt = opt || {};
    if (e.dead || e.dying || e.invul > 0) return false;
    // 中ボス（52_karate.js）は、受け方を自分で決める: false = 見切って当たらない / { mul, guard } = ダメージの倍率と、ガードしたか
    var gd = e.onHit ? e.onHit(e, dmg, dir, kb, opt) : null;
    if (gd === false) return false;
    var p = G.pl, d = Math.round(dmg * atkMul() * rand(0.92, 1.08) * (opt.weak ? 1.6 : 1) * (gd ? gd.mul : 1));
    var cx = opt.cx != null ? opt.cx : e.x, cy = opt.cy != null ? opt.cy : e.y - e.h * 0.55;
    if (gd && gd.guard) {      // ガードされた: 少しだけ削れる（これで倒れることはない）。コンボも SP も伸びない
      d = Math.max(1, d); e.hp = Math.max(1, e.hp - d); e.flash = 3;
      fx({ type: 'spark', x: cx + rand(-3, 3), y: cy + rand(-4, 4), life: 8, size: 11, col: 'blue' });
      text(cx, cy - 8, d, '#aebcff');
      G.hitstop = Math.max(G.hitstop, 2); shake(1.5); R.snd('guard');
      return true;
    }
    e.hp -= d; e.flash = 7;
    fx({ type: 'spark', x: cx + rand(-5, 5), y: cy + rand(-6, 6), life: opt.heavy ? 13 : 9, size: opt.heavy ? 24 : 13, col: opt.col || 'gold' });
    burst(cx, cy, opt.heavy ? 10 : 4, opt.col === 'blue' ? ['#7af3ff', '#ffffff', '#37e6ff'] : ['#ffd36a', '#ffffff', '#ff7ad1'], opt.heavy ? 4 : 2.6, 18, 0.12);
    text(cx, cy - 8, d, opt.weak ? '#ffe04a' : '#ffffff', opt.weak || opt.heavy);
    if (opt.weak) text(cx, cy - 22, 'WEAK!', '#ff7ad1');
    if (!e.armor) { e.vx = dir * kb; if (opt.lift && e.type !== 'drone') e.vy = opt.lift; e.st = 'hurt'; e.stT = 0; }
    else if (e.type === 'drone') { e.vx = dir * kb; }
    G.combo++; G.comboT = 130; G.comboPop = 8; G.maxCombo = Math.max(G.maxCombo, G.combo);
    if (!opt.noGain) {
      var c = p.chars[p.who], gm = opt.gain == null ? 1 : opt.gain;      // gain = SP とゲージのたまり方（離れて当てる攻撃は少なめ）
      c.sp = Math.min(c.maxsp, c.sp + (opt.heavy ? 5 : 3) * gm);
      p.cross = Math.min(100, p.cross + (2.2 + Math.min(3, G.combo * 0.08)) * gm);
    }
    G.hitstop = Math.max(G.hitstop, opt.stop || 0);
    shake(opt.heavy ? 4 : 1.5);
    R.snd(opt.snd || (opt.heavy ? 'hit_heavy' : 'hit'), { step: Math.min(12, G.combo) });      // コンボが続くほど音が上がっていく
    if (e.afterHit) e.afterHit(e, d, dir, kb, opt);      // 中ボス: ひるみ・ガードへの切り替え
    if (e.hp <= 0) killEnemy(e, dir);
    return true;
  }
  function killEnemy(e, dir) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    if (e.onKill) { e.onKill(e, dir); return; }      // 中ボスと、その写し身は、倒れ方を自分で決める
    G.kills++;
    if (e.type === 'dragon') { e.st = 'die'; e.stT = 0; e.dead = false; e.dying = true; G.shots = []; R.snd('boss_die'); R.bgm(null); return; }
    R.snd(e.type === 'guard' ? 'explosion' : 'enemy_die');
    fx({ type: 'boom', x: e.x, y: e.y - e.h / 2, life: 18, r: e.type === 'guard' ? 44 : 22 });
    burst(e.x, e.y - e.h / 2, e.type === 'guard' ? 40 : 16, ['#cfc9e4', '#f2a431', '#ff3048', '#ffffff'], 4.5, 34, 0.18);
    shake(e.type === 'guard' ? 9 : 3);
    gainExp(e.exp || 10);
    var k = Math.random();
    if (e.type === 'guard') { for (var i = 0; i < 5; i++) dropItem('crystal', e.x + rand(-30, 30), e.y - 30); dropItem('potion', e.x, e.y - 40); }
    else if (k < 0.34) dropItem('crystal', e.x, e.y - e.h / 2);
    else if (k < 0.42) dropItem('potion', e.x, e.y - e.h / 2);
    if (G.boss === e) { G.bossDefeated = true; G.stateT = 0; R.bgm(null); }
  }
  function dropItem(type, x, y) { G.items.push({ type: type, x: x, y: y, vy: -3, vx: rand(-1, 1), loose: true, t: 0 }); }

  function hitEnemies(p, a, mult) {
    var hb = atkBox(p, a.box), any = false, i, e, blue = p.who === 'aoi';
    var second = !!a.rehit && p.stT >= a.rehit, heavy = !!(a.heavy || (a.heavyLast && second));
    var kb = a.rehit && !second ? 0.4 : (a.kb || 2);      // 二段の一段目は相手を飛ばさない
    var snd = blue ? (heavy ? 'hit_blue_heavy' : 'hit_blue') : (a.fin ? 'hit_red_heavy' : 'hit_red');
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead || p.hitSet.indexOf(e) >= 0) continue;
      var parts = hurtboxes(e), j;
      for (j = 0; j < parts.length; j++) {
        if (R.overlap(hb, parts[j])) {
          p.hitSet.push(e);
          var hx = clamp(p.x + p.face * 24, parts[j].x, parts[j].x + parts[j].w), hy = clamp(p.y - MID - 4, parts[j].y, parts[j].y + parts[j].h);
          damageEnemy(e, a.dmg * (mult || 1), p.face, kb, { heavy: heavy, weak: parts[j].weak, lift: a.lift, stop: blue && heavy ? 4 : a.stop, cx: hx, cy: hy, col: blue ? 'blue' : 'gold', snd: snd });
          any = true; break;
        }
      }
    }
    openChests(hb);
    return any;
  }
  // 宝箱も叩ける（斬撃でも、飛び道具でも、鎖鎌でも）
  function openChests(hb) {
    var p = G.pl, i, it;
    for (i = 0; i < G.items.length; i++) {
      it = G.items[i];
      if (it.type === 'chest' && !it.open && R.overlap(hb, { x: it.x - 12, y: it.y - 20, w: 24, h: 20 })) {
        it.open = true; p.joyT = 60; p.joyAll = false; R.snd('pickup'); fx({ type: 'spark', x: it.x, y: it.y - 10, life: 10, size: 14, col: 'gold' });
        dropItem('potion', it.x, it.y - 16); dropItem('crystal', it.x - 8, it.y - 16); dropItem('crystal', it.x + 8, it.y - 16); dropItem('crystal', it.x, it.y - 22);
      }
    }
  }
  function hurtboxes(e) {
    if (e.boxes) return e.boxes(e);      // 龍: 頭（弱点）と胴。向きと傾きで変わる（35_dragon.js）
    if (e.type === 'drone') return [{ x: e.x - 10, y: e.y - 10, w: 20, h: 20 }];
    return [box(e)];
  }

  // ぎりぎりでダッシュ回避したごほうび: しばらく敵の動きが遅くなる
  function justDodge(p) {
    if (p.justCd > 0) return;
    var c = p.chars[p.who];
    p.justCd = 160; G.slow = 54;
    c.sp = Math.min(c.maxsp, c.sp + 12); p.cross = Math.min(100, p.cross + 8);
    text(p.x, p.y - 40, 'JUST!', '#ffe04a', true); R.snd('checkpoint');
    fx({ type: 'ring', x: p.x, y: p.y - MID, life: 20, r: 44, col: '#ffe04a' });
    G.flash = Math.max(G.flash, 0.16);
  }
  function hurtPlayer(dmg, dir, big) {
    var p = G.pl, c = p.chars[p.who];
    if (G.state !== 'play' || G.cross || G.bossDefeated) return false;
    if (p.st === 'dash' && !p.justDone) { p.justDone = true; justDodge(p); }
    if (p.inv > 0 || p.st === 'dash' || p.st === 'special' || p.st === 'cross') return false;
    // 紅は大鎌を振っている間、攻撃を受けてもひるまない（ダメージは 7 割）
    var armor = p.who === 'kurenai' && p.st === 'attack' && !p.atk.dive && p.stT <= p.atk.h1 + 2;
    if (armor) dmg *= 0.7;
    c.hp -= dmg; p.hurtFlash = 8; p.hurtFaceT = 55; p.battleT = 150;
    text(p.x, p.y - 36, '-' + Math.round(dmg), '#ff5a6a');
    burst(p.x, p.y - MID, armor ? 4 : 8, ['#ff5a6a', '#ffffff'], 3, 20, 0.1);
    R.snd('hurt');
    if (armor && c.hp > 0) { p.inv = 28; shake(2.5); return true; }
    p.st = 'hurt'; p.stT = 0; p.hurtBig = !!big; p.flipT = 0; p.entry = false; p.vx = dir * (big ? 4.5 : 3); p.vy = big ? -4.5 : -3; p.inv = 75;
    shake(big ? 6 : 3.5); G.flash = Math.max(G.flash, 0.25);
    G.combo = 0;
    if (c.hp <= 0) {
      c.hp = 0; c.down = true;
      var o = p.who === 'kurenai' ? 'aoi' : 'kurenai';
      if (!p.chars[o].down) { p.who = o; p.inv = 110; p.switchCd = 30; G.cutin = { who: o, t: 0 }; toast(R.NAMES[o] + ' に交代！', o === 'aoi' ? '#7af3ff' : '#ff7ad1'); R.snd('switch'); fx({ type: 'ring', x: p.x, y: p.y - MID, life: 20, r: 40, col: o === 'aoi' ? '#37e6ff' : '#ff4fb0' }); }
      else { G.state = 'gameover'; G.stateT = 0; R.bgm('gameover'); }
    }
    return true;
  }

  // キャラチェンジ: いまのキャラは残像を残して跳び去り、相棒が斬り込みながら現れる
  //（紅は上から降ってきて叩きつけ、蒼は一直線に突き抜ける）。
  // 攻撃を当てた直後に替わると「チェイン」になり、登場攻撃が強くなる。
  function doSwitch() {
    var p = G.pl, o = p.who === 'kurenai' ? 'aoi' : 'kurenai', blue = o === 'aoi', T = ATK[o];
    if (p.switchCd > 0) return;
    if (p.chars[o].down) { R.snd('deny'); toast(R.NAMES[o] + ' は戦闘不能（端末か薬で復帰）', '#ff9db8'); p.switchCd = 20; return; }
    var chain = p.st === 'attack' && p.hitSet.length > 0, col = blue ? '#37e6ff' : '#ff4fb0';
    ghost(p, 26, { leave: true, vx: -p.face * 2.4, vy: -3.6, f: R.frame(p.who, 'djump', 1) });
    p.chT = 0; p.chLv = 0; p.chQ = 0;      // ためた力は、交代で消える
    p.who = o; p.switchCd = 28; p.inv = Math.max(p.inv, 24); p.flipT = 0;
    R.snd('switch'); G.cutin = { who: o, t: 0 };
    fx({ type: 'ring', x: p.x, y: p.y - MID, life: 18, r: 40, col: col });
    fx({ type: 'circle', x: p.x, y: p.y - MID, life: 22, r: 30 });
    fx({ type: 'xflash', x: p.x, y: p.y - MID, life: 12, col: blue ? 'blue' : 'red' });
    burst(p.x, p.y - MID, 16, blue ? ['#37e6ff', '#ffffff'] : ['#ff4fb0', '#ffffff'], 3.6, 22);
    var a = !p.ground && !blue ? T.a[0] : T.swin;
    startAttack(a);
    if (a.drop && p.ground) { p.y -= 14; p.vy = 3; }
    p.entry = true; p.chain = chain;
    if (chain) { p.cross = Math.min(100, p.cross + 7); text(p.x, p.y - 42, 'CHAIN!', blue ? '#7af3ff' : '#ff9ad8', true); G.hitstop = Math.max(G.hitstop, 3); }
  }
  function startSpecial() {
    var p = G.pl, c = p.chars[p.who];
    if (c.sp < 30) { R.snd('deny'); toast('SP が足りない', '#9adfff'); return; }
    c.sp -= 30; p.st = 'special'; p.stT = 0; p.slammed = false; p.slamT = 0; p.entry = false; p.flipT = 0; p.hitSet = []; p.spHits = {}; p.inv = Math.max(p.inv, 50);
    p.battleT = 150; p.angerT = 90;
    if (p.who === 'kurenai') { R.snd('slash_red2'); toast('紅蓮砕！', '#ff7ad1'); fx({ type: 'ring', x: p.x, y: p.y - MID, life: 14, r: 36, col: '#ff7ad1' }); }
    else { R.snd('special_blue'); toast('蒼刃閃！', '#7af3ff'); }
  }
  function startCross() {
    var p = G.pl;
    if (p.cross < 100) { R.snd('deny'); toast('交錯ゲージが足りない', '#ffb8e6'); return; }
    if (p.chars.kurenai.down || p.chars.aoi.down) { R.snd('deny'); toast('二人そろっていないと使えない', '#ffb8e6'); return; }
    p.cross = 0; p.st = 'cross'; p.stT = 0; p.vx = 0; p.inv = 200; p.entry = false; p.flipT = 0; p.battleT = 150; p.angerT = 130;
    G.cross = { t: 0, x: p.x, y: p.y, face: p.face }; R.snd('cross');
  }
  function useItems() {
    var p = G.pl, I = R.input, c = p.chars[p.who], o = p.chars[p.who === 'kurenai' ? 'aoi' : 'kurenai'];
    if (I.hit.potion) {
      if (p.potions <= 0 || (c.hp >= c.max && !o.down)) { R.snd('deny'); }
      else {
        p.potions--; R.snd('potion');
        if (o.down) { o.down = false; o.hp = Math.round(o.max * 0.5); toast((p.who === 'kurenai' ? '蒼' : '紅') + ' が復帰した！', '#9dffb0'); }
        c.hp = Math.min(c.max, c.hp + Math.round(c.max * 0.6));
        p.joyT = 50; p.joyAll = false;
        text(p.x, p.y - 40, '+HP', '#9dffb0', true); burst(p.x, p.y - MID, 16, ['#9dffb0', '#ffffff'], 2.4, 30, -0.05);
      }
    }
    if (I.hit.crystal) {
      if (p.crystals <= 0 || c.sp >= c.maxsp) R.snd('deny');
      else { p.crystals--; c.sp = Math.min(c.maxsp, c.sp + 50); p.cross = Math.min(100, p.cross + 12); R.snd('pickup'); text(p.x, p.y - 40, '+SP', '#7af3ff', true); burst(p.x, p.y - MID, 16, ['#37e6ff', '#ffffff'], 2.4, 30, -0.05); }
    }
  }
  // ---- いま表示するコマ（用意されたスプライトのどれを使うか）----
  var FR = R.frame;
  function seqFrame(who, seq, t, ground) {
    var e = seq[0];
    for (var i = 1; i < seq.length && t >= seq[i][0]; i++) e = seq[i];
    return (e[3] && !ground) ? FR(who, e[3][0], e[3][1]) : FR(who, e[1], e[2]);
  }
  // 合体技のあいだのコマ（t = 技が始まってからのフレーム数）。紅は覚醒 → 連続回転斬り、蒼は構え → 連続斬撃
  function crossFrame(who, t) {
    if (who === 'kurenai') {
      if (t < 30) return FR(who, 'awaken', Math.min(3, t >> 3));
      if (t < 90) return FR(who, 'senpu', (t >> 2) % 4);
      if (t < 106) return FR(who, 'moon', t < 98 ? 1 : 2);
      return FR(who, 'stance', 0);
    }
    if (t < 30) return FR(who, 'ougi', (t >> 3) % 2);
    if (t < 90) return FR(who, 'renjin', 1 + ((t >> 1) % 3));
    if (t < 106) return FR(who, 'flash', 2);
    return FR(who, 'stance', 0);
  }
  R.crossFrame = crossFrame;
  function curFrame(p) {
    var who = p.who, K = who === 'kurenai', t = p.stT, n, S = R.STAND[who];
    R.curStand = null;      // 立ちポーズのときだけ、呼吸の指定が入る（描くときに使う）
    if (G.state === 'gameover') return FR(who, 'down', 0);
    if (G.state === 'clear' && p.ground) return FR(who, 'event', (G.stateT >> 4) % 4 === 3 ? 0 : 1);      // 勝利のポーズ
    if (p.st === 'attack') {
      if (p.atk.dive || (p.kusari && p.kusari.st === 'reel')) return FR(who, 'airatk', 0);      // 急降下 / 鎖をたぐって落ちる
      return seqFrame(who, p.atk.seq, t, p.ground);
    }
    if (p.st === 'special') {
      if (K) {
        if (p.slammed) { n = t - p.slamT; return n < 8 ? FR(who, 'leap', 3) : FR(who, 'spin', n < 13 ? 0 : n < 18 ? 1 : 2); }
        if (t < 8) return FR(who, 'awaken', t >> 1);
        return t < 26 ? FR(who, 'leap', 2) : FR(who, 'airatk', 0);
      }
      if (t < 24) return FR(who, 'renjin', 1 + ((t >> 1) % 3));
      return t < 26 ? FR(who, 'flash', 1) : FR(who, 'moon', t < 35 ? 2 : 1);
    }
    if (p.st === 'cross') return crossFrame(who, G.cross ? G.cross.t : 200);
    if (p.st === 'dash') return (t < 3 && p.ground) ? FR(who, 'dash', 0) : FR(who, 'dodge', t < 7 ? 0 : 1);
    if (p.st === 'hurt') return FR(who, p.hurtBig ? 'hurtbig' : 'hurt', t < 9 ? 0 : 1);
    if (p.flipT > 0) return FR(who, 'djump', 0);
    if (!p.ground) return FR(who, 'jump', p.stretchT > 3 ? 0 : p.vy < -3 ? 1 : p.vy < -0.8 ? 2 : p.vy < 2.2 ? 3 : 4);
    if (p.landT > 0) return (p.landAnim && p.landT > 4) ? FR(who, p.landAnim[0], p.landAnim[1]) : FR(who, 'land', p.landT > 4 ? 0 : p.landT > 2 ? 1 : 2);
    if (p.skidT > 0) return FR(who, 'slide', 1);
    if (Math.abs(p.vx) > 0.3) return p.dashWin > 0 ? FR(who, 'dash', 2) : FR(who, 'run', Math.floor(p.runPh) % R.SPR[who].run.length);
    if (p.stopT > 0) return FR(who, 'stop', 0);                                  // 止まるときの 1 歩
    R.curStand = p.battleT > 0 ? S.stance : S.idle;                              // 戦いのあいだは構えたまま
    return FR(who, p.battleT > 0 ? 'stance' : 'idle', R.curStand.i);
  }
  R.curFrame = curFrame;

  function doJump(p) {
    var K = p.who === 'kurenai';
    if (p.ground || p.coyote > 0) { p.vy = -7.6; p.jumps = 1; p.coyote = 0; p.stretchT = 6; p.landT = 0; p.landAnim = null; R.snd('jump'); dust(p.x, p.y, 4); }
    else if (p.jumps < 2) {      // 二段ジャンプは宙返り
      p.vy = Math.min(p.vy, -7.0); p.jumps = 2; p.flipT = FLIP; R.snd('djump');      // バネで跳ね上がった直後に押しても、勢いは落とさない
      fx({ type: 'ring', x: p.x, y: p.y, life: 12, r: 16, col: K ? '#ff7ad1' : '#7af3ff', flat: true });
      burst(p.x, p.y - 4, 6, K ? ['#ff7ad1', '#ffffff'] : ['#7af3ff', '#ffffff'], 1.8, 14);
    }
  }
  // 壁キック: 壁を蹴って、反対側へ跳ぶ（何度でも。向かい合う壁を交互に蹴れば登れる）
  function wallKick(p) {
    var d = p.wallDir, K = p.who === 'kurenai';
    p.vy = -7.0; p.vx = -d * 3.4; p.face = -d; p.wallT = 0; p.kickT = 14; p.hitWall = false; p.flipT = FLIP; p.rose = false; p.stretchT = 0;
    R.snd('djump');
    fx({ type: 'ring', x: p.x + d * 5, y: p.y - 12, life: 10, r: 14, col: K ? '#ff7ad1' : '#7af3ff' });
    burst(p.x + d * 5, p.y - 10, 6, K ? ['#ff7ad1', '#ffffff'] : ['#7af3ff', '#ffffff'], 2, 12);
  }
  function canDash(p) { return p.dashCd <= 0 && (p.ground || p.airDashed < BASE[p.who].airDash); }
  function startDash(move) {
    var p = G.pl; if (move) p.face = move;
    p.st = 'dash'; p.stT = 0; p.dashCd = BASE[p.who].dashCd; p.inv = Math.max(p.inv, 12); p.justDone = false; p.entry = false; p.flipT = 0;
    if (!p.ground) p.airDashed++; else dust(p.x, p.y, 6);
    R.snd('dash');
    fx({ type: 'thrust', x: p.x + p.face * 4, y: p.y - MID + 2, face: -p.face, life: 10, col: p.who === 'kurenai' ? 'red' : 'blue', len: 40 });
  }
  // チャージ: 攻撃ボタンを押している間、力をためる。光が体に集まり、段が上がるたびに音と光の輪
  function chargeUp(p, K) {
    p.chT++;
    var col = K ? '#ff7ad1' : '#7af3ff', lv = p.chT >= CH2 ? 2 : p.chT >= CH1 ? 1 : 0, an, r;
    if (p.chT > 10 && p.chT % (lv ? 2 : 4) === 0) {
      an = rand(0, PI * 2); r = lv === 2 ? 28 : 22;
      part(p.x + Math.cos(an) * r, p.y - MID + Math.sin(an) * r, -Math.cos(an) * r / 11, -Math.sin(an) * r / 11, 11, lv === 2 && p.chT % 4 ? '#ffffff' : col, lv ? 2 : 1, 0, true);
    }
    if (lv > p.chLv) {
      p.chLv = lv; R.snd(lv === 2 ? 'checkpoint' : 'select');
      fx({ type: 'ring', x: p.x, y: p.y - MID, life: 14, r: lv === 2 ? 34 : 24, col: lv === 2 ? '#ffffff' : col });
      if (lv === 2) burst(p.x, p.y - MID, 10, [col, '#ffffff'], 2.2, 16);
    }
    if (lv === 2 && p.chT % 16 === 0) fx({ type: 'ring', x: p.x, y: p.y - 1, life: 12, r: 18, col: col, flat: true });
  }
  // ためた力を放てるか（ふつうの攻撃の途中なら、打ち切れる時刻を過ぎていること）
  function canCharge(p) {
    if (p.st === 'free' || p.st === 'dash') return true;
    var a = p.atk;
    return p.st === 'attack' && !a.dive && !a.kusari && !a.charge && p.stT >= Math.min(a.cancel, a.h1 + 2);
  }
  function startCharge(p, lv) {
    var K = p.who === 'kurenai', col = K ? '#ff7ad1' : '#7af3ff', a = chgAtk(p.who, lv);
    var move = (R.input.down.right ? 1 : 0) - (R.input.down.left ? 1 : 0);
    if (move) p.face = move;
    startAttack(a); p.entry = false;
    if (!K) p.inv = Math.max(p.inv, 20);      // 蒼は、斬り抜ける間は無敵
    fx({ type: 'xflash', x: p.x, y: p.y - MID, life: 12, col: K ? 'red' : 'blue' });
    fx({ type: 'ring', x: p.x, y: p.y - MID, life: 16, r: lv === 2 ? 44 : 30, col: col });
    if (lv === 2) { R.snd(K ? 'special_red' : 'special_blue'); text(p.x, p.y - 48, a.name + '！', K ? '#ff9ad8' : '#7af3ff', true); G.hitstop = Math.max(G.hitstop, 3); G.flash = Math.max(G.flash, 0.18); }
  }
  // いま出せる遠距離攻撃（地上 / 空中 / 空中で↓）。空中では、一度の滞空で撃てる回数に限りがある
  function shotOf(p, down) {
    var T = ATK[p.who];
    if (p.ground) return T.s[0];
    if (p.airShot >= T.airShots) return null;
    return down ? T.asd : T.as;
  }
  // 次につなぐ攻撃を決める（buf: 'atk' / 'down' / 'shot'）
  function nextAttack(p, a, buf) {
    var T = ATK[p.who];
    if (buf === 'shot') return (p.ground && a.nextS !== undefined) ? a.nextS : shotOf(p, R.input.down.down);      // 蒼は 3 発まで続けて撃てる
    if (buf === 'down') return p.ground ? (a === T.up ? null : T.up) : T.dive;
    if (!p.ground) return a.air ? a.nextA : (p.airAtk < T.a.length ? T.a[0] : null);
    if (a.air) return T.g[0];
    return a.nextA;
  }
  // 急降下の着地: まわりに衝撃波
  function diveLand(p, a, mult) {
    var red = p.who === 'kurenai', rad = a.rad, area = { x: p.x - rad, y: p.y - 40, w: rad * 2, h: 46 };
    shake(red ? 9 : 4); G.hitstop = Math.max(G.hitstop, red ? 6 : 2); R.snd(red ? 'special_red' : 'land');
    dust(p.x, p.y, red ? 14 : 8); fx({ type: 'crack', x: p.x + p.face * 6, y: p.y, life: 20 });
    fx({ type: 'ring', x: p.x, y: p.y - 2, life: 16, r: rad, col: red ? '#ff7ad1' : '#7af3ff', flat: true });
    if (red) fx({ type: 'quake', x: p.x, y: p.y, life: 24, face: p.face, n: 3 });
    G.enemies.forEach(function (e) {
      if (e.dead) return;
      var hbs = hurtboxes(e);
      for (var j = 0; j < hbs.length; j++) if (R.overlap(area, hbs[j])) {
        damageEnemy(e, a.land * mult, e.x >= p.x ? 1 : -1, 3, { heavy: red, lift: red ? -5 : -3.4, weak: hbs[j].weak, stop: 2, cx: clamp(p.x, hbs[j].x, hbs[j].x + hbs[j].w), cy: hbs[j].y + hbs[j].h * 0.7, col: red ? 'gold' : 'blue', snd: red ? 'hit_red_heavy' : 'hit_blue' });
        break;
      }
    });
    p.st = 'free'; p.landT = red ? 12 : 6; p.landAnim = red ? ['leap', 3] : null; p.entry = false; p.vx = 0;      // 紅は着地で光の柱が立つ
  }

  // ---- 遠距離攻撃 ----
  // 蒼: 三日月の刃を 1 枚飛ばす
  function fireShot(p, a) {
    var s = a.shot, x = p.x + p.face * s.dx, y = p.y + s.y;
    G.pshots.push({ x: x, y: y, vx: p.face * s.vx, vy: s.vy, t: 0, life: s.life, dmg: s.dmg, kb: a.kb || 0.5, r: s.r, pierce: s.pierce, big: !!s.big, hit: [] });
    if (a.back) p.vx = -p.face * a.back;      // 撃った反動で、少し下がる（間合いを保つ）
    fx({ type: 'ring', x: x, y: y, life: 8, r: s.r + 5, col: '#7af3ff' });
    if (s.big) { fx({ type: 'thrust', x: p.x, y: y, face: p.face, life: 9, col: 'blue', len: 70 }); shake(2); }
  }
  function updPShots() {
    var i, j, k, s, e, hb, parts;
    for (i = 0; i < G.pshots.length; i++) {
      s = G.pshots[i]; s.t++; s.x += s.vx; s.y += s.vy;
      hb = { x: s.x - s.r * 0.8, y: s.y - s.r * 0.75, w: s.r * 1.6, h: s.r * 1.5 };
      for (j = 0; j < G.enemies.length && !s.dead; j++) {
        e = G.enemies[j];
        if (e.dead || s.hit.indexOf(e) >= 0) continue;
        parts = hurtboxes(e);
        for (k = 0; k < parts.length; k++) {
          if (!R.overlap(hb, parts[k])) continue;
          s.hit.push(e);
          damageEnemy(e, s.dmg, R.sign(s.vx) || 1, s.kb, { heavy: s.big, weak: parts[k].weak, stop: s.big ? 3 : 1, gain: 0.5, col: 'blue', snd: s.big ? 'hit_blue_heavy' : 'hit_blue',
            cx: clamp(s.x, parts[k].x, parts[k].x + parts[k].w), cy: clamp(s.y, parts[k].y, parts[k].y + parts[k].h) });
          if (--s.pierce <= 0) s.dead = true;
          break;
        }
      }
      openChests(hb);
      // 地面・壁に当たるか、飛びきったら消える
      var wall = false, S = G.S.solids;
      for (j = 0; j < S.length; j++) if (R.overlap({ x: s.x - 2, y: s.y - 2, w: 4, h: 4 }, S[j])) wall = true;
      if (wall || (s.y >= GY - 1 && groundAt(s.x))) { s.dead = true; burst(s.x, Math.min(s.y, GY - 2), 5, ['#7af3ff', '#ffffff'], 2, 12, 0.05); }
      if (s.t >= s.life || s.x < G.cam.x - 60 || s.x > G.cam.x + R.W + 60) s.dead = true;
      if (!s.dead && s.t % 2 === 0) part(s.x - s.vx * 1.5 + rand(-2, 2), s.y + rand(-s.r * 0.6, s.r * 0.6), -s.vx * 0.08, rand(-0.2, 0.2), 9, s.t % 4 ? '#6ae8ff' : '#ffffff', 1, 0, true);
    }
    G.pshots = G.pshots.filter(function (q) { return !q.dead; });
  }
  // 紅: 鎖鎌。伸びる → 止まる → 戻る。戻るとき、当てた敵を手元へ引きずり寄せる。
  // 空中（pull）では、地面か敵に打ち込んだら、鎖をたぐってそこへ落ちる（着地は急降下と同じ衝撃波）。
  // p.kusari = { st: 'out' / 'hold' / 'back' / 'reel' / 'done', t, len: いまの長さ, hits: 当てた敵, spin: 鎌の回転, ax・ay: 打ち込んだ所 }
  // 戻り値 = このフレームの重力
  function kusariHead(p, a) {
    var k = a.kusari, q = p.kusari;
    if (q.st === 'reel') return [q.ax, q.ay - 4];
    return [p.x + q.face * (9 + Math.cos(k.ang) * q.len), p.y + k.hy + Math.sin(k.ang) * q.len];
  }
  function kusari(p, a, mult, grav) {
    var k = a.kusari, q = p.kusari, air = !!k.pull, i, e, r, h, hb, parts, j;
    if (p.ground) p.vx *= 0.8;
    if (p.stT < a.h0) {      // 振りかぶり（空中では、一瞬止まる）
      if (air) { p.vx *= 0.85; p.vy = Math.min(p.vy, 0.4); return 0.1; }
      return grav;
    }
    if (!q) q = p.kusari = { st: 'out', t: 0, age: 0, len: 0, face: p.face, hits: [], spin: 0, ax: 0, ay: 0 };
    q.t++; q.age++;
    if (q.st === 'reel') {      // 鎖をたぐって、打ち込んだ所へ落ちる
      var dx = q.ax - p.x, dy = q.ay - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 14 || q.t > 44) { p.vx *= 0.3; p.vy = 9; q.st = 'done'; return 0; }      // 着いた（空中の敵なら、そこから真下へ）
      p.vx = dx / d * k.pull; p.vy = dy / d * k.pull; q.len = d;
      if (p.stT % 2 === 0) ghost(p, 9);
      hitEnemies(p, a, mult);
      return 0;
    }
    if (q.st === 'done') return air ? 0.45 : grav;
    q.spin += 0.66;
    if (q.st === 'out') {
      q.len = k.len * (1 - Math.pow(1 - Math.min(1, q.t / k.out), 2));
      if (q.t >= k.out) { q.st = air ? 'back' : 'hold'; q.t = 0; q.len0 = q.len; }
    } else if (q.st === 'hold') {
      if (q.t >= k.hold) {      // 引き戻す: 当てた敵を、目の前まで引きずる
        q.st = 'back'; q.t = 0; q.len0 = q.len; R.snd('dash');
        q.hits.forEach(function (rec) {
          var en = rec.e, D = p.x + q.face * 32 - en.x;
          if (en.dead || en.armor || Math.abs(D) < 10 || Math.abs(D) > 180) return;
          en.vx = clamp(D * 0.14, -16, 16); en.st = 'hurt'; en.stT = 0;
          burst(en.x, en.y - en.h * 0.5, 5, ['#ff8ad0', '#ffffff'], 2, 12, 0.05);
        });
      }
    } else if (q.st === 'back') {
      q.len = q.len0 * (1 - R.ease(Math.min(1, q.t / k.back)));
      if (q.t >= k.back) { q.st = 'done'; q.len = 0; if (!air) dust(p.x + q.face * 8, p.y, 3); }
    }
    if (q.st === 'done') return air ? 0.45 : grav;
    // 鎌の頭の当たり（同じ敵には、少し間をあけて 3 回まで）
    h = kusariHead(p, a); hb = { x: h[0] - 14, y: h[1] - 14, w: 28, h: 28 };
    var struck = false;
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i]; if (e.dead) continue;
      parts = hurtboxes(e);
      for (j = 0; j < parts.length; j++) {
        if (!R.overlap(hb, parts[j])) continue;
        r = null; q.hits.forEach(function (rec) { if (rec.e === e) r = rec; });
        if (!r) { r = { e: e, n: 0, t: -99 }; q.hits.push(r); }
        if (r.n < 3 && q.age - r.t >= 8) {
          var keep = e.vx;
          r.n++; r.t = q.age;
          damageEnemy(e, a.dmg * mult, q.face, a.kb, { weak: parts[j].weak, stop: a.stop, gain: 0.6, chain: true, col: 'gold', snd: 'hit_red', cx: clamp(h[0], parts[j].x, parts[j].x + parts[j].w), cy: clamp(h[1], parts[j].y, parts[j].y + parts[j].h) });
          if (q.st === 'back' && !e.armor && !e.dead) e.vx = keep;      // 引きずっている最中は、当たっても押し戻さない
        }
        struck = true; break;
      }
    }
    openChests(hb);
    if (air) {
      // 地面か敵に刺さったら、たぐり寄せに移る
      var top = floorAt(h[0]), onGround = top !== null && h[1] >= top - 3;
      if (q.st === 'out' && (struck || onGround)) {
        q.st = 'reel'; q.t = 0; q.ax = h[0]; q.ay = Math.min(h[1] + 4, top === null ? GY : top);
        R.snd('hit_red'); shake(3); fx({ type: 'spark', x: q.ax, y: q.ay - 4, life: 10, size: 16, col: 'gold' });
        if (onGround) dust(q.ax, top, 6);
        return 0;
      }
      p.vx *= 0.85; p.vy = Math.min(p.vy, 0.5);
      return 0.1;      // 投げている間は、空中に止まる
    }
    return grav;
  }
  // 描画用: 鎖の両端と鎌の回転（鎖鎌を出していなければ null）
  R.kusariView = function () {
    var p = G.pl, a = p.atk, q = p.kusari, h;
    if (p.st !== 'attack' || !a || !a.kusari || !q || q.st === 'done' || q.len < 3) return null;
    h = kusariHead(p, a);
    return { x0: p.x + q.face * 9, y0: p.y + a.kusari.hy, x1: h[0], y1: h[1], spin: q.st === 'reel' ? 0.6 * q.face : q.spin * q.face, stuck: q.st === 'reel' };
  };

  function updPlayer() {
    var p = G.pl, I = R.input, K = p.who === 'kurenai', T = ATK[p.who], B = BASE[p.who], a, nx;
    var move = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0), speed = B.speed;
    var jumpHit = I.hit.jump || I.hit.up, jumpHeld = I.down.jump || I.down.up, wasGround = p.ground, grav = 0.45;
    p.animT++;
    ['inv', 'dashCd', 'switchCd', 'drop', 'hurtFlash', 'flipT', 'landT', 'stretchT', 'dashWin', 'justCd', 'battleT', 'angerT', 'hurtFaceT', 'joyT', 'stopT', 'wallT', 'kickT'].forEach(function (k) { if (p[k] > 0) p[k]--; });
    if (p.st !== 'free') p.running = false;
    // 待機中の回復
    ['kurenai', 'aoi'].forEach(function (k) { var q = p.chars[k]; if (q.down) return; q.sp = Math.min(q.maxsp, q.sp + (k === p.who ? 0.03 : 0.07)); if (k !== p.who) q.hp = Math.min(q.max, q.hp + 0.025); });
    // チャージ: ふつうに動いている間・攻撃の途中・ダッシュ中に、攻撃ボタンを押し続けるとたまる。
    //   離したら放つ（すぐ出せないときは、少しの間だけ待って出す）。やられ・技・交代などで押したままのときは、消える
    if (I.down.attack && (p.st === 'free' || p.st === 'dash' || (p.st === 'attack' && !p.atk.charge))) chargeUp(p, K);
    else if (p.chT > 0) { if (p.chLv > 0 && !I.down.attack) { p.chQ = p.chLv; p.chQT = 24; } p.chT = 0; p.chLv = 0; }
    if (p.chQ > 0) { if (canCharge(p)) { startCharge(p, p.chQ); p.chQ = 0; } else if (--p.chQT <= 0) p.chQ = 0; }

    if (p.st === 'free') {
      var acc = p.ground ? (K ? 0.5 : 0.8) : 0.36;
      if (p.ground && move && Math.abs(p.vx) > 1.5 && move !== R.sign(p.vx)) { if (p.skidT <= 0) dust(p.x, p.y, 4); p.skidT = 7; acc = 0.8; }      // 切り返し
      else if (p.skidT > 0) p.skidT--;
      // 壁ずり: 空中で壁に体を預けている間は、落ちるのがゆっくりになる。そこでジャンプを押すと壁キック
      if (!p.ground && p.hitWall && p.wallSide) {
        p.wallT = 8; p.wallDir = p.wallSide;
        if (p.vy > 1.3) { p.vy = 1.3; if (G.t % 5 === 0) part(p.x + p.wallDir * 5, p.y - 8, -p.wallDir * rand(0.2, 0.8), rand(-0.6, 0.1), 12, '#a39bd0', 2, 0.02); }
      }
      var mv = p.kickT > 0 && move === p.wallDir ? 0 : move;      // 蹴った直後は、同じ壁へは戻れない
      if (!(p.kickT > 0 && !p.ground)) p.vx += clamp(mv * speed - p.vx, -acc, acc);      // 蹴り出した勢いは、しばらく保つ（反対の壁まで届くように）
      if (mv) p.face = mv;
      if (p.ground && Math.abs(p.vx) > 0.3) {
        var RN = RUN[p.who], ph0 = Math.floor(p.runPh);
        if (!p.running) { p.running = true; p.stopT = 0; p.runPh = ph0 = RN.start; }      // 走り出しは、地面を蹴る姿勢から
        p.runPh = (p.runPh + Math.abs(p.vx) * RN.rate / RN.w[ph0]) % RN.w.length;
        if (Math.floor(p.runPh) === 0 && ph0 !== 0 && Math.abs(p.vx) > 1.2) {             // 足が着くたびに、小さな土ぼこり
          part(p.x + p.face * 3, p.y - 1, -p.face * rand(0.3, 0.9), rand(-0.7, -0.2), rand(9, 14), '#8078b8', 2, 0.02);
          part(p.x + p.face * 1, p.y - 1, -p.face * rand(0.1, 0.5), rand(-0.5, -0.1), rand(8, 12), '#655e9e', 1, 0.02);
        }
        if (!K && Math.abs(p.vx) > 2.6 && G.t % 5 === 0) ghost(p, 7, { faint: true });      // 蒼は走るだけで残像が出る
      } else {
        if (p.running && p.ground && !move && p.skidT <= 0) p.stopT = 7;                  // 止まるときは、足をそろえる 1 歩をはさむ
        p.running = false;
      }
      if (jumpHit) { if (I.down.down && p.ground && onPlat(p)) { p.drop = 10; p.y += 2; } else if (!p.ground && p.coyote <= 0 && p.wallT > 0) wallKick(p); else doJump(p); }
      if (!jumpHeld && p.vy < -3 && !p.rose) p.vy = -3;
      if (I.hit.attack) {
        if (I.down.down) startAttack(p.ground ? T.up : T.dive);              // ↓+攻撃: 斬り上げ / 急降下
        else if (p.dashWin > 0) startAttack(T.dash);                         // ダッシュ直後: ダッシュ斬り
        else startAttack(p.ground ? T.g[0] : T.a[0]);
      }
      else if (I.hit.shot) { if ((a = shotOf(p, I.down.down))) startAttack(a); }      // 遠距離: 紅は鎖鎌、蒼は飛ぶ斬撃
      else if (I.hit.special) startSpecial();
      else if (I.hit.dash && canDash(p)) startDash(move);
      if (I.hit.switch) doSwitch();
      if (I.hit.cross) startCross();
      useItems();
    } else if (p.st === 'attack') {
      a = p.atk; p.stT++;
      var mult = p.entry ? (p.chain ? 1.5 : 1.2) : 1, open = p.stT >= a.h0;
      if (!p.sndDone && p.stT > (a.sndAt != null ? a.sndAt : a.h0 - 5)) { p.sndDone = true; R.snd(a.snd); }      // 風切り音は振り抜く直前に
      if (a.dive) {
        if (p.stT < a.h0) { p.vx *= 0.8; p.vy = Math.min(p.vy, 0.4); grav = 0.1; }      // 一瞬ためてから落ちる
        else {
          p.vy = 9.6; p.vx = p.face * 1.4; grav = 0;
          if (p.stT % 2 === 0) ghost(p, 9);
          hitEnemies(p, a, mult);
        }
      } else if (a.kusari) {
        grav = kusari(p, a, mult, grav);      // 紅の鎖鎌
      } else {
        if (a.slide && p.stT <= a.h1 + 2) {                                  // 滑り込みながら斬る
          p.vx = p.face * a.slide * Math.max(0.25, 1 - p.stT / (a.h1 + 4));
          if (!p.ground) { p.vy = 0; grav = 0; }
          if (p.stT % 2 === 0) ghost(p, 10);
        } else if (p.ground) p.vx *= 0.84;
        else p.vx += clamp(move * speed * 0.8 - p.vx, -0.25, 0.25);
        if (a.air && p.airAtk <= T.a.length && p.stT < a.h1 + 3) grav = 0.16;          // 空中コンボの間はふわりと浮く
        if (a.hover && p.stT < 9) grav = 0.14;                                         // 空中で撃つ間も、ふわりと浮く
        if (a.shot && p.stT === a.shot.at) fireShot(p, a);                             // 蒼の飛ぶ斬撃
        if (a.hopAt && p.stT === a.hopAt && p.ground) { p.vy = a.hop; dust(p.x, p.y, 6); }      // 大鎌落とし: 跳び上がって
        if (a.slamAt && p.stT === a.slamAt && !p.ground) p.vy = 6.5;                             //               一気に落ちる
        if (a.scrape && p.stT === a.h0 - 2 && p.ground) { dust(p.x + p.face * 8, p.y, 4); burst(p.x + p.face * 12, p.y - 2, 6, ['#ffd36a', '#ffffff', '#ff7ad1'], 2.4, 12, 0.1); }      // 刃が地面を擦る
        if (p.stT >= a.h0 - 2 && !p.fxDone) { p.fxDone = true; if (!a.fxs) slashFx(p, a, p.entry, a.fx); if (a.heavy) ghost(p, 10); }
        if (a.fxs) for (var fi = 0; fi < a.fxs.length; fi++) if (p.stT === a.fxs[fi][0]) slashFx(p, a, p.entry, a.fxs[fi].slice(1));
        if (a.rise && p.stT === a.h0) { p.vy = a.rise; p.jumps = Math.max(p.jumps, 1); p.rose = true; dust(p.x, p.y, 5); }
        if (a.rehit && p.stT === a.rehit) p.hitSet = [];
        if (a.rehits && a.rehits.indexOf(p.stT) >= 0) p.hitSet = [];      // チャージ攻撃: 何度も当たる
        if (a.box && open && p.stT <= a.h1) hitEnemies(p, a, mult);
        if (a.shock && p.stT === (a.shockAt || a.h0 + 1) && p.ground) {
          shake(a.fin ? 8 : 5); dust(p.x + p.face * 30, p.y, 12); R.snd('slam_red'); fx({ type: 'crack', x: p.x + p.face * 32, y: p.y, life: 22 });
          if (a.quake) fx({ type: 'quake', x: p.x + p.face * 30, y: p.y, life: 24, face: p.face, n: a.quake });
        }
      }
      if (I.hit.attack && p.stT > 2) p.buf = I.down.down ? 'down' : 'atk';
      if (I.hit.shot && p.stT > 2) p.buf = 'shot';
      var locked = !!a.kusari && p.stT < a.cancel;      // 鎖鎌は、投げたら戻るまで動けない（大振りの代わりに、ひるまない）
      if (a.dive || (a.kusari && a.kusari.pull)) {
        if (p.ground && p.stT >= a.h0) diveLand(p, a, mult);
        else if (p.stT >= a.dur) { p.st = 'free'; p.entry = false; }
      }
      else if (I.hit.switch && open) doSwitch();
      else if (!locked && I.hit.dash && open && canDash(p)) startDash(move);
      else if (!locked && I.hit.special && open) startSpecial();
      else if (I.hit.cross) startCross();
      else if (!locked && jumpHit && open && (p.hitSet.length > 0 || p.stT >= a.cancel) && (p.ground || p.jumps < 2)) { p.st = 'free'; p.entry = false; doJump(p); }      // ジャンプで打ち切る
      else if (p.buf && p.stT >= (p.buf === 'down' ? Math.min(a.cancel, a.h1) : a.cancel) && (nx = nextAttack(p, a, p.buf))) { p.entry = false; if (move) p.face = move; startAttack(nx); }      // ↓+攻撃（斬り上げ・急降下）は早めに出せる
      else if (a.walk && p.stT >= a.walk && move) { p.st = 'free'; p.entry = false; }
      else if (p.stT >= a.dur) { p.st = 'free'; p.entry = false; }
      else if (a.air && p.ground && p.stT > a.h1) { p.st = 'free'; p.entry = false; p.landT = 4; }
    } else if (p.st === 'dash') {
      p.stT++; p.vx = p.face * B.dash * (p.stT < 9 ? 1 : 0.72); p.vy = wasGround ? 0.01 : 0; grav = 0;      // 地上では、わずかに押しつけて接地を保つ
      if (p.stT % 2 === 0) ghost(p, 12);
      if (I.hit.attack) startAttack(I.down.down && !p.ground ? T.dive : T.dash);
      else if (I.hit.shot && (a = shotOf(p, I.down.down))) startAttack(a);      // ダッシュから、そのまま遠距離攻撃
      else if (I.hit.switch) doSwitch();
      else if (jumpHit && (p.ground || p.jumps < 2)) { p.st = 'free'; doJump(p); }      // ダッシュジャンプ: 勢いを残して跳ぶ
      else if (p.stT >= 11) { p.st = 'free'; p.dashWin = 6; p.vx = p.face * speed * 1.25; }
    } else if (p.st === 'hurt') {
      p.stT++; if (p.ground) p.vx *= 0.85;
      if (p.stT >= 20) p.st = 'free';
    } else if (p.st === 'special') {
      p.stT++;
      if (K) {      // 紅蓮砕: 力をためて（覚醒）、跳び上がり、地面を叩き割る
        if (p.stT < 8) {
          p.vx *= 0.6; if (!wasGround) { p.vy = 0; grav = 0; }
          part(p.x + rand(-10, 10), p.y - rand(0, 30), 0, rand(-1.8, -0.6), 16, p.stT % 2 ? '#ff7ad1' : '#ffffff', 2, 0, true);
        }
        else if (p.stT === 8) { p.vy = -5.6; p.vx = p.face * 1.3; R.snd('slash_red3'); dust(p.x, p.y, 6); }
        else if (p.stT < 26) p.vx = p.face * 1.2; else p.vx *= 0.7;
        if (p.stT === 26) p.vy = 9;
        if (p.stT > 26 && p.ground && !p.slammed) {
          p.slammed = true; p.slamT = p.stT; shake(12); G.hitstop = 7; R.snd('special_red'); G.flash = 0.35;
          fx({ type: 'slash', x: p.x, y: p.y - MID - 4, face: p.face, a0: -2.6, a1: 1.2, r: 62, wd: 1.3, life: 16, col: 'red', follow: p });
          fx({ type: 'quake', x: p.x, y: p.y, life: 34, face: p.face });
          for (var i = 0; i < G.enemies.length; i++) {
            var e = G.enemies[i]; if (e.dead) continue;
            var hbs = hurtboxes(e), hitIt = false;
            for (var j = 0; j < hbs.length; j++) if (R.overlap({ x: p.x - 108, y: p.y - 74, w: 216, h: 84 }, hbs[j])) hitIt = hbs[j];
            if (hitIt) damageEnemy(e, 60, e.x >= p.x ? 1 : -1, 4, { heavy: true, lift: -5.5, weak: hitIt.weak, cx: clamp(p.x, hitIt.x, hitIt.x + hitIt.w), cy: hitIt.y + hitIt.h * 0.6, snd: 'hit_red_heavy' });
          }
        }
        if (p.stT >= 62 || (p.slammed && p.stT >= p.slamT + 24)) { p.st = 'free'; p.slammed = false; }
      } else {      // 蒼刃閃: 一直線に駆け抜けて切り刻む（一発は軽いが、何度も当たる）
        if (p.stT < 24) {
          p.vx = p.face * 9; p.vy = wasGround ? 0.01 : 0; grav = 0;
          if (p.stT % 2 === 0) ghost(p, 14);
          if (p.stT % 3 === 0) fx({ type: 'thrust', x: p.x - p.face * 20, y: p.y - MID + rand(-7, 7), face: p.face, life: 10, col: 'blue', len: 80 });
          var hb = { x: p.x - 32, y: p.y - 42, w: 64, h: 46 };
          G.enemies.forEach(function (e) {
            if (e.dead) return;
            var id = G.enemies.indexOf(e), last = p.spHits[id] || -99, hbs = hurtboxes(e);
            if (p.stT - last < 4) return;
            for (var j = 0; j < hbs.length; j++) if (R.overlap(hb, hbs[j])) { p.spHits[id] = p.stT; damageEnemy(e, 5, p.face, 0.5, { col: 'blue', weak: hbs[j].weak, stop: 1, cx: clamp(p.x, hbs[j].x, hbs[j].x + hbs[j].w), cy: clamp(p.y - MID - 2, hbs[j].y, hbs[j].y + hbs[j].h), snd: 'hit_blue' }); break; }
          });
          if (p.hitWall) p.stT = 23;
        } else {
          p.vx *= 0.7;
          if (p.stT === 24) { p.hitSet = []; fx({ type: 'slash', x: p.x, y: p.y - MID - 4, face: p.face, a0: -2.9, a1: 1.3, r: 44, wd: 0.7, life: 12, col: 'blue', follow: p }); R.snd('slash_blue4'); }
          if (p.stT >= 26 && p.stT <= 32) hitEnemies(p, AOI_FIN, 1);
          if (p.stT >= 40) p.st = 'free';
        }
      }
    } else if (p.st === 'cross') {
      p.stT++; p.vx = 0; if (!p.ground) p.vy = Math.min(p.vy, 1);
      if (!G.cross) p.st = 'free';
    }
    if (grav) p.vy = Math.min(9.6, p.vy + grav);
    var vy0 = p.vy;
    moveBody(p);
    // ステージ端・ボス部屋
    var lo = 8, hi = G.S.len - 8;
    if (G.arena) { lo = G.arena[0] + 8; hi = G.arena[1] - 8; }
    if ((p.x <= lo && p.vx < 0) || (p.x >= hi && p.vx > 0)) p.vx = 0;      // 端で止められたら、その場で足踏みしない
    p.x = clamp(p.x, lo, hi);
    if (p.ground) {
      if (!wasGround) {
        if (p.st !== 'special' && !(p.st === 'attack' && p.atk.dive)) { R.snd('land'); dust(p.x, p.y, vy0 > 6 ? 6 : 3); if (p.st === 'free') { p.landT = vy0 > 6 ? 7 : 4; p.landAnim = null; } }
        p.flipT = 0;
      }
      p.jumps = 0; p.coyote = 6; p.airAtk = 0; p.airDashed = 0; p.airShot = 0; p.rose = false;
      if (groundAt(p.x - 10) && groundAt(p.x + 10)) p.safeX = p.x;
    }
    else if (p.coyote > 0) p.coyote--;
    if (p.flipT > 0 && p.flipT % 4 === 0) ghost(p, 9);
    // ステージから落ちたら、その場でゲームオーバー（つづきは、最後に記録した端末から）。縦のステージでは、画面の下へ消えたら
    if ((G.S.vertical ? p.y - p.h + G.cam.y > R.H + 6 : p.y > R.H + 60) && G.state === 'play') {
      p.vx = 0; p.vy = 0; p.st = 'free'; p.flipT = 0; G.combo = 0; G.cross = null;
      toast('落下…', '#ff9db8'); R.snd('hurt');
      G.state = 'gameover'; G.stateT = 0; R.bgm('gameover');
    }
  }
  function onPlat(p) { var P = G.plats || G.S.platRects; for (var i = 0; i < P.length; i++) if (Math.abs(p.y - P[i].y) < 1 && p.x > P[i].x - 6 && p.x < P[i].x + P[i].w + 6) return true; return false; }
  function dust(x, y, n) { for (var i = 0; i < n; i++) part(x + rand(-6, 6), y - 1, rand(-1.2, 1.2), rand(-1.2, -0.2), rand(12, 22), i % 2 ? '#a39bd0' : '#655e9e', 2, 0.02); }

  // ---- 敵 ----
  function spawn(type, x, y) {
    var e = { type: type, x: x, y: y == null ? (floorAt(x) || GY) : y, vx: 0, vy: 0, face: -1, st: 'idle', stT: 0, flash: 0, cd: rand(30, 90), animT: rand(0, 60), dead: false, ground: true, invul: 0 };
    if (type === 'robot') { e.w = 24; e.h = 46; e.hp = e.max = 58; e.exp = 12; }
    else if (type === 'drone') { e.w = 18; e.h = 18; e.hp = e.max = 30; e.exp = 9; e.armor = true; e.baseY = e.y; e.homeX = x; }
    else if (type === 'guard') { e.w = 36; e.h = 66; e.hp = e.max = 620; e.exp = 160; e.armor = true; }
    else if (type === 'dragon') R.Dragon.init(e);      // ボス「玉龍」。空を飛び回る。中身は 35_dragon.js
    else if (R.Karate) R.Karate.init(e);      // 中ボス「黒瀬 龍士」（karate）と、その写し身（photo）。中身は 52_karate.js
    return e;
  }
  function shoot(o) { o.t = 0; G.shots.push(o); return o; }

  function updRobot(e) {
    var p = G.pl, dx = p.x - e.x, ad = Math.abs(dx);
    e.animT++; e.stT++;
    if (e.cd > 0) e.cd--;
    if (e.st === 'hurt') { if (e.ground) e.vx *= 0.86; if (e.stT > 16 && e.ground) e.st = 'idle'; }
    else if (e.st === 'attack') {
      e.vx *= 0.8;
      if (e.stT === 24) { e.vx = e.face * 2.6; R.snd('slash_red1'); }
      if (e.stT >= 24 && e.stT <= 32 && R.overlap({ x: e.face > 0 ? e.x : e.x - 40, y: e.y - 40, w: 40, h: 36 }, box(p))) hurtPlayer(10, e.face, false);
      if (e.stT > 52) { e.st = 'idle'; e.cd = rand(40, 80); }
    } else {
      if (ad < 230 && Math.abs(p.y - e.y) < 90 && onScreen(e.x, 60, e.y)) {
        e.face = R.sign(dx);
        if (ad < 42 && e.cd <= 0) { e.st = 'attack'; e.stT = 0; }
        else if (ad > 34) {
          var ahead = e.x + e.face * 14;
          e.vx = (G.S.vertical ? e.ground && standAt(ahead, e.y) : groundAt(ahead)) ? e.face * 0.75 : 0; e.st = e.vx ? 'walk' : 'idle';
        } else { e.vx *= 0.8; e.st = 'idle'; }
      } else { e.vx *= 0.8; e.st = 'idle'; }
    }
    e.vy = Math.min(9, e.vy + 0.45); moveBody(e);
    if (e.y > R.H + 80) { e.dead = true; }
  }
  function updDrone(e) {
    var p = G.pl, dx = p.x - e.x;
    e.animT++; e.stT++; if (e.cd > 0) e.cd--;
    if (Math.abs(dx) < 260 && onScreen(e.x, 30, e.y)) {
      e.face = R.sign(dx);
      var want = p.x - e.face * 110;
      e.vx += clamp((want - e.x) * 0.002, -0.05, 0.05);
      if (e.cd <= 0) { e.cd = rand(140, 200); e.aim = 26; }
    }
    if (e.aim > 0) {
      e.aim--; e.vx *= 0.9;
      if (e.aim === 0) {
        var a = Math.atan2((p.y - 22) - e.y, p.x - e.x);
        shoot({ type: 'bullet', x: e.x, y: e.y + 2, vx: Math.cos(a) * 2.1, vy: Math.sin(a) * 2.1, life: 200, dmg: 8, r: 4 });
        R.snd('enemy_shot');
      }
    }
    e.vx = clamp(e.vx * 0.97, -1.4, 1.4); e.x += e.vx;
    e.y = e.baseY + Math.sin(e.animT * 0.05) * 8;
  }
  function updGuard(e) {
    var p = G.pl, dx = p.x - e.x, ad = Math.abs(dx), i;
    e.animT++; e.stT++; if (e.cd > 0) e.cd--;
    var rage = e.hp < e.max * 0.5;
    if (e.st === 'idle' || e.st === 'walk' || e.st === 'hurt') {
      e.face = R.sign(dx);
      e.vx = ad > 44 ? e.face * (rage ? 0.75 : 0.55) : 0; e.st = e.vx ? 'walk' : 'idle';
      if (e.cd <= 0) {
        var k = Math.random();
        if (ad < 62) { e.st = k < 0.6 ? 'punch' : 'slam'; }
        else if (ad > 150) { e.st = k < 0.65 ? 'charge' : 'slam'; }
        else { e.st = k < 0.55 ? 'slam' : 'charge'; }
        e.stT = 0; e.vx = 0;
      }
    } else if (e.st === 'punch') {
      e.vx *= 0.8;
      if (e.stT === 26) { e.vx = e.face * 3.4; R.snd('slash_red2'); }
      if (e.stT >= 26 && e.stT <= 36 && R.overlap({ x: e.face > 0 ? e.x : e.x - 62, y: e.y - 60, w: 62, h: 52 }, box(p))) hurtPlayer(16, e.face, true);
      if (e.stT > 58) { e.st = 'idle'; e.cd = rage ? 30 : 60; }
    } else if (e.st === 'slam') {
      e.vx = 0;
      if (e.stT === 36) {
        shake(8); R.snd('special_red'); dust(e.x + e.face * 28, e.y, 14);
        shoot({ type: 'shock', x: e.x + e.face * 30, y: e.y, vx: e.face * 3.2, vy: 0, life: 90, dmg: 14, w: 16, h: 22 });
        shoot({ type: 'shock', x: e.x - e.face * 10, y: e.y, vx: -e.face * 3.2, vy: 0, life: 90, dmg: 14, w: 16, h: 22 });
        if (R.overlap({ x: e.x - 50, y: e.y - 30, w: 100, h: 30 }, box(p)) && p.ground) hurtPlayer(16, R.sign(p.x - e.x), true);
      }
      if (e.stT > 70) { e.st = 'idle'; e.cd = rage ? 36 : 70; }
    } else if (e.st === 'charge') {
      if (e.stT < 34) { e.vx = -e.face * 0.3; }
      else if (e.stT < 34 + 46) {
        if (e.stT === 34) R.snd('dash');
        e.vx = e.face * (rage ? 5.2 : 4.4);
        if (e.stT % 3 === 0) dust(e.x - e.face * 14, e.y, 2);
        if (R.overlap({ x: e.x - 20, y: e.y - 62, w: 40, h: 62 }, box(p))) hurtPlayer(15, e.face, true);
        if (e.hitWall || e.x < G.arena[0] + 30 || e.x > G.arena[1] - 30) { e.stT = 34 + 46; shake(6); R.snd('hit_heavy'); }
      } else { e.vx *= 0.8; if (e.stT > 34 + 46 + 40) { e.st = 'idle'; e.cd = rage ? 30 : 60; } }
    }
    e.vy = Math.min(9, e.vy + 0.45); moveBody(e);
    if (G.arena) e.x = clamp(e.x, G.arena[0] + 22, G.arena[1] - 22);
  }
  function updEnemies() {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead) continue;
      if (e.flash > 0) e.flash--;
      if (e.type === 'robot') updRobot(e); else if (e.type === 'drone') updDrone(e); else if (e.type === 'guard') updGuard(e);
      else if (e.upd) e.upd(e);      // 龍（35_dragon.js）、中ボスと写し身（52_karate.js）
    }
    G.enemies = G.enemies.filter(function (e) { return !e.dead || e === G.boss; });
  }
  // 敵の体に触れると、のけぞってダメージを受ける。
  //   こちらが攻撃している間・ダッシュや技の最中・無敵の間は受けない。斬られてひるんでいる敵（白く光っている間）にも当たらない
  var TOUCH = { robot: 6, drone: 5, guard: 10, dragon: 10, karate: 8 };
  function updTouch() {
    var p = G.pl, pb, i, j, e, parts, b;
    if (p.inv > 0 || p.st === 'attack' || p.st === 'dash' || p.st === 'special' || p.st === 'cross' || p.st === 'hurt') return;
    pb = box(p);
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead || e.dying || e.gone || !TOUCH[e.type] || e.flash > 0 || e.st === 'hurt' || e.st === 'stagger' || e.st === 'intro' || e.invul > 0 || e.hide) continue;
      parts = hurtboxes(e);
      for (j = 0; j < parts.length; j++) {
        b = parts[j];
        if (R.overlap(pb, { x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 4 })) { hurtPlayer(TOUCH[e.type], p.x >= e.x ? 1 : -1, false); return; }
      }
    }
  }
  function updShots() {
    var p = G.pl, pb = box(p), i, s;
    for (i = 0; i < G.shots.length; i++) {
      s = G.shots[i]; s.t++; s.x += s.vx; s.y += s.vy; if (s.g) s.vy += s.g;
      var hit = false;
      if (s.type === 'bullet' || s.type === 'fireball' || s.type === 'flame') {
        if (s.type === 'flame') { s.vx *= 0.985; s.r = 5 + s.t * 0.16; if (s.y > GY - 4) { s.y = GY - 4; s.vy = -Math.abs(s.vy) * 0.2; } }
        hit = R.overlap({ x: s.x - s.r * 0.7, y: s.y - s.r * 0.7, w: s.r * 1.4, h: s.r * 1.4 }, pb);
        var fty = s.ty === undefined ? GY : s.ty;      // 火球がはじける高さ（ねらった足場の高さ）
        if (s.type === 'fireball' && s.vy > 0 && s.y >= fty - 4) {
          s.dead = true; fx({ type: 'boom', x: s.x, y: fty - 8, life: 16, r: 24 }); R.snd('explosion'); shake(3);
          if (R.overlap({ x: s.x - 24, y: fty - 36, w: 48, h: 40 }, pb)) hurtPlayer(s.dmg, R.sign(p.x - s.x), false);
        }
        if (s.type === 'fireball' && s.t % 2 === 0) part(s.x, s.y, rand(-0.4, 0.4), rand(-0.4, 0.4), 14, s.t % 4 ? '#ff8a3a' : '#ffd36a', 2, 0, true);
        if (s.type === 'bullet' && ((s.y > GY && groundAt(s.x)) || inBlock(s.x, s.y))) { s.dead = true; hit = false; }      // 地面と石の段で消える
      } else if (s.type === 'shock') {
        hit = R.overlap({ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h }, pb);
        if (!groundAt(s.x)) s.dead = true;
        if (s.t % 2 === 0) part(s.x + rand(-6, 6), s.y - rand(0, s.h), -s.vx * 0.2, rand(-1.5, -0.4), 14, s.t % 4 ? '#ff7ad1' : '#ffffff', 2, 0, true);
      } else if (s.type === 'pillar') {
        if (s.t === s.warn) { R.snd('fire'); shake(4); }
        hit = s.t > s.warn && s.t < s.life - 12 && R.overlap({ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h }, pb);
      } else if (s.upd) hit = s.upd(s, p, pb);      // 中ボスの技（衝撃波・地裂）は、動きを自分で決める
      if (hit) { if (hurtPlayer(s.dmg, R.sign(s.vx || (p.x - s.x)), s.type === 'shock' || !!s.big)) { if (s.type === 'bullet') s.dead = true; } }
      if (s.t > s.life || s.x < G.cam.x - 80 || s.x > G.cam.x + R.W + 80 || (G.S.vertical && !onScreen(s.x, 80, s.y))) s.dead = true;
    }
    G.shots = G.shots.filter(function (s) { return !s.dead; });
  }
  function updItems() {
    var p = G.pl, pb = box(p), i, it;
    for (i = 0; i < G.items.length; i++) {
      it = G.items[i]; it.t++;
      if (it.loose) {
        it.vy += 0.25; it.x += it.vx; it.y += it.vy;
        var fy = floorAt(it.x), PL = G.S.platRects, pi;      // 石の段の上にも、足場の上にも乗る
        for (pi = 0; pi < PL.length; pi++) if (it.vy >= 0 && it.x > PL[pi].x && it.x < PL[pi].x + PL[pi].w && it.y - it.vy + 12 <= PL[pi].y + 0.01 && it.y + 12 >= PL[pi].y && (fy === null || PL[pi].y < fy)) fy = PL[pi].y;
        if (fy !== null && it.vy >= 0 && it.y >= fy - 12) { it.y = fy - 12; it.vy = 0; it.vx = 0; it.loose = false; }
        if (it.y > R.H + 30) it.dead = true;
      }
      if (it.type === 'chest') continue;
      if (it.t > 12 && R.overlap({ x: it.x - 9, y: it.y - 12, w: 18, h: 24 }, pb)) {
        it.dead = true; R.snd('pickup'); p.joyT = 45; p.joyAll = false;
        if (it.type === 'crystal') { p.crystals = Math.min(99, p.crystals + 1); ['kurenai', 'aoi'].forEach(function (k) { var c = p.chars[k]; c.sp = Math.min(c.maxsp, c.sp + 8); }); burst(it.x, it.y, 10, ['#37e6ff', '#ffffff', '#7af3ff'], 2.6, 22); text(it.x, it.y - 12, '+1', '#7af3ff'); }
        else { p.potions = Math.min(9, p.potions + 1); burst(it.x, it.y, 10, ['#ff5a7a', '#ffffff'], 2.6, 22); text(it.x, it.y - 12, 'POTION', '#ff9db8'); }
      }
    }
    G.items = G.items.filter(function (q) { return !q.dead; });
    // 端末（チェックポイント）
    for (i = 0; i < G.terminals.length; i++) {
      var tm = G.terminals[i];
      if (!tm.on && Math.abs(p.x - tm.x) < 22 && p.ground && Math.abs(p.y - tm.y) < 4) {
        tm.on = true; G.respawn = { x: tm.x, y: tm.y, stage: G.stageIdx }; R.snd('checkpoint'); p.joyT = 70; p.joyAll = true; toast('CHECKPOINT ― 記録した', '#7af3ff');
        fx({ type: 'ring', x: tm.x, y: tm.y - 30, life: 26, r: 50, col: '#37e6ff' });
        ['kurenai', 'aoi'].forEach(function (k) { var c = p.chars[k]; if (c.down) { c.down = false; c.hp = Math.round(c.max * 0.5); } else c.hp = Math.min(c.max, c.hp + Math.round(c.max * 0.35)); });
      }
    }
  }
  function updFx() {
    var i, o;
    for (i = 0; i < G.fx.length; i++) { o = G.fx[i]; o.t++; if (o.follow && o.type === 'slash') { o.x = o.follow.x + o.face * 2; o.y = o.follow.y - 21; } }
    G.fx = G.fx.filter(function (q) { return q.t < q.life; });
    for (i = 0; i < G.parts.length; i++) { o = G.parts[i]; o.t++; o.x += o.vx; o.y += o.vy; o.vy += o.grav; if (o.petal) o.x += Math.sin((o.t + o.sway * 20) * 0.05) * 0.3; else o.vx *= 0.97; }
    G.parts = G.parts.filter(function (q) { return q.t < q.life; });
    for (i = 0; i < G.texts.length; i++) { o = G.texts[i]; o.t++; o.y += o.vy; o.vy *= 0.94; }
    G.texts = G.texts.filter(function (q) { return q.t < q.life; });
    for (i = 0; i < G.ghosts.length; i++) { o = G.ghosts[i]; o.t++; if (o.leave) { o.x += o.vx; o.y += o.vy; o.vy += 0.14; } }
    G.ghosts = G.ghosts.filter(function (q) { return q.t < q.life; });
    // 舞う桜・光の粒
    if (G.S && G.parts.length < 160 && G.t % 5 === 0) {
      if (G.S.id === 'school') G.parts.push({ x: G.cam.x + rand(0, R.W + 80), y: -6, vx: rand(-0.9, -0.3), vy: rand(0.35, 0.8), life: 420, t: 0, col: null, petal: true, size: 1, grav: 0, sway: rand(0, 6) });
      else if (G.t % 15 === 0) part(G.cam.x + rand(0, R.W), rand(20, 190) - (G.cam.y || 0), rand(-0.2, 0.2), rand(-0.3, -0.1), 120, Math.random() < 0.5 ? '#ff7ad1' : '#37e6ff', 1, 0, true);
    }
  }
  // 合体技「紅蒼交錯」
  function updCross() {
    var X = G.cross, p = G.pl; X.t++;
    var hits = [46, 52, 58, 64, 70, 76];
    if (X.t === 34) { R.snd('slash_red3'); R.snd('slash_blue3'); }
    if (hits.indexOf(X.t) >= 0) {
      var odd = hits.indexOf(X.t) % 2;
      fx({ type: 'slash', x: X.x, y: X.y - 30, face: odd ? -1 : 1, a0: odd ? 1.4 : -2.6, a1: odd ? -2.2 : 1.1, r: 96 + hits.indexOf(X.t) * 6, life: 14, col: odd ? 'blue' : 'red' });
      fx({ type: 'thrust', x: X.x + (odd ? 190 : -190), y: X.y - 30 + rand(-36, 36), face: odd ? -1 : 1, life: 12, col: odd ? 'blue' : 'red', len: 380 });
    }
    if (X.t === 92) { fx({ type: 'ring', x: X.x, y: X.y - 30, life: 24, r: 220, col: '#ffffff' }); fx({ type: 'boom', x: X.x, y: X.y - 30, life: 22, r: 120 }); }
    if (hits.indexOf(X.t) >= 0 || X.t === 92) {
      var fin = X.t === 92;
      G.enemies.forEach(function (e) {
        if (e.dead || !onScreen(e.x, 10, e.y)) return;
        var hbs = hurtboxes(e), h = hbs[0];
        if (fin) fx({ type: 'sprfx', who: 'aoi', group: 'ougi', i0: 2, i1: 3, x: e.x, y: e.type === 'drone' ? GY : e.y, life: 30 });
        damageEnemy(e, fin ? 80 : 20, R.sign(e.x - p.x) || 1, fin ? 5 : 0.4, { heavy: fin, noGain: true, cross: true, col: X.t % 4 ? 'blue' : 'gold', weak: !!h.weak, lift: fin ? -5 : 0, cx: h.x + h.w / 2 + rand(-10, 10), cy: h.y + h.h / 2 + rand(-10, 10), stop: fin ? 8 : 2 });
      });
      shake(fin ? 12 : 4); if (fin) { G.flash = 0.9; R.snd('explosion'); }
    }
    if (X.t >= 118) { G.cross = null; p.st = 'free'; p.inv = Math.max(p.inv, 40); }
  }

  // ---- 進行 ----
  // talk = ステージの前にはさむ会話の名前（65_talk.js の R.TALKS）。会話があるときは、章の題と曲を会話のあとに回す
  R.startStage = function (idx, fromCheckpoint, talk) {
    var S = R.STAGES[idx], p = G.pl;
    G.stageIdx = idx; G.S = S; G.enemies = []; G.shots = []; G.pshots = []; G.items = []; G.fx = []; G.parts = []; G.texts = []; G.ghosts = [];
    G.boss = null; G.arena = null; G.cross = null; G.bossCut = null; G.bossDefeated = false; G.rage = false; G.combo = 0; G.hitstop = 0; G.slow = 0;
    G.dazzle = 0; G.bossIntro = 0;
    if (!fromCheckpoint) { G.midDone = false; G.midMet = false; G.midHint = null; }      // 中ボスを倒したか・もう会ったか（やり直しても覚えておく。ステージを最初から始めるときだけ戻す）
    S.enemies.forEach(function (q) { G.enemies.push(spawn(q[0], q[1], q[2])); });
    S.items.forEach(function (q) { G.items.push({ type: q[0], x: q[1], y: q[2], t: 0, open: false }); });
    // 端末・バネは、x だけ（地面の上）か、[x, y]（縦のステージの足場の上）
    G.terminals = S.checkpoints.map(function (q) { return typeof q === 'number' ? { x: q, y: GY, on: false } : { x: q[0], y: q[1], on: false }; });
    G.movers = (S.movers || []).map(function (q, n) { return { x0: q[0], y0: q[1], x: q[0], y: q[1], w: q[2], dx: q[3], dy: q[4], per: q[5], ph: n * 37 }; });
    G.plats = S.platRects.concat(G.movers);
    G.springs = (S.springs || []).map(function (q) { if (typeof q !== 'number') return { x: q[0], y: q[1], t: 0 }; var y = floorAt(q); return { x: q, y: y === null ? GY : y, t: 0 }; });
    var sx = S.startX || 70, sy = GY;
    if (fromCheckpoint && G.respawn && G.respawn.stage === idx) {
      sx = G.respawn.x; sy = G.respawn.y === undefined ? GY : G.respawn.y;
      if (S.vertical) {      // 縦のステージ: 記録した高さより下の端末は済み。上にいる敵だけ残す
        G.terminals.forEach(function (tm) { if (tm.y >= sy) tm.on = true; });
        G.enemies = G.enemies.filter(function (e) { return e.y < sy - 110; });
      } else {
        G.terminals.forEach(function (tm) { if (tm.x <= sx) tm.on = true; });
        G.enemies = G.enemies.filter(function (e) { return e.x > sx + 200; });
      }
    } else { G.respawn = { x: sx, y: GY, stage: idx }; }
    p.x = sx; p.y = sy; p.vx = 0; p.vy = 0; p.st = 'free'; p.inv = 60; p.face = 1; p.safeX = sx; p.ground = true; p.slammed = false; p.entry = false; p.flipT = 0; p.landT = 0; p.skidT = 0; p.airAtk = 0; p.airDashed = 0; p.landAnim = null; p.battleT = 0; p.angerT = 0; p.hurtFaceT = 0; p.joyT = 0; p.running = false; p.stopT = 0;
    G.cam.x = clamp(sx - 180, 0, S.len - R.W); G.cam.y = S.vertical ? towerCam(sy) : 0;
    G.goalT = 0;
    G.card = null; G.talk = null;
    G.state = 'play'; G.stateT = 0; G.fade = 1; G.fadeDir = -1;
    if (talk && R.TALKS && R.TALKS[talk]) R.beginTalk(talk); else R.openStage();
  };
  // 章の題を出して、ステージの曲を始める
  R.openStage = function () { var S = G.S; G.card = { t: 0, title: S.title, sub: S.sub }; R.bgm(S.bgm); };
  R.newGame = function () {
    G.pl = newPlayer(); G.time = 0; G.kills = 0; G.maxCombo = 0; G.helpT = 60 * 14; G.respawn = null;
    R.startStage(0, false, 'stage1');      // ステージ 1 の前に、紅と蒼の会話
  };
  R.continueGame = function () {
    var p = G.pl;
    ['kurenai', 'aoi'].forEach(function (k) { var c = p.chars[k]; c.down = false; c.hp = c.max; c.sp = Math.max(c.sp, 50); });
    p.who = 'kurenai'; p.potions = Math.max(p.potions, 2);
    R.startStage(G.stageIdx, true);
  };
  // 縦のステージのカメラ: 足もとが画面の下から 105 ドット（y = 165）に来る高さ。下の地面より下は映さず、てっぺんより上へも行かない
  function towerCam(y) { return clamp(165 - y, 0, 165 - G.S.goal[1] + 20); }
  // 縦のステージ: てっぺんの足場に立ったら、登りきってステージクリア
  function updGoal() {
    var S = G.S, q = S.goal, p = G.pl;
    if (!G.bossDefeated && p.ground && Math.abs(p.y - q[1]) < 2 && p.x > q[0] && p.x < q[0] + q[2]) {
      G.bossDefeated = true; G.stateT = 0; G.shots = [];
      G.enemies.forEach(function (e) { if (!e.dead) { e.dead = true; burst(e.x, e.y - 10, 12, ['#ffe04a', '#ffffff'], 2.4, 22); } });
      toast('登頂！ ― 鉄塔のてっぺんに着いた', '#ffe04a'); R.snd('levelup'); p.joyT = 120; p.joyAll = true;
      fx({ type: 'ring', x: p.x, y: p.y - MID, life: 30, r: 70, col: '#ffe04a' });
    }
    if (G.bossDefeated) { G.stateT++; if (G.stateT === 90) { R.bgm('clear'); G.state = 'clear'; G.stateT = 0; } }
  }
  function updBossTrigger() {
    var S = G.S, b = S.boss, m = S.mid, p = G.pl;
    if (S.goal) { updGoal(); return; }
    // 中ボス: ステージの途中で立ちはだかる。退けると先へ進める（ステージクリアにはならない）。一騎打ちなので、ほかの敵は入れない
    if (m && R.Karate && R.Karate.ok() && !G.midDone && !G.boss && !G.cross && p.x > m.trigger && p.x < m.arena[1]) {
      G.arena = m.arena.slice();
      G.boss = spawn(m.type, m.x, GY); G.boss.name = m.name; G.boss.sub = m.sub; G.boss.mid = m; G.enemies.push(G.boss);
      G.enemies = G.enemies.filter(function (e) { return e === G.boss || e.x < m.arena[0] - 60 || e.x > m.arena[1] + 60; });
      G.shots = []; G.bossIntro = 150;
      R.Karate.enter(G.boss, m);
    }
    if (!G.boss && !G.bossDefeated && p.x > b.trigger) {
      G.arena = b.arena.slice();
      G.boss = spawn(b.type, b.x, GY); G.boss.name = b.name; G.boss.sub = b.sub; G.enemies.push(G.boss);
      G.bossIntro = 110; R.bgm('boss'); R.snd(b.type === 'dragon' ? 'roar' : 'explosion'); shake(8);
      G.enemies = G.enemies.filter(function (e) { return e === G.boss || (e.x > b.arena[0] - 40 && e.x < b.arena[1]); });
    }
    if (G.bossIntro > 0) G.bossIntro--;
    if (G.bossDefeated) {
      G.stateT++;
      if (G.stateT === 70) { G.arena = null; R.bgm('clear'); G.state = 'clear'; G.stateT = 0; }
    }
  }

  // 動く足場: 2 点の間を、ゆっくり往復する。乗っていれば一緒に運ばれる
  function updMovers() {
    var M = G.movers || [], p = G.pl, i, m, ox, oy, u;
    for (i = 0; i < M.length; i++) {
      m = M[i]; ox = m.x; oy = m.y; m.py = oy;
      u = 0.5 - 0.5 * Math.cos((G.time + m.ph) / m.per * PI * 2);
      m.x = m.x0 + m.dx * u; m.y = m.y0 + m.dy * u;
      if (p.ground && !(p.drop > 0) && Math.abs(p.y - oy) < 1.6 && p.x + p.w / 2 > ox && p.x - p.w / 2 < ox + m.w) { p.x += m.x - ox; p.y = m.y; }
    }
  }
  // バネ: 踏むと高く跳ね上がる（二段ジャンプと空中ダッシュも戻る）
  function updSprings() {
    var K = G.springs || [], p = G.pl, i, s;
    for (i = 0; i < K.length; i++) {
      s = K[i]; if (s.t > 0) s.t--;
      if (p.ground && Math.abs(p.x - s.x) < 11 && Math.abs(p.y - s.y) < 3 && (p.st === 'free' || p.st === 'dash' || (p.st === 'attack' && !p.atk.dive && !(p.atk.kusari && p.atk.kusari.pull)))) {
        p.st = 'free'; p.entry = false; p.vy = -11; p.ground = false; p.coyote = 0; p.jumps = 1; p.airDashed = 0; p.airAtk = 0; p.airShot = 0; p.rose = true; p.landT = 0; p.stretchT = 6;
        s.t = 12; R.snd('djump'); dust(s.x, s.y, 5);
        fx({ type: 'ring', x: s.x, y: s.y - 4, life: 12, r: 20, col: '#ffe04a', flat: true });
      }
    }
  }
  // トゲ: 地面に立っていると刺さる（跳び越えるか、ダッシュで駆け抜ける）
  function updSpikes() {
    var p = G.pl, K = G.S.spikes || [], i;
    if (!p.ground || p.y < GY - 1 || p.inv > 0 || p.st === 'dash' || p.st === 'special' || p.st === 'cross') return;
    for (i = 0; i < K.length; i++) if (p.x > K[i][0] + 1 && p.x < K[i][0] + K[i][1] - 1) { if (hurtPlayer(12, -p.face, false)) { p.vy = -5; } return; }
  }
  R.updatePlay = function () {
    G.t++;
    if (G.fadeDir) { G.fade = clamp(G.fade + G.fadeDir * 0.04, 0, 1); if (G.fade === 0 || G.fade === 1) G.fadeDir = 0; }
    if (G.flash > 0) G.flash = Math.max(0, G.flash - 0.05);
    if (G.dazzle > 0) G.dazzle--;      // 中ボスのフラッシュで目がくらんでいる時間
    if (G.cam.shake > 0) G.cam.shake *= 0.86;
    if (G.card) { G.card.t++; if (G.card.t > 190) G.card = null; }
    if (G.toast) { G.toast.t++; if (G.toast.t > 130) G.toast = null; }
    if (G.cutin) { G.cutin.t++; if (G.cutin.t > 52) G.cutin = null; }
    if (G.helpT > 0) G.helpT--;
    if (G.comboPop > 0) G.comboPop--;
    if (G.hitstop > 0) {      // ヒットストップ中の入力は次のコマへ持ち越す
      G.hitstop--; updFx();
      for (var k in R.input.hit) if (R.input.hit[k]) R.input.tap(k);
      return;
    }
    G.time++;
    if (G.comboT > 0) { G.comboT--; if (G.comboT === 0) G.combo = 0; }
    updMovers(); updPlayer(); updSprings(); updPShots();
    if (G.slow > 0) G.slow--;
    if (G.cross) updCross(); else if (!(G.slow > 0) || G.t % 3 === 0) { updEnemies(); updShots(); }
    if (!G.cross) updTouch();
    updItems(); updFx(); updBossTrigger(); updSpikes();
    // カメラ
    var p = G.pl, tx = p.x - R.W * 0.42 + p.face * 26, lo = 0, hi = G.S.len - R.W;
    if (G.arena) { lo = G.arena[0]; hi = G.arena[1] - R.W; }
    G.cam.x += (clamp(tx, lo, hi) - G.cam.x) * 0.1;
    if (G.cam.x < lo) G.cam.x += Math.min(4, lo - G.cam.x); if (G.cam.x > hi) G.cam.x -= Math.min(4, G.cam.x - hi);
    if (G.S.vertical) {
      // 縦のステージ: 高い足場に乗るとカメラが上がる。下へは戻らない（落ちたら画面の外 = ゲームオーバー）。
      //   跳んで画面の上端に近づいたときも、少し先に上げる
      var cy = Math.max(p.ground ? towerCam(p.y) : 0, towerCam(p.y + 95));      // 足もとが画面の上から 70 ドットより上に来たら
      if (cy > G.cam.y) G.cam.y = Math.min(cy, G.cam.y + Math.min(6, (cy - G.cam.y) * 0.08 + 0.3));
    } else
    // 高い所に上がると、カメラが少し上を向く（塔の上から跳んでも、自分が画面の外へ消えない）
    G.cam.y = (G.cam.y || 0) + (clamp(104 - p.y, 0, 84) - (G.cam.y || 0)) * 0.1;
  };
  // 中ボスを退けたあと: 道が開き、ステージの曲に戻る（52_karate.js から呼ばれる）
  R.midBossDone = function (e) {
    e.dead = true; e.gone = true;
    if (G.boss === e) G.boss = null;
    G.arena = null; G.midDone = true; G.shots = [];
    R.bgm(G.S.bgm);
  };
  // 別ファイルの敵（52_karate.js）が使う部品
  R.GX = {
    fx: fx, part: part, burst: burst, text: text, toast: toast, shake: shake, dust: dust, box: box, onScreen: onScreen, groundAt: groundAt,
    moveBody: moveBody, hurtPlayer: hurtPlayer, shoot: shoot, dropItem: dropItem, gainExp: gainExp, spawn: spawn, MID: MID
  };
  R.G = G;
})();

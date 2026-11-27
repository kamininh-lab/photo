// 全体マップ（ステージを選ぶ画面）。街を上空から見下ろした下絵（09_map_art.js。make_world_map.py が描く）の上に、
// 道のりのマス・ステージのマス・紅と蒼を描く。画面は 1920x1080 の仮想座標（HUD と同じ。下絵の 1 ドット = 2）。
//   ← → （↑ ↓ でも）… となりのステージのマスへ、道のりに沿って走る（行けるのは、クリアしたステージと、その次まで）
//   決定            … いまいるマスのステージを始める（ステージの前の会話から）
// 流れ: はじめから → マップ（道の入口から第一章のマスへ走ってくる）→ 決定でステージ → クリア → マップ（次のマスへの道が開き、自動で走っていく）
//       最後のステージをクリアしたときだけ、マップをはさまずエンディングへ（90_main.js）。クリアしたステージは、選び直して何度でも遊べる
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, U = R.UI, T = U.T, panel = U.panel, PI = Math.PI, clamp = R.clamp;
  var PINK = '#ff4fb0', CYAN = '#37e6ff', GOLD = '#ffd36a';
  var img = null; if (window.REBELL_MAP) { img = new Image(); img.src = window.REBELL_MAP; }
  // 道のり（下絵の座標）: 水道橋の上 → 鉄塔の足もと → てっぺん → 雲の上の航路 → 学園。make_world_map.py の絵と合わせてある
  var PATH = [[30, 445], [120, 432], [150, 427], [250, 412], [380, 400], [470, 392], [470, 192], [540, 142], [640, 124], [740, 130], [800, 168]];
  var NODE = [2, 5, 6, 10];      // ステージのマス（PATH の何番目か）
  // マスの横に出す短い名前（dx, dy = マスからのずれ）と、下の説明
  var INFO = [
    { name: '水道橋', dx: 0, dy: 74, desc: '雨の降るネオンの廃都。機械兵のうろつく水道橋を渡り、門番を倒せ。' },
    { name: '鉄塔', dx: -110, dy: 20, desc: '学園への橋は、結界の中。雲の上まで続く鉄塔を、てっぺんまで登れ。' },
    { name: '空中回廊', dx: -150, dy: -10, desc: '止まらない飛空艇の航路。乗り継いで、結界の上を越えろ。' },
    { name: '玉龍学園', dx: 0, dy: 80, desc: '紅い月の下、桜の並木の奥で《龍》が待つ。姫を取り戻せ。' }
  ];
  var RANKS = 'DCBAS', SPEED = 4.6, STEP = 21;
  var LEN = [0], i;
  for (i = 1; i < PATH.length; i++) LEN.push(LEN[i - 1] + Math.sqrt(Math.pow(PATH[i][0] - PATH[i - 1][0], 2) + Math.pow(PATH[i][1] - PATH[i - 1][1], 2)));
  var ND = NODE.map(function (n) { return LEN[n]; });
  // 道のりの上の、入口から d だけ進んだ点（仮想座標）
  function at(d) {
    d = clamp(d, 0, LEN[LEN.length - 1]);
    for (var k = 1; k < PATH.length; k++) if (d <= LEN[k]) { var u = (d - LEN[k - 1]) / (LEN[k] - LEN[k - 1] || 1); return [(PATH[k - 1][0] + (PATH[k][0] - PATH[k - 1][0]) * u) * 2, (PATH[k - 1][1] + (PATH[k][1] - PATH[k - 1][1]) * u) * 2]; }
    return [PATH[PATH.length - 1][0] * 2, PATH[PATH.length - 1][1] * 2];
  }
  // 小さなマス（ステージのマスの間を、同じ間隔で刻む）
  var DOTS = [];
  (function () {
    var a = 0, k, j, n;
    for (k = 0; k < ND.length; k++) { n = Math.max(1, Math.round((ND[k] - a) / STEP)); for (j = (k ? 1 : 0); j < n; j++) DOTS.push(a + (ND[k] - a) * j / n); a = ND[k]; }
  })();
  function better(a, b) { return !b || RANKS.indexOf(a) > RANKS.indexOf(b); }

  // マップを開く。at = いるマス（-1 = はじめから: 道の入口から走ってくる）、cleared = そのステージをクリアして戻ってきた
  R.openMap = function (k, cleared) {
    if (G.unlocked == null) G.unlocked = 0;
    if (!G.ranks) G.ranks = {};
    var m = G.map = { at: Math.max(0, k), d: k < 0 ? 0 : ND[k], to: null, t: 0, wait: 0, newT: 0, face: 1, moveT: 0 };
    if (k < 0) m.to = 0;
    if (cleared && k + 1 < NODE.length && G.unlocked < k + 1) { G.unlocked = k + 1; m.to = k + 1; m.wait = 70; m.newT = 200; }      // 次のマスへの道が開く
    G.state = 'map'; G.stateT = 0; R.bgm('title');
  };
  // クリアの評価を覚える（よいほうを残す）
  R.mapRecord = function (idx, rank) { if (!G.ranks) G.ranks = {}; if (rank && better(rank, G.ranks[idx])) G.ranks[idx] = rank; };

  R.updateMap = function (ok) {
    var m = G.map, I = R.input; if (!m) { R.openMap(0, false); return; }
    m.t++; if (m.newT > 0) m.newT--;
    if (m.wait > 0) { if (--m.wait === 0) R.snd('levelup'); return; }
    if (m.to !== null) {      // 道のりに沿って走る
      var goal = ND[m.to], p0 = at(m.d);
      m.d += clamp(goal - m.d, -SPEED, SPEED); m.moveT++;
      var p1 = at(m.d); if (Math.abs(p1[0] - p0[0]) > 0.5) m.face = p1[0] > p0[0] ? 1 : -1;
      if (m.moveT % 14 === 0) R.snd('select');
      if (Math.abs(goal - m.d) < 0.01) { m.at = m.to; m.to = null; m.moveT = 0; m.face = 1; R.snd('checkpoint'); }
      return;
    }
    var dir = (I.hit.right || I.hit.up) ? 1 : (I.hit.left || I.hit.down) ? -1 : 0;
    if (dir) { var k = m.at + dir; if (k >= 0 && k <= G.unlocked && k < NODE.length) m.to = k; else R.snd('deny'); }
    else if (ok && m.t > 24) { R.snd('start'); R.startStage(m.at, false, R.STAGES[m.at].talk); }
  };

  function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
  function hero(g, who, x, y, face, run, ph, t) {
    if (!R.SPR || !R.SPR[who]) return;
    var f = run ? R.frame(who, 'run', Math.floor(ph / 4) % R.SPR[who].run.length) : R.frame(who, 'idle', 0);
    if (!f || !f.c) return;
    if (!run) y += Math.round(Math.sin(t * 0.08 + (who === 'aoi' ? 1.6 : 0)) * 1.5);
    g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(face * 1.5, 1.5); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(f.c, -f.ox, -f.oy); g.restore();
  }

  R.drawMap = function (g) {
    var m = G.map; if (!m) return;
    var t = m.t, k, p, lit = ND[Math.min(G.unlocked || 0, ND.length - 1)], q, moving = m.to !== null;
    g.save();
    g.imageSmoothingEnabled = false;
    if (img && img.complete && img.naturalWidth) g.drawImage(img, 0, 0, 1920, 1080); else { g.fillStyle = '#140a30'; g.fillRect(0, 0, 1920, 1080); }
    // 道のり: 開いているところまでは光る線、その先は暗い点線
    g.lineCap = 'round'; g.lineJoin = 'round';
    function trace(d0, d1) { g.beginPath(); for (var d = d0; d <= d1 + 0.01; d += 6) { q = at(Math.min(d, d1)); if (d === d0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); } q = at(d1); g.lineTo(q[0], q[1]); }
    g.setLineDash([10, 16]); g.lineWidth = 5; g.strokeStyle = 'rgba(190,180,230,.35)'; trace(lit, ND[ND.length - 1]); g.stroke(); g.setLineDash([]);
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = 22; g.strokeStyle = 'rgba(255,79,176,.16)'; trace(0, lit); g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 8; g.strokeStyle = '#1a0f3a'; trace(0, lit); g.stroke();
    var lg = g.createLinearGradient(60, 900, 1600, 300); lg.addColorStop(0, PINK); lg.addColorStop(0.55, GOLD); lg.addColorStop(1, CYAN);
    g.lineWidth = 4; g.strokeStyle = lg; trace(0, lit); g.stroke();
    // 小さなマス
    for (k = 0; k < DOTS.length; k++) {
      p = at(DOTS[k]); var on = DOTS[k] <= lit + 0.01, pass = DOTS[k] <= m.d + 0.01;
      diamond(g, p[0], p[1], on ? 9 : 7); g.fillStyle = on ? (pass ? '#ffffff' : '#2a1a58') : '#1a1236'; g.fill();
      g.lineWidth = 3; g.strokeStyle = on ? (pass ? PINK : '#c9b8ff') : '#4a4270'; g.stroke();
    }
    // ステージのマス
    for (k = 0; k < NODE.length; k++) {
      p = at(ND[k]); var open = k <= (G.unlocked || 0), rank = G.ranks && G.ranks[k], here = !moving && m.at === k, I2 = INFO[k];
      var col = !open ? '#5a5280' : rank ? GOLD : PINK, r = 34 + (here ? 3 * Math.sin(t * 0.14) : 0);
      if (open) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = here ? 0.5 + 0.2 * Math.sin(t * 0.14) : 0.25; diamond(g, p[0], p[1], r + 18); g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      diamond(g, p[0], p[1], r); g.fillStyle = open ? '#1c0f44' : '#141030'; g.fill(); g.lineWidth = 6; g.strokeStyle = col; g.stroke();
      diamond(g, p[0], p[1], r - 9); g.lineWidth = 2; g.strokeStyle = open ? '#ffffff' : '#3a3460'; g.stroke();
      T(g, String(k + 1), p[0], p[1] + 14, 40, open ? '#ffffff' : '#6a6290', 'center', U.font, '#120a30', 6);
      if (rank) { g.fillStyle = '#120a30'; g.beginPath(); g.arc(p[0] + 34, p[1] - 32, 20, 0, PI * 2); g.fill(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(); T(g, rank, p[0] + 34, p[1] - 21, 28, GOLD, 'center', U.font); }
      T(g, open ? I2.name : '？？？', p[0] + I2.dx, p[1] + I2.dy, 30, open ? '#ffffff' : '#8a82b0', 'center', U.font, '#120a30', 7);
    }
    // 新しい道が開いたときの光（開いたマスから輪が広がる）
    if (m.newT > 0 && m.wait <= 0) {
      p = at(ND[G.unlocked]); var u = 1 - m.newT / 200;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.max(0, 1 - u * 1.6); g.lineWidth = 6; g.strokeStyle = GOLD;
      diamond(g, p[0], p[1], 40 + u * 240); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // 紅と蒼（蒼が少し後ろをついていく）
    var pk = at(m.d), pa = at(m.d - (moving ? 26 : 0));
    if (!moving) pa = [pk[0] - 46, pk[1] + 6];
    g.globalAlpha = 0.35; g.fillStyle = '#000000'; g.beginPath(); g.ellipse(pk[0], pk[1] - 30, 26, 6, 0, 0, PI * 2); g.fill(); g.globalAlpha = 1;
    hero(g, 'aoi', pa[0], pa[1] - 30, moving ? m.face : 1, moving, m.moveT + 6, t);
    hero(g, 'kurenai', pk[0], pk[1] - 30, moving ? m.face : 1, moving, m.moveT, t);
    if (!moving && m.wait <= 0) {      // いまいるマスの上で、はずむ矢印
      var ay = pk[1] - 150 + Math.sin(t * 0.16) * 8;
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(pk[0] - 16, ay - 20); g.lineTo(pk[0] + 16, ay - 20); g.lineTo(pk[0], ay); g.closePath(); g.fill();
      g.lineWidth = 4; g.strokeStyle = PINK; g.stroke();
    }
    // 左上: 題
    panel(g, 36, 30, 520, 118, 16, 'rgba(14,8,40,.82)', '#c9b8ff', 4);
    T(g, 'WORLD MAP', 64, 84, 46, '#ffffff', 'left', U.font, '#120a30', 6);
    T(g, 'REBELL ― 紅蒼交錯', 66, 126, 26, '#ffb8e6', 'left', U.font, '#120a30', 5);
    // 下: いまいる（向かっている）ステージ
    var s = moving ? m.to : m.at, S = R.STAGES[s], rk = G.ranks && G.ranks[s];
    panel(g, 620, 884, 1260, 172, 18, 'rgba(14,8,40,.88)', rk ? GOLD : PINK, 5);
    T(g, S.title, 660, 942, 46, '#ffffff', 'left', U.font, '#120a30', 6);
    T(g, S.sub, 662, 976, 22, '#b8b0e0', 'left', U.font);
    T(g, INFO[s].desc, 662, 1018, 27, '#ffe8f6', 'left', U.font, '#120a30', 4);
    if (rk) { T(g, 'CLEAR', 1838, 926, 26, GOLD, 'right', U.font, '#120a30', 5); T(g, 'RANK ' + rk, 1838, 970, 44, GOLD, 'right', U.font, '#120a30', 6); }
    else if ((t >> 4) % 2) T(g, 'NEW !', 1838, 950, 40, PINK, 'right', U.font, '#120a30', 6);
    if (!moving && m.wait <= 0 && (t >> 5) % 2 === 0) T(g, 'Enter / Space ： 出発', 1838, 1040, 28, '#ffffff', 'right', U.font, '#120a30', 5);
    T(g, '← → ： マスを移動', 64, 190, 26, '#d8d0ff', 'left', U.font, '#120a30', 5);
    if (m.newT > 0 && m.wait <= 0 && m.newT > 60) T(g, '新しい道が開いた！', 960, 220, 54, (t >> 3) % 2 ? '#ffffff' : GOLD, 'center', U.font, '#120a30', 9);
    if (t < 24) { g.fillStyle = 'rgba(0,0,0,' + (1 - t / 24) + ')'; g.fillRect(0, 0, 1920, 1080); }      // 暗い画面から現れる
    g.restore();
  };
  R.MAP_DEBUG = { ND: ND, at: at };
})();

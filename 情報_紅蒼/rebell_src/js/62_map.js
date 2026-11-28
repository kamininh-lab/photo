// 全体マップ（ステージを選ぶ画面）。章ごとに 1 枚。下絵の上に、地名・道のりのマス・ステージのマス・紅と蒼を描く。
//   第1章 KAGOSHIMA CITY     … サイバーパンクの鹿児島市（下絵は 09_map_art.js。make_world_map.py が描く）。ステージは第1話〜第4話
//   第2章 IBUSUKI・TANIYAMA  … 指宿・谷山方面（下絵は 09_map2_art.js。make_world_map2.py が描く）。いま遊べるのは第1話（谷山）だけで、ほかのマスは「準備中」
// 画面は 1920x1080 の仮想座標（HUD と同じ。下絵の 1 ドット = 2）。
//   ← → （↑ ↓ でも）… となりのステージのマスへ、道のりに沿って走る（行けるのは、クリアしたステージと、その次まで）
//   決定            … いまいるマスのステージを始める（ステージの前の会話から）
// 流れ: はじめから → 第1章のマップ（道の入口から第1話のマスへ走ってくる）→ 決定でステージ → クリア → マップ（次のマスへの道が開き、自動で走っていく）
//       最後のステージをクリアしたときだけ、マップをはさまずエンディングへ（90_main.js）。クリアしたステージは、選び直して何度でも遊べる
//       エンディングで決定 → 第2章のプロローグ → 第2章のマップ（どのマスへも行ける。ステージのあるマスは決定で始まり、準備中のマスは始められない。Esc でタイトルへ）
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, U = R.UI, T = U.T, panel = U.panel, PI = Math.PI, clamp = R.clamp;
  var PINK = '#ff4fb0', CYAN = '#37e6ff', GOLD = '#ffd36a';
  var RANKS = 'DCBAS', SPEED = 4.6, STEP = 21;

  // ---- 章ごとの中身 ----
  //   PATH  = 道のり（下絵の座標）、NODE = ステージのマス（PATH の何番目か）
  //   INFO  = マスの横に出す短い名前（dx, dy = マスからのずれ）と、下の説明（下見の章は title / sub も。desc は 1 行ずつ）
  //   PLACES = 地名（仮想座標。下絵には文字を描かず、ここで重ねる）: [文字, x, y, 大きさ, 色, ローマ字]
  //   box = 題の枠 [x, y, 幅]、hint = 操作の案内 [x, y, そろえ]、info = 下の説明の枠 [x, y, 幅, 高さ]、grad = 道のりの色の向き、newAt = 「新しい道が開いた！」の位置
  var CH = [
    {
      no: '第1章', name: 'KAGOSHIMA CITY', art: 'REBELL_MAP',
      // 水道橋の上（左下の台地 → 甲突川を越えて城山のふもと）→ 城山の鉄塔の足もと → てっぺん → 航路 → 学園の真上の飛空艇 → 学園。
      //   make_world_map.py の絵（AQ・TX/TY/TT・ROUTE・DOME）と合わせてある
      PATH: [[6, 532], [64, 478], [122, 424], [210, 343], [297, 262], [297, 100], [340, 70], [395, 48], [446, 38], [480, 46], [480, 126]],
      NODE: [2, 4, 5, 10], stages: [0, 1, 2, 3],      // stages = マスごとの R.STAGES の番号
      INFO: [
        { name: '水道橋', dx: 0, dy: 74, desc: '雨の降るネオンの廃都。機械兵のうろつく水道橋を渡り、門番を倒せ。' },
        { name: '鉄塔', dx: 0, dy: 76, desc: '学園への橋は、結界の中。雲の上まで続く鉄塔を、てっぺんまで登れ。' },
        { name: '空中回廊', dx: 150, dy: 16, desc: '止まらない飛空艇の航路。乗り継いで、結界の上を越えろ。' },
        { name: '玉龍学園', dx: 0, dy: 80, desc: '紅い月の下、桜の並木の奥で《龍》が待つ。姫を取り戻せ。' }
      ],
      PLACES: [
        ['桜島', 1650, 690, 40, '#ffc2d0', 'SAKURAJIMA'],
        ['錦江湾', 1380, 640, 32, '#9fe9ff', 'KINKO BAY'],
        ['城山', 716, 436, 24, '#b6f5d8'],
        ['天文館', 822, 716, 24, '#ffd0ee'],
        ['甲突川', 300, 262, 22, '#9fe9ff'],
        ['鹿児島中央駅', 470, 920, 22, '#d8d0ff'],
        ['鹿児島駅', 1000, 420, 22, '#d8d0ff']
      ],
      box: [36, 30, 560], hint: [64, 190, 'left'], info: [620, 884, 1260, 172], grad: [20, 1060, 960, 100], newAt: [960, 580]
    },
    {
      // 第2章（2026-11-28 の要望）: 指宿・谷山方面。マスは 谷山 → 平川動物公園 → 喜入 → 指宿 → 開聞岳（ユーザーが選んだ 5 つ）。
//   free = どのマスへも行ける（クリアの順番を問わない）。stages = マスごとの R.STAGES の番号（null = 準備中）
      //   道のりは、鹿児島市街（上の端）から海ぞいに南へ。make_world_map2.py の絵（ZOO・BASE・KATOP など）と合わせてある
      no: '第2章', name: 'IBUSUKI・TANIYAMA', art: 'REBELL_MAP2', free: true,
      PATH: [[262, -8], [258, 40], [236, 100], [196, 122], [168, 146], [140, 166], [166, 186], [192, 210], [216, 234], [232, 256], [252, 284], [284, 322], [322, 358],
        [362, 384], [388, 404], [409, 424], [398, 452], [360, 472], [300, 480], [252, 484], [205, 456]],
      NODE: [2, 5, 9, 15, 20], stages: [4, 5, null, null, null],      // 第1話 = 谷山（40_stage.js の taniyama）、第2話 = 平川動物公園（hirakawa）
      INFO: [
        { name: '谷山', dx: 104, dy: 14, title: '谷山', sub: 'TANIYAMA  -  BAYSIDE INDUSTRIAL ZONE', desc: ['鹿児島市の南、海ぞいの工業地帯。', '七ツ島には、メガソーラーが広がる。'] },
        { name: '平川動物公園', dx: -44, dy: 82, title: '平川動物公園', sub: 'HIRAKAWA ZOO', desc: ['海を見下ろす、丘の上の動物園。', 'となりの公園に、ロケットの模型が立つ。'] },
        { name: '喜入', dx: -104, dy: 14, title: '喜入', sub: 'KIIRE  -  OIL TERMINAL', desc: ['湾に突き出た、石油の基地。', '巨大なタンクがならび、沖にタンカーが着く。'] },
        { name: '指宿', dx: -104, dy: 14, title: '指宿', sub: 'IBUSUKI  -  HOT SPRING TOWN', desc: ['砂むし温泉の町。潮が引くと、', '知林ヶ島へ砂の道がつながる。'] },
        { name: '開聞岳', dx: -116, dy: 14, title: '開聞岳', sub: 'MT. KAIMON  -  SATSUMA FUJI', desc: ['薩摩富士とよばれる、円すいの山。', 'ふもとには、池田湖が広がる。'] }
      ],
      PLACES: [
        ['桜島', 880, 84, 30, '#ffc2d0'],
        ['錦江湾', 860, 404, 34, '#9fe9ff', 'KINKO BAY'],
        ['薩摩半島', 196, 668, 28, '#b6f5d8', 'SATSUMA'],
        ['大隅半島', 1620, 620, 28, '#a8cfe0', 'OSUMI'],
        ['鹿児島市街', 176, 56, 22, '#ffd0ee'],
        ['垂水', 1112, 244, 20, '#a8cfe0'],
        ['鹿屋', 1580, 462, 20, '#a8cfe0'],
        ['知覧', 104, 470, 20, '#b6f5d8'],
        ['池田湖', 552, 800, 22, '#9fe9ff'],
        ['知林ヶ島', 1036, 746, 20, '#fff0c8'],
        ['山川', 868, 962, 20, '#d8d0ff'],
        ['長崎鼻', 704, 1052, 20, '#fff0c8']
      ],
      box: [1324, 30, 560], hint: [1856, 190, 'right'], info: [960, 838, 920, 218], grad: [500, 0, 420, 1000], newAt: [960, 580]
    }
  ];
  CH.forEach(function (C) {
    var i, a = 0, k, j, n, P = C.PATH;
    C.img = null; if (window[C.art]) { C.img = new Image(); C.img.src = window[C.art]; }
    C.LEN = [0];
    for (i = 1; i < P.length; i++) C.LEN.push(C.LEN[i - 1] + Math.sqrt(Math.pow(P[i][0] - P[i - 1][0], 2) + Math.pow(P[i][1] - P[i - 1][1], 2)));
    C.ND = C.NODE.map(function (q) { return C.LEN[q]; });
    C.DOTS = [];      // 小さなマス（ステージのマスの間を、同じ間隔で刻む）
    for (k = 0; k < C.ND.length; k++) { n = Math.max(1, Math.round((C.ND[k] - a) / STEP)); for (j = (k ? 1 : 0); j < n; j++) C.DOTS.push(a + (C.ND[k] - a) * j / n); a = C.ND[k]; }
  });
  // 道のりの上の、入口から d だけ進んだ点（仮想座標）
  function at(C, d) {
    var P = C.PATH, L = C.LEN;
    d = clamp(d, 0, L[L.length - 1]);
    for (var k = 1; k < P.length; k++) if (d <= L[k]) { var u = (d - L[k - 1]) / (L[k] - L[k - 1] || 1); return [(P[k - 1][0] + (P[k][0] - P[k - 1][0]) * u) * 2, (P[k - 1][1] + (P[k][1] - P[k - 1][1]) * u) * 2]; }
    return [P[P.length - 1][0] * 2, P[P.length - 1][1] * 2];
  }
  function better(a, b) { return !b || RANKS.indexOf(a) > RANKS.indexOf(b); }

  // 第1章のマップを開く。k = いるマス（-1 = はじめから: 道の入口から走ってくる）、cleared = そのステージをクリアして戻ってきた
  R.openMap = function (k, cleared) {
    var C = CH[0];
    if (G.unlocked == null) G.unlocked = 0;
    if (!G.ranks) G.ranks = {};
    var m = G.map = { ch: 0, at: Math.max(0, k), d: k < 0 ? 0 : C.ND[k], to: null, t: 0, wait: 0, newT: 0, face: 1, moveT: 0 };
    if (k < 0) m.to = 0;
    if (cleared && k + 1 < C.NODE.length && G.unlocked < k + 1) { G.unlocked = k + 1; m.to = k + 1; m.wait = 70; m.newT = 200; }      // 次のマスへの道が開く
    G.state = 'map'; G.stateT = 0; R.bgm('title');
  };
  // 第2章からのマップを開く。k = いるマス（-1 = 道の入口から、最初のマスへ走ってくる。プロローグのあと）
  R.openMapCh = function (ch, k) {
    var C = CH[ch]; if (!C) return false;
    if (!G.ranks) G.ranks = {};
    G.map = { ch: ch, at: Math.max(0, k), d: k < 0 ? 0 : C.ND[k], to: k < 0 ? 0 : null, t: 0, wait: 0, newT: 0, face: 1, moveT: 0 };
    G.state = 'map'; G.stateT = 0; R.bgm('title');
    return true;
  };
  R.openMapPreview = function (ch) { return R.openMapCh(ch, -1); };
  R.mapNode = function (ch, idx) { var C = CH[ch]; return C ? Math.max(0, C.stages.indexOf(idx)) : 0; };      // そのステージは、章のマップの何番目のマスか
  // クリアの評価を覚える（よいほうを残す）
  R.mapRecord = function (idx, rank) { if (!G.ranks) G.ranks = {}; if (rank && better(rank, G.ranks[idx])) G.ranks[idx] = rank; };

  R.updateMap = function (ok) {
    var m = G.map, I = R.input; if (!m) { R.openMap(0, false); return; }
    var C = CH[m.ch || 0], free = !!C.free, max = free ? C.NODE.length - 1 : G.unlocked;
    if (free && I.hit.pause && m.to === null) { R.snd('select'); G.map = null; G.state = 'title'; G.stateT = 0; G.titleFade = 24; return; }      // Esc でタイトルへ
    m.t++; if (m.newT > 0) m.newT--;
    if (m.wait > 0) { if (--m.wait === 0) R.snd('levelup'); return; }
    if (m.to !== null) {      // 道のりに沿って走る
      var goal = C.ND[m.to], p0 = at(C, m.d);
      m.d += clamp(goal - m.d, -SPEED, SPEED); m.moveT++;
      var p1 = at(C, m.d); if (Math.abs(p1[0] - p0[0]) > 0.5) m.face = p1[0] > p0[0] ? 1 : -1;
      if (m.moveT % 14 === 0) R.snd('select');
      if (Math.abs(goal - m.d) < 0.01) { m.at = m.to; m.to = null; m.moveT = 0; m.face = 1; R.snd('checkpoint'); }
      return;
    }
    var dir = (I.hit.right || I.hit.up) ? 1 : (I.hit.left || I.hit.down) ? -1 : 0;
    if (dir) { var k = m.at + dir; if (k >= 0 && k <= max && k < C.NODE.length) m.to = k; else R.snd('deny'); }
    else if (ok && m.t > 24) {
      var st = C.stages[m.at];
      if (st === null || st === undefined || !R.STAGES[st]) R.snd('deny');      // 準備中のマス
      else { R.snd('start'); R.startStage(st, false, R.STAGES[st].talk); }
    }
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
    var C = CH[m.ch || 0], free = !!C.free, ND = C.ND, INFO = C.INFO, img = C.img;
    var t = m.t, k, p, lit = free ? ND[ND.length - 1] : ND[Math.min(G.unlocked || 0, ND.length - 1)], q, moving = m.to !== null;
    function ready(n) { var v = C.stages[n]; return v !== null && v !== undefined && !!R.STAGES[v]; }      // ステージのあるマスか（ないマスは「準備中」で水色）
    g.save();
    g.imageSmoothingEnabled = false;
    if (img && img.complete && img.naturalWidth) g.drawImage(img, 0, 0, 1920, 1080); else { g.fillStyle = '#140a30'; g.fillRect(0, 0, 1920, 1080); }
    for (k = 0; k < C.PLACES.length; k++) {      // 地名（道のりやマスの下になるよう、先に描く）
      p = C.PLACES[k]; g.globalAlpha = 0.92;
      T(g, p[0], p[1], p[2], p[3], p[4], 'center', U.font, '#0a0624', 6);
      if (p[5]) T(g, p[5], p[1], p[2] + Math.round(p[3] * 0.62), Math.round(p[3] * 0.46), p[4], 'center', U.font, '#0a0624', 4);
      g.globalAlpha = 1;
    }
    // 道のり: 開いているところまでは光る線、その先は暗い点線
    g.lineCap = 'round'; g.lineJoin = 'round';
    function trace(d0, d1) { g.beginPath(); for (var d = d0; d <= d1 + 0.01; d += 6) { q = at(C, Math.min(d, d1)); if (d === d0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); } q = at(C, d1); g.lineTo(q[0], q[1]); }
    g.setLineDash([10, 16]); g.lineWidth = 5; g.strokeStyle = 'rgba(190,180,230,.35)'; trace(lit, ND[ND.length - 1]); g.stroke(); g.setLineDash([]);
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = 22; g.strokeStyle = 'rgba(255,79,176,.16)'; trace(0, lit); g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 8; g.strokeStyle = '#1a0f3a'; trace(0, lit); g.stroke();
    var lg = g.createLinearGradient(C.grad[0], C.grad[1], C.grad[2], C.grad[3]); lg.addColorStop(0, PINK); lg.addColorStop(0.55, GOLD); lg.addColorStop(1, CYAN);
    g.lineWidth = 4; g.strokeStyle = lg; trace(0, lit); g.stroke();
    // 小さなマス
    for (k = 0; k < C.DOTS.length; k++) {
      p = at(C, C.DOTS[k]); var on = C.DOTS[k] <= lit + 0.01, pass = C.DOTS[k] <= m.d + 0.01;
      diamond(g, p[0], p[1], on ? 9 : 7); g.fillStyle = on ? (pass ? '#ffffff' : '#2a1a58') : '#1a1236'; g.fill();
      g.lineWidth = 3; g.strokeStyle = on ? (pass ? PINK : '#c9b8ff') : '#4a4270'; g.stroke();
    }
    // ステージのマス
    for (k = 0; k < C.NODE.length; k++) {
      p = at(C, ND[k]); var open = free || k <= (G.unlocked || 0), rank = ready(k) && G.ranks && G.ranks[C.stages[k]], here = !moving && m.at === k, I2 = INFO[k];
      var col = !open ? '#5a5280' : rank ? GOLD : ready(k) ? PINK : '#7af3ff', r = 34 + (here ? 3 * Math.sin(t * 0.14) : 0);
      if (open) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = here ? 0.5 + 0.2 * Math.sin(t * 0.14) : 0.25; diamond(g, p[0], p[1], r + 18); g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      diamond(g, p[0], p[1], r); g.fillStyle = open ? '#1c0f44' : '#141030'; g.fill(); g.lineWidth = 6; g.strokeStyle = col; g.stroke();
      diamond(g, p[0], p[1], r - 9); g.lineWidth = 2; g.strokeStyle = open ? '#ffffff' : '#3a3460'; g.stroke();
      T(g, String(k + 1), p[0], p[1] + 14, 40, open ? '#ffffff' : '#6a6290', 'center', U.font, '#120a30', 6);
      if (rank) { g.fillStyle = '#120a30'; g.beginPath(); g.arc(p[0] + 34, p[1] - 32, 20, 0, PI * 2); g.fill(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(); T(g, rank, p[0] + 34, p[1] - 21, 28, GOLD, 'center', U.font); }
      T(g, open ? I2.name : '？？？', p[0] + I2.dx, p[1] + I2.dy, 30, open ? '#ffffff' : '#8a82b0', 'center', U.font, '#120a30', 7);
    }
    // 新しい道が開いたときの光（開いたマスから輪が広がる）
    if (m.newT > 0 && m.wait <= 0) {
      p = at(C, ND[G.unlocked]); var u = 1 - m.newT / 200;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.max(0, 1 - u * 1.6); g.lineWidth = 6; g.strokeStyle = GOLD;
      diamond(g, p[0], p[1], 40 + u * 240); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // 紅と蒼（蒼が少し後ろをついていく）
    var pk = at(C, m.d), pa = at(C, m.d - (moving ? 26 : 0));
    if (!moving) pa = [pk[0] - 46, pk[1] + 6];
    g.globalAlpha = 0.35; g.fillStyle = '#000000'; g.beginPath(); g.ellipse(pk[0], pk[1] - 30, 26, 6, 0, 0, PI * 2); g.fill(); g.globalAlpha = 1;
    hero(g, 'aoi', pa[0], pa[1] - 30, moving ? m.face : 1, moving, m.moveT + 6, t);
    hero(g, 'kurenai', pk[0], pk[1] - 30, moving ? m.face : 1, moving, m.moveT, t);
    if (!moving && m.wait <= 0) {      // いまいるマスの上で、はずむ矢印
      var ay = pk[1] - 150 + Math.sin(t * 0.16) * 8;
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(pk[0] - 16, ay - 20); g.lineTo(pk[0] + 16, ay - 20); g.lineTo(pk[0], ay); g.closePath(); g.fill();
      g.lineWidth = 4; g.strokeStyle = ready(m.at) ? PINK : '#7af3ff'; g.stroke();
    }
    // 題（第1章は左上、第2章は右上。道とマスにかからない場所と幅）
    var bx = C.box[0], by = C.box[1];
    panel(g, bx, by, C.box[2], 118, 16, 'rgba(14,8,40,.82)', '#c9b8ff', 4);
    T(g, C.no, bx + 28, by + 54, 40, GOLD, 'left', U.font, '#120a30', 6);
    T(g, C.name, bx + 164, by + 54, 40, '#ffffff', 'left', U.font, '#120a30', 6);
    T(g, 'REBELL ― 紅蒼交錯', bx + 30, by + 96, 26, '#ffb8e6', 'left', U.font, '#120a30', 5);
    T(g, '← → ： マスを移動', C.hint[0], C.hint[1], 26, '#d8d0ff', C.hint[2], U.font, '#120a30', 5);
    if (free) T(g, 'Esc ： タイトルへ', C.hint[0], C.hint[1] + 40, 26, '#d8d0ff', C.hint[2], U.font, '#120a30', 5);
    // 下: いまいる（向かっている）ステージ
    var s = moving ? m.to : m.at, rd = ready(s), S = rd ? R.STAGES[C.stages[s]] : INFO[s], rk = rd && G.ranks && G.ranks[C.stages[s]];
    var ix = C.info[0], iy = C.info[1], iw = C.info[2], ih = C.info[3], rx = ix + iw - 42, lines = [].concat(INFO[s].desc);
    panel(g, ix, iy, iw, ih, 18, 'rgba(14,8,40,.88)', rk ? GOLD : rd ? PINK : '#7af3ff', 5);
    T(g, S.title, ix + 40, iy + 58, 46, '#ffffff', 'left', U.font, '#120a30', 6);
    T(g, S.sub, ix + 42, iy + 92, 22, '#b8b0e0', 'left', U.font);
    for (k = 0; k < lines.length; k++) T(g, lines[k], ix + 42, iy + 134 + k * 36, 27, '#ffe8f6', 'left', U.font, '#120a30', 4);
    if (!rd) T(g, '準備中', rx, iy + 62, 34, '#7af3ff', 'right', U.font, '#120a30', 6);
    else if (rk) { T(g, 'CLEAR', rx, iy + 42, 26, GOLD, 'right', U.font, '#120a30', 5); T(g, 'RANK ' + rk, rx, iy + 86, 44, GOLD, 'right', U.font, '#120a30', 6); }
    else if ((t >> 4) % 2) T(g, 'NEW !', rx, iy + 66, 40, PINK, 'right', U.font, '#120a30', 6);
    if (!moving && m.wait <= 0 && rd && (t >> 5) % 2 === 0) T(g, 'Enter / Space ： 出発', rx, iy + ih - 16, 28, '#ffffff', 'right', U.font, '#120a30', 5);
    if (m.newT > 0 && m.wait <= 0 && m.newT > 60) T(g, '新しい道が開いた！', C.newAt[0], C.newAt[1], 54, (t >> 3) % 2 ? '#ffffff' : GOLD, 'center', U.font, '#120a30', 9);
    if (t < 24) { g.fillStyle = 'rgba(0,0,0,' + (1 - t / 24) + ')'; g.fillRect(0, 0, 1920, 1080); }      // 暗い画面から現れる
    g.restore();
  };
  R.MAP_DEBUG = { CH: CH, ND: CH[0].ND, at: function (d) { return at(CH[0], d); } };
})();

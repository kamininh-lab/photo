// HUD と各画面（タイトル・ポーズ・クリアなど）。1920x1080 の仮想座標で、高解像度のまま描く。
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, clamp = R.clamp, PI = Math.PI;
  var UI = '"DotGothic16","Yu Gothic UI","Meiryo",sans-serif', SERIF = 'Georgia,"Times New Roman","Yu Mincho",serif', MIN = '"Yu Mincho","Hiragino Mincho ProN",Georgia,serif';
  var RED = '#ff4a5e', CYAN = '#37e6ff', PINK = '#ff4fb0';

  function T(g, s, x, y, size, col, align, font, stroke, sw) {
    g.font = size + 'px ' + (font || UI); g.textAlign = align || 'left'; g.textBaseline = 'alphabetic';
    if (stroke) { g.lineJoin = 'round'; g.lineWidth = sw || Math.max(4, size * 0.18); g.strokeStyle = stroke; g.strokeText(s, x, y); }
    g.fillStyle = col; g.fillText(s, x, y);
  }
  // 角を落とした枠（ドット絵風の角丸）
  function cham(g, x, y, w, h, c) {
    g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }
  function panel(g, x, y, w, h, c, fill, line, lw) {
    cham(g, x, y, w, h, c); if (fill) { g.fillStyle = fill; g.fill(); }
    if (line) { g.lineWidth = lw || 4; g.strokeStyle = line; g.lineJoin = 'miter'; g.stroke(); }
  }
  function bar(g, x, y, w, h, v, c1, c2) {
    panel(g, x, y, w, h, 6, '#15122e', '#ffffff', 4);
    var iw = (w - 12) * clamp(v, 0, 1);
    if (iw > 1) {
      var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c1); gr.addColorStop(0.55, c2); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.fillRect(x + 6, y + 6, iw, h - 12);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 8, y + 7, Math.max(0, iw - 4), 3);
    }
  }
  function pix(g, img, x, y, w, h) { g.imageSmoothingEnabled = false; g.drawImage(img, x, y, w, h); }
  R.UI = { T: T, panel: panel, cham: cham, font: UI, MIN: MIN, SERIF: SERIF };      // 会話シーン（65_talk.js）でも使う部品

  function logo(g, cx, y, s) {
    g.save(); g.translate(cx, y); g.scale(s, s);
    g.font = 'italic 104px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = 'rgba(18,10,48,.9)'; g.strokeText('REBELL', 0, 0);
    g.fillStyle = 'rgba(255,60,150,.9)'; g.fillText('REBELL', -4, 3);
    g.fillStyle = 'rgba(60,220,255,.9)'; g.fillText('REBELL', 4, -2);
    var gr = g.createLinearGradient(0, -80, 0, 6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e6dcff'); gr.addColorStop(1, '#a898e8');
    g.fillStyle = gr; g.fillText('REBELL', 0, 0);
    // きらめき
    g.fillStyle = '#ffffff'; g.fillRect(168, -98, 3, 44); g.fillRect(148, -78, 44, 3);
    g.fillStyle = '#ff7ad1'; g.fillRect(-212, -40, 2, 22); g.fillRect(-222, -30, 22, 2);
    // 副題
    g.font = '46px ' + MIN; var sub = ['紅', '蒼', '交', '錯'], cols = [RED, CYAN, '#ff7ad1', '#7af3ff'];
    for (var i = 0; i < 4; i++) { g.lineWidth = 8; g.strokeStyle = 'rgba(18,10,48,.9)'; g.strokeText(sub[i], -93 + i * 62, 58); g.fillStyle = cols[i]; g.fillText(sub[i], -93 + i * 62, 58); }
    g.fillStyle = '#ff7ad1'; g.fillRect(-230, 40, 86, 3); g.fillStyle = '#7af3ff'; g.fillRect(144, 40, 86, 3);
    g.restore();
  }
  R.drawLogo = logo;

  // ---- 顔グラフィック（用意された表情一覧。expr = normal / damage / anger / joy、2 枚目の sad（悲しみ）/ silly（おとぼけ）/ shy（照れ））----
  function faceKey(who, expr) { return (who === 'kurenai' ? 'k_' : 'a_') + expr; }
  // 枠（x, y, w, h）を埋めるように顔を描く。kind = 'hud'（顔のアップ）か 'band'（目のあたりの横長）。縦横比が違うぶんは中央で切る
  function drawFace(g, who, expr, kind, x, y, w, h) {
    var key = faceKey(who, expr), img = R.IMG['face_' + key], FM = window.REBELL_FACES;
    if (!img || !img.complete || !img.naturalWidth || !FM || !FM[key]) return false;
    var m = FM[key][kind] || FM[key].hud, s = FM.scale, sx = m[0] * s, sy = m[1] * s, sw = m[2] * s, sh = m[3] * s, ar = w / h;
    if (sw / sh > ar) { sx += (sw - sh * ar) / 2; sw = sh * ar; } else { sy += (sh - sw / ar) / 2; sh = sw / ar; }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
  }
  R.UI.drawFace = drawFace;
  // いまの表情。やられた直後・体力わずか = ダメージ、攻撃中 = 怒り、アイテムやレベルアップ = 喜び、
  //   ゲームオーバー・相棒が倒れた直後 = 悲しみ、合体技のあと・薬で復帰した子 = 照れ、
  //   SP やゲージが足りないのに技を出そうとした・しばらく何も操作しない = おとぼけ（気持ちの表情は 50_game.js の R.mood で付ける）
  function exprOf(who) {
    var p = G.pl, c = p.chars[who], act = p.who === who, m = p.mood;
    if (G.state === 'gameover') return 'sad';
    if (c.down) return 'damage';
    if (G.state === 'clear') return 'joy';
    if (act && p.hurtFaceT > 0) return 'damage';
    if (m && m.t > 0 && (m.who === 'both' || m.who === who)) return m.expr;
    if (p.joyT > 0 && (act || p.joyAll)) return 'joy';
    if (G.cross) return 'anger';
    if (act && p.angerT > 0) return 'anger';
    if (act && c.hp <= c.max * 0.25) return 'damage';
    if (p.idleT > IDLE && (act || p.idleT > IDLE * 2)) return 'silly';      // 放っておくと、ぼんやりし始める（長いと相棒も）
    return 'normal';
  }
  var IDLE = 420;      // 7 秒
  // 八角形の枠つきの顔
  function faceFrame(g, who, expr, x, y, w, h, col, glow, shade) {
    g.save();
    if (glow) { g.shadowColor = col; g.shadowBlur = 26; cham(g, x + 2, y + 2, w - 4, h - 4, 16); g.fillStyle = col; g.fill(); g.shadowBlur = 0; }
    cham(g, x, y, w, h, 16); g.fillStyle = '#2e2170'; g.fill();
    g.save(); cham(g, x, y, w, h, 16); g.clip();
    drawFace(g, who, expr, 'hud', x, y, w, h);
    if (shade) { g.fillStyle = shade; g.fillRect(x, y, w, h); }
    g.restore();
    g.lineJoin = 'miter'; cham(g, x, y, w, h, 16); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
    cham(g, x + 5, y + 5, w - 10, h - 10, 12); g.lineWidth = 2; g.strokeStyle = glow ? col : 'rgba(255,255,255,.4)'; g.stroke();
    g.restore();
  }
  function portrait(g, who, x, y, w, h, active, down) {
    faceFrame(g, who, exprOf(who), x, y, w, h, who === 'kurenai' ? PINK : CYAN, active, down ? 'rgba(40,0,10,.62)' : (active ? null : 'rgba(10,8,40,.42)'));
    if (down) T(g, 'DOWN', x + w / 2, y + h / 2 + 12, 34, '#ff5a6a', 'center', UI, '#1a0a20');
  }
  // 武器の絵（表情一覧に描かれている大鎌と刀）
  function icon(g, key, x, y, w, h) {
    var im = R.IMG[key]; if (!im || !im.complete || !im.naturalWidth) return;
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(im, x, y, w, h); g.restore();
  }

  function charBlock(g, who, y, active) {
    var p = G.pl, c = p.chars[who], K = who === 'kurenai';
    portrait(g, who, 69, y, 168, 114, active, c.down);
    T(g, K ? '紅' : '蒼', 281, y + 50, 62, K ? RED : CYAN, 'center', MIN, '#120a30', 8);
    T(g, K ? 'KURENAI' : 'AOI', 281, y + 78, 19, '#ffffff', 'center', UI, '#120a30', 4);
    T(g, 'Lv.' + p.lv, 596, y + 30, 32, '#ffffff', 'center', SERIF, '#120a30', 6);
    T(g, 'HP', 345, y + 66, 30, '#ffffff', 'left', UI, '#120a30', 6);
    bar(g, 396, y + 40, 262, 30, c.hp / c.max, '#ff7a86', '#d82c46');
    T(g, 'SP', 345, y + 101, 30, '#ffffff', 'left', UI, '#120a30', 6);
    bar(g, 396, y + 75, 262, 30, c.sp / c.maxsp, '#7af3ff', '#16b6e6');
    T(g, Math.ceil(c.hp) + '/' + c.max, 652, y + 62, 17, '#ffffff', 'right', UI, '#120a30', 4);
    if (c.sp >= 30 && active && !c.down) { g.fillStyle = '#ffffff'; g.fillRect(396 + 6 + 250 * 0.3, y + 79, 2, 22); }
  }

  // 縦のステージの地図の代わり: 高さ計（左がふもと、右がてっぺん。S.pxPerM ドットを 1 m として数える）
  function altimeter(g, S, x, y, w, h) {
    var y0 = R.GY, y1 = S.goal[1], bx = x + 24, bw = w - 70, by = y + 92, f = function (wy) { return bx + clamp((y0 - wy) / (y0 - y1), 0, 1) * bw; };
    var pm = S.pxPerM || 14, top = Math.round((y0 - y1) / pm), m = Math.max(0, Math.round((y0 - G.pl.y) / pm));
    T(g, 'ALTITUDE', x + 24, y + 46, 26, '#c8b8ff', 'left', UI, '#120a30', 5);
    T(g, m + ' m', x + w - 24, y + 50, 40, '#ffffff', 'right', UI, '#120a30', 6);
    g.fillStyle = '#2a2266'; g.fillRect(bx, by, bw, 14);
    g.fillStyle = '#8a70e0'; g.fillRect(bx, by, f(G.pl.y) - bx, 14); g.fillStyle = '#b49cff'; g.fillRect(bx, by, f(G.pl.y) - bx, 4);
    G.terminals.forEach(function (tm) { g.fillStyle = tm.on ? CYAN : '#5a8ab0'; g.fillRect(f(tm.y) - 2, by - 12, 5, 12); });
    // てっぺん（旗）
    var gx = bx + bw + 4; g.fillStyle = '#ffffff'; g.fillRect(gx, by - 30, 3, 44); g.fillStyle = '#ff2e48'; g.beginPath(); g.moveTo(gx + 3, by - 30); g.lineTo(gx + 26, by - 22); g.lineTo(gx + 3, by - 14); g.fill();
    // 自分（赤い菱形）
    var px = f(G.pl.y), py = by + 7, r = 11 + ((G.t >> 4) % 2);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(px, py - r - 3); g.lineTo(px + r + 3, py); g.lineTo(px, py + r + 3); g.lineTo(px - r - 3, py); g.fill();
    g.fillStyle = '#ff2e48'; g.beginPath(); g.moveTo(px, py - r); g.lineTo(px + r, py); g.lineTo(px, py + r); g.lineTo(px - r, py); g.fill();
    T(g, 'TOP ' + top + ' m', x + w - 24, y + 132, 20, '#8a7ac8', 'right', UI, '#120a30', 4);
  }
  function minimap(g) {
    var S = G.S, x = 1552, y = 20, w = 343, h = 143, i;
    panel(g, x, y, w, h, 10, 'rgba(22,16,60,.86)', '#ffffff', 5);
    g.save(); cham(g, x + 4, y + 4, w - 8, h - 8, 8); g.clip();
    g.strokeStyle = 'rgba(120,100,220,.35)'; g.lineWidth = 2;
    for (i = 1; i < 12; i++) { g.beginPath(); g.moveTo(x + i * 29, y); g.lineTo(x + i * 29, y + h); g.stroke(); }
    for (i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x, y + i * 29); g.lineTo(x + w, y + i * 29); g.stroke(); }
    if (S.vertical) { altimeter(g, S, x, y, w, h); g.restore(); return; }
    var sx = (w - 30) / S.len, bx = x + 15, by = y + 96;
    g.fillStyle = '#8a70e0';
    S.ground.forEach(function (q) { g.fillRect(bx + q[0] * sx, by, (q[1] - q[0]) * sx, 22); });
    g.fillStyle = '#b49cff';
    S.ground.forEach(function (q) { g.fillRect(bx + q[0] * sx, by, (q[1] - q[0]) * sx, 5); });
    (S.blocks || []).forEach(function (q) {      // 石の段
      g.fillStyle = '#8a70e0'; g.fillRect(bx + q[0] * sx, by - q[2] * 0.5, Math.max(4, q[1] * sx), q[2] * 0.5 + 2);
      g.fillStyle = '#b49cff'; g.fillRect(bx + q[0] * sx, by - q[2] * 0.5, Math.max(4, q[1] * sx), 4);
    });
    S.plats.forEach(function (q) { g.fillStyle = '#8a70e0'; g.fillRect(bx + q[0] * sx - 2, by - (R.GY - q[1]) * 0.5, Math.max(8, q[2] * sx + 4), 7); });
    G.terminals.forEach(function (tm) { g.fillStyle = tm.on ? CYAN : '#5a8ab0'; g.fillRect(bx + tm.x * sx - 2, by - 12, 5, 12); });
    // 中ボスのいる所（退けるまで、紫の菱形）
    if (S.mid && !G.midDone) {
      var mx = bx + S.mid.x * sx, my = by - 12;
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(mx, my - 11); g.lineTo(mx + 9, my); g.lineTo(mx, my + 11); g.lineTo(mx - 9, my); g.fill();
      g.fillStyle = (G.t >> 4) % 2 ? '#a050ff' : '#7a2be0'; g.beginPath(); g.moveTo(mx, my - 8); g.lineTo(mx + 6, my); g.lineTo(mx, my + 8); g.lineTo(mx - 6, my); g.fill();
    }
    // ゴール（宝箱の印）
    var gx = bx + S.boss.x * sx, gy = by - 24;
    g.fillStyle = '#7a4a18'; g.fillRect(gx - 14, gy - 2, 28, 24); g.fillStyle = '#ffc83e'; g.fillRect(gx - 11, gy + 1, 22, 18);
    g.fillStyle = '#7a4a18'; g.fillRect(gx - 11, gy + 7, 22, 3); g.fillRect(gx - 3, gy + 5, 6, 8); g.fillStyle = '#fff3b0'; g.fillRect(gx - 1, gy + 7, 2, 4);
    // 自分（赤い菱形）
    var px = bx + G.pl.x * sx, py = by - 14 - clamp((R.GY - G.pl.y) * 0.5, 0, 60), r = 11 + ((G.t >> 4) % 2);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(px, py - r - 3); g.lineTo(px + r + 3, py); g.lineTo(px, py + r + 3); g.lineTo(px - r - 3, py); g.fill();
    g.fillStyle = '#ff2e48'; g.beginPath(); g.moveTo(px, py - r); g.lineTo(px + r, py); g.lineTo(px, py + r); g.lineTo(px - r, py); g.fill();
    g.restore();
  }

  function helpPanel(g, a) {
    var x = 22, y = 852, w = 608, h = 206;
    g.save(); g.globalAlpha = a;
    panel(g, x, y, w, h, 16, 'rgba(18,12,52,.9)', PINK, 5);
    panel(g, x + 8, y + 8, w - 16, h - 16, 12, null, 'rgba(120,230,255,.7)', 2);
    keycap(g, x + 46, y + 22, R.input.usePad ? 'LB' : 'Q'); T(g, '/', x + 122, y + 60, 34, '#fff', 'center'); keycap(g, x + 140, y + 22, R.input.usePad ? 'RB' : 'E');
    T(g, '：キャラ切り替え', x + 222, y + 60, 34, '#ffffff', 'left', UI, '#120a30', 6);
    // 紅
    panel(g, x + 40, y + 78, 208, 78, 12, 'rgba(60,16,60,.9)', '#ff7a6a', 4);
    drawFace(g, 'kurenai', 'normal', 'hud', x + 46, y + 83, 100, 68); icon(g, 'iconKurenai', x + 150, y + 85, 96, 64);
    T(g, '⇄', x + 304, y + 132, 54, '#ffffff', 'center', UI);
    panel(g, x + 360, y + 78, 208, 78, 12, 'rgba(16,30,80,.9)', CYAN, 4);
    drawFace(g, 'aoi', 'normal', 'hud', x + 366, y + 83, 100, 68); icon(g, 'iconAoi', x + 470, y + 85, 96, 64);
    T(g, '紅（くれない）', x + 144, y + 190, 27, '#ffffff', 'center', UI, '#120a30', 5);
    T(g, '蒼（あおい）', x + 464, y + 190, 27, '#ffffff', 'center', UI, '#120a30', 5);
    g.restore();
  }
  function keycap(g, x, y, s, w) {
    w = w || 62; panel(g, x, y, w, 46, 10, 'rgba(20,14,56,.9)', '#ffffff', 4);
    T(g, s, x + w / 2, y + 35, 30, '#ffffff', 'center', UI);
  }
  function keyHints(g, a) {
    var list = [['←→', '移動'], ['Space', 'ジャンプ'], ['J', '攻撃'], ['U', '遠距離'], ['↓+J', '斬り上げ'], ['L', 'ダッシュ'], ['K', '特技'], ['F', '交錯']], x = 648, i;
    g.save(); g.globalAlpha = a;
    for (i = 0; i < list.length; i++) {
      g.font = '24px ' + UI; var kw = Math.max(42, g.measureText(list[i][0]).width + 18);
      panel(g, x, 1014, kw, 38, 8, 'rgba(20,14,56,.85)', '#ffffff', 3); T(g, list[i][0], x + kw / 2, 1042, 24, '#fff', 'center');
      T(g, list[i][1], x + kw + 7, 1042, 23, '#e8e0ff', 'left', UI, '#120a30', 5);
      g.font = '23px ' + UI; x += kw + 7 + g.measureText(list[i][1]).width + 16;
    }
    g.restore();
  }

  // 右下の斜めカットイン（交代した相棒が斬り込んでくる）。顔グラフィックの「怒り」＝戦う顔を大きく見せる
  function cutin(g) {
    var c = G.cutin, u = c.t / 52, k = u < 0.2 ? R.ease(u / 0.2) : (u > 0.8 ? 1 - R.ease((u - 0.8) / 0.2) : 1), off = (1 - k) * 1000;
    var blue = c.who === 'aoi', col = blue ? CYAN : PINK, dark = blue ? '#0c1450' : '#40103c';
    g.save(); g.translate(off, 0);
    g.beginPath(); g.moveTo(1010, 1080); g.lineTo(1300, 790); g.lineTo(1930, 790); g.lineTo(1930, 1080); g.closePath();
    g.save(); g.clip();
    var gr = g.createLinearGradient(0, 790, 0, 1080); gr.addColorStop(0, dark); gr.addColorStop(1, blue ? '#162a8a' : '#7a1c58');
    g.fillStyle = gr; g.fillRect(1000, 780, 940, 310);
    drawFace(g, c.who, 'anger', 'band', 1176, 790, 764, 290);
    gr = g.createLinearGradient(1176, 0, 1400, 0); gr.addColorStop(0, dark); gr.addColorStop(1, 'rgba(0,0,0,0)');      // 顔の左端をなじませる
    g.fillStyle = gr; g.fillRect(1170, 790, 236, 290);
    // 斬撃の帯
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 5; i++) { g.fillStyle = i % 2 ? col : '#ffffff'; g.globalAlpha = 0.42; g.fillRect(1100 + ((c.t * 40 + i * 260) % 1000), 840 + i * 44, 300, 6 + i % 2 * 4); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    R.drawFrame(g, blue ? R.frame('aoi', 'renjin', 1 + ((c.t >> 2) % 3)) : R.frame('kurenai', 'senpu', (c.t >> 2) % 4), 1232 - (1 - k) * 200, 1072, 3, 1);
    g.restore();
    g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(1010, 1080); g.lineTo(1300, 790); g.lineTo(1930, 790); g.stroke();
    g.lineWidth = 3; g.strokeStyle = col; g.beginPath(); g.moveTo(1022, 1080); g.lineTo(1305, 797); g.lineTo(1930, 797); g.stroke();
    T(g, blue ? '蒼' : '紅', 1856, 874, 78, col, 'center', MIN, '#ffffff', 6);
    g.restore();
  }
  // 中ボス（黒瀬）の、戦いの最中のカットイン: 左上から紫の帯がすべり込み、シートのカットインの絵と、ひとことを出す（52_karate.js の bossCut）
  function bossCut(g) {
    var c = G.bossCut, u = c.t / 84, k = u < 0.14 ? R.ease(u / 0.14) : (u > 0.82 ? 1 - R.ease((u - 0.82) / 0.18) : 1), off = -(1 - k) * 1300;
    var y = 270, h = 230, x0 = -40, w = 1180, sk = 90, im = R.IMG['midPic_' + c.pic], i, gr;      // 左上の HP の表示にかからない高さ
    g.save(); g.translate(off, 0);
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w + sk, y); g.lineTo(x0 + w, y + h); g.lineTo(x0, y + h); g.closePath();
    g.save(); g.clip();
    var gd = !!c.gold, acc = gd ? '#ffc83e' : '#c98bff';      // gold = 覚醒のカットイン（金色の帯）
    gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, gd ? '#6a4210' : '#3a1470'); gr.addColorStop(1, gd ? '#1e1006' : '#12052a');
    g.fillStyle = gr; g.fillRect(x0, y, w + sk, h);
    if (im && im.complete && im.naturalWidth) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 40, y, h * 450 / 306, h); }
    gr = g.createLinearGradient(40 + h * 450 / 306 - 120, 0, 40 + h * 450 / 306, 0); gr.addColorStop(0, gd ? 'rgba(60,36,8,0)' : 'rgba(18,5,42,0)'); gr.addColorStop(1, gd ? '#4a2e0a' : '#1c0838');      // 絵の右端をなじませる
    g.fillStyle = gr; g.fillRect(40 + h * 450 / 306 - 120, y, 122, h);
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < 5; i++) { g.fillStyle = i % 2 ? acc : '#ffffff'; g.globalAlpha = 0.3; g.fillRect(x0 + ((c.t * 44 + i * 300) % (w + 200)), y + 22 + i * 48, 260, 4 + i % 2 * 4); }
    g.restore();
    g.lineJoin = 'miter'; g.lineWidth = 7; g.strokeStyle = '#ffffff';
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w + sk, y); g.lineTo(x0 + w, y + h); g.lineTo(x0, y + h); g.stroke();
    g.lineWidth = 3; g.strokeStyle = acc;
    g.beginPath(); g.moveTo(x0, y + 9); g.lineTo(x0 + w + sk - 9, y + 9); g.moveTo(x0, y + h - 9); g.lineTo(x0 + w - 4, y + h - 9); g.stroke();
    if (c.line2) {      // 2 行の台詞（覚醒）: 名前を小さく上へ
      T(g, '黒瀬', 1020, y + 72, 64, acc, 'right', MIN, '#ffffff', 6);
      T(g, c.line, 1030, y + 136, 42, '#ffffff', 'right', MIN, gd ? '#4a2a06' : '#2a0c50', 8);
      T(g, c.line2, 1030, y + 194, 46, gd ? '#fff3b0' : '#ffffff', 'right', MIN, gd ? '#4a2a06' : '#2a0c50', 8);
    } else {
      T(g, '黒瀬', 1020, y + 100, 90, '#c98bff', 'right', MIN, '#ffffff', 7);
      T(g, c.line, 1030, y + 180, 44, '#ffffff', 'right', MIN, '#2a0c50', 8);
    }
    g.restore();
  }
  // 合体技のカットイン: 紅は左から、蒼は右から、目のあたりの帯がすべり込む
  function crossBand(g, who, dx, y, a) {
    var K = who === 'kurenai', col = K ? PINK : CYAN, dark = K ? '#40103c' : '#0c1450', w = 1180, h = 176, sk = 70, x0 = K ? -80 : 1920 + 80 - w - sk;
    g.save(); g.translate(dx, 0); g.globalAlpha = a;
    g.beginPath(); g.moveTo(x0 + sk, y); g.lineTo(x0 + w + sk, y); g.lineTo(x0 + w, y + h); g.lineTo(x0, y + h); g.closePath();
    g.save(); g.clip();
    var gr = g.createLinearGradient(x0, 0, x0 + w + sk, 0);
    gr.addColorStop(K ? 0 : 1, K ? '#8a2062' : '#1a36a8'); gr.addColorStop(K ? 1 : 0, dark);
    g.fillStyle = gr; g.fillRect(x0, y, w + sk, h);
    var fw = 560, fx = K ? x0 + 150 : x0 + w + sk - 150 - fw;
    drawFace(g, who, 'anger', 'band', fx, y - 18, fw, 213);
    gr = g.createLinearGradient(K ? fx + fw - 170 : fx, 0, K ? fx + fw : fx + 170, 0);      // 顔の内側の端をなじませる
    gr.addColorStop(K ? 0 : 1, 'rgba(0,0,0,0)'); gr.addColorStop(K ? 1 : 0, K ? '#5a1650' : '#12246e');
    g.fillStyle = gr; g.fillRect(K ? fx + fw - 170 : fx - 2, y, 174, h);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.4;
    for (var i = 0; i < 4; i++) { g.fillStyle = i % 2 ? col : '#ffffff'; g.fillRect(x0 + ((G.t * 46 + i * 330) % (w + 300)) * (K ? 1 : -1) + (K ? 0 : w), y + 18 + i * 40, 260, 5 + i % 2 * 4); }
    g.restore();
    g.lineJoin = 'miter'; g.lineWidth = 6; g.strokeStyle = '#ffffff';
    g.beginPath(); g.moveTo(x0 + sk, y); g.lineTo(x0 + w + sk, y); g.moveTo(x0, y + h); g.lineTo(x0 + w, y + h); g.stroke();
    g.lineWidth = 3; g.strokeStyle = col;
    g.beginPath(); g.moveTo(x0 + sk, y + 8); g.lineTo(x0 + w + sk, y + 8); g.moveTo(x0, y + h - 8); g.lineTo(x0 + w, y + h - 8); g.stroke();
    T(g, K ? '紅' : '蒼', K ? x0 + w - 130 : x0 + sk + 150, y + 128, 118, col, 'center', MIN, '#ffffff', 8);
    g.restore();
  }

  R.drawHUD = function (g) {
    var p = G.pl, i;
    // 文字（ダメージ数字）
    for (i = 0; i < G.texts.length; i++) {
      var t = G.texts[i], a = Math.min(1, (1 - t.t / t.life) * 2.2);
      g.globalAlpha = a; T(g, t.str, (t.x - R.viewCam) * 4, (t.y + (G.cam.y || 0)) * 4, t.big ? 46 : 32, t.col, 'center', UI, '#1a0a30', 7);
    }
    g.globalAlpha = 1;
    // 左上: 二人の状態
    charBlock(g, 'kurenai', 18, p.who === 'kurenai');
    charBlock(g, 'aoi', 138, p.who === 'aoi');
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(43, 96); g.lineTo(56, 114); g.lineTo(47, 114); g.lineTo(47, 146); g.lineTo(56, 146); g.lineTo(43, 164); g.lineTo(30, 146); g.lineTo(39, 146); g.lineTo(39, 114); g.lineTo(30, 114); g.fill();
    // アイテム枠
    var slots = [[703, 'potion', p.potions, '1'], [817, 'crystal', p.crystals, '2'], [931, null, 0, '']];
    for (i = 0; i < 3; i++) {
      var sx = slots[i][0];
      panel(g, sx, 40, i < 2 ? 100 : 78, 72, 12, 'rgba(22,16,60,.86)', '#ffffff', 5);
      if (slots[i][1] === 'potion') pix(g, R.SPR.items.potion, sx + 10, 46, 13 * 3.6, 16 * 3.6);
      if (slots[i][1] === 'crystal') pix(g, R.SPR.items.crystal[(G.t >> 4) % 4], sx + 10, 44, 15 * 3.2, 19 * 3.2);
      if (slots[i][1]) { T(g, '×' + slots[i][2], sx + 92, 100, 29, '#ffffff', 'right', UI, '#120a30', 6); T(g, slots[i][3], sx + 50, 134, 19, '#c8c0f0', 'center', UI, '#120a30', 4); }
    }
    // 交錯ゲージ
    var full = p.cross >= 100, cx0 = 1020, cw = 0;
    T(g, '交錯', 703, 186, 26, full && (G.t >> 3) % 2 ? '#ffffff' : '#ffb8e6', 'left', UI, '#120a30', 6);
    panel(g, 766, 160, 244, 30, 6, '#15122e', full ? ((G.t >> 3) % 2 ? '#ffffff' : PINK) : '#ffffff', 4);
    cw = 232 * p.cross / 100;
    if (cw > 1) { var cg = g.createLinearGradient(772, 0, 1004, 0); cg.addColorStop(0, '#ff4fb0'); cg.addColorStop(0.5, '#ffffff'); cg.addColorStop(1, '#37e6ff'); g.fillStyle = cg; g.fillRect(772, 166, cw, 18); }
    if (full && !p.chars.kurenai.down && !p.chars.aoi.down) T(g, '[F] 紅蒼交錯！', 766, 222, 24, (G.t >> 3) % 2 ? '#ffffff' : '#ffe04a', 'left', UI, '#120a30', 6);
    logo(g, 1296, 100, 0.86);
    minimap(g);
    // コンボ
    if (G.combo >= 2) {
      g.save(); g.translate(1680, 392); var s = 1 + G.comboPop * 0.035; g.scale(s, s); g.transform(1, 0, -0.18, 1, 0, 0);
      g.globalAlpha = Math.min(1, G.comboT / 20);
      var gr = g.createLinearGradient(0, -110, 0, 0); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#ff9a2a'); gr.addColorStop(1, '#e8501a');
      g.font = 'bold 128px ' + SERIF; g.textAlign = 'right'; g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#2a0c20'; g.strokeText(G.combo, 4, 0); g.fillStyle = gr; g.fillText(G.combo, 4, 0);
      g.font = 'bold 60px ' + SERIF; g.textAlign = 'left'; g.lineWidth = 12; g.strokeText('HIT', 12, 0); g.fillStyle = gr; g.fillText('HIT', 12, 0);
      g.fillStyle = '#ff7a2a'; g.beginPath(); g.moveTo(-170, 26); g.lineTo(150, 12); g.lineTo(150, 18); g.fill();
      g.restore();
    }
    // 連続攻撃のリズム（BEAT）: 段数の目盛りと、SP・ゲージのたまり方の倍率
    var rb = G.pl.rhythm;
    if (rb > 0 && G.state === 'play') {
      var full = rb >= 6, bc = full ? '#ffe04a' : (G.pl.who === 'kurenai' ? '#ff9ad8' : '#7af3ff');
      T(g, 'BEAT', 1560, 462, 34, bc, 'right', UI, '#120a30', 7);
      for (i = 0; i < 6; i++) { g.fillStyle = i < rb ? bc : 'rgba(40,24,80,.8)'; g.save(); g.translate(1590 + i * 36, 450); g.rotate(PI / 4); g.fillRect(-10, -10, 20, 20); g.restore(); }
      T(g, 'SP・ゲージ ×' + R.beatGain().toFixed(2), 1800, 504, 26, '#ffffff', 'right', UI, '#120a30', 6);
    }
    // ボスの体力
    var b = G.boss;
    if (b && !b.gone && !(b.dead && b.type !== 'dragon')) {
      var mid = !!b.mid, ba = G.bossIntro > 0 ? clamp(1 - G.bossIntro / 110, 0, 1) : 1;      // mid = 中ボス（紫の帯と、顔のアイコン）
      g.globalAlpha = ba;
      T(g, b.name, 520, 968, 38, '#ffffff', 'left', MIN, mid ? '#1e0a3c' : '#2a0818', 8); T(g, b.sub, 1400, 968, 20, mid ? '#d9b8ff' : '#ffb0c0', 'right', UI, mid ? '#1e0a3c' : '#2a0818', 5);
      if (mid && b.phase === 3) bar(g, 510, 978, 900, 30, b.hp / b.max * ba, (G.t >> 3) % 2 ? '#fff3b0' : '#ffd36a', '#c07818');      // 覚醒中は金色の帯
      else if (mid) bar(g, 510, 978, 900, 30, b.hp / b.max * ba, '#c98bff', '#7a2be0'); else bar(g, 510, 978, 900, 30, b.hp / b.max * ba, '#ff9a6a', '#e02a5a');
      if (mid) midFace(g, b, 392, 906, 104, 114);
      g.globalAlpha = 1;
      if (G.bossIntro > 20 && G.bossIntro <= 110) {
        var ia = Math.min(1, (110 - G.bossIntro) / 14) * Math.min(1, (G.bossIntro - 20) / 14);
        g.globalAlpha = ia; g.fillStyle = 'rgba(8,2,24,.6)'; g.fillRect(0, 430, 1920, 200);
        g.fillStyle = mid ? '#a050ff' : '#ff2e60'; g.fillRect(0, 430, 1920, 5); g.fillRect(0, 625, 1920, 5);
        if (mid) T(g, 'MID BOSS　―　空手使い', 960, 500, 40, (G.t >> 3) % 2 ? '#c98bff' : '#f0e0ff', 'center', UI, '#1e0a3c', 8);
        else T(g, b.type === 'dragon' ? '囚われの姫を救え！' : 'WARNING', 960, 500, 44, (G.t >> 3) % 2 ? '#ff5a6a' : '#ffd0d6', 'center', SERIF, '#2a0818', 8);
        T(g, b.name, 960, 584, 78, '#ffffff', 'center', MIN, mid ? '#5a1ea8' : '#a8183c', 10); g.globalAlpha = 1;
      }
    }
    if (G.helpT > 0 && !G.boss && G.state === 'play') { var ha = Math.min(1, G.helpT / 40); helpPanel(g, ha); keyHints(g, ha); }
    if (G.cutin) cutin(g);
    if (G.bossCut && G.state === 'play') bossCut(g);
    // 合体技の題字
    if (G.cross) {
      var X = G.cross, xa = Math.min(1, X.t / 10) * (X.t > 96 ? Math.max(0, (118 - X.t) / 22) : 1), sp = 150 + Math.max(0, 26 - X.t) * 24;
      var cu = X.t < 9 ? R.ease(X.t / 9) : X.t > 40 ? Math.max(0, 1 - (X.t - 40) / 9) : 1;      // 二人の顔のカットイン
      if (cu > 0) { crossBand(g, 'kurenai', -1300 * (1 - cu), 470, Math.min(1, cu * 2)); crossBand(g, 'aoi', 1300 * (1 - cu), 806, Math.min(1, cu * 2)); }
      g.globalAlpha = xa;
      var ch = ['紅', '蒼', '交', '錯'], cc = [RED, CYAN, '#ffffff', '#ffffff'];
      for (i = 0; i < 4; i++) T(g, ch[i], 960 + (i - 1.5) * sp, 330, 150, cc[i], 'center', MIN, i < 2 ? '#ffffff' : (i === 2 ? RED : CYAN), 10);
      T(g, 'C R O S S   R E B E L L I O N', 960, 392, 30, '#ffffff', 'center', SERIF, '#120a30', 6);
      g.globalAlpha = 1;
    }
    if (G.toast) { var ta = Math.min(1, G.toast.t / 8) * Math.min(1, (130 - G.toast.t) / 20); g.globalAlpha = ta; T(g, G.toast.str, 960, 286 - Math.max(0, 8 - G.toast.t) * 3, 40, G.toast.col, 'center', UI, '#120a30', 9); g.globalAlpha = 1; }
    if (G.card && G.state === 'play') {
      var ct = G.card.t, ca = Math.min(1, ct / 24) * Math.min(1, (190 - ct) / 30);
      g.globalAlpha = ca; g.fillStyle = 'rgba(8,4,30,.62)'; g.fillRect(0, 420, 1920, 220);
      g.fillStyle = PINK; g.fillRect(0, 420, 960 * Math.min(1, ct / 30) * 2, 4); g.fillStyle = CYAN; g.fillRect(1920 - 1920 * Math.min(1, ct / 30), 636, 1920, 4);
      T(g, G.card.title, 960, 540, 74, '#ffffff', 'center', MIN, '#3a1470', 10); T(g, G.card.sub, 960, 598, 28, '#c8b8ff', 'center', SERIF, '#120a30', 5);
      g.globalAlpha = 1;
    }
    if (G.dazzle > 0) {      // 中ボスのフラッシュで目がくらんでいる: 画面が白く飛び、だんだん戻る
      g.fillStyle = 'rgba(255,255,255,' + (0.88 * Math.pow(G.dazzle / 84, 1.25)) + ')'; g.fillRect(0, 0, 1920, 1080);
    }
    if (G.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, G.flash) + ')'; g.fillRect(0, 0, 1920, 1080); }
    if (G.fade > 0) { g.fillStyle = 'rgba(5,4,15,' + G.fade + ')'; g.fillRect(0, 0, 1920, 1080); }
  };
  // 中ボスの顔（シートの表情アイコン）。八角形の枠に入れる
  function midFace(g, b, x, y, w, h) {
    var im = R.IMG.midIcons, D = window.REBELL_MIDBOSS, i = R.Karate.icon(b);
    if (!im || !im.complete || !im.naturalWidth || !D) return;
    g.save();
    cham(g, x, y, w, h, 14); g.fillStyle = '#1e0a3c'; g.fill();
    g.save(); cham(g, x, y, w, h, 14); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, i * D.iconSize[0], 0, D.iconSize[0], D.iconSize[1], x, y, w, h);
    if (b.flash > 0) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w, h); }
    g.restore();
    g.lineJoin = 'miter'; cham(g, x, y, w, h, 14); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke();
    cham(g, x + 4, y + 4, w - 8, h - 8, 11); g.lineWidth = 2; g.strokeStyle = '#c98bff'; g.stroke();
    g.restore();
  }

  // ---- 各画面 ----
  function dim(g, a) { g.fillStyle = 'rgba(6,3,22,' + a + ')'; g.fillRect(0, 0, 1920, 1080); }
  function blinkText(g, s, x, y, size) { if ((G.t >> 5) % 2 === 0) T(g, s, x, y, size, '#ffffff', 'center', UI, '#3a1470', 8); }

  // ---- 起動時のロゴ（GYOKURYU → PHOTO TEAM → presents By KONOMI → タイトル）----
  // 時間はフレーム数（60 で 1 秒）。l1・l2・l3 = それぞれのロゴが始まる時刻
  var SP = { l1: 22, len1: 186, gap: 14, len2: 168, len3: 200, tail: 14 };
  SP.l2 = SP.l1 + SP.len1 + SP.gap; SP.l3 = SP.l2 + SP.len2 + SP.gap; SP.total = SP.l3 + SP.len3 + SP.tail;
  R.SPLASH_LEN = SP.total;
  var SANS = '"Segoe UI","Yu Gothic UI","Meiryo",sans-serif', JADE = '#4be8c0', JADE_L = '#c8fff2', embC = null;

  // 1 文字ずつ、字間をあけて中央ぞろえで並べる。fn(文字, x, 何文字目) が 1 文字ぶんを描く
  function spaced(g, text, cx, font, gap, fn) {
    g.font = font; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    var ws = [], total = -gap, i, x;
    for (i = 0; i < text.length; i++) { ws.push(g.measureText(text[i]).width); total += ws[i] + gap; }
    x = cx - total / 2;
    for (i = 0; i < text.length; i++) { fn(text[i], x, i); x += ws[i] + gap; }
  }

  // ロゴ 1 の龍が吐く炎。u だけで決まる（状態を持たない）。mx, my = 口の位置（画面の座標）
  //   BR.charge〜BR.fire: 口に光が集まる（火の粉が吸い込まれる）→ BR.fire: 着火の閃光 → BR.end まで炎を吐き続け、BR.end + 炎の寿命で消える
  //   炎は、下の漢字「玉龍」をめがけて吐く（TGT = ねらう点）。文字に当たった炎は、文字に沿って左右へはじける
  var MOUTH = [184, 22], BR = { charge: 36, fire: 58, end: 112, life: 32 }, TGT = [960, 810];      // MOUTH = 龍の影の中の口の位置（emblem のドット）
  function fhash(n) { n = Math.imul(n ^ 0x2545f491, 0x9e3779b1); n ^= n >>> 15; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13; return (n >>> 0) / 4294967296; }
  function breath(g, u, a, mx, my) {
    var i, k;
    if (u < BR.charge || u > BR.end + BR.life) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    // ため: 口に熱が集まり、まわりの火の粉が吸い込まれていく
    if (u < BR.fire + 6) {
      k = clamp((u - BR.charge) / (BR.fire - BR.charge), 0, 1);
      var cg = g.createRadialGradient(mx, my, 0, mx, my, 10 + 34 * k);
      cg.addColorStop(0, 'rgba(255,240,200,' + (0.9 * k * a) + ')'); cg.addColorStop(0.4, 'rgba(255,150,40,' + (0.55 * k * a) + ')'); cg.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(mx, my, 10 + 34 * k, 0, PI * 2); g.fill();
      for (i = 0; i < 14; i++) {
        var ph = ((u - BR.charge) / 14 + fhash(i)) % 1, ang = fhash(i * 7 + 1) * PI * 2, d = (1 - ph) * (60 + 50 * fhash(i * 3));
        g.fillStyle = 'rgba(255,' + (160 + Math.round(80 * ph)) + ',80,' + (ph * a * k) + ')';
        g.fillRect(mx + Math.cos(ang) * d - 1.5, my + Math.sin(ang) * d - 1.5, 3, 3);
      }
    }
    // 炎: 口から「玉龍」の文字へ、粒が広がりながら流れる（白 → 黄 → 橙 → 赤 → 煙）。文字に届いた粒は、左右へはじけて立ちのぼる
    //   1 回目はふつうに重ねて（白い翼や文字の上でも炎の色が見えるように）、2 回目は光として足す
    var L = Math.hypot(TGT[0] - mx, TGT[1] - my), dx = (TGT[0] - mx) / L, dy = (TGT[1] - my) / L, nx = -dy, ny = dx, pass;
    for (pass = 0; pass < 2; pass++) {
      g.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (i = 0; ; i++) {
        var ts = BR.fire + i * 0.4; if (ts > BR.end) break;
        var age = u - ts; if (age < 0 || age > BR.life) continue;
        var q = age / BR.life, sp = 32 + 8 * fhash(i * 11), wob = (fhash(i * 5 + 2) - 0.5) * (0.22 + q * 0.5);
        var dist = sp * age * (1 - 0.3 * q), px, py;
        if (dist < L) { px = mx + dx * dist + nx * wob * dist * 0.6; py = my + dy * dist + ny * wob * dist * 0.6; }
        else { var over = dist - L, side = fhash(i * 5 + 2) < 0.5 ? -1 : 1; px = TGT[0] + side * over * (0.35 + 0.5 * fhash(i * 17)); py = TGT[1] - over * 0.28 - q * q * 30; }      // はじけて、文字に沿って広がる
        var rr = (pass ? 1.3 : 0.8) * (12 + 40 * q + 10 * fhash(i * 13)), al = a * (1 - q) * (q < 0.06 ? q / 0.06 : 1);
        var col = q < 0.15 ? '255,248,215' : q < 0.38 ? '255,196,60' : q < 0.65 ? '255,100,24' : '180,30,24';
        var pg = g.createRadialGradient(px, py, 0, px, py, rr);
        pg.addColorStop(0, 'rgba(' + col + ',' + ((pass ? 0.5 : 0.8) * al) + ')'); pg.addColorStop(pass ? 1 : 0.7, 'rgba(' + col + ',0)');
        g.fillStyle = pg; g.beginPath(); g.arc(px, py, rr, 0, PI * 2); g.fill();
      }
    }
    // 着火の閃光と、吐いている間の口の光
    if (u >= BR.fire && u < BR.end + 8) {
      k = u < BR.fire + 10 ? 1 - (u - BR.fire) / 10 : 0;
      if (k > 0) { g.fillStyle = 'rgba(255,200,120,' + (0.35 * k * a) + ')'; g.fillRect(0, 0, 1920, 1080); }
      var mg = g.createRadialGradient(mx, my, 0, mx, my, 30), fl = 0.75 + 0.25 * Math.sin(u * 1.7);
      mg.addColorStop(0, 'rgba(255,250,220,' + (0.9 * fl * a) + ')'); mg.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 30, 0, PI * 2); g.fill();
    }
    g.restore();
  }
  // 炎に合わせた翼の動き: ためで大きく振り上げ → 吐く瞬間に打ち下ろす → 吐いている間は小さく羽ばたき → 元に戻る。
  //   龍の影は 1 枚の絵なので、上半分（翼）を縦 2 ドットの帯に切り、体の中心から離れるほど上端を上下させて（伸び縮み）曲げる。
  //   下半分（脚と尾）と、体のまん中（頭）は動かさない。lift = 翼の先の上がり幅（ドット。正 = 上）
  //   動きはゆっくり大きく: 龍が出てすぐから約 0.7 秒かけて振り上げ（38）→ 吐く瞬間から約 0.27 秒で打ち下ろし（-22）→
  //   約 0.87 秒で 1 回、大きくゆったり羽ばたき → 0.4 秒で元の形へ。WF = 各区切りの時刻（ロゴが始まってからのフレーム数）
  var WG = { pad: 44, cut: 54, xc: 172, body: 22, len: 150 }, wingC = null;
  var WF = { up: 14, down: BR.fire, flap: BR.fire + 16, back: BR.fire + 16 + 52, end: BR.fire + 16 + 52 + 24 }, WUP = 38, WDN = 22;
  function wingLift(u) {
    var e = R.ease;
    if (u < WF.up) return 0;
    if (u < WF.down) return WUP * e((u - WF.up) / (WF.down - WF.up));                          // ゆっくり振り上げる
    if (u < WF.flap) return WUP - (WUP + WDN) * e((u - WF.down) / (WF.flap - WF.down));        // 炎と同時に打ち下ろす
    if (u < WF.back) return -WDN * Math.cos(2 * PI * (u - WF.flap) / (WF.back - WF.flap));     // 大きく 1 回羽ばたく（下 → 上 → 下）
    if (u < WF.end) return -WDN * (1 - e((u - WF.back) / (WF.end - WF.back)));                  // 元の形へ
    return 0;
  }
  function wings(src, u) { return bendWings(src, wingLift(u)); }
  function bendWings(src, lift) {
    var P = WG.pad, W = src.width, H = src.height, x, t, dy;
    if (!wingC || wingC.width !== W) wingC = R.mk(W, H + P * 2);
    var c = wingC.getContext('2d'); c.clearRect(0, 0, W, H + P * 2);
    c.drawImage(src, 0, WG.cut, W, H - WG.cut, 0, WG.cut + P, W, H - WG.cut);      // 脚と尾はそのまま
    for (x = 0; x < W; x += 2) {
      t = clamp((Math.abs(x + 1 - WG.xc) - WG.body) / WG.len, 0, 1);
      dy = Math.round(-lift * Math.pow(t, 1.4));
      c.drawImage(src, x, 0, 2, WG.cut, x, P + dy, 2, WG.cut - dy);      // 上端だけを動かし、付け根（下端）は脚につないだまま伸び縮みさせる
    }
    return wingC;
  }
  // 炎を浴びた「玉龍」の文字が焦げていく。BURN.start で炎が届き、BURN.full で焦げきる。焦げた文字には、くすぶる火の粉と煙が残る
  var BURN = { start: 70, full: 108 }, burnC = null;
  function scorch(g, u, a, font) {
    var b = clamp((u - BURN.start) / (BURN.full - BURN.start), 0, 1);
    if (!burnC) burnC = R.mk(440, 110);
    var c = burnC.getContext('2d'), W = burnC.width, H = burnC.height, by = 80, i;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, W, H);
    spaced(c, '玉龍', W / 2, font, 26, function (ch, x) { c.fillStyle = JADE_L; c.fillText(ch, x, by); });
    if (b > 0) {
      c.globalCompositeOperation = 'source-atop';
      // 下から焦げが広がる（焦げの境目は熱で赤く光る）。焦げた色は、黒い背景でも字が読める焦げ茶
      var fy = H - (H + 20) * R.ease(b), cg = c.createLinearGradient(0, fy - 16, 0, fy + 12);
      cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(0.45, 'rgba(255,150,40,1)'); cg.addColorStop(1, 'rgba(120,70,44,1)');
      c.fillStyle = cg; c.fillRect(0, fy - 16, W, 28);
      var bg = c.createLinearGradient(0, 20, 0, H); bg.addColorStop(0, '#8a5a3a'); bg.addColorStop(1, '#5a3424');
      c.fillStyle = bg; c.fillRect(0, fy + 12, W, H);
      // 焦げのむら（黒い点）と、くすぶる火の粉（明滅する橙の点）
      for (i = 0; i < 260; i++) {
        var x = fhash(i * 3) * W, y = fhash(i * 3 + 1) * H; if (y < fy + 6) continue;
        if (i % 3) { c.fillStyle = 'rgba(20,8,4,.85)'; c.fillRect(x | 0, y | 0, 2 + (i % 3), 2 + (i % 2)); }
        else { var fl = 0.5 + 0.5 * Math.sin(u * (0.2 + fhash(i) * 0.3) + i); c.fillStyle = 'rgba(255,' + (110 + Math.round(100 * fl)) + ',40,' + (0.5 + 0.5 * fl) + ')'; c.fillRect(x | 0, y | 0, 2, 2); }
      }
    }
    var dx0 = 960 - W / 2, dy0 = 826 - by;
    g.save(); g.globalAlpha = a * R.ease(clamp((u - 44) / 24, 0, 1));
    g.drawImage(burnC, dx0, dy0);
    if (b > 0) {      // 焦げた文字のまわりの、くすぶる熱の光と、立ちのぼる煙
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * b * (0.4 + 0.15 * Math.sin(u * 0.31));
      g.shadowColor = '#ff6a20'; g.shadowBlur = 24; g.drawImage(burnC, dx0, dy0); g.shadowBlur = 0;
      g.globalCompositeOperation = 'source-over';
      for (i = 0; i < 18; i++) {
        var per = 46 + Math.floor(fhash(i * 7) * 30), ph = ((u - BURN.start + fhash(i * 9) * per) % per) / per;
        var sx = 960 + (fhash(i * 5) - 0.5) * 150 + Math.sin(ph * 5 + i) * 8, sy = 812 - ph * 90, sr = 6 + ph * 16;
        g.globalAlpha = a * b * (1 - ph) * 0.3; g.fillStyle = 'rgb(110,100,96)';
        g.beginPath(); g.arc(sx, sy, sr, 0, PI * 2); g.fill();
      }
    }
    g.restore();
  }
  // 「GYOKURYU」の文字も焦げる: 炎が文字の列のまん中（K と U の間）を突き抜けた所から、焦げが左右へ燃え広がる。
  //   ABURN.start で燃え始め、ABURN.full で両端まで焦げる。燃え広がる先は赤く光り、焦げた所には火の粉と煙が残る
  var ABURN = { start: 66, full: 128 }, aburnC = null;
  function scorchAlpha(g, u, a, font) {
    var b = clamp((u - ABURN.start) / (ABURN.full - ABURN.start), 0, 1);
    if (b <= 0) return;
    if (!aburnC) aburnC = R.mk(1240, 170);
    var c = aburnC.getContext('2d'), W = aburnC.width, H = aburnC.height, by = 130, mid = W / 2, i;
    var r = 40 + (W / 2) * R.ease(b);      // 焦げの広がり（まん中からの横の距離）
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, W, H);
    spaced(c, 'GYOKURYU', mid, font, 22, function (ch, x) { c.fillStyle = '#ffffff'; c.fillText(ch, x, by); });
    c.globalCompositeOperation = 'source-in';      // 文字の形の中だけに、焦げを塗る（焦げていない所は透明にする）
    var bg = c.createLinearGradient(0, 30, 0, H); bg.addColorStop(0, '#8a5a3a'); bg.addColorStop(1, '#4e2c1e');
    c.fillStyle = bg; c.beginPath(); c.rect(mid - r, 0, r * 2, H); c.fill();
    c.globalCompositeOperation = 'source-atop';
    [-1, 1].forEach(function (sd) {      // 燃え広がる先の、赤く光る帯
      var ex = mid + sd * r, eg = c.createLinearGradient(ex - sd * 34, 0, ex, 0);
      eg.addColorStop(0, 'rgba(255,150,40,0)'); eg.addColorStop(0.7, 'rgba(255,170,60,1)'); eg.addColorStop(1, 'rgba(255,230,150,1)');
      c.fillStyle = eg; c.fillRect(sd < 0 ? ex : ex - 34, 0, 34, H);
    });
    for (i = 0; i < 700; i++) {      // 焦げのむらと、くすぶる火の粉
      var x = fhash(i * 3 + 7) * W, y = fhash(i * 3 + 8) * H; if (Math.abs(x - mid) > r - 8) continue;
      if (i % 3) { c.fillStyle = 'rgba(20,8,4,.85)'; c.fillRect(x | 0, y | 0, 2 + (i % 3), 2 + (i % 2)); }
      else { var fl = 0.5 + 0.5 * Math.sin(u * (0.2 + fhash(i) * 0.3) + i); c.fillStyle = 'rgba(255,' + (110 + Math.round(100 * fl)) + ',40,' + (0.5 + 0.5 * fl) + ')'; c.fillRect(x | 0, y | 0, 2, 2); }
    }
    var dx0 = 960 - mid, dy0 = 716 - by;
    g.save(); g.globalAlpha = a; g.drawImage(aburnC, dx0, dy0);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * (0.3 + 0.12 * Math.sin(u * 0.27));      // くすぶる熱の光
    g.shadowColor = '#ff6a20'; g.shadowBlur = 26; g.drawImage(aburnC, dx0, dy0); g.shadowBlur = 0;
    g.globalCompositeOperation = 'source-over';
    for (i = 0; i < 26; i++) {      // 焦げた所から立ちのぼる煙
      var sx0 = (fhash(i * 5 + 3) - 0.5) * 2 * r; if (Math.abs(sx0) > 560) continue;
      var per = 50 + Math.floor(fhash(i * 7 + 2) * 30), ph = ((u - ABURN.start + fhash(i * 9 + 4) * per) % per) / per;
      g.globalAlpha = a * (1 - ph) * 0.26; g.fillStyle = 'rgb(110,100,96)';
      g.beginPath(); g.arc(960 + sx0 + Math.sin(ph * 5 + i) * 8, 690 - ph * 100, 8 + ph * 18, 0, PI * 2); g.fill();
    }
    g.restore();
  }
  // 炎を吐いている間の、画面の小さな揺れ（drawSplash から）
  function breathShake(u) { return u >= BR.fire && u < BR.end ? (u - BR.fire < 12 ? 5 : 1.6) : 0; }

  // ロゴ 1: GYOKURYU。玉（光る輪）の前に龍の影。u = このロゴが始まってからのフレーム数
  function logoGyokuryu(g, u, len) {
    var a = Math.min(1, u / 30) * Math.min(1, (len - u) / 26);
    if (a <= 0) return;
    var cx = 960, cy = 372, pop = 1 + 0.05 * (1 - R.ease(Math.min(1, u / 44))), font = 'bold 112px ' + SERIF;
    g.save();
    var shk = breathShake(u); if (shk) g.translate((fhash(u * 2) - 0.5) * 2 * shk, (fhash(u * 2 + 1) - 0.5) * 2 * shk);      // 炎を吐くと、画面が揺れる
    // 玉
    var rg = g.createRadialGradient(cx, cy, 20, cx, cy, 270);
    rg.addColorStop(0, 'rgba(75,232,192,.36)'); rg.addColorStop(0.6, 'rgba(75,232,192,.10)'); rg.addColorStop(1, 'rgba(75,232,192,0)');
    g.globalAlpha = a; g.fillStyle = rg; g.fillRect(cx - 280, cy - 280, 560, 560);
    g.strokeStyle = JADE; g.lineWidth = 3; g.beginPath();
    g.arc(cx, cy, 196 * pop, -PI / 2, -PI / 2 + PI * 2 * R.ease(Math.min(1, u / 46))); g.stroke();      // 輪を一筆で描く
    g.globalAlpha = a * 0.45; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 214 * pop, 0, PI * 2); g.stroke();
    // 龍（ボスのドット絵のうち、翼を広げた正面の姿を単色の影にして、紋章として使う）
    var dc = R.Dragon.emblem();
    if (!embC) embC = R.mk(dc.width, dc.height);
    var e = embC.getContext('2d'), eg = e.createLinearGradient(0, 0, 0, embC.height);
    eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.55, JADE_L); eg.addColorStop(1, JADE);
    e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, embC.width, embC.height); e.drawImage(dc, 0, 0);
    e.globalCompositeOperation = 'source-in'; e.fillStyle = eg; e.fillRect(0, 0, embC.width, embC.height);
    var s = 1.5 * pop;
    g.globalAlpha = a * clamp((u - 6) / 30, 0, 1); g.imageSmoothingEnabled = false; g.shadowColor = JADE; g.shadowBlur = 34;
    var ex0 = cx - embC.width / 2 * s, ey0 = cy - embC.height * 0.46 * s, wd = wings(embC, u);
    g.drawImage(wd, ex0, ey0 - WG.pad * s, wd.width * s, wd.height * s);
    g.shadowBlur = 0;
    // 文字: 1 文字ずつ浮かび上がる
    var burnR = u > ABURN.start ? 40 + 620 * R.ease(clamp((u - ABURN.start) / (ABURN.full - ABURN.start), 0, 1)) : -1;      // 焦げた範囲（scorchAlpha と同じ）
    spaced(g, 'GYOKURYU', 960, font, 22, function (ch, x, i) {
      var k = R.ease(clamp((u - 16 - i * 3) / 16, 0, 1)), y = 716 + (1 - k) * 16, burnt = Math.abs(x + g.measureText(ch).width / 2 - 960) < burnR;
      var gr = g.createLinearGradient(0, y - 90, 0, y + 6); gr.addColorStop(0, '#f4fffb'); gr.addColorStop(0.6, JADE_L); gr.addColorStop(1, '#7af0d4');
      g.globalAlpha = a * k; g.fillStyle = gr; g.shadowColor = burnt ? '#8a2a10' : JADE; g.shadowBlur = 16; g.fillText(ch, x, y); g.shadowBlur = 0;      // 焦げた字は、翡翠の光が消えて赤黒くくすむ
    });
    // 文字の上を走る光
    var sw = (u - 50) / 34;
    if (sw > 0 && sw < 1) {
      var sx = 960 - 560 + sw * 1120;
      g.save(); g.beginPath(); g.moveTo(sx - 20, 610); g.lineTo(sx + 70, 610); g.lineTo(sx + 20, 740); g.lineTo(sx - 70, 740); g.closePath(); g.clip();
      g.globalAlpha = a; g.shadowColor = '#ffffff'; g.shadowBlur = 26;
      spaced(g, 'GYOKURYU', 960, font, 22, function (ch, x) { g.fillStyle = '#ffffff'; g.fillText(ch, x, 716); });
      g.restore();
    }
    scorchAlpha(g, u, a, font);      // 炎が突き抜けたまん中から、焦げが左右へ燃え広がる
    // 下線と、漢字
    var lw = 660 * R.ease(Math.min(1, u / 36));
    g.globalAlpha = a; g.fillStyle = JADE; g.fillRect(960 - lw / 2, 754, lw, 3);
    g.save(); g.translate(960, 755.5); g.rotate(PI / 4); g.fillStyle = JADE_L; g.fillRect(-7, -7, 14, 14); g.restore();
    scorch(g, u, a, '62px ' + MIN);      // 「玉龍」（炎を浴びると焦げる）
    g.globalAlpha = 1;
    breath(g, u, a, ex0 + MOUTH[0] * s, ey0 + MOUTH[1] * s);      // 炎は、文字より手前に
    g.restore();
  }

  // カメラのしぼり（6 枚羽根）。open = 開きぐあい（0〜1）、rot = 回転
  function aperture(g, cx, cy, r, open, rot, col, edge) {
    var n = 6, ri = r * 0.84, ro = Math.max(3, ri * open), i, a, b;
    g.save(); g.translate(cx, cy);
    g.lineWidth = r * 0.085; g.strokeStyle = col; g.beginPath(); g.arc(0, 0, r, 0, PI * 2); g.stroke();      // 外側の輪
    g.beginPath(); g.arc(0, 0, ri, 0, PI * 2);                                                              // 羽根 = 円から六角形の穴を抜いた形
    for (i = 0; i <= n; i++) { a = rot + i * PI * 2 / n; if (i) g.lineTo(Math.cos(a) * ro, Math.sin(a) * ro); else g.moveTo(Math.cos(a) * ro, Math.sin(a) * ro); }
    g.closePath(); g.fillStyle = col; g.fill('evenodd');
    g.strokeStyle = edge; g.lineWidth = 4; g.lineCap = 'butt';                                              // 羽根の境目: 穴の辺を外へ延ばした線
    for (i = 0; i < n; i++) {
      a = rot + i * PI * 2 / n; b = rot + (i + 1) * PI * 2 / n;
      var x0 = Math.cos(a) * ro, y0 = Math.sin(a) * ro, dx = x0 - Math.cos(b) * ro, dy = y0 - Math.sin(b) * ro, L = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= L; dy /= L;
      var pd = x0 * dx + y0 * dy, t = -pd + Math.sqrt(Math.max(0, pd * pd - (ro * ro - ri * ri)));
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * (t + 2), y0 + dy * (t + 2)); g.stroke();
    }
    g.restore();
  }

  // ロゴ 2: PHOTO TEAM。ファインダーでピントを合わせ、シャッターを切ると、文字がはっきり写る
  function logoPhoto(g, u, len) {
    var a = Math.min(1, u / 20) * Math.min(1, (len - u) / 26), SH = 46;      // SH = シャッターが切れる時刻
    if (a <= 0) return;
    var cx = 960, cy = 372, shot = u >= SH, k = R.ease(Math.min(1, u / 38)), font = 'bold 100px ' + SANS;
    g.save(); g.globalAlpha = a;
    // ファインダーの四隅（内側へ寄ってくる）
    var bw = 600 + (1 - k) * 230, bh = 350 + (1 - k) * 130, L = 66;
    g.strokeStyle = shot ? '#ffffff' : 'rgba(255,255,255,.7)'; g.lineWidth = 6; g.lineJoin = 'miter'; g.lineCap = 'square';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      var x = 960 + c[0] * bw, y = 520 + c[1] * bh;
      g.beginPath(); g.moveTo(x - c[0] * L, y); g.lineTo(x, y); g.lineTo(x, y - c[1] * L); g.stroke();
    });
    // しぼり: 絞り込んでいき、切れた瞬間に開く
    var open = shot ? 0.14 + 0.36 * R.ease(Math.min(1, (u - SH) / 18)) : 0.66 - 0.54 * R.ease(Math.min(1, u / (SH - 6)));
    g.globalAlpha = a * 0.55; aperture(g, cx - 4, cy + 3, 122, open, u * 0.012, PINK, '#000000');       // 色のずれ（紅と蒼）
    aperture(g, cx + 4, cy - 3, 122, open, u * 0.012, CYAN, '#000000');
    g.globalAlpha = a; aperture(g, cx, cy, 122, open, u * 0.012, '#ffffff', '#000000');
    // 文字: 切る前はピントの合っていない像、切ったあとは、はっきりした文字
    if (!shot) {
      var blur = (1 - k) * 14 + 3;
      g.save(); if ('filter' in g) g.filter = 'blur(' + blur.toFixed(1) + 'px)';
      g.globalAlpha = a * 0.5;
      spaced(g, 'PHOTO TEAM', 960, font, 24, function (ch, x) { g.fillStyle = '#ffffff'; g.fillText(ch, x, 706); });
      g.restore();
    } else {
      spaced(g, 'PHOTO TEAM', 960, font, 24, function (ch, x) {
        g.globalAlpha = a * 0.85; g.fillStyle = PINK; g.fillText(ch, x - 4, 709); g.fillStyle = CYAN; g.fillText(ch, x + 4, 703);
        g.globalAlpha = a; g.fillStyle = '#ffffff'; g.fillText(ch, x, 706);
      });
      var lw = 700 * R.ease(Math.min(1, (u - SH) / 26));
      g.globalAlpha = a; g.fillStyle = '#ffffff'; g.fillRect(960 - lw / 2, 746, lw, 3);
      g.fillStyle = PINK; g.fillRect(960 - lw / 2, 753, lw / 2, 2); g.fillStyle = CYAN; g.fillRect(960, 753, lw / 2, 2);
    }
    // フラッシュ
    var fl = shot ? Math.max(0, 1 - (u - SH) / 18) : 0;
    if (fl > 0) { g.globalAlpha = fl * fl; g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1920, 1080); }
    g.restore();
  }

  // ---- ロゴ 3: presents By KONOMI ----
  // 二人が左右から走ってきてすれ違い（紅蒼交錯）、通ったあとに文字がぽんぽんと生える。振り返って、跳んで、決めポーズ。
  // 文字はフォントに頼らず、丸い線で描く（どの環境でも同じ形になり、1 文字ずつ弾ませられる）。
  //   1 文字 = [字送り, 線…]。座標は、大文字の上端 y=0・小文字の上端 y=40・ベースライン y=100
  //   'M' x y = 始点、'L' x y = 直線、'C' … = 曲線、'E' cx cy rx ry = だ円
  var GLY = {
    K: [78, 'M', 10, 0, 'L', 10, 100, 'M', 66, 0, 'L', 12, 58, 'M', 32, 40, 'L', 70, 100],
    O: [92, 'E', 46, 50, 36, 50],
    N: [88, 'M', 10, 100, 'L', 10, 0, 'L', 78, 100, 'L', 78, 0],
    M: [104, 'M', 10, 100, 'L', 10, 0, 'L', 52, 64, 'L', 94, 0, 'L', 94, 100],
    I: [28, 'M', 14, 0, 'L', 14, 100],
    B: [68, 'M', 10, 0, 'L', 10, 100, 'M', 10, 0, 'L', 30, 0, 'C', 58, 0, 58, 46, 30, 46, 'L', 10, 46, 'M', 30, 46, 'C', 64, 46, 64, 100, 30, 100, 'L', 10, 100],
    y: [52, 'M', 6, 42, 'L', 26, 96, 'M', 46, 42, 'L', 22, 108, 'C', 18, 120, 12, 130, 2, 126],
    p: [62, 'M', 10, 42, 'L', 10, 130, 'E', 31, 70, 21, 28],
    r: [42, 'M', 10, 42, 'L', 10, 100, 'M', 10, 62, 'C', 12, 48, 24, 40, 36, 44],
    e: [56, 'M', 8, 70, 'L', 48, 70, 'C', 48, 34, 8, 34, 8, 70, 'C', 8, 102, 36, 106, 46, 90],
    s: [46, 'M', 38, 50, 'C', 30, 38, 8, 40, 9, 56, 'C', 10, 70, 38, 68, 38, 84, 'C', 38, 100, 14, 104, 6, 92],
    n: [56, 'M', 10, 42, 'L', 10, 100, 'M', 10, 62, 'C', 12, 42, 46, 36, 46, 62, 'L', 46, 100],
    t: [40, 'M', 16, 18, 'L', 16, 84, 'C', 16, 98, 26, 102, 34, 96, 'M', 4, 44, 'L', 32, 44]
  };
  function glyph(g, d) {
    g.beginPath();
    for (var i = 1; i < d.length;) {
      var c = d[i];
      if (c === 'M') { g.moveTo(d[i + 1], d[i + 2]); i += 3; }
      else if (c === 'L') { g.lineTo(d[i + 1], d[i + 2]); i += 3; }
      else if (c === 'C') { g.bezierCurveTo(d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6]); i += 7; }
      else { g.moveTo(d[i + 1] + d[i + 3], d[i + 2]); g.ellipse(d[i + 1], d[i + 2], d[i + 3], d[i + 4], 0, 0, PI * 2); i += 5; }
    }
  }
  // 各文字の左端（文字の座標）。.w = 全体の幅
  function wordLayout(s, gap) {
    var x = 0, a = [], i;
    for (i = 0; i < s.length; i++) { a.push(x); x += GLY[s[i]][0] + gap; }
    a.w = x - gap; return a;
  }
  // ぽんっと出る大きさ: 0 から始まり、少し行きすぎてから 1 に落ち着く
  function boing(v) { return v <= 0 ? 0 : 1 - Math.exp(-v * 0.32) * Math.cos(v * 0.55); }
  function rnd(i) { var s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  // 細い丸線の文字（presents / By）。中央ぞろえ。pop(i) = i 文字目の大きさ
  function lineWord(g, s, cx, base, sc, gap, lw, col, glow, pop) {
    var L = wordLayout(s, gap), x = cx - L.w * sc / 2, i, k, d;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (i = 0; i < s.length; i++) {
      k = pop(i); if (k <= 0) continue;
      d = GLY[s[i]];
      g.save(); g.translate(x + (L[i] + d[0] / 2) * sc, base); g.scale(sc * k, sc * k); g.translate(-d[0] / 2, -100);
      glyph(g, d);
      g.strokeStyle = glow; g.lineWidth = lw * 2.6; g.globalAlpha = 0.3; g.stroke();
      g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = 1; g.stroke();
      g.restore();
    }
  }
  // あめ玉のような太い文字（KONOMI）。w = 線の太さ（文字の座標で）、col = [地の色, 上のほうの明るい色]
  //   halo = true なら、まわりににじむ光だけを描く（となりの文字に光がかぶらないよう、先に全部の光を描く）
  function candy(g, d, w, col, halo) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    glyph(g, d);
    if (halo) {
      g.strokeStyle = col[0]; g.globalAlpha = 0.1; g.lineWidth = w + 30; g.stroke(); g.globalAlpha = 0.13; g.lineWidth = w + 20; g.stroke(); g.globalAlpha = 0.16; g.lineWidth = w + 12; g.stroke();
      g.globalAlpha = 1; return;
    }
    g.globalAlpha = 1; g.strokeStyle = '#ffffff'; g.lineWidth = w + 6; g.stroke();         // 白いふち
    var gr = g.createLinearGradient(0, -8, 0, 108); gr.addColorStop(0, col[1]); gr.addColorStop(0.55, col[0]); gr.addColorStop(1, col[0]);
    g.strokeStyle = gr; g.lineWidth = w; g.stroke();
    g.save(); g.beginPath(); g.rect(-40, -40, 240, 92); g.clip();                           // つや（上半分だけ）
    g.translate(-w * 0.15, -w * 0.17); glyph(g, d);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = w * 0.2; g.stroke(); g.restore();
  }
  // O の中の顔。mood: 0 = ふつう、1 = にっこり、2 = まばたき。look = 目線（-1 = 左、1 = 右）
  function oFace(g, col, mood, look) {
    var i, x;
    g.fillStyle = col[0]; g.globalAlpha = 0.16; g.beginPath(); g.ellipse(46, 50, 27, 41, 0, 0, PI * 2); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = 2.6; g.lineCap = 'round';
    for (i = -1; i <= 1; i += 2) {
      x = 46 + i * 11 + look * 1.6; g.beginPath();
      if (mood === 1) { g.arc(x, 49, 4.6, PI * 1.12, PI * 1.88); g.stroke(); }
      else if (mood === 2) { g.moveTo(x - 4, 46); g.lineTo(x + 4, 46); g.stroke(); }
      else { g.arc(x, 46, 3.9, 0, PI * 2); g.fill(); }
    }
    g.beginPath(); g.arc(46, 53, mood === 1 ? 6.5 : 5, PI * 0.12, PI * 0.88); g.stroke();      // 口
    g.fillStyle = '#ff9ac6'; g.globalAlpha = 0.8;                                               // ほっぺ
    g.beginPath(); g.ellipse(27, 58, 5.2, 3.2, 0, 0, PI * 2); g.fill();
    g.beginPath(); g.ellipse(65, 58, 5.2, 3.2, 0, 0, PI * 2); g.fill();
    g.globalAlpha = 1;
  }
  function heart(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s); g.beginPath(); g.moveTo(0, 0.9);
    g.bezierCurveTo(-1.5, -0.2, -0.75, -1.25, 0, -0.45); g.bezierCurveTo(0.75, -1.25, 1.5, -0.2, 0, 0.9); g.closePath(); g.fill(); g.restore();
  }
  // きらめき（4 つの角がとがった星）。thin = くびれの細さ（小さいほど、細い光の筋になる）
  function spark(g, x, y, r, rot, thin) {
    var q = r * (thin || 0.14);
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.beginPath(); g.moveTo(r, 0);
    for (var i = 1; i <= 4; i++) { var a = i * PI / 2, m = a - PI / 4; g.quadraticCurveTo(Math.cos(m) * q, Math.sin(m) * q, Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.restore();
  }
  // 光の筋 1 本（細長いひし形）
  function ray(g, x, y, r, w, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(r, 0); g.lineTo(0, w); g.lineTo(-r, 0); g.lineTo(0, -w); g.closePath(); g.fill(); g.restore();
  }
  // ぱっと光る（やわらかい光の玉 + 細い十字の筋）
  function flare(g, x, y, r, al) {
    if (r <= 1 || al <= 0) return;
    var rg = g.createRadialGradient(x, y, 0, x, y, r * 0.62);
    rg.addColorStop(0, 'rgba(255,255,255,' + 0.9 * al + ')'); rg.addColorStop(0.16, 'rgba(255,236,250,' + 0.55 * al + ')'); rg.addColorStop(0.45, 'rgba(255,190,235,' + 0.16 * al + ')'); rg.addColorStop(1, 'rgba(190,170,255,0)');
    g.globalAlpha = 1; g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = al; g.fillStyle = '#ffffff';
    ray(g, x, y, r, r * 0.04, 0); ray(g, x, y, r * 0.82, r * 0.04, PI / 2); ray(g, x, y, r * 0.42, r * 0.028, PI / 4); ray(g, x, y, r * 0.42, r * 0.028, -PI / 4);
    g.globalAlpha = 1;
  }
  function glowSpot(g, x, y, r, rgb, al) {
    if (al <= 0) return;
    var rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(' + rgb + ',' + al + ')'); rg.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 時間割（このロゴが始まってからのフレーム数）
  //   T0 走り出す、T1 止まりはじめる、T2 止まる、T3 跳ぶ（蒼は wait だけ遅れる）、JD・JH = ジャンプの長さと高さ、H2 = 2 回目の小さなジャンプ
  //   FLOOR = 床の高さ、S = KONOMI の大きさ、W = 線の太さ、GAP = 字間
  var KN = { T0: 8, T1: 46, T2: 60, T3: 70, JD: 26, JH: 132, H2: 142, HD: 18, FLOOR: 756, S: 1.5, W: 17.4, GAP: 20, BURST: 36 };
  var ACT = {
    kurenai: { x0: -160, x1: 1620, dir: 1, rate: 0.55, wait: 0, idle: 1 },
    aoi: { x0: 2080, x1: 300, dir: -1, rate: 0.5, wait: 6, idle: 0 }
  };
  var KCOL = [['#55ccff', '#c8f0ff'], ['#7ab2ff', '#d3e4ff'], ['#a79aff', '#e0dbff'], ['#d48ef2', '#f3dafc'], ['#ff84cc', '#ffd6ee'], ['#ff6c9c', '#ffcbdd']];
  // またたく星: [x, 床からの高さ, 大きさ, またたきのずれ, 色]
  var KTW = [[742, 246, 13, 0, '#ffffff'], [1184, 264, 16, 1.7, '#ffd9ef'], [640, 324, 10, 3.1, '#bfe9ff'], [1312, 218, 11, 4.4, '#ffffff'], [872, 364, 9, 2.2, '#ffe9a8'], [1060, 360, 8, 5.3, '#bfe9ff'],
    [452, 150, 9, 0.9, '#ffd9ef'], [1470, 156, 10, 3.8, '#bfe9ff'], [960, -84, 9, 1.2, '#ffe9a8'], [706, -90, 7, 2.9, '#ffffff'], [1226, -96, 8, 4.9, '#ffd9ef']];
  var kPop = null;
  // 走ってくる位置: 一定の速さで来て、T1 からだんだん遅くなり、T2 で止まる
  function runX(A, u) {
    var v0 = Math.abs(A.x1 - A.x0) / (KN.T1 - KN.T0 + (KN.T2 - KN.T1) / 2), v;
    if (u <= KN.T0) return A.x0;
    if (u < KN.T1) return A.x0 + A.dir * v0 * (u - KN.T0);
    v = Math.min(1, (u - KN.T1) / (KN.T2 - KN.T1));
    return A.x0 + A.dir * v0 * (KN.T1 - KN.T0 + (KN.T2 - KN.T1) * (v - v * v / 2));
  }
  // 文字が生える時刻: その場所を、走っている子が通りすぎた少しあと（真ん中から外へ順に出る）
  function konomiPops(L) {
    var a = [], i, cx, u, A;
    for (i = 0; i < 6; i++) {
      cx = 960 + (L[i] + GLY['KONOMI'[i]][0] / 2 - L.w / 2) * KN.S;
      A = cx >= 960 ? ACT.kurenai : ACT.aoi;
      for (u = KN.T0; u < KN.T2; u += 0.25) if ((runX(A, u) - cx) * A.dir >= 0) break;
      a.push({ cx: cx, t: u + 4 });
    }
    return a;
  }
  // 着地の時刻と、どちら側か（1 = 右の紅、-1 = 左の蒼）、文字の跳ねる高さ
  function landings() {
    var k = KN.T3 + KN.JD, a = k + ACT.aoi.wait, h = KN.H2 + KN.HD;
    return [[k, 1, 20], [a, -1, 20], [h, 1, 11], [h + ACT.aoi.wait, -1, 11]];
  }
  // 二人が着地するたび、近い文字から順に小さく跳ねる。そのあとは、ゆるく波うつ
  function letterHop(u, i) {
    var y = 0, E = landings(), n, v;
    for (n = 0; n < E.length; n++) {
      v = u - E[n][0] - 2 - (E[n][1] > 0 ? 5 - i : i) * 2.2;
      if (v > 0 && v < 12) y -= E[n][2] * Math.sin(PI * v / 12);
    }
    if (u > 114) y -= 5 * Math.pow(Math.max(0, Math.sin(u * 0.105 - i * 0.8)), 2) * Math.min(1, (u - 114) / 20);
    return y;
  }
  // 主人公のコマを、ロゴ画面の大きさ（シートの 1 ドット = 4）で描く。位置は 4 の倍数にそろえて、ドットをくずさない
  function chibi(g, f, x, y, face, sx, sy) {
    g.save(); g.translate(Math.round(x / 4) * 4, Math.round(y / 4) * 4); g.scale(face * 4 * sx, 4 * sy);
    g.imageSmoothingEnabled = false; g.drawImage(f.c, -f.ox, -f.oy); g.restore();
  }
  function actor(g, who, u) {
    if (u < KN.T0 || !R.SPR[who]) return;
    var A = ACT[who], x = runX(A, u), y = KN.FLOOR, face = A.dir, sx = 1, sy = 1, f, v;
    var J0 = KN.T3 + A.wait, L0 = J0 + KN.JD, H0 = KN.H2 + A.wait;
    if (u < KN.T1) f = R.frame(who, 'run', Math.floor((u - KN.T0) * A.rate) % R.SPR[who].run.length);      // 走ってくる
    else if (u < KN.T2 - 4) f = R.frame(who, 'slide', 1);                                                     // 砂ぼこりを上げて止まる
    else if (u < KN.T2 + 1) f = R.frame(who, 'stop', 0);
    else {
      face = -A.dir;                                                                                           // 振り返って、文字のほうを見る
      if (u < J0 - 3) { f = R.frame(who, 'idle', A.idle); v = (u - KN.T2 - 1) / 5; if (v < 1) y -= 16 * Math.sin(PI * v); }
      else if (u < J0) { f = R.frame(who, 'idle', A.idle); sx = 1.07; sy = 0.9; }                             // ぐっと沈んで
      else if (u < L0) {                                                                                       // 跳ぶ
        v = (u - J0) / KN.JD; y -= KN.JH * 4 * v * (1 - v);
        f = R.frame(who, 'jump', v < 0.3 ? 2 : v < 0.62 ? 3 : 4);
        if (v < 0.2) { sx = 0.94; sy = 1.08; }
      }
      else if (u < L0 + 6) f = R.frame(who, 'land', 1);                                                       // 着地
      else {                                                                                                   // 決めポーズ（きらきら付き）
        f = R.frame(who, 'event', 1); v = u - L0 - 6;
        if (v < 7) { sx = 1 - 0.06 * (1 - v / 7); sy = 1 + 0.09 * (1 - v / 7); }
        v = (u - H0) / KN.HD; if (v > 0 && v < 1) y -= 46 * 4 * v * (1 - v);                                   // もう一度、小さく跳ねる
      }
    }
    chibi(g, f, x, y, face, sx, sy);
  }

  function logoKonomi(g, u, len) {
    var a = Math.min(1, u / 14) * Math.min(1, (len - u) / 24), FL = KN.FLOOR, i, v, k, d;
    if (a <= 0) return;
    var L = wordLayout('KONOMI', KN.GAP), E = landings();
    if (!kPop) kPop = konomiPops(L);
    g.save();
    // 奥の明かり（左 = 蒼の色、右 = 紅の色）
    var ga = R.ease(clamp((u - 30) / 40, 0, 1));
    glowSpot(g, 300, FL - 120, 560, '85,204,255', 0.2 * ga); glowSpot(g, 1620, FL - 120, 560, '255,108,156', 0.2 * ga); glowSpot(g, 960, FL - 60, 640, '167,154,255', 0.12 * ga);
    // 床の線（二人がすれ違ったところから、左右へ伸びる）
    var fw = 830 * R.ease(clamp((u - KN.BURST) / 22, 0, 1));
    if (fw > 0) {
      var lg = g.createLinearGradient(130, 0, 1790, 0);
      lg.addColorStop(0, 'rgba(85,204,255,0)'); lg.addColorStop(0.12, '#55ccff'); lg.addColorStop(0.5, '#b7a0ff'); lg.addColorStop(0.88, '#ff6c9c'); lg.addColorStop(1, 'rgba(255,108,156,0)');
      g.fillStyle = lg; g.fillRect(960 - fw, FL + 3, fw * 2, 4);
    }
    // すれ違った瞬間の光（文字と二人の後ろで光る）
    var bx = 960, by = FL - 128, bv = u - KN.BURST;
    if (bv >= 0 && bv < 18) { g.globalAlpha = 0.85 * (1 - bv / 18); g.strokeStyle = '#e8dcff'; g.lineWidth = 7 * (1 - bv / 18) + 1; g.beginPath(); g.arc(bx, by, 24 + 190 * R.ease(bv / 18), 0, PI * 2); g.stroke(); }
    if (bv >= 0 && bv < 16) flare(g, bx, by, 230 * Math.sin(PI * bv / 16), Math.min(1, (16 - bv) / 7));
    g.globalAlpha = 1;
    // presents（1 文字ずつ、ぽんぽんと出る）
    lineWord(g, 'presents', 960, FL - 286, 0.66, 9, 10, '#fff0f8', '#ff7ac8', function (n) { return boing(u - 6 - n * 2.6); });
    // By（K の左上に、少しかたむけて）
    v = u - 53;
    if (v > 0) {
      g.save(); g.translate(538, FL - 232); g.rotate(-0.12 + 0.12 * Math.exp(-v * 0.2) * Math.sin(v * 0.7));
      lineWord(g, 'By', 0, 0, 0.62, 6, 11, '#ffffff', '#a79aff', function () { return boing(v); }); g.restore();
    }
    // KONOMI（先に全部の文字の光、そのあと文字）
    var happy = (u >= E[0][0] - 24 && u < E[1][0] + 14) || (u >= KN.H2 + 2 && u < E[3][0] + 6);
    var mood = happy ? 1 : ((u + 22) % 72 >= 66 ? 2 : 0), pass;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < 6; i++) {
      v = u - kPop[i].t; if (v <= 0) continue;
      k = boing(v); d = GLY['KONOMI'[i]];
      g.save(); g.translate(kPop[i].cx, FL - 15 + letterHop(u, i)); g.rotate(0.16 * Math.exp(-v * 0.22) * Math.sin(v * 0.7)); g.scale(KN.S * k, KN.S * k); g.translate(-d[0] / 2, -100);
      candy(g, d, KN.W, KCOL[i], pass === 0);
      if (pass && d === GLY.O) oFace(g, KCOL[i], mood, i === 1 ? 1 : -1);
      g.restore();
    }
    // 二人
    actor(g, 'aoi', u); actor(g, 'kurenai', u);
    // すれ違った瞬間に飛びちる、ハートと星
    v = bv;
    if (v >= 0 && v < 46) {
      for (i = 0; i < 16; i++) {
        var an = i / 16 * PI * 2 + rnd(i) * 0.5, sp = 9 + rnd(i + 20) * 9, life = 30 + rnd(i + 40) * 14;
        if (v >= life) continue;
        var dist = sp * (1 - Math.exp(-v * 0.09)) / 0.09, px = bx + Math.cos(an) * dist, py = by + Math.sin(an) * dist * 0.8 + 0.09 * v * v, sz = (10 + rnd(i + 60) * 8) * Math.min(1, v / 4);
        g.globalAlpha = Math.min(1, (life - v) / 10);
        if (i % 3 === 0) { g.fillStyle = i % 2 ? '#7fd4ff' : '#ff7fb5'; heart(g, px, py, sz, (rnd(i + 80) - 0.5) * 0.8); }
        else if (i % 3 === 1) { g.fillStyle = i % 2 ? '#ffe9a0' : '#ffffff'; spark(g, px, py, sz * 1.2, v * 0.08); }
        else { g.fillStyle = '#c9b8ff'; g.beginPath(); g.arc(px, py, sz * 0.4, 0, PI * 2); g.fill(); }
      }
    }
    // まわりで、またたく星
    for (i = 0; i < KTW.length; i++) {
      var tw = KTW[i], ta = clamp((u - 44 - i * 3) / 14, 0, 1), ts = 0.5 + 0.5 * Math.sin(u * 0.17 + tw[3]);
      if (ta <= 0) continue;
      g.globalAlpha = ta * (0.3 + 0.7 * ts); g.fillStyle = tw[4]; spark(g, tw[0], FL - tw[1], tw[2] * (0.6 + 0.5 * ts), 0);
    }
    // 決めポーズのあと、ハートがふわふわ昇る
    [['kurenai', '#ff7fb5'], ['aoi', '#8fd6ff']].forEach(function (h) {
      var A = ACT[h[0]], s0 = KN.T3 + A.wait + KN.JD + 8, j, t, hx, hy;
      for (j = 0; j < 3; j++) {
        t = u - s0 - j * 15; if (t < 0) continue;
        t %= 46; hx = A.x1 + (j - 1) * 34 + 10 * Math.sin(t * 0.2 + j * 2); hy = FL - 300 - t * 1.8;
        g.globalAlpha = Math.sin(PI * t / 46) * 0.95; g.fillStyle = h[1]; heart(g, hx, hy, 11 + j * 2 + t * 0.08, 0.2 * Math.sin(t * 0.15 + j));
      }
    });
    // 入りと終わりは、黒をかぶせてフェード
    g.globalAlpha = 1 - a; g.fillStyle = '#000000'; g.fillRect(0, 0, 1920, 1080);
    g.restore();
  }

  R.drawSplash = function (g) {
    var t = G.stateT;
    g.fillStyle = '#000000'; g.fillRect(0, 0, 1920, 1080);
    if (t >= SP.l1 && t < SP.l1 + SP.len1) logoGyokuryu(g, t - SP.l1, SP.len1);
    else if (t >= SP.l2 && t < SP.l2 + SP.len2) logoPhoto(g, t - SP.l2, SP.len2);
    else if (t >= SP.l3 && t < SP.l3 + SP.len3) logoKonomi(g, t - SP.l3, SP.len3);
  };

  // ---- タイトル画面の、紅い月と、羽ばたく龍の影 ----
  //   空の絵の月を大きく描き直し、その前で、龍の影が大きく羽ばたきながら浮かぶ。
  //   龍の影は起動ロゴと同じ絵（R.Dragon.emblem）を黒く塗ったもの。翼の曲げ方は起動ロゴと同じ bendWings
  var TM = { x: 935, y: 236, r: 150 }, darkC = null;      // ポスターとタイトルロゴの間（月の左端はポスターの後ろに隠れる）
  function titleMoon(g, t) {
    var sky = R.BG.sky, x = TM.x, y = TM.y, r = TM.r, i;
    g.save();
    var hg = g.createRadialGradient(x, y, r * 0.9, x, y, r * 2);      // 月のまわりの赤い光（ゆっくり脈打つ）
    hg.addColorStop(0, 'rgba(255,40,70,' + (0.32 + 0.06 * Math.sin(t * 0.03)) + ')'); hg.addColorStop(1, 'rgba(255,0,40,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(x, y, r * 2, 0, PI * 2); g.fill();
    g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.clip();
    g.imageSmoothingEnabled = false; g.drawImage(sky, 245 - 34, 56 - 34, 68, 68, x - r, y - r, r * 2, r * 2);
    var mg = g.createLinearGradient(0, y - r, 0, y + r); mg.addColorStop(0, 'rgba(255,60,80,.18)'); mg.addColorStop(1, 'rgba(60,0,20,.45)');
    g.fillStyle = mg; g.fillRect(x - r, y - r, r * 2, r * 2);
    for (i = 0; i < 3; i++) {      // 月の前を流れる黒い雲の筋
      var w = r * (1 + fhash(i * 3) * 0.8), cx = x - r - w + ((t * (0.25 + 0.15 * fhash(i)) + fhash(i * 7) * 900) % (r * 2 + w * 2)), cy = y - r * 0.5 + i * r * 0.45;
      g.fillStyle = 'rgba(14,4,18,.55)'; g.fillRect(cx, cy, w, 7); g.fillRect(cx + w * 0.25, cy + 9, w * 0.5, 3);
    }
    g.restore();
    // 龍の影
    var dc = R.Dragon.emblem();
    if (dc.width <= 8) return;      // 龍の絵がまだ読み込まれていない
    if (!darkC) {
      darkC = R.mk(dc.width, dc.height);
      var d = darkC.getContext('2d'); d.drawImage(dc, 0, 0); d.globalCompositeOperation = 'source-in'; d.fillStyle = '#0c0414'; d.fillRect(0, 0, dc.width, dc.height);
    }
    // 羽ばたき: ゆっくり大きく振り上げ（周期の 6 割）→ 力強く打ち下ろす（4 割）。打ち下ろすと体が浮き、振り上げる間に沈む
    var P = 84, p = (t % P) / P, e = R.ease, s = 1.0;
    var lift = p < 0.6 ? -24 + 60 * e(p / 0.6) : 36 - 60 * e((p - 0.6) / 0.4);
    var rise = p < 0.6 ? 8 * e(p / 0.6) : 8 - 16 * e((p - 0.6) / 0.4);      // 正 = 沈む
    var wd = bendWings(darkC, lift), dx = x - darkC.width / 2 * s + Math.sin(t * 0.011) * 12, dy = y - 56 + rise + Math.sin(t * 0.017) * 6;
    g.save(); g.imageSmoothingEnabled = false; g.shadowColor = 'rgba(255,40,60,.9)'; g.shadowBlur = 18;
    g.drawImage(wd, dx, dy - WG.pad * s, wd.width * s, wd.height * s);
    g.restore();
  }

  // ---- タイトル画面の二人の動き ----
  //   TH.cycle フレームで一巡: しばらく走り、ゲームと同じ並びのコマで連続攻撃（ATK.g を順に）、続けて遠距離攻撃（ATK.s を順に）、また走る。
  //   斬撃の光・紅の鎖鎌・蒼の飛ぶ刃は、この画面用に簡単に描く（ゲームの当たり判定や音はない）。G.t だけで決まる
  //   k = コマを描く倍率（シートの 1 ドット → 画面の k ドット）
  var TH = { cycle: 400, run: 150, k: 2.8 };
  function seqFrame(seq, tt) { var e = seq[0], i; for (i = 0; i < seq.length; i++) if (seq[i][0] <= tt) e = seq[i]; return [e[1], e[2]]; }
  function titleMoves(who) {      // [{ a: 技, t0: 始まる時刻 }]（走り終わってから）
    var A = R.ATK[who], L = [], t0 = 0;
    A.g.forEach(function (a) { L.push({ a: a, t0: t0 }); t0 += a.dur; });
    t0 += 10;
    A.s.forEach(function (a) { L.push({ a: a, t0: t0 }); t0 += a.dur; });
    return { list: L, end: t0 };
  }
  var moveCache = {};
  function titleHero(g, who, x, t) {
    var K = who === 'kurenai', col = K ? PINK : CYAN, k = TH.k, y = 880, ph = ((t % TH.cycle) + TH.cycle) % TH.cycle, f, i, fx = null;
    var M = moveCache[who] || (moveCache[who] = titleMoves(who)), tt = ph - TH.run, cur = null;
    if (tt >= 0) for (i = 0; i < M.list.length; i++) if (tt >= M.list[i].t0 && tt < M.list[i].t0 + M.list[i].a.dur) cur = M.list[i];
    if (cur) { var at = tt - cur.t0, fr = seqFrame(cur.a.seq, at); f = R.frame(who, fr[0], fr[1]); fx = { a: cur.a, at: at }; }
    else if (tt >= 0 && tt < M.end) f = R.frame(who, 'stance', R.STAND[who].stance.i);      // 技と技の間の構え
    else f = R.frame(who, 'run', Math.floor(ph / (K ? 5 : 4)) % R.SPR[who].run.length);      // t は蒼だと負になるので、一巡の中の時刻で数える
    // 足もとの光
    var lg = g.createRadialGradient(x, y + 2, 0, x, y + 2, 110); lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.3; g.fillStyle = lg; g.fillRect(x - 110, y - 40, 220, 60); g.restore();
    g.imageSmoothingEnabled = false;
    if (fx && fx.a.kusari) kusariFx(g, x, y, k, fx.a, fx.at);      // 鎖は体の後ろから伸びる
    g.save(); g.shadowColor = col; g.shadowBlur = 18; R.drawFrame(g, f, x, y, k, 1); g.restore();
    if (fx) {
      if (fx.a.shot) shotFx(g, x, y, k, fx.a, fx.at);
      else if (!fx.a.kusari) slashFx(g, x, y, k, fx.a, fx.at, K);
    }
    // 遠距離の刃は、技が終わってからも飛び続ける（直前の遠距離技の刃を描く）
    if (tt >= 0) M.list.forEach(function (m) { if (m.a.shot && (!fx || fx.a !== m.a) && tt - m.t0 > m.a.dur && tt - m.t0 < m.a.dur + 40) shotFx(g, x, y, k, m.a, tt - m.t0); });
  }
  // 斬撃の光: 当たるあいだ（h0〜h1）、体の前に三日月形の光の弧
  function slashFx(g, x, y, k, a, at, K) {
    if (at < a.h0 - 1 || at > a.h1 + 4) return;
    var u = clamp((at - a.h0 + 1) / (a.h1 - a.h0 + 5), 0, 1), r = (K ? 34 : 24) * k, cx = x + (K ? 16 : 12) * k, cy = y - 20 * k, up = a.fx ? a.fx[1] < 0 : (at & 1);
    var s0 = up ? 0.9 : -1.3, s1 = up ? -1.3 : 0.9, now = s0 + (s1 - s0) * R.ease(Math.min(1, u * 1.6));
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    [[K ? '#ff4fb0' : '#37e6ff', 14, 0.55], ['#ffffff', 5, 0.9]].forEach(function (L) {
      g.strokeStyle = L[0]; g.lineWidth = L[1] * (1 - u * 0.6); g.globalAlpha = L[2] * (1 - u);
      g.beginPath(); g.arc(cx, cy, r, Math.min(s0, now), Math.max(s0, now)); g.stroke();
    });
    g.restore();
  }
  // 紅の鎖鎌: 伸びる（out）→ 止まる（hold）→ 戻る（back）。鎖は小さな輪の連なり、先に鎌
  function kusariFx(g, x, y, k, a, at) {
    var q = a.kusari, t0 = a.h0, len;
    if (at < t0) return;
    var u = at - t0;
    if (u < q.out) len = R.ease(u / q.out); else if (u < q.out + q.hold) len = 1; else if (u < q.out + q.hold + q.back) len = 1 - R.ease((u - q.out - q.hold) / q.back); else return;
    var L = 180 * len, hx = x + 12 * k, hy = y + q.hy * k * 0.5 - 30, i, n = Math.floor(L / 14);
    g.save();
    for (i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#c8b8d8' : '#8a7aa0'; g.fillRect(hx + i * 14, hy - 3 + Math.sin(i * 0.9 + at) * 1.5, 10, 6); }
    var tx = hx + L;      // 鎌（くるくる回る）
    g.translate(tx, hy); g.rotate(at * 0.6);
    g.strokeStyle = '#ffe2f0'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 22, -2.4, 0.6); g.stroke();
    g.strokeStyle = '#ff4fb0'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 22, -2.4, 0.6); g.stroke();
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.fillStyle = '#ff4fb0'; g.beginPath(); g.arc(0, 0, 30, 0, PI * 2); g.fill();
    g.restore();
  }
  // 蒼の飛ぶ刃: 撃った所から右へ飛ぶ三日月（big = 3 発目の大きな刃）
  function shotFx(g, x, y, k, a, at) {
    var s = a.shot, age = at - s.at; if (age < 0 || age > 40) return;
    var px = x + 16 * k + age * 22, py = y + s.y * k * 0.5 - 36, r = (s.big ? 40 : 24), al = Math.min(1, (40 - age) / 10);
    if (px > 1900) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = al;
    g.fillStyle = 'rgba(55,230,255,.5)'; g.beginPath(); g.arc(px, py, r, -PI / 2, PI / 2); g.arc(px - r * 0.45, py, r * 0.8, PI / 2, -PI / 2, true); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, r * 0.8, -PI / 2, PI / 2); g.arc(px - r * 0.3, py, r * 0.7, PI / 2, -PI / 2, true); g.fill();
    g.fillStyle = 'rgba(55,230,255,.35)'; g.fillRect(px - r - 90, py - 2, 90, 4);      // 光の尾
    g.restore();
  }

  R.drawTitle = function (g) {
    var t = G.t, i;
    var gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#0b0a26'); gr.addColorStop(0.6, '#2a1a66'); gr.addColorStop(1, '#5a2470');
    g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
    g.globalAlpha = 0.55; pix(g, R.BG.sky, 0, 0, 1920, 1080); g.globalAlpha = 0.8; pix(g, R.BG.far, -((t * 0.6) % 3840), 180, 3840, 1080); pix(g, R.BG.far, 3840 - ((t * 0.6) % 3840), 180, 3840, 1080); g.globalAlpha = 1;
    dim(g, 0.35);
    titleMoon(g, t);      // 紅い月と、羽ばたく龍の影
    // ポスター
    var img = R.IMG.poster, pw = 664, ph = 996, px = 110, py = 42;
    g.save(); g.shadowColor = PINK; g.shadowBlur = 50; g.fillStyle = '#ffffff'; g.fillRect(px - 6, py - 6, pw + 12, ph + 12); g.shadowBlur = 0;
    if (img && img.complete && img.naturalWidth) { g.imageSmoothingEnabled = true; g.drawImage(img, px, py, pw, ph); }
    g.restore();
    g.strokeStyle = CYAN; g.lineWidth = 3; g.strokeRect(px - 16, py - 16, pw + 32, ph + 32);
    var LX = 1420;      // タイトルロゴの中心（左の月と龍にかからないよう、少し右寄せ）
    R.drawMagicCircleHi(g, LX, 560, 330, t * 0.004, 0.16);
    logo(g, LX, 300, 1.55);
    T(g, '交わる運命、ぶつかる色。', LX, 470, 46, '#ffffff', 'center', MIN, '#3a1470', 8);
    T(g, 'サイバーパンク 2D ドットアクション', LX, 524, 26, '#c8b8ff', 'center', UI, '#120a30', 5);
    blinkText(g, 'PRESS  ENTER  /  SPACE', LX, 640, 46);
    // 主人公の二人: 走る → 連続攻撃 → 遠距離攻撃 → また走る、をくり返す（titleHero）。二人は交互に技を見せる
    g.fillStyle = '#ffe2ff'; g.fillRect(920, 880, 900, 4); g.fillStyle = 'rgba(200,150,240,.5)'; g.fillRect(920, 884, 900, 4);
    titleHero(g, 'kurenai', 1180, t);
    titleHero(g, 'aoi', 1480, t - TH.cycle / 2);
    var rows = [['←→ / A D', '移動'], ['Space / W', 'ジャンプ（二段・壁でキック）'], ['J / Z', '攻撃（連打でコンボ）'], ['U / G', '遠距離攻撃（空中でも可）'], ['↓ + 攻撃', '斬り上げ / 空中で急降下'], ['L / Shift', 'ダッシュ（空中でも可）'], ['K / X', '特技（SP 消費）'], ['Q / E', 'キャラチェンジ'], ['F', '合体技「紅蒼交錯」'], ['J 長押し', 'チャージ攻撃（離すと大技）']];
    for (i = 0; i < rows.length; i++) {
      var cx = 930 + (i % 2) * 470, cy = 920 + (i >> 1) * 30;
      T(g, rows[i][0], cx + 150, cy, 24, '#7af3ff', 'right', UI, '#120a30', 5); T(g, rows[i][1], cx + 168, cy, 24, '#ffffff', 'left', UI, '#120a30', 5);
    }
    T(g, 'キャラクターデザイン：このみ　／　ゲームパッド対応（LB・RB で切り替え）　／　M：音のオン・オフ', 1900, 1070, 18, '#a898e8', 'right', UI);
  };
  R.drawMagicCircleHi = function (g, x, y, r, rot, alpha) {
    g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter'; g.lineWidth = 3; var i, a;
    for (i = 0; i < 4; i++) { g.globalAlpha = alpha; g.strokeStyle = i % 2 ? CYAN : PINK; g.beginPath(); g.arc(0, 0, r * (1 - i * 0.2), 0, PI * 2); g.stroke(); }
    g.rotate(rot);
    for (var s = 0; s < 2; s++) { g.strokeStyle = s ? CYAN : PINK; g.beginPath(); for (i = 0; i <= 3; i++) { a = i * PI * 2 / 3 + s * PI / 3; g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); } g.stroke(); }
    g.strokeStyle = '#ffffff'; for (i = 0; i < 6; i++) { a = i * PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
    g.restore();
  };

  // あらすじ: 龍にさらわれた姫を、二人が救いに行く（7 行目だけ大きく、桃色で出る）
  var STORY = ['紅い月が昇る夜。', '目覚めた《龍》が、玉龍の姫をさらっていった。', '', '「反逆者（REBELL）」と呼ばれる二人――', '大鎌を振るう 紅（くれない）。刀を閃かせる 蒼（あおい）。', '', '囚われの姫を、取り戻せ。', '二人は、龍の待つ玉龍学園へ走る。'];
  R.drawIntro = function (g) {
    var t = G.stateT, i;
    g.imageSmoothingEnabled = false; g.drawImage(R.BG.sky, 0, 0, 1920, 1080); g.globalAlpha = 0.85; g.drawImage(R.BG.far, -((t * 0.8) % 3840), 120, 3840, 1080); g.drawImage(R.BG.far, 3840 - ((t * 0.8) % 3840), 120, 3840, 1080); g.globalAlpha = 1;
    dim(g, 0.5);
    for (i = 0; i < STORY.length; i++) {
      var a = clamp((t - i * 50) / 40, 0, 1); if (a <= 0) continue;
      g.globalAlpha = a;
      var col = i === 6 ? '#ffd0ec' : '#ffffff';
      T(g, STORY[i], 960, 300 + i * 74 - (1 - a) * 12, i === 6 ? 54 : 40, col, 'center', MIN, '#1a0c40', 8);
    }
    g.globalAlpha = 1;
    if (t > 60) blinkText(g, 'ENTER でスキップ', 1700, 1040, 24);
  };
  R.introDone = function () { return G.stateT > STORY.length * 50 + 150; };

  R.drawPause = function (g) {
    dim(g, 0.62);
    T(g, 'PAUSE', 960, 270, 96, '#ffffff', 'center', SERIF, PINK, 10);
    helpPanel(g, 1);
    var rows = [['紅 / 蒼', '紅: 大鎌の重い大振り・ひるまない　蒼: 速い連撃・一発は軽い'], ['←→ / A D', '移動（逆を押すと切り返し）'], ['Space / W / ↑', 'ジャンプ　空中でもう一度押すと宙返り'], ['J / Z', '攻撃（押すたびにコンボ・締めの後は 1 段目へ戻って続く）'], ['つながる瞬間に押す', 'BEAT: 続くほど SP と交錯ゲージがたまりやすい（連打は MISS）'], ['攻撃を長押し', 'チャージ攻撃　離すと 紅: 紅月旋　蒼: 蒼月一閃（光ったら最大）'], ['↓ + 攻撃', '地上: 斬り上げて追いかける　空中: 急降下'],
      ['U / G', '遠距離　紅: 鎖鎌を投げて敵を引き寄せる　蒼: 飛ぶ斬撃を 3 連射'], ['空中で U / G', '紅: 鎌を打ち込んで叩きつける　蒼: 空中から撃つ（↓で斜め下）'],
      ['L / C / Shift', 'ダッシュ（空中は紅 1 回・蒼 2 回）　ぎりぎりでかわすとスロー'], ['ダッシュ中に攻撃', 'ダッシュ斬り'], ['攻撃が当たった後', 'ジャンプ・ダッシュで動きを打ち切れる'], ['Q / E', 'キャラチェンジ（斬り込みながら交代）'], ['攻撃を当てた直後に交代', 'チェイン: 登場攻撃が強くなる'], ['K / X', '特技（SP 30）　紅: 紅蓮砕　蒼: 蒼刃閃'], ['F / V', '合体技「紅蒼交錯」（ゲージ満タン）'], ['1 / 2　　M / B', '薬 / 結晶　　音 / 光のにじみ']];
    for (var i = 0; i < rows.length; i++) { T(g, rows[i][0], 800, 322 + i * 36, 27, i ? '#7af3ff' : '#ffe04a', 'right', UI, '#120a30', 6); T(g, rows[i][1], 828, 322 + i * 36, 27, '#ffffff', 'left', UI, '#120a30', 6); }
    blinkText(g, 'Esc / P で再開', 1560, 1010, 32);
  };
  R.drawGameOver = function (g) {
    var a = Math.min(1, G.stateT / 40); dim(g, 0.72 * a); g.globalAlpha = a;
    faceFrame(g, 'kurenai', 'sad', 636, 150, 300, 204, PINK, false, 'rgba(40,0,10,.25)'); faceFrame(g, 'aoi', 'sad', 984, 150, 300, 204, CYAN, false, 'rgba(40,0,10,.25)');
    T(g, 'GAME OVER', 960, 530, 130, '#ff5a6a', 'center', SERIF, '#2a0818', 12);
    T(g, '二人の色は、まだ消えていない。', 960, 620, 40, '#ffffff', 'center', MIN, '#2a0818', 8);
    g.globalAlpha = 1; if (G.stateT > 50) blinkText(g, 'ENTER でチェックポイントから再開', 960, 750, 38);
  };
  function stats(g, y) {
    var s = Math.floor(G.time / 60), rows = [['TIME', Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2)], ['MAX COMBO', G.maxCombo + ' HIT'], ['撃破数', G.kills], ['LEVEL', 'Lv.' + G.pl.lv]];
    for (var i = 0; i < rows.length; i++) { T(g, rows[i][0], 900, y + i * 56, 36, '#c8b8ff', 'right', UI, '#120a30', 6); T(g, String(rows[i][1]), 960, y + i * 56, 40, '#ffffff', 'left', UI, '#120a30', 6); }
  }
  R.drawClear = function (g) {
    var a = Math.min(1, G.stateT / 30); dim(g, 0.6 * a); g.globalAlpha = a;
    ['kurenai', 'aoi'].forEach(function (who, i) {      // 戦闘不能のままクリアした子は、笑顔にしない（HP は次のステージへ持ち越す）
      var down = G.pl.chars[who].down;
      portrait(g, who, 636 + i * 348, 96, 300, 204, !down, down);
    });
    T(g, 'STAGE CLEAR', 960, 430, 120, '#ffffff', 'center', SERIF, PINK, 12);
    g.fillStyle = CYAN; g.fillRect(480, 462, 960, 4);
    stats(g, 540);
    g.globalAlpha = 1; if (G.stateT > 60) blinkText(g, 'ENTER で次へ', 960, 800, 40);
  };
  R.drawEnding = function (g) {
    var t = G.stateT, a = Math.min(1, t / 60);
    var gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#0b0a26'); gr.addColorStop(1, '#3a1c66'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
    g.globalAlpha = 0.5 * a; pix(g, R.BG.sky, 0, 0, 1920, 1080); g.globalAlpha = a;
    R.drawMagicCircleHi(g, 1380, 540, 420, t * 0.003, 0.14);
    // 原画（このみさんのイラスト）
    var img = R.IMG.original, ph = 980, pw = img && img.naturalWidth ? ph * img.naturalWidth / img.naturalHeight : 693, px = 120, py = 50;
    g.save(); g.shadowColor = CYAN; g.shadowBlur = 44; g.fillStyle = '#ffffff'; g.fillRect(px - 8, py - 8, pw + 16, ph + 16); g.shadowBlur = 0;
    if (img && img.complete && img.naturalWidth) { g.imageSmoothingEnabled = true; g.drawImage(img, px, py, pw, ph); }
    g.restore();
    T(g, 'Original Illustration by このみ', px + pw / 2, py + ph + 40, 24, '#c8b8ff', 'center', SERIF);
    logo(g, 1380, 200, 1.2);
    T(g, '龍は倒れ、囚われの姫は解き放たれた。', 1380, 380, 40, '#ffd0ec', 'center', MIN, '#1a0c40', 8);
    T(g, '月は沈み、街に朝の色が戻る。', 1380, 440, 40, '#ffffff', 'center', MIN, '#1a0c40', 8);
    T(g, '――ふたりの反逆は、まだ始まったばかり。', 1380, 500, 34, '#ffffff', 'center', MIN, '#1a0c40', 8);
    g.save(); g.translate(420, 60); stats(g, 560); g.restore();
    T(g, 'キャラクターデザイン・原案　このみ', 1380, 850, 28, '#ffffff', 'center', UI, '#120a30', 6);
    T(g, 'ゲーム制作　Claude  ×  Codex', 1380, 892, 24, '#c8b8ff', 'center', UI, '#120a30', 5);
    T(g, 'THANK YOU FOR PLAYING', 1380, 950, 38, '#7af3ff', 'center', SERIF, '#120a30', 6);
    g.globalAlpha = 1; if (t > 120) blinkText(g, 'ENTER でタイトルへ', 1380, 1020, 30);
  };
})();

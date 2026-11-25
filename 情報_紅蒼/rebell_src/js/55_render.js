// ゲーム画面の描画。背景・敵・エフェクトは 480x270 のドット絵、主人公は用意されたスプライトを細かい解像度で重ねる
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, GY = R.GY, clamp = R.clamp, rand = R.rand, PI = Math.PI;
  var tintC = null, tintBig = null;
  var COL = {
    red: ['#ff2e88', '#ff8ad0', '#fff0fa'], blue: ['#1a9cff', '#6ae8ff', '#f0feff'], gold: ['#ff8a2a', '#ffd36a', '#ffffff'],
    purple: ['#7a2be0', '#c98bff', '#ffffff']      // 中ボスの蹴りの軌跡
  };

  function spr(g, c, x, y, face, ox, oy) {
    x = Math.round(x); y = Math.round(y);
    if (face < 0) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(c, -ox, -oy); g.restore(); }
    else g.drawImage(c, x - ox, y - oy);
  }
  // 主人公のコマを描く（回転 = 宙返り、sx・sy = 踏み切りと着地の伸び縮み、col = 単色で塗る）。
  // g は表示用のキャンバス。ゲームの 1 ドット単位で位置を決め、絵はその半分の細かさで置く
  //   br = 立ちポーズの呼吸 { knee, neck: 体を分ける高さ, d: 体の沈み, e: 頭の沈み }
  function charDraw(g, f, x, y, face, rot, sx, sy, col, br) {
    var k = R.CHAR_K, c = col ? R.tinted(f, col) : f.c;
    g.save(); g.translate(Math.round(x), Math.round(y));
    if (rot) { g.translate(0, -R.CHAR_MID); g.rotate(rot); g.translate(0, R.CHAR_MID); }
    g.scale(face * (sx || 1) * k, (sy || 1) * k);
    if (br && (br.d || br.e)) {
      // 絵を横に切って、上の部分を 1 ドットずつ下げる。下げた部分を後から重ねるので、継ぎ目はできない
      var kr = f.oy - br.knee, nr = f.oy - br.neck, w = f.w, h = f.h;
      if (br.d) {
        g.drawImage(c, 0, kr, w, h - kr, -f.ox, kr - f.oy, w, h - kr);                    // ひざから下はそのまま
        if (br.e) {
          g.drawImage(c, 0, nr, w, kr - nr, -f.ox, nr - f.oy + 1, w, kr - nr);            // 体は 1 ドット
          g.drawImage(c, 0, 0, w, nr, -f.ox, 2 - f.oy, w, nr);                            // 頭は 2 ドット
        } else g.drawImage(c, 0, 0, w, kr, -f.ox, 1 - f.oy, w, kr);                       // ひざから上を 1 ドット
      } else {
        g.drawImage(c, 0, nr, w, h - nr, -f.ox, nr - f.oy, w, h - nr);                    // 首から下はそのまま
        g.drawImage(c, 0, 0, w, nr, -f.ox, 1 - f.oy, w, nr);                              // 頭だけ 1 ドット
      }
    } else g.drawImage(c, -f.ox, -f.oy);
    g.restore();
  }
  // 交代の瞬間に走る、紅と蒼の交差する光
  function xflash(g, e, cam) {
    var u = e.t / e.life, x = Math.round(e.x - cam), y = Math.round(e.y), L = 74 * Math.min(1, u * 3.2), i, k;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u * u;
    for (i = 0; i < 2; i++) {
      var dx = i ? 1 : -1, C = COL[i ? 'blue' : 'red'];
      for (k = -L; k <= L; k++) {
        var w = Math.abs(k) < L * 0.3 ? 3 : (Math.abs(k) < L * 0.7 ? 2 : 1);
        g.fillStyle = Math.abs(k) < L * 0.35 ? C[2] : C[1];
        g.fillRect(Math.round(x + k * dx), Math.round(y - k * 0.55) - (w >> 1), 1, w);
      }
    }
    g.restore();
  }
  function white(c) {
    var big = c.width > 200;
    if (big) { if (!tintBig) tintBig = R.mk(c.width, c.height); return R.tint(c, '#ffffff', tintBig); }
    if (!tintC || tintC.width !== c.width || tintC.height !== c.height) tintC = R.mk(c.width, c.height);
    return R.tint(c, '#ffffff', tintC);
  }

  // 三日月形の斬撃。モックに合わせて横に広い楕円にし、白い芯・色のついた外側・尾を引く細い光の筋を重ねる
  function slash(g, e, cam) {
    var u = e.t / e.life, f = e.face, cx = e.x - cam, cy = e.y, SX = 1.32;
    var front = e.a0 + (e.a1 - e.a0) * R.ease(Math.min(1, u * 2.3)), back = e.a0 + (e.a1 - e.a0) * R.ease(Math.max(0, (u - 0.28) / 0.72));
    if (Math.abs(front - back) < 0.06) return;
    var C = COL[e.col], n = 18, layer, i, k, a, dir = front > back ? 1 : -1;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (layer = 0; layer < 3; layer++) {
      var rr = e.r - layer * 1.5, th = e.r * [0.5, 0.34, 0.17][layer] * (e.wd || 1);
      g.globalAlpha = (1 - u * u) * [0.55, 0.8, 1][layer];
      g.fillStyle = C[layer]; g.beginPath();
      for (i = 0; i <= n; i++) { k = i / n; a = back + (front - back) * k; g.lineTo(cx + Math.cos(a) * rr * SX * f, cy + Math.sin(a) * rr); }
      for (i = n; i >= 0; i--) { k = i / n; a = back + (front - back) * k; var t2 = th * Math.pow(k, 0.75) * (1 - Math.pow(k, 8) * 0.7); g.lineTo(cx + Math.cos(a) * (rr - t2) * SX * f, cy + Math.sin(a) * (rr - t2)); }
      g.closePath(); g.fill();
    }
    // 尾を引く細い光の筋（点線）
    var streak = [[1.07, 0.6, 0], [0.96, 0.85, 1], [0.8, 0.6, 0], [0.64, 0.4, 1], [1.16, 0.35, 1]];
    g.globalAlpha = (1 - u) * 0.9;
    for (i = 0; i < streak.length; i++) {
      var r2 = e.r * streak[i][0], a0 = back - dir * (0.55 - i * 0.07), a1 = back + (front - back) * streak[i][1], step = 1.4 / r2, cnt = 0;
      g.fillStyle = C[streak[i][2]];
      for (a = a0; dir > 0 ? a < a1 : a > a1; a += dir * step, cnt++) {
        if (cnt % 9 > 6) continue;
        g.fillRect(Math.round(cx + Math.cos(a) * r2 * SX * f), Math.round(cy + Math.sin(a) * r2), 1, 1);
      }
    }
    g.restore();
  }  function thrust(g, e, cam) {
    var u = e.t / e.life, C = COL[e.col], x0 = e.x - cam, len = e.len * Math.min(1, u * 3), f = e.face;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u * u;
    var xa = f > 0 ? x0 : x0 - len;
    g.fillStyle = C[0]; g.fillRect(Math.round(xa), Math.round(e.y - 3), Math.round(len), 6);
    g.fillStyle = C[1]; g.fillRect(Math.round(xa + (f > 0 ? len * 0.15 : 0)), Math.round(e.y - 2), Math.round(len * 0.85), 4);
    g.fillStyle = C[2]; g.fillRect(Math.round(xa + (f > 0 ? len * 0.4 : 0)), Math.round(e.y - 1), Math.round(len * 0.6), 2);
    g.restore();
  }
  // ヒットの火花。長い光条が何本も出る星形（モックの橙と白の閃光）
  function spark(g, e, cam) {
    var u = e.t / e.life, C = COL[e.col] || COL.gold, x = Math.round(e.x - cam), y = Math.round(e.y), s = e.size * (0.55 + u * 1.0), i, k;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u * u;
    for (i = 0; i < 12; i++) {
      var a = i * PI / 6 + (e.size % 5) * 0.13 + ((e.x | 0) % 7) * 0.09, L = s * [1.7, 0.55, 1.0, 0.6][i % 4], dx = Math.cos(a), dy = Math.sin(a);
      for (k = 2; k < L; k++) {
        g.fillStyle = k < L * 0.45 ? C[2] : (k < L * 0.75 ? C[1] : C[0]);
        var w = k < L * 0.3 ? 2 : 1; g.fillRect(Math.round(x + dx * k), Math.round(y + dy * k), w, w);
      }
    }
    g.fillStyle = C[2]; var c = Math.max(1, Math.round(s * 0.3 * (1 - u)));
    g.fillRect(x - c, y - c, c * 2 + 1, c * 2 + 1); g.fillRect(x - c - 2, y - 1, c * 2 + 5, 3); g.fillRect(x - 1, y - c - 2, 3, c * 2 + 5);
    g.restore();
  }  function ring(g, e, cam) {
    var u = e.t / e.life, r = e.r * R.ease(u);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - u) * 0.9; g.strokeStyle = e.col; g.lineWidth = Math.max(1, 3 * (1 - u));
    g.beginPath(); g.ellipse(e.x - cam, e.y, r, e.flat ? r * 0.3 : r, 0, 0, PI * 2); g.stroke(); g.restore();
  }
  function boom(g, e, cam) {
    var u = e.t / e.life, r = e.r * (0.3 + 0.7 * R.ease(u)), x = e.x - cam;
    g.save(); g.globalCompositeOperation = 'lighter';
    var cols = ['#ff3a6c', '#ff9a3a', '#fff3b0'];
    for (var i = 0; i < 3; i++) { g.globalAlpha = (1 - u) * (0.5 + i * 0.2); g.fillStyle = cols[i]; g.beginPath(); g.arc(x, e.y, r * (1 - u * 0.4) * (1 - i * 0.28), 0, PI * 2); g.fill(); }
    g.globalAlpha = (1 - u) * 0.8; g.strokeStyle = '#ff7ad1'; g.lineWidth = 2; g.beginPath(); g.arc(x, e.y, r, 0, PI * 2); g.stroke();
    g.restore();
  }
  function quake(g, e, cam) {      // 紅蓮砕: 地面から突き上がる光の牙
    g.save(); g.globalCompositeOperation = 'lighter';
    for (var k = 1; k <= (e.n || 5); k++) {
      var t = e.t - k * 3; if (t < 0 || t > 16) continue;
      var u = t / 16, h = (44 - k * 5) * Math.sin(Math.min(1, u * 2.2) * PI / 2) * (1 - u * 0.3);
      for (var s = -1; s <= 1; s += 2) {
        var x = e.x - cam + s * k * 20;
        g.globalAlpha = 1 - u;
        g.fillStyle = '#ff2e88'; g.beginPath(); g.moveTo(x - 7, e.y); g.lineTo(x + s * 3, e.y - h); g.lineTo(x + 7, e.y); g.fill();
        g.fillStyle = '#ffd0ec'; g.beginPath(); g.moveTo(x - 3, e.y); g.lineTo(x + s * 2, e.y - h * 0.75); g.lineTo(x + 3, e.y); g.fill();
      }
    }
    g.restore();
  }
  function crack(g, e, cam) {
    var u = e.t / e.life, x = Math.round(e.x - cam);
    g.save(); g.globalAlpha = 1 - u; g.fillStyle = '#ffd0ec';
    for (var i = -3; i <= 3; i++) g.fillRect(x + i * 5, e.y - 1 - (3 - Math.abs(i)) * Math.round(3 * (1 - u)), 2, 2 + (3 - Math.abs(i)));
    g.restore();
  }
  // 魔法陣（原画・ポスター中央の紋）
  function circle(g, x, y, r, rot, alpha) {
    if (r < 2) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.lineWidth = 1;
    var i, a;
    for (i = 0; i < 4; i++) { g.globalAlpha = alpha * (i % 2 ? 0.9 : 0.7); g.strokeStyle = i % 2 ? '#37e6ff' : '#ff4fb0'; g.beginPath(); g.arc(0, 0, r * (1 - i * 0.2), 0, PI * 2); g.stroke(); }
    g.rotate(rot);
    for (var s = 0; s < 2; s++) {
      g.strokeStyle = s ? '#7af3ff' : '#ff7ad1'; g.globalAlpha = alpha; g.beginPath();
      for (i = 0; i <= 3; i++) { a = i * PI * 2 / 3 + s * PI / 3; g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); }
      g.stroke();
    }
    g.strokeStyle = '#ffffff'; g.globalAlpha = alpha * 0.8;
    for (i = 0; i < 6; i++) { a = i * PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
    g.rotate(-rot * 2.3);
    for (i = 0; i < 12; i++) { a = i * PI / 6; g.fillStyle = i % 2 ? '#37e6ff' : '#ff4fb0'; g.fillRect(Math.round(Math.cos(a) * r * 1.08) - 1, Math.round(Math.sin(a) * r * 1.08) - 1, 2, 2); }
    g.restore();
  }
  R.drawMagicCircle = circle;

  function drawEnemy(g, e, cam) {
    var S, an, fr, c, x = e.x - cam;
    if (e.draw) { e.draw(g, e, cam); return; }      // 龍（35_dragon.js）、中ボスと写し身（52_karate.js）は、自分で描く
    if (e.type === 'drone') {
      S = R.SPR.drone; c = S.fly.frames[(e.animT >> 3) % 2];
      if (e.flash > 0 || (e.aim > 0 && (e.aim >> 2) % 2)) c = white(c);
      spr(g, c, x, e.y, e.face, S.ox, S.oy);
      if (e.aim > 0) { g.fillStyle = '#ff3048'; g.fillRect(Math.round(x) - 1, Math.round(e.y) - 18, 2, 5); g.fillRect(Math.round(x) - 1, Math.round(e.y) - 12, 2, 2); }
      return;
    }
    S = e.type === 'guard' ? R.SPR.guard : R.SPR.robot;
    var t = e.stT, warn = false;
    if (e.st === 'walk') { an = 'walk'; fr = Math.floor(e.animT / 7) % 6; }
    else if (e.st === 'attack') { an = 'attack'; fr = t < 12 ? 0 : t < 24 ? 1 : t < 30 ? 2 : t < 42 ? 3 : 4; warn = t < 24; }
    else if (e.st === 'punch') { an = 'attack'; fr = t < 13 ? 0 : t < 26 ? 1 : t < 32 ? 2 : t < 46 ? 3 : 4; warn = t < 26; }
    else if (e.st === 'slam') { an = 'slam'; fr = t < 18 ? 0 : t < 36 ? 1 : t < 42 ? 2 : t < 58 ? 3 : 4; warn = t < 36; }
    else if (e.st === 'charge') { if (t < 34) { an = 'attack'; fr = 1; warn = true; } else if (t < 80) { an = 'walk'; fr = Math.floor(t / 3) % 6; } else { an = 'walk'; fr = 0; } }
    else if (e.st === 'hurt') { an = 'hurt'; fr = 0; }
    else { an = 'walk'; fr = 0; }
    c = S[an].frames[fr];
    if (e.flash > 0 && (e.flash >> 1) % 2 === 0) c = white(c);
    spr(g, c, x, e.y, e.face, S.ox, S.oy);
    if (warn && (G.t >> 2) % 2) { var hx = Math.round(x), hy = Math.round(e.y - e.h - 16); g.fillStyle = '#ff3048'; g.fillRect(hx - 1, hy, 3, 7); g.fillRect(hx - 1, hy + 9, 3, 3); g.fillStyle = '#ffd0d6'; g.fillRect(hx, hy + 1, 1, 5); }
  }
  function drawShot(g, s, cam) {
    var x = Math.round(s.x - cam), y = Math.round(s.y), I = R.SPR.items, i;
    if (s.draw) { s.draw(g, s, cam); return; }      // 中ボスの技（衝撃波・地裂の牙）
    if (s.type === 'bullet') g.drawImage(I.bullet, x - 4, y - 4);
    else if (s.type === 'fireball') g.drawImage(I.fireball, x - 8, y - 8);
    else if (s.type === 'flame') {
      var u = s.t / s.life, r = Math.max(2, Math.round(s.r));
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - u) * 0.75;
      g.fillStyle = u < 0.25 ? '#fff3b0' : u < 0.55 ? '#ff9a3a' : '#ff3a6c';
      g.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); g.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
      g.restore();
    } else if (s.type === 'shock') {
      g.save(); g.globalCompositeOperation = 'lighter';
      var d = s.vx > 0 ? 1 : -1;
      for (i = 0; i < 5; i++) {
        var hh = s.h * (1 - i * 0.18) * (0.85 + 0.15 * Math.sin(s.t * 0.8 + i));
        g.fillStyle = ['#ffffff', '#ffd0ec', '#ff7ad1', '#ff2e88', '#a81868'][i];
        g.fillRect(x - d * i * 4 - 2, Math.round(y - hh), 4, Math.round(hh));
      }
      g.restore();
    } else if (s.type === 'pillar') {
      g.save();
      if (s.t < s.warn) {
        if ((s.t >> 2) % 2) { g.fillStyle = '#ff3048'; g.fillRect(x - 13, y - 1, 26, 2); g.fillRect(x - 9, y - 3, 18, 1); }
        g.globalAlpha = 0.35 + 0.3 * (s.t / s.warn); g.fillStyle = '#ff5a6a'; g.fillRect(x, y - 150, 1, 150);
      } else {
        var k = s.t > s.life - 12 ? (s.life - s.t) / 12 : Math.min(1, (s.t - s.warn) / 5);
        g.globalCompositeOperation = 'lighter';
        for (var yy = 0; yy < 200; yy += 3) {
          var w = (13 + Math.sin(yy * 0.2 + s.t * 0.9) * 3) * k;
          g.fillStyle = '#ff2e60'; g.fillRect(Math.round(x - w), y - yy - 3, Math.round(w * 2), 3);
          g.fillStyle = '#ff9a3a'; g.fillRect(Math.round(x - w * 0.6), y - yy - 3, Math.round(w * 1.2), 3);
          g.fillStyle = '#fff3b0'; g.fillRect(Math.round(x - w * 0.25), y - yy - 3, Math.round(w * 0.5), 3);
        }
      }
      g.restore();
    }
  }

  // 蒼の飛ぶ斬撃（三日月の刃）。進む向きへ弓なりにふくらみ、後ろへ細い光の尾を引く
  function wave(g, s, cam) {
    var C = COL.blue, r = s.r * (s.t < 3 ? 0.55 + s.t * 0.15 : 1), fade = Math.min(1, (s.life - s.t) / 6), n = 10, layer, i, a, th;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.translate(Math.round(s.x - cam), Math.round(s.y)); g.rotate(Math.atan2(s.vy, s.vx));
    for (layer = 0; layer < 3; layer++) {
      var rr = r - layer * 1.3;
      g.globalAlpha = fade * [0.55, 0.85, 1][layer]; g.fillStyle = C[layer]; g.beginPath();
      for (i = 0; i <= n; i++) { a = -1.2 + 2.4 * i / n; g.lineTo(-rr * 0.5 + Math.cos(a) * rr, Math.sin(a) * rr * 1.08); }                                  // 外側の弧
      for (i = n; i >= 0; i--) {                                                                                                                         // 内側の弧（まん中が太く、両端がとがる）
        a = -1.2 + 2.4 * i / n; th = r * [0.62, 0.42, 0.2][layer] * (1 - Math.pow(Math.abs(i / n - 0.5) * 2, 2));
        g.lineTo(-rr * 0.5 + Math.cos(a) * (rr - th), Math.sin(a) * rr * 1.08);
      }
      g.closePath(); g.fill();
    }
    g.globalAlpha = fade * 0.75;
    g.fillStyle = C[1]; g.fillRect(Math.round(-r * 2.1), -1, Math.round(r * 1.5), 1);
    g.fillStyle = C[0]; g.fillRect(Math.round(-r * 2.9), Math.round(r * 0.35), Math.round(r * 1.3), 1); g.fillRect(Math.round(-r * 2.5), Math.round(-r * 0.45), Math.round(r * 1.1), 1);
    g.restore();
  }
  // 紅の鎖鎌。手元から伸びる鎖（明るい輪と暗い輪が交互）と、その先で回る鎌
  function kusariDraw(g, v, cam) {
    var x0 = v.x0 - cam, y0 = v.y0, x1 = v.x1 - cam, y1 = v.y1, dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy), n = Math.max(1, Math.floor(d / 3.5)), C = COL.red, i, a, layer;
    g.save();
    for (i = 1; i < n; i++) {
      var px = Math.round(x0 + dx * i / n), py = Math.round(y0 + dy * i / n);
      g.fillStyle = i % 2 ? '#ffe3f3' : '#c2408e'; g.fillRect(px - 1, py - 1, 2, 2);
    }
    g.translate(Math.round(x1), Math.round(y1)); g.rotate(v.spin);
    // 柄
    g.fillStyle = '#ffd36a'; g.fillRect(-11, -1, 15, 2); g.fillStyle = '#fff3b0'; g.fillRect(-11, -1, 15, 1);
    // 刃: 三日月（外側の弧と、少しずらした内側の弧）
    g.globalCompositeOperation = 'lighter';
    for (layer = 0; layer < 3; layer++) {
      var R0 = 15.5 - layer * 1.5, th = [6.6, 4.5, 2.1][layer];
      g.globalAlpha = v.stuck ? 0.9 : [0.7, 0.9, 1][layer]; g.fillStyle = C[layer]; g.beginPath();
      for (i = 0; i <= 12; i++) { a = -2.0 + 3.1 * i / 12; g.lineTo(2 + Math.cos(a) * R0, Math.sin(a) * R0); }
      for (i = 12; i >= 0; i--) { a = -2.0 + 3.1 * i / 12; var t2 = th * Math.sin(Math.PI * Math.min(1, i / 12 * 1.15)); g.lineTo(2 + Math.cos(a) * (R0 - t2), Math.sin(a) * (R0 - t2)); }
      g.closePath(); g.fill();
    }
    if (!v.stuck) {      // 回っている間は、うすい円の残像
      g.globalAlpha = 0.28; g.strokeStyle = C[1]; g.lineWidth = 2; g.beginPath(); g.arc(2, 0, 14, v.spin * 0.5, v.spin * 0.5 + 4.2); g.stroke();
    }
    g.restore();
  }

  // 縦のステージの仕掛け（上昇気流・崩れる足場・レーザー柵・鎖の楔）。fg は世界の y に合わせて平行移動済み
  function towerGimmicks(fg) {
    var i, f, c, L, r, x, y, k, t = G.t, vis = function (yy, m) { return yy + oy > -m && yy + oy < R.H + m; };
    // 上昇気流: 下に送風口、範囲の中を光の筋が昇っていく
    for (i = 0; i < (G.fans || []).length; i++) {
      f = G.fans[i]; if (!vis(f.y, f.h + 20) && !vis(f.y + f.h, 20)) continue;
      x = Math.round(f.x - cam); y = Math.round(f.y);
      fg.globalAlpha = 0.10; fg.fillStyle = '#7af3ff'; fg.fillRect(x, y, f.w, f.h);
      fg.globalAlpha = 0.5;
      for (k = 0; k < f.w / 8; k++) {
        var sy = f.h - ((t * 2.2 + k * 37) % f.h), sx = x + 4 + ((k * 23) % Math.max(1, f.w - 8));
        fg.fillStyle = k % 2 ? '#c0f8ff' : '#37e6ff'; fg.fillRect(sx, y + sy, 1, 7);
      }
      fg.globalAlpha = 1;
      fg.fillStyle = '#24213f'; fg.fillRect(x - 2, y + f.h, f.w + 4, 6); fg.fillStyle = '#655e9e'; fg.fillRect(x - 2, y + f.h, f.w + 4, 1);
      for (k = 0; k < f.w; k += 6) { fg.fillStyle = (t >> 1) % 2 ? '#37e6ff' : '#1aa6c8'; fg.fillRect(x + k + 1, y + f.h + 2, 3, 2); }
    }
    // 崩れる足場: 茶色のひび割れた板。乗ると震え、崩れたあとは点線の跡（戻ってくる場所）
    for (i = 0; i < (G.crumbles || []).length; i++) {
      c = G.crumbles[i]; if (!vis(c.y, 20)) continue;
      x = Math.round(c.x - cam); y = Math.round(c.y);
      if (c.gone > 0) { if ((t >> 3) % 2) { fg.fillStyle = 'rgba(255,200,120,.35)'; for (k = 0; k < c.w; k += 6) fg.fillRect(x + k, y, 3, 1); } continue; }
      if (c.t > 0) x += (t % 4 < 2 ? 1 : -1) * (c.t > 14 ? 2 : 1);
      fg.fillStyle = '#5a3a22'; fg.fillRect(x, y, c.w, 7);
      fg.fillStyle = '#c89060'; fg.fillRect(x, y, c.w, 1); fg.fillStyle = '#8a6040'; fg.fillRect(x, y + 1, c.w, 2);
      fg.fillStyle = '#2a1a10'; for (k = 7; k < c.w - 3; k += 11) { fg.fillRect(x + k, y + 1, 1, 3); fg.fillRect(x + k + 1, y + 3, 1, 3); }
      if (c.t > 0) { fg.fillStyle = '#ffd36a'; fg.fillRect(x + (c.t * 3) % c.w, y + 7, 2, 2); }
    }
    // レーザー柵: 両端に発振器。点く前は細い線が点滅して予告
    for (i = 0; i < (G.lasers || []).length; i++) {
      L = G.lasers[i]; if (!vis(L.y, 20)) continue;
      x = Math.round(L.x - cam); y = Math.round(L.y);
      if (L.on) {
        fg.globalAlpha = 0.35; fg.fillStyle = '#ff2e88'; fg.fillRect(x, y - 3, L.w, 6);
        fg.globalAlpha = 1; fg.fillStyle = '#ff7ad1'; fg.fillRect(x, y - 1, L.w, 2); fg.fillStyle = '#ffffff'; fg.fillRect(x, y, L.w, 1);
      } else if (L.warn && (t >> 2) % 2) { fg.fillStyle = 'rgba(255,90,170,.7)'; for (k = 0; k < L.w; k += 4) fg.fillRect(x + k, y, 2, 1); }
      [x - 5, x + L.w].forEach(function (ex) { fg.fillStyle = '#24213f'; fg.fillRect(ex, y - 5, 5, 10); fg.fillStyle = L.on || L.warn ? '#ff4fb0' : '#655e9e'; fg.fillRect(ex + 1, y - 2, 3, 4); });
    }
    // 鎖の楔: 金色の輪。紅がいま鎖鎌を投げれば届く楔は、明るく脈打つ
    var aim = G.pl && G.pl.who === 'kurenai' && R.ringFor ? R.ringFor() : null;
    for (i = 0; i < (G.rings || []).length; i++) {
      r = G.rings[i]; x = Math.round(r.x - cam); y = Math.round(r.y);
      if (!vis(r.y, 20)) {      // 画面の上の外にある楔: 紅なら、上端に小さな印を出す
        if (G.pl && G.pl.who === 'kurenai' && r.y + oy < 0 && r.y + oy > -140) { var my = -oy + 3; fg.fillStyle = (t >> 3) % 2 ? '#ffd36a' : '#c07818'; fg.beginPath(); fg.moveTo(x, my); fg.lineTo(x + 5, my + 6); fg.lineTo(x - 5, my + 6); fg.fill(); }
        continue;
      }
      var hot = r === aim, pr = hot ? 1 + 0.5 * Math.abs(Math.sin(t * 0.2)) : 0;
      fg.globalAlpha = hot ? 0.4 : 0.16 + 0.08 * Math.sin(t * 0.08 + i); fg.fillStyle = '#ffd36a'; fg.beginPath(); fg.arc(x + 0.5, y + 0.5, hot ? 12 + pr * 3 : 11, 0, Math.PI * 2); fg.fill(); fg.globalAlpha = 1;
      fg.strokeStyle = '#7a4a18'; fg.lineWidth = 3.5; fg.beginPath(); fg.arc(x + 0.5, y + 0.5, 8, 0, Math.PI * 2); fg.stroke();
      fg.strokeStyle = hot ? '#fff3b0' : '#ffc83e'; fg.lineWidth = 2; fg.beginPath(); fg.arc(x + 0.5, y + 0.5, 8, 0, Math.PI * 2); fg.stroke();
      fg.fillStyle = '#3d3684'; fg.fillRect(x - 1, y - 12, 2, 6);      // 楔を吊る金具
    }
  }

  // ---- 1 フレームの描画。奥から順に 4 回に分けて呼ぶ ----
  var cam = 0, oy = 0;      // いまのカメラ位置と、画面ゆれの縦ずれ

  // (1) 背景。bg = 480x270 の背景用キャンバス
  R.renderBack = function (bg) {
    var S = G.S, sh = G.cam.shake;
    cam = Math.round(clamp(G.cam.x + (sh > 0.4 ? rand(-1, 1) * sh : 0), 0, S.len - R.W)); oy = (sh > 0.4 ? Math.round(rand(-1, 1) * sh * 0.5) : 0) + Math.round(G.cam.y || 0);      // 画面ゆれ + 高い所でのカメラの上向き
    R.viewCam = cam; R.viewOy = oy;
    R.drawBackdrop(bg, S, cam, G.t, G.rage, oy);
    if (S.vertical) {      // 縦のステージ: 地形の絵は縦に長い。画面の上端に映る世界の y は -oy
      bg.drawImage(S.layer, cam, clamp(-oy - S.top, 0, S.layer.height - R.H), R.W, R.H, 0, 0, R.W, R.H);
    } else bg.drawImage(S.layer, cam, 0, R.W, R.H, 0, oy, R.W, R.H);
    if (R.Cyber) R.Cyber.near(bg, S, cam, G.t, oy);      // ネオンの霧・蒸気・雲（14_cyber.js）
    if (G.slow > 0) { bg.fillStyle = 'rgba(40,70,220,' + (0.24 * Math.min(1, G.slow / 12)) + ')'; bg.fillRect(0, 0, R.W, R.H); }      // ジャスト回避のスロー中は青く沈む
    var X = G.cross;
    if (X) {
      var da = Math.min(1, X.t / 20) * (X.t > 100 ? (118 - X.t) / 18 : 1);
      bg.fillStyle = 'rgba(8,2,30,' + (0.68 * da) + ')'; bg.fillRect(0, 0, R.W, R.H);
      circle(bg, X.x - cam, X.y - 30, 78 * R.ease(Math.min(1, X.t / 26)) * (X.t > 96 ? 1 + (X.t - 96) * 0.06 : 1), X.t * 0.04, da);
      circle(bg, X.x - cam, X.y - 30, 40 * R.ease(Math.min(1, X.t / 30)), -X.t * 0.07, da * 0.8);
    }
  };

  // (2) 主人公の後ろに描くもの（端末・アイテム・敵）。fg = 480x270 の透明なキャンバス
  R.renderMid = function (fg) {
    var I = R.SPR.items, i, e;
    fg.clearRect(0, 0, R.W, R.H); fg.imageSmoothingEnabled = false;
    fg.save(); fg.translate(0, oy);
    // 端末
    for (i = 0; i < G.terminals.length; i++) { var tm = G.terminals[i], ty = tm.y; fg.drawImage(I.terminal[tm.on ? ((G.t >> 4) % 2) : 0], Math.round(tm.x - cam - 17), ty - 56); if (!tm.on && (G.t >> 4) % 2) { fg.fillStyle = '#7af3ff'; fg.fillRect(Math.round(tm.x - cam) - 1, ty - 66, 2, 5); fg.fillRect(Math.round(tm.x - cam) - 3, ty - 62, 6, 1); } }
    if (G.S.vertical) towerGimmicks(fg);
    // 縦のステージのてっぺん: 航空灯が明滅する
    if (G.S.vertical && (G.t >> 5) % 2 === 0) { var gl = G.S.goal; fg.globalAlpha = 0.5; fg.fillStyle = '#ff2e48'; fg.fillRect(gl[0] + gl[2] / 2 - 9 - cam, gl[1] - 162, 18, 18); fg.globalAlpha = 1; }
    // 動く足場（水色に光る板。下に噴射の光）
    var MV = G.movers || [], SPG = G.springs || [], mx, my, k;
    for (i = 0; i < MV.length; i++) {
      mx = Math.round(MV[i].x - cam); my = Math.round(MV[i].y); k = MV[i].w;
      if (mx > R.W + 10 || mx + k < -10) continue;
      fg.fillStyle = '#2f2b55'; fg.fillRect(mx, my, k, 7);
      fg.fillStyle = '#7af3ff'; fg.fillRect(mx, my, k, 1); fg.fillStyle = '#37e6ff'; fg.fillRect(mx, my + 1, k, 1);
      fg.fillStyle = '#655e9e'; fg.fillRect(mx + 1, my + 2, k - 2, 3);
      fg.fillStyle = '#ff7ad1'; fg.fillRect(mx + 3, my + 4, 2, 1); fg.fillRect(mx + k - 5, my + 4, 2, 1);
      fg.fillStyle = (G.t >> 2) % 2 ? '#7af3ff' : '#37e6ff'; fg.fillRect(mx + 5, my + 7, 3, 2 + (G.t >> 2) % 2); fg.fillRect(mx + k - 8, my + 7, 3, 2 + (G.t >> 2) % 2);
    }
    // バネ（黄色い台。踏むと縮んで跳ね上げる）
    for (i = 0; i < SPG.length; i++) {
      mx = Math.round(SPG[i].x - cam); my = Math.round(SPG[i].y); k = SPG[i].t > 6 ? 3 : SPG[i].t > 0 ? 9 : 6;      // 台の高さ
      if (mx > R.W + 12 || mx < -12) continue;
      fg.fillStyle = '#24213f'; fg.fillRect(mx - 8, my - 2, 16, 2);
      fg.fillStyle = '#b49cff'; fg.fillRect(mx - 3, my - k, 2, k - 1); fg.fillRect(mx + 1, my - k, 2, k - 1);
      fg.fillStyle = '#c07818'; fg.fillRect(mx - 8, my - k - 3, 16, 3); fg.fillStyle = '#ffd36a'; fg.fillRect(mx - 8, my - k - 3, 16, 2); fg.fillStyle = '#fff3b0'; fg.fillRect(mx - 7, my - k - 3, 14, 1);
      if ((G.t + i * 9) % 50 < 8) { fg.fillStyle = '#ffffff'; fg.fillRect(mx - 1, my - k - 9 - ((G.t + i * 9) % 50 >> 1), 2, 3); }
    }
    // アイテム
    for (i = 0; i < G.items.length; i++) {
      var it = G.items[i], ix = Math.round(it.x - cam);
      if (ix < -30 || ix > R.W + 30) continue;
      if (it.type === 'crystal') { var bob = it.loose ? 0 : Math.round(Math.sin((G.t + it.x) * 0.07) * 3); fg.drawImage(I.crystal[(G.t >> 3) % 4], ix - 7, Math.round(it.y) - 9 + bob); if ((G.t + (it.x | 0)) % 40 < 6) { fg.fillStyle = '#ffffff'; fg.fillRect(ix + 5, Math.round(it.y) - 10 + bob, 1, 5); fg.fillRect(ix + 3, Math.round(it.y) - 8 + bob, 5, 1); } }
      else if (it.type === 'potion') fg.drawImage(I.potion, ix - 6, Math.round(it.y) - 8 + (it.loose ? 0 : Math.round(Math.sin((G.t + it.x) * 0.07) * 2)));
      else if (it.type === 'chest') fg.drawImage(I.chest[it.open ? 1 : 0], ix - 13, Math.round(it.y) - 22);
    }
    // 敵
    for (i = 0; i < G.enemies.length; i++) { e = G.enemies[i]; if (!e.dead && e.x > cam - 260 && e.x < cam + R.W + 200) drawEnemy(fg, e, cam); }
    // 斬撃の弧・突きの線・輪・魔法陣（主人公の絵を隠さないよう、後ろに描く）
    for (i = 0; i < G.fx.length; i++) {
      e = G.fx[i];
      if (e.type === 'slash') slash(fg, e, cam); else if (e.type === 'thrust') thrust(fg, e, cam); else if (e.type === 'ring') ring(fg, e, cam);
      else if (e.type === 'circle') circle(fg, e.x - cam, e.y, e.r * (0.4 + 0.6 * R.ease(Math.min(1, e.t / (e.life * 0.5)))), e.t * 0.12, 1 - e.t / e.life);
    }
    fg.restore();
  };

  // (3) 主人公（残像・合体技の相棒・プレイヤー・スプライトのエフェクト）。
  //     g = 表示用のキャンバス、S = ゲームの 1 ドットを何ピクセルで表示しているか
  R.renderChars = function (g, S) {
    var p = G.pl, X = G.cross, i, e, f;
    g.save(); g.setTransform(S, 0, 0, S, 0, oy * S);
    g.imageSmoothingEnabled = (S === 3); if (S === 3) g.imageSmoothingQuality = 'high';      // 1.5 倍だけは、にじませたほうがドットがそろって見える
    if (G.state === 'talk') { R.talkChars(g, cam, charDraw); g.restore(); return; }          // 会話シーンでは、二人の立ち姿を並べる（65_talk.js）
    // 残像（交代で跳び去る相棒は、元の色のまま薄れていく）
    for (i = 0; i < G.ghosts.length; i++) {
      var gh = G.ghosts[i], gu = gh.t / gh.life;
      if (gh.leave) { g.globalAlpha = 0.95 * (1 - gu * gu); charDraw(g, gh.f, gh.x - cam, gh.y, gh.face, 0, 1, 1); }
      g.globalAlpha = (gh.leave ? 0.45 * gu : (gh.faint ? 0.26 : 0.5)) * (1 - gu);
      charDraw(g, gh.f, gh.x - cam, gh.y, gh.face, gh.rot || 0, 1, 1, gh.who === 'aoi' ? '#5ad8ff' : '#ff6ac8');
    }
    g.globalAlpha = 1;
    // 合体技中の相棒
    if (X) {
      var o = p.who === 'kurenai' ? 'aoi' : 'kurenai';
      var ox = X.x + X.face * (X.t < 34 ? 56 : 56 - Math.min(1, (X.t - 34) / 14) * 112);
      g.globalAlpha = Math.min(1, X.t / 12) * (X.t > 104 ? (118 - X.t) / 14 : 1);
      charDraw(g, R.crossFrame(o, X.t), ox - cam, X.y, X.t < 48 ? -X.face : X.face, 0, 1, 1);
      g.globalAlpha = 1;
    }
    // プレイヤー
    f = R.curFrame(p);
    var st = R.curStand, br = null;
    if (st && G.state !== 'pause') { var bb = R.breath(st, p.animT); br = { knee: st.knee, neck: st.neck, d: bb[0], e: bb[1] }; }
    else if (st) br = R.lastBreath || null;      // ポーズ中は、止めた瞬間の姿のまま
    R.lastBreath = br;
    var blink = p.inv > 0 && p.st !== 'dash' && p.st !== 'special' && p.st !== 'cross' && !X && (G.t >> 1) % 2 === 0 && p.inv < 70 && G.state === 'play';
    if (!blink) {
      var psx = 1, psy = 1;
      if (p.landT > 0 && p.ground && p.st === 'free') { psy = 1 - 0.1 * p.landT / 7; psx = 1 + 0.08 * p.landT / 7; }      // 着地でつぶれる
      else if (p.stretchT > 0 && p.st === 'free') { psy = 1 + 0.1 * p.stretchT / 6; psx = 1 - 0.07 * p.stretchT / 6; }     // 踏み切りで伸びる
      charDraw(g, f, p.x - cam, p.y, p.face, R.flipRot(p), psx, psy, p.hurtFlash > 0 && G.state === 'play' ? '#ffffff' : null, br);
    }
    // スプライトのコマを使ったエフェクト（合体技のとどめの光の柱）
    for (i = 0; i < G.fx.length; i++) {
      e = G.fx[i]; if (e.type !== 'sprfx') continue;
      var u = e.t / e.life;
      g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      charDraw(g, R.frame(e.who, e.group, u < 0.3 ? e.i0 : e.i1), e.x - cam, e.y, 1, 0, 1, 1);
    }
    g.restore();
  };

  // (4) 主人公の手前に描くもの（弾・火花や爆発・粒）
  R.renderFront = function (fg) {
    var i, e;
    fg.clearRect(0, 0, R.W, R.H); fg.imageSmoothingEnabled = false;
    fg.save(); fg.translate(0, oy);
    for (i = 0; i < G.shots.length; i++) drawShot(fg, G.shots[i], cam);
    for (i = 0; i < G.pshots.length; i++) wave(fg, G.pshots[i], cam);      // 蒼の飛ぶ斬撃
    var kv = G.pl && G.state !== 'talk' ? R.kusariView() : null;            // 紅の鎖鎌
    if (kv) kusariDraw(fg, kv, cam);
    for (i = 0; i < G.fx.length; i++) {
      e = G.fx[i];
      if (e.type === 'spark') spark(fg, e, cam); else if (e.type === 'boom') boom(fg, e, cam); else if (e.type === 'quake') quake(fg, e, cam);
      else if (e.type === 'crack') crack(fg, e, cam); else if (e.type === 'xflash') xflash(fg, e, cam);
      else if (e.type === 'kfx') R.Karate.drawFx(fg, e, cam);      // 中ボスの地裂撃
    }
    for (i = 0; i < G.parts.length; i++) {
      var q = G.parts[i], qx = Math.round(q.x - cam), qy = Math.round(q.y);
      if (qx < -8 || qx > R.W + 8) continue;
      if (q.petal) { fg.globalAlpha = 0.9; fg.drawImage(R.BG.petal, qx, qy); continue; }
      fg.globalAlpha = Math.min(1, (1 - q.t / q.life) * 1.6); fg.fillStyle = q.col; fg.fillRect(qx, qy, q.size, q.size);
    }
    fg.globalAlpha = 1;
    fg.restore();
    if (R.Cyber) R.Cyber.rain(fg, G.S, cam, oy, G.t);      // 雨（画面の手前）
  };
})();

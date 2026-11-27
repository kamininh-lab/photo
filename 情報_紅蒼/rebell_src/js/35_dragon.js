// ボス「玉龍」（紅蒼の終焉龍）。art/source/DRAGON.png から切り出したコマ（08_dragon_art.js。左向き）を使う。
// 空を飛び回って、こちらを翻弄する:
//   hover   … こちらの横に浮かぶ。近づかれると、頭の上を越えて反対側へ回り込む（cross）
//   swoop   … 急降下の爪。こちらを通り抜けて、背中側へ抜ける（怒りの間は、折り返してもう一度）
//   rush    … 炎をまとった突進。画面の端から、こちらのいる高さを横一文字に駆け抜け、いったん画面の外へ消える（return で上から戻る）
//   fireball… 高い所から火球を落とす   breath … 斜め上から炎を吹き下ろす   pillar … 光の柱（怒りの間だけ）
//   land → rest … 何度か攻めると、右の岸に降りて羽を休める（ここが攻めどき）→ takeoff でまた飛び立つ
//   体力が半分を切ると、真の力を解き放つ（phase 2）: 動きが約 1.33 倍に速くなり（3 フレームに 1 回もう 1 コマ進める）、一撃が 1.25 倍に重くなる。
//     紅い炎の気をまとい、光の柱と、空から火球の雨を降らせる meteor が加わる。吠えている間に、助っ人の大森（36_mako.js）が駆けつける
// 向きは e.face（-1 = 左。絵のまま）、e.rot は体の傾き（正 = 頭が上がる）。e.y は足元。
(function () {
  'use strict';
  var R = window.REBELL, PI = Math.PI, clamp = R.clamp, GY = R.GY;
  var D = window.REBELL_DRAGON || { frames: {} }, FR = D.frames, img = null, tmp = null, tctx = null, emb = null, G, X;
  var PIV = 46;      // 傾けるときの中心（足元からの高さ）
  var PW = 1;        // 一撃の重さ（真の力を解き放つと 1.25）
  function rand(a, b) { return a + Math.random() * (b - a); }

  // 絵を読み込む（90_main.js から。終わったら done）
  R.loadDragon = function (done) {
    if (!D.img) { done(); return; }
    var im = new Image();
    im.onload = function () { img = im; done(); };
    im.onerror = function () { var el = document.getElementById('err'); if (el) el.textContent += 'スプライトを読み込めませんでした: 龍\n'; done(); };
    im.src = D.img;
  };

  // 1 コマを描く。wk > 0 なら白く光らせる
  function blit(g, name, i, x, y, face, rot, alpha, wk) {
    var f = FR[name] && FR[name][i]; if (!img || !f) return;
    var src = img, sx = f[0], sy = f[1];
    if (wk) {
      if (!tmp) { tmp = R.mk(360, 110); tctx = tmp.getContext('2d'); }
      tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, 360, 110); tctx.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
      tctx.globalCompositeOperation = 'source-atop'; tctx.fillStyle = 'rgba(255,255,255,' + wk + ')'; tctx.fillRect(0, 0, f[2], f[3]);
      src = tmp; sx = 0; sy = 0;
    }
    g.save(); g.globalAlpha = alpha == null ? 1 : alpha; g.imageSmoothingEnabled = false;
    g.translate(Math.round(x), Math.round(y)); if (face > 0) g.scale(-1, 1);
    if (rot) { g.translate(0, -PIV); g.rotate(rot); g.translate(0, PIV); }
    g.drawImage(src, sx, sy, f[2], f[3], -f[4], -f[5], f[2], f[3]);
    g.restore();
  }

  function setFr(e, name, i) { e.fn = name; e.fi = i; }
  function go(e, st) { e.st = st; e.stT = 0; }
  // 口の位置（傾きをかけたあと）
  function mouth(e) {
    var r = e.rot || 0, vx = -96, vy = -8, x = vx * Math.cos(r) - vy * Math.sin(r), y = vx * Math.sin(r) + vy * Math.cos(r);
    return [e.x - e.face * x, e.y - PIV + y];
  }
  // 当たり判定: 頭（弱点）と胴
  function boxes(e) {
    if (e.hide || e.gone) return [];
    if (e.front) return [{ x: e.x - 50, y: e.y - 80, w: 50, h: 40, weak: true }, { x: e.x - 46, y: e.y - 72, w: 96, h: 62 }];
    var m = mouth(e), hx = m[0] - e.face * 22;
    return [{ x: hx - 28, y: m[1] - 24, w: 56, h: 40, weak: true }, { x: e.x - 50, y: e.y - 78, w: 104, h: 66 }];
  }
  function glide(e, tx, ty, k, max) {
    var sx = clamp((tx - e.x) * k, -max, max), sy = clamp((ty - e.y) * k, -max, max);
    e.x += sx; e.y += sy; e.vx = sx; e.vy = sy;
  }
  // 浮かんでいるときの絵: ゆっくりなら正面で羽ばたき、速く動くときは横向きで滑る
  function wingAnim(e) {
    if (Math.abs(e.vx) > 1.7) { setFr(e, 'walk', (e.t >> 3) % 4); e.face = e.vx > 0 ? 1 : -1; e.rot = clamp(-e.vy * 0.08, -0.3, 0.3) + 0.06; }
    else { setFr(e, 'wing', (e.t % 22) < 11 ? 3 : 2); e.front = true; e.rot = 0; }
  }
  function ghost(e) { e.trail.push({ x: e.x, y: e.y, fn: e.fn, fi: e.fi, face: e.face, rot: e.rot, a: 0.5 }); }
  function hit(b, dmg, dir, big) { if (R.overlap(b, X.box(G.pl))) X.hurtPlayer(Math.round(dmg * PW), dir, big); }
  function shoot(o) { o.dmg = Math.round(o.dmg * PW); X.shoot(o); }
  function toHover(e, cd) {
    var p = G.pl;
    go(e, 'hover'); e.cd = cd; e.evade = e.phase === 2 ? 2 : 1; e.side = e.x >= p.x ? 1 : -1; e.rot = 0;
  }
  function pick(e) {
    var rage = e.phase === 2, k;
    if (e.count >= (rage ? 4 : 3)) { go(e, 'land'); return; }
    var opts = rage ? ['swoop', 'rush', 'fireball', 'breath', 'pillar', 'meteor', 'swoop', 'rush'] : ['swoop', 'rush', 'fireball', 'breath', 'swoop'];
    do { k = opts[(Math.random() * opts.length) | 0]; } while (k === e.last);
    e.last = k; e.count++; e.again = false; go(e, k);
  }
  function rageOn(e) {
    e.phase = 2; go(e, 'roar'); e.invul = 80; G.rage = true; R.snd('roar'); X.toast('玉龍が真の力を解き放った…！　動きが速く、一撃が重くなる！', '#ff7a8a');
    G.flash = 1; X.shake(12); X.burst(e.x, e.y - 50, 40, ['#ff2e48', '#ffd36a', '#ffffff'], 6, 40, 0.04);
  }

  function die(e) {
    var t = e.stT;
    if (t === 1) { e.vy = -1.6; e.trail = []; }
    e.rot = 0; e.front = false;
    if (!e.landed) {
      e.vy = Math.min(5, e.vy + 0.1); e.y += e.vy;
      if (e.y >= GY && X.groundAt(e.x)) { e.y = GY; e.landed = true; X.shake(8); X.dust(e.x, GY, 14); }
    }
    setFr(e, t < 20 ? 'hurt' : 'fall', t < 20 ? 1 : t < 45 ? 0 : t < 70 ? 1 : t < 95 ? 2 : t < 120 ? 3 : 4);
    if (t % 6 === 0) { X.fx({ type: 'boom', x: e.x + rand(-90, 90), y: Math.min(e.y, 250) - rand(10, 90), life: 18, r: rand(16, 34) }); R.snd('explosion'); X.shake(5); }
    if (t === 150) { G.flash = 1; X.shake(14); X.burst(e.x, Math.min(e.y, 230) - 50, 80, ['#ff7ad1', '#ffffff', '#37e6ff', '#ffd36a'], 7, 60, 0.05); }
    if (t > 150) { e.gone = true; e.dead = true; if (G.boss === e) { G.bossDefeated = true; G.stateT = 0; } }
  }

  function upd(e) {
    G = R.game; X = R.GX;
    var p = G.pl, A0 = G.arena ? G.arena[0] : e.homeX - 420, A1 = G.arena ? G.arena[1] : e.homeX + 90;
    var rage = e.phase === 2, dx = p.x - e.x, i, m, u, t, tx, ty, n;
    PW = rage ? 1.25 : 1;
    e.t++; e.stT++; e.front = false; e.hide = false; e.glow = 0; t = e.stT;
    if (e.invul > 0) e.invul--;
    for (i = e.trail.length - 1; i >= 0; i--) { e.trail[i].a -= 0.07; if (e.trail[i].a <= 0) e.trail.splice(i, 1); }
    if (e.st === 'die') { die(e); return; }
    if (rage && e.t % 2 === 0 && !e.hide) X.part(e.x + rand(-60, 60), e.y - rand(10, 80), rand(-0.4, 0.4), -rand(0.6, 1.6), rand(16, 28), Math.random() < 0.5 ? '#ff2e48' : '#ffb03a', 2, 0, true);      // 真の力: 紅い炎の気

    if (e.bannerT > 0 && --e.bannerT === 0) G.bossIntro = 110;      // 会話のあとに、題字を出す
    if (e.st === 'intro') {      // 岸の上で吠えてから、飛び立つ
      if (!G.dragonMet && R.TALKS && R.TALKS.dragon && R.beginTalk) {      // はじめて会ったとき: 吠えたあとで、紅・蒼・四角の会話（65_talk.js）
        G.bossIntro = 0;
        if (t === 40) { G.dragonMet = true; e.bannerT = 24; R.beginTalk('dragon', { vs: e }); return; }
      }
      e.face = -1; setFr(e, 'roar', t < 14 ? 0 : t < 26 ? 1 : (t >> 3) % 2 ? 2 : 3);
      if (t % 6 === 0) X.shake(3);
      if (t > 104) go(e, 'takeoff');
    } else if (e.st === 'takeoff') {
      if (t === 1) { X.dust(e.x - 40, GY, 8); X.dust(e.x + 40, GY, 8); R.snd('dash'); e.count = 0; }
      glide(e, e.x, 120, 0.09, 3.4); e.vx = 0; wingAnim(e);
      if (t > 34) toHover(e, 26);
    } else if (e.st === 'hover') {
      if (e.phase === 1 && e.hp < e.max * 0.5) { rageOn(e); return; }
      tx = clamp(p.x + e.side * 150, A0 + 60, A1 - 60);
      if (Math.abs(tx - p.x) < 100) { e.side = -e.side; tx = clamp(p.x + e.side * 150, A0 + 60, A1 - 60); }
      ty = clamp(p.y - 4, 96, 150) + Math.sin(e.t * 0.07) * 6;
      glide(e, tx, ty, 0.07, 3.2);
      e.face = dx >= 0 ? 1 : -1; wingAnim(e);
      if (Math.abs(dx) < 84 && Math.abs(p.y - e.y) < 90 && e.evade > 0 && t > 14) {      // 近づかれたら、頭の上を越えて反対側へ
        e.evade--; e.side = -e.side; go(e, 'cross'); e.sx = e.x; e.sy = e.y; e.ex = clamp(p.x + e.side * 150, A0 + 60, A1 - 60); R.snd('dash'); return;
      }
      if (--e.cd <= 0 && Math.abs(tx - e.x) < 46) pick(e);
    } else if (e.st === 'cross') {
      u = t / 26; var s = R.ease(Math.min(1, u)), nx = e.sx + (e.ex - e.sx) * s, ny = e.sy - Math.sin(Math.min(1, u) * PI) * 62;
      e.vx = nx - e.x; e.vy = ny - e.y; e.x = nx; e.y = ny;
      e.face = e.ex >= e.sx ? 1 : -1; setFr(e, 'walk', (t >> 2) % 4); e.rot = clamp(-e.vy * 0.07, -0.35, 0.35);
      if (t % 3 === 0) ghost(e);
      if (u >= 1) { go(e, 'hover'); e.cd = Math.min(e.cd, 12); }
    } else if (e.st === 'swoop') {      // 急降下の爪
      var tel = e.again ? 16 : 32;
      if (t <= tel) {
        e.face = dx >= 0 ? 1 : -1; e.y -= 0.5; e.rot = 0.14; setFr(e, 'claw', t < tel * 0.5 ? 0 : 1); e.glow = 1;
        if (t === 1) R.snd('wave');
        if (t === tel) {
          e.sx = e.x; e.sy = e.y; e.tx = p.x; e.ty = Math.min(GY, p.y) - 8;
          e.ex = clamp(p.x + e.face * 170, A0 + 50, A1 - 50); e.ey = clamp(e.sy - 4, 90, 140);
          R.snd('slash_red3');
        }
      } else {
        u = Math.min(1, (t - tel) / 42);
        var cx = 2 * e.tx - (e.sx + e.ex) / 2, cy = 2 * e.ty - (e.sy + e.ey) / 2, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        nx = a * e.sx + b * cx + c * e.ex; ny = a * e.sy + b * cy + c * e.ey;
        e.vx = nx - e.x; e.vy = ny - e.y; e.x = nx; e.y = ny;
        if (Math.abs(e.vx) > 0.5) e.face = e.vx > 0 ? 1 : -1;
        e.rot = clamp(-Math.atan2(e.vy, Math.abs(e.vx) + 0.01) * 0.55, -0.6, 0.6);
        setFr(e, 'claw', u < 0.42 ? 1 : u < 0.78 ? 2 : 3);
        if (t % 3 === 0) ghost(e);
        if (u > 0.15 && u < 0.85) hit({ x: e.x + e.face * 12 - 56, y: e.y - 62, w: 112, h: 62 }, 18, e.face, true);
        if (u >= 1) {
          if (rage && !e.again) { e.again = true; e.stT = 0; }
          else toHover(e, rage ? 26 : 46);
        }
      }
    } else if (e.st === 'rush') {      // 炎の突進
      var T1 = rage ? 44 : 56; e.T1 = T1;
      if (t === 1) { e.dir = (p.x - A0 < A1 - p.x) ? -1 : 1; e.rowY = clamp(p.y, 100, GY); }      // こちらから遠いほうの端から来る
      if (t <= T1) {
        if (t < 16) e.rowY = clamp(p.y, 100, GY);      // ねらう高さは、ここで決まる
        glide(e, e.dir > 0 ? A0 + 34 : A1 - 34, e.rowY, 0.12, 6.5); e.face = e.dir; e.rot = 0;
        setFr(e, 'breath', t < T1 * 0.5 ? 0 : 1); e.glow = 1;
        if (t === 16) R.snd('roar');
        if (t % 3 === 0) { m = mouth(e); X.part(m[0] + rand(-8, 8), m[1] + rand(-8, 8), rand(-0.6, 0.6), rand(-1.2, 0), 16, '#ffd36a', 2, 0, true); }
      } else {
        if (t === T1 + 1) { R.snd('fire'); X.shake(6); e.y = e.rowY; }
        e.vx = e.dir * (rage ? 8.6 : 7.4); e.vy = 0; e.x += e.vx; e.face = e.dir;
        setFr(e, 'breath', (t >> 2) % 2 ? 2 : 3);
        if (t % 7 === 0) R.snd('fire');
        for (i = 0; i < 2; i++) X.part(e.x - e.dir * rand(40, 200), e.y - rand(16, 56), -e.dir * rand(0.2, 1.4), rand(-1.2, 0.2), rand(14, 26), i ? '#ff7ad1' : '#ffd0ec', 2, 0, true);
        hit({ x: e.x - 58, y: e.y - 84, w: 116, h: 78 }, 16, e.dir, true);      // 体
        hit({ x: e.dir > 0 ? e.x - 200 : e.x, y: e.y - 58, w: 200, h: 42 }, 14, e.dir, false);      // 尾を引く炎
        if (e.x < A0 - 250 || e.x > A1 + 250) go(e, 'return');
      }
    } else if (e.st === 'return') {      // いったん姿を消して、思わぬ側の上から戻ってくる
      if (t === 1) { e.side = Math.random() < 0.5 ? -1 : 1; e.x = clamp(p.x + e.side * 150, A0 + 60, A1 - 60); if (Math.abs(e.x - p.x) < 100) { e.side = -e.side; e.x = clamp(p.x + e.side * 150, A0 + 60, A1 - 60); } e.y = -80; e.trail = []; }
      if (t < 22) { e.hide = true; return; }
      glide(e, e.x, clamp(p.y - 4, 96, 150), 0.09, 5); e.vx = 0; e.face = dx >= 0 ? 1 : -1; wingAnim(e);
      if (t === 22) R.snd('dash');
      if (t > 58) toHover(e, 16);
    } else if (e.st === 'fireball') {      // 高い所から火球
      tx = clamp(p.x + e.side * 165, A0 + 60, A1 - 60);
      glide(e, tx, 98 + Math.sin(e.t * 0.07) * 4, 0.06, 2.6); e.face = dx >= 0 ? 1 : -1; e.rot = 0.1;
      n = rage ? 5 : 3; u = (t - 20) % 24;
      setFr(e, 'roar', t < 20 ? 1 : u < 10 ? 3 : 2);
      if (t > 20 && u === 0 && (t - 20) / 24 <= n) {
        m = mouth(e);
        var fx = p.x + rand(-26, 26) + p.vx * 18, T = 60, fy = Math.min(GY, p.y);
        shoot({ type: 'fireball', x: m[0], y: m[1], vx: (fx - m[0]) / T, vy: (fy - m[1] - 0.5 * 0.14 * T * T) / T, g: 0.14, life: 200, dmg: 13, r: 7, ty: fy });
        R.snd('fire');
      }
      if (t > 20 + 24 * (n + 1)) toHover(e, rage ? 26 : 44);
    } else if (e.st === 'breath') {      // 斜め上から、炎を吹き下ろす
      var len = rage ? 96 : 72;
      if (t === 1) { e.aimX = p.x; e.aimY = p.y - 18; }
      if (t <= 34) {
        tx = clamp(p.x + e.side * 125, A0 + 60, A1 - 60);
        glide(e, tx, clamp(p.y - 66, 62, 112), 0.1, 4); e.face = dx >= 0 ? 1 : -1; e.rot += clamp(-0.32 - e.rot, -0.03, 0.03);
        setFr(e, 'breath', t < 16 ? 0 : 1); e.glow = 1;
        if (t === 8) R.snd('roar');
        e.aimX = p.x; e.aimY = p.y - 18;
      } else if (t <= 34 + len) {
        e.vx = 0; e.vy = 0; setFr(e, 'breath', 1); e.glow = 1;
        e.aimX += clamp(p.x - e.aimX, -1.5, 1.5); e.aimY += clamp(p.y - 18 - e.aimY, -1.2, 1.2);      // ゆっくり追いかける（走れば振り切れる）
        m = mouth(e);
        var an = Math.atan2(e.aimY - m[1], e.aimX - m[0]);
        if (t % 8 === 0) R.snd('fire');
        for (i = 0; i < 2; i++) { var sp = rand(3.8, 4.8), aa = an + rand(-0.09, 0.09); shoot({ type: 'flame', x: m[0], y: m[1], vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(36, 48), dmg: 11, r: 5 }); }
      } else { e.rot += clamp(0 - e.rot, -0.03, 0.03); setFr(e, 'breath', 4); if (t > 34 + len + 20) toHover(e, rage ? 24 : 40); }
    } else if (e.st === 'pillar') {      // 光の柱（怒りの間だけ）
      glide(e, clamp(e.x, A0 + 80, A1 - 80), 104, 0.06, 2.4); e.face = dx >= 0 ? 1 : -1; e.rot = 0.12;
      setFr(e, 'roar', t < 10 ? 1 : (t >> 3) % 2 ? 2 : 3);
      if (t === 10) {
        R.snd('roar'); X.shake(5);
        for (i = 0; i < 5; i++) shoot({ type: 'pillar', x: A0 + 44 + i * 102 + rand(-20, 20), y: GY, vx: 0, vy: 0, life: 110, dmg: 16, w: 26, h: 120, warn: 56 });
        shoot({ type: 'pillar', x: p.x, y: GY, vx: 0, vy: 0, life: 110, dmg: 16, w: 26, h: 120, warn: 56 });
      }
      if (t > 96) toHover(e, 30);
    } else if (e.st === 'meteor') {      // 火球の雨（真の力のときだけ）: 高く昇り、地面に落ちる場所を光の輪で知らせてから、火球を次々に降らせる
      glide(e, clamp((A0 + A1) / 2, A0 + 80, A1 - 80), 70, 0.06, 3); e.face = dx >= 0 ? 1 : -1; e.rot = 0.18;
      setFr(e, 'roar', t < 12 ? 1 : (t >> 3) % 2 ? 2 : 3); e.glow = 1;
      if (t === 12) { R.snd('roar'); X.shake(6); e.drops = []; for (i = 0; i < 7; i++) e.drops.push(A0 + 50 + (A1 - A0 - 100) * (i + rand(-0.3, 0.3)) / 6); e.drops.push(p.x); e.drops.sort(function () { return Math.random() - 0.5; }); }
      if (t > 12 && e.drops && (t - 12) % 9 === 0 && e.drops.length) {
        var dxp = e.drops.pop(), TT = 46; m = mouth(e);
        shoot({ type: 'fireball', x: m[0], y: m[1], vx: (dxp - m[0]) / TT, vy: (GY - m[1] - 0.5 * 0.14 * TT * TT) / TT, g: 0.14, life: 200, dmg: 12, r: 7, ty: GY });
        X.fx({ type: 'ring', x: dxp, y: GY - 2, life: TT, r: 14, col: '#ff7a8a', flat: true }); R.snd('fire');
      }
      if (t > 12 + 9 * 9 + 30) toHover(e, 30);
    } else if (e.st === 'land') {      // 岸に降りる
      glide(e, e.homeX, GY, 0.08, 4.2);
      if (e.y < GY - 26) wingAnim(e); else { setFr(e, 'walk', 0); e.rot = 0; e.face = dx >= 0 ? 1 : -1; }
      if ((e.y >= GY - 1.5 && Math.abs(e.x - e.homeX) < 8) || t > 130) {
        e.x = e.homeX; e.y = GY; e.rot = 0; e.face = dx >= 0 ? 1 : -1;
        X.shake(9); R.snd('special_red'); X.dust(e.x - 50, GY, 10); X.dust(e.x + 50, GY, 10);
        shoot({ type: 'shock', x: e.x - 70, y: GY, vx: -3.2, vy: 0, life: 200, dmg: 14, w: 18, h: 26 });
        shoot({ type: 'shock', x: e.x + 70, y: GY, vx: 3.2, vy: 0, life: 200, dmg: 14, w: 18, h: 26 });
        if (p.ground) hit({ x: e.x - 120, y: GY - 30, w: 240, h: 32 }, 14, p.x >= e.x ? 1 : -1, true);
        if (!e.told) { e.told = true; X.toast('玉龍が羽を休めている…今だ！', '#ffe04a'); }
        go(e, 'rest');
      }
    } else if (e.st === 'rest') {      // 羽を休める（攻めどき）
      if (e.flash > 0) setFr(e, 'hurt', [0, 1, 3][(e.flash >> 2) % 3]); else setFr(e, 'idle', (e.t >> 4) % 4);
      if (e.phase === 1 && e.hp < e.max * 0.5) { rageOn(e); return; }
      if (t > (rage ? 120 : 170)) go(e, 'takeoff');
    } else if (e.st === 'roar') {      // 怒り
      setFr(e, 'roar', t < 10 ? 0 : t < 20 ? 1 : (t >> 3) % 2 ? 2 : 3); e.rot = 0.1;
      if (t === 24 && !G.dragonRageMet && R.TALKS && R.TALKS.dragon_rage && R.beginTalk) { G.dragonRageMet = true; R.beginTalk('dragon_rage', { vs: e }); return; }      // はじめて怒ったとき: 短い会話
      if (t % 5 === 0) X.shake(5);
      if (t === 30 && R.Mako && !R.Mako.on()) R.Mako.arrive();      // 助っ人の大森が駆けつける
      if (t > 80 && R.Mako && !R.Mako.ready()) { e.stT = 80; return; }      // 大森が降り立って、話し終えるまで吠えたまま待つ
      if (t > 80) { if (e.y >= GY - 2) go(e, 'takeoff'); else toHover(e, 16); e.count = 0; }
    }
  }

  function draw(g, e, cam) {
    if (e.gone || e.hide) return;
    var x = e.x - cam, i, q, m, r, k, jx = e.st === 'die' ? rand(-2, 2) : 0;
    if (e.st === 'die' && e.stT > 110 && (e.stT >> 1) % 2) return;
    if (e.st === 'rush' && e.stT <= e.T1 && e.stT > 14) {      // 突進の前ぶれ: ねらう高さに、光の帯
      k = (e.stT >> 2) % 2;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.14 + 0.1 * k; g.fillStyle = '#ff2e88'; g.fillRect(0, e.rowY - 58, R.W, 42);
      g.globalAlpha = 0.5 + 0.3 * k; g.fillStyle = '#ffd0ec'; g.fillRect(0, e.rowY - 59, R.W, 1); g.fillRect(0, e.rowY - 16, R.W, 1);
      g.restore();
    }
    if (e.phase === 2 && e.st !== 'die') {      // 真の力: 体のまわりに、脈打つ紅い気
      k = 0.5 + 0.5 * Math.sin(e.t * 0.12);
      g.save(); g.globalCompositeOperation = 'lighter';
      var ag = g.createRadialGradient(x, e.y - 46, 10, x, e.y - 46, 96); ag.addColorStop(0, 'rgba(255,60,80,' + (0.22 + 0.12 * k) + ')'); ag.addColorStop(1, 'rgba(255,60,80,0)');
      g.fillStyle = ag; g.fillRect(x - 100, e.y - 146, 200, 200); g.restore();
    }
    for (i = 0; i < e.trail.length; i++) { q = e.trail[i]; blit(g, q.fn, q.fi, q.x - cam, q.y, q.face, q.rot, q.a * 0.6, 0.55); }
    blit(g, e.fn, e.fi, x + jx, e.y, e.face, e.rot, 1, e.flash > 0 && (e.flash >> 1) % 2 === 0 ? 0.85 : 0);
    if (e.glow && !e.front) {      // 攻撃の前ぶれ: 口もとの光
      m = mouth(e); r = 5 + 3 * Math.sin(e.t * 0.5);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (k = 0; k < 3; k++) { g.globalAlpha = [0.3, 0.5, 0.9][k]; g.fillStyle = ['#ff2e88', '#ff8ad0', '#ffffff'][k]; g.beginPath(); g.arc(m[0] - cam, m[1], r * (1 - k * 0.3), 0, PI * 2); g.fill(); }
      g.restore();
    }
  }

  // 真の力: 3 フレームに 1 回、もう 1 回動かす（吠えている・倒れていくとき、会話のときは、ふつうの速さ）
  function fastUpd(e) {
    upd(e);
    if (e.phase === 2 && e.st !== 'die' && e.st !== 'roar' && R.game.state === 'play' && (e.fastN = (e.fastN || 0) + 1) % 3 === 0) upd(e);
  }
  var EMB = ['wing', 3];
  R.Dragon = {
    init: function (e) {
      e.w = 110; e.h = 90; e.hp = e.max = 1800; e.exp = 0; e.armor = true; e.phase = 1;
      e.t = 0; e.cd = 40; e.count = 0; e.evade = 1; e.side = -1; e.rot = 0; e.trail = []; e.homeX = e.x; e.face = -1;
      e.st = 'intro'; e.stT = 0; setFr(e, 'roar', 0);
      e.upd = fastUpd; e.draw = draw; e.boxes = boxes;
    },
    // 起動ロゴの紋章に使う絵（翼を広げた正面の姿）。[キャンバス, 中心 x, 中心 y]
    emblem: function () {
      var f = FR[EMB[0]] && FR[EMB[0]][EMB[1]];
      if (!emb) { emb = R.mk(f ? f[2] : 8, f ? f[3] : 8); if (img && f) emb.getContext('2d').drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); }
      return emb;
    }
  };
})();

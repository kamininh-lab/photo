// 四角のドローン（2P のお助け）。ふだんは出てこない。テンキーをどれか押すと、四角が作った小型ドローンが飛んでくる。
//   テンキー: 8 4 6 2（7 9 1 3 は斜め）= 移動 / 0 = 電撃弾（押しっぱなしで連射）/ 5 = 修理（HP を回復）/ + か Enter = シールド（1 回だけ攻撃を防ぐ）/ - = 引っこめる
//   ドローンはやられない。しばらく動かさないと、主人公の肩のあたりへ戻ってついていく。画面の外へは出ない。
//   1P のキー（00_core.js）とは別に、テンキーの押し具合をここで持つ（e.code は NumLock の状態によらず Numpad○ になる）
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, clamp = R.clamp, rand = R.rand;
  var held = {}, latch = {};
  window.addEventListener('keydown', function (e) {
    if (!e.code || e.code.indexOf('Numpad') !== 0 || (R.typing && R.typing(e))) return;
    e.preventDefault();
    if (!e.repeat) latch[e.code] = true;
    held[e.code] = true;
    if (R.onGesture) R.onGesture();
  });
  window.addEventListener('keyup', function (e) { if (e.code && e.code.indexOf('Numpad') === 0) held[e.code] = false; });
  window.addEventListener('blur', function () { held = {}; });
  function any(m, codes) { for (var i = 0; i < codes.length; i++) if (m[codes[i]]) return true; return false; }
  function anyLatch() { for (var k in latch) if (latch[k]) return true; return false; }

  // SPEED = 飛ぶ速さ / SHOT = 弾の間隔 / REP = 修理の待ち時間・回復の割合 / SHD = シールドの待ち時間・続く時間 / IDLE = ついていくまでの時間
  var SPEED = 2.8, SHOT = 7, REP_CD = 900, REP_HEAL = 0.25, SHD_CD = 1200, SHD_LEN = 420, IDLE = 150;
  R.DRONE_CFG = { REP_CD: REP_CD, SHD_CD: SHD_CD };
  var img = null;
  function pic() { if (!img && window.REBELL_DRONE) { img = new Image(); img.src = window.REBELL_DRONE; } return img; }
  pic();      // 起動時に読み込んでおく（呼んだ瞬間に絵が間に合うように）

  function drone() {
    if (!G.drone) G.drone = { on: false, x: 0, y: 0, vx: 0, vy: 0, face: 1, idle: 0, t: 0, shotCd: 0, repCd: 0, shdCd: 0, shieldT: 0, healT: 0, healLeft: 0, introT: 0, shots: [], used: false };
    return G.drone;
  }
  function launch(d, p, X) {
    d.on = true; d.leaving = 0; d.t = 0; d.idle = 0; d.introT = 300; d.face = p.face;
    d.x = G.cam.x + (p.face > 0 ? -12 : R.W + 12); d.y = p.y - 70;      // 画面の後ろの端から飛び込んでくる
    if (!d.used) { d.used = true; X.toast('四角のドローン、発進！（2P: テンキー）', '#ffc84a'); }
    else X.toast('ドローン、戻ったよ！', '#ffc84a');
    R.snd('switch');
  }
  function screenY(y) { return y + (G.cam.y || 0); }

  R.Drone = {
    // LAN の協力プレイ（59_net.js）: 子のパソコンで押されたキーを、テンキーと同じように受け取る
    feed: function (code, down) { if (down && !held[code]) latch[code] = true; held[code] = !!down; },
    feedReset: function () { held = {}; },
    // 毎フレーム（R.updatePlay から）。X = 50_game.js の部品
    update: function (X) {
      var d = drone(), p = G.pl, i, s;
      if (!d.on) {
        if (anyLatch() && G.state === 'play') launch(d, p, X);
        latch = {}; return;
      }
      d.t++;
      if (d.introT > 0) d.introT--;
      ['shotCd', 'repCd', 'shdCd', 'shieldT'].forEach(function (k) { if (d[k] > 0) d[k]--; });
      // 引っこめる: その場で小さく沈んでから、上空へ一気に飛び去る（画面の上へ消えたら待機）。飛び去る途中でテンキーを押すと、引き返す
      if (d.leaving) {
        if (anyLatch() && !latch.NumpadSubtract) { d.leaving = 0; d.idle = 0; X.toast('やっぱり手伝うよ！', '#ffc84a'); R.snd('switch'); latch = {}; return; }
        d.leaving++; latch = {};
        if (d.leaving < 10) { d.vx *= 0.8; d.vy = 0.6; }                                   // ため: 少し沈む
        else {
          if (d.leaving === 10) { R.snd('dash'); X.fx({ type: 'ring', x: d.x, y: d.y + 6, life: 12, r: 14, col: '#ffc84a', flat: true }); }
          d.vx *= 0.9; d.vy = Math.max(-9, d.vy - 0.55);                                    // ぐんぐん加速して昇る
          if (d.leaving % 2 === 0) X.part(d.x + rand(-4, 4), d.y + 8, rand(-0.3, 0.3), rand(0.6, 1.4), 14, d.leaving % 4 ? '#ffc84a' : '#ffffff', 2, 0, true);      // 噴射の光
        }
        d.x += d.vx; d.y += d.vy;
        if (screenY(d.y) < -24) { d.on = false; d.leaving = 0; d.shots = []; }             // 画面の上へ消えた
        return;
      }
      if (latch.NumpadSubtract) { d.leaving = 1; d.shots = []; d.shieldT = 0; d.healT = 0; d.introT = 0; X.toast('ドローン、いったん引き上げるよ', '#ffc84a'); R.snd('select'); latch = {}; return; }
      // 移動
      var mx = (any(held, ['Numpad6', 'Numpad9', 'Numpad3']) ? 1 : 0) - (any(held, ['Numpad4', 'Numpad7', 'Numpad1']) ? 1 : 0);
      var my = (any(held, ['Numpad2', 'Numpad1', 'Numpad3']) ? 1 : 0) - (any(held, ['Numpad8', 'Numpad7', 'Numpad9']) ? 1 : 0);
      if (mx || my) {
        d.idle = 0; var k = mx && my ? 0.72 : 1;
        d.vx += (mx * SPEED * k - d.vx) * 0.25; d.vy += (my * SPEED * k - d.vy) * 0.25;
        if (mx) d.face = mx;
      } else {
        d.idle++; d.vx *= 0.85; d.vy *= 0.85;
        if (d.idle > IDLE || d.introT > 240) {      // 主人公の肩の後ろへ戻って、ついていく
          var tx = p.x - p.face * 20, ty = p.y - 48;
          d.vx += clamp((tx - d.x) * 0.06 - d.vx, -0.4, 0.4); d.vy += clamp((ty - d.y) * 0.06 - d.vy, -0.4, 0.4);
          if (Math.abs(tx - d.x) < 30) d.face = p.face;
        }
      }
      d.x += d.vx; d.y += d.vy;
      d.x = clamp(d.x, G.cam.x + 10, G.cam.x + R.W - 10);
      d.y = clamp(d.y, 16 - (G.cam.y || 0), R.H - 14 - (G.cam.y || 0));
      // 射撃
      if (held.Numpad0 && d.shotCd <= 0) {
        d.shotCd = SHOT;
        d.shots.push({ x: d.x + d.face * 9, y: d.y + 5, vx: d.face * 6.4, t: 0, life: 50 });
        if ((d.nShot = (d.nShot || 0) + 1) % 2) R.snd('select');      // 連射の音は 1 発おきに（うるさくしない）
        X.part(d.x + d.face * 9, d.y + 5, d.face * 1.2, rand(-0.4, 0.4), 6, '#fff3b0', 1, 0, true);
      }
      // 修理: 戦っている子の HP を少しずつ戻す（倒れている相棒は起こせない）
      if (latch.Numpad5) {
        var c = p.chars[p.who];
        if (d.repCd > 0 || c.hp >= c.max) R.snd('deny');
        else { d.repCd = REP_CD; d.healT = 60; d.healLeft = c.max * REP_HEAL; R.snd('potion'); X.text(p.x, p.y - 44, '修理！', '#9dffb0', true); }
      }
      if (d.healT > 0) {
        d.healT--; var c2 = p.chars[p.who], add = d.healLeft / (d.healT + 1);
        d.healLeft -= add; if (!c2.down) c2.hp = Math.min(c2.max, c2.hp + add);
        if (d.healT % 4 === 0) X.part(p.x + rand(-8, 8), p.y - rand(4, 30), 0, -0.8, 16, d.healT % 8 ? '#9dffb0' : '#ffffff', 2, 0, true);
      }
      // シールド: 1 回だけ攻撃を防ぐ光の膜
      if (latch.NumpadAdd || latch.NumpadEnter) {
        if (d.shdCd > 0 || d.shieldT > 0) R.snd('deny');
        else { d.shdCd = SHD_CD; d.shieldT = SHD_LEN; R.snd('checkpoint'); X.text(p.x, p.y - 44, 'シールド！', '#ffe8a0', true); X.fx({ type: 'ring', x: p.x, y: p.y - X.MID, life: 16, r: 30, col: '#ffc84a' }); }
      }
      latch = {};
      // 弾
      for (i = 0; i < d.shots.length; i++) {
        s = d.shots[i]; s.t++; s.x += s.vx;
        var hb = { x: s.x - 4, y: s.y - 3, w: 8, h: 6 };
        for (var j = 0; j < G.enemies.length && !s.dead; j++) {
          var e = G.enemies[j]; if (e.dead) continue;
          var hbs = X.hurtboxes(e);
          for (var q = 0; q < hbs.length; q++) if (R.overlap(hb, hbs[q])) {
            X.damageEnemy(e, 3, R.sign(s.vx), 0.3, { gain: 0.2, stop: 0, col: 'gold', weak: hbs[q].weak, snd: 'hit', cx: s.x, cy: s.y });
            s.dead = true; break;
          }
        }
        X.openChests(hb);
        if (s.t >= s.life || s.x < G.cam.x - 20 || s.x > G.cam.x + R.W + 20) s.dead = true;
        var S = G.S.solids; for (var w = 0; w < S.length && !s.dead; w++) if (R.overlap(hb, S[w])) { s.dead = true; X.burst(s.x, s.y, 4, ['#ffd36a', '#ffffff'], 1.6, 10); }
      }
      d.shots = d.shots.filter(function (o) { return !o.dead; });
    },
    // 主人公が攻撃を受ける直前に呼ぶ。シールドがあれば消費して、受けなかったことにする
    block: function (X) {
      var d = G.drone; if (!d || !d.on || d.shieldT <= 0) return false;
      var p = G.pl; d.shieldT = 0; p.inv = Math.max(p.inv, 50);
      R.snd('guard'); X.fx({ type: 'ring', x: p.x, y: p.y - X.MID, life: 18, r: 34, col: '#ffe8a0' });
      X.burst(p.x, p.y - X.MID, 14, ['#ffc84a', '#ffffff', '#fff3b0'], 3, 20); X.text(p.x, p.y - 44, 'BLOCK!', '#ffe8a0', true);
      return true;
    },
    // 主人公と同じ高解像度の層に描く（g は 1 ドット = S ピクセルに変換済み）
    draw: function (g, cam) {
      var d = G.drone; if (!d || !d.on || G.state === 'talk') return;
      var p = G.pl, t = G.t, im = pic(), x = d.x - cam, y = d.y + Math.sin(t * 0.12) * 1.5, W = 22, H = W * 44 / 59, i;
      g.save();
      // シールドの膜（主人公のまわり）
      if (d.shieldT > 0) {
        var a = d.shieldT < 60 ? ((t >> 2) % 2 ? 0.25 : 0.55) : 0.45 + 0.1 * Math.sin(t * 0.2);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.lineWidth = 1;
        for (i = 0; i < 6; i++) {      // 六角形の膜
          var an = i * Math.PI / 3 + t * 0.02;
          g.strokeStyle = i % 2 ? '#ffc84a' : '#fff3b0'; g.beginPath();
          g.moveTo(p.x - cam + Math.cos(an) * 20, p.y - 17 + Math.sin(an) * 22); g.lineTo(p.x - cam + Math.cos(an + Math.PI / 3) * 20, p.y - 17 + Math.sin(an + Math.PI / 3) * 22); g.stroke();
        }
        g.globalAlpha = a * 0.25; g.fillStyle = '#ffc84a'; g.beginPath(); g.ellipse(p.x - cam, p.y - 17, 19, 21, 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      // 修理の光の線（ドローンから主人公へ）
      if (d.healT > 0) {
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.6); g.strokeStyle = '#9dffb0'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y + 6); g.lineTo(p.x - cam, p.y - 17); g.stroke(); g.globalCompositeOperation = 'source-over';
      }
      // 弾
      g.globalCompositeOperation = 'lighter';
      for (i = 0; i < d.shots.length; i++) {
        var s = d.shots[i], sx = s.x - cam;
        g.globalAlpha = 0.5; g.fillStyle = '#ffc84a'; g.fillRect(sx - s.vx * 1.2, s.y - 1, Math.abs(s.vx) * 1.2, 2);
        g.globalAlpha = 1; g.fillStyle = '#fff3b0'; g.fillRect(sx - 2.5, s.y - 1.5, 5, 3); g.fillStyle = '#ffffff'; g.fillRect(sx - 1.5, s.y - 0.5, 3, 1);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // 影（下の足場の上に、小さな楕円）
      g.globalAlpha = 0.25; g.fillStyle = '#000000'; g.beginPath(); g.ellipse(x, y + 14, 7, 1.6, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      // 上空へ飛び去るときの光の尾（速いほど長い）
      if (d.leaving > 10) {
        var tl = Math.min(46, -d.vy * 5.5), tg = g.createLinearGradient(0, y + 6, 0, y + 6 + tl);
        tg.addColorStop(0, 'rgba(255,243,176,.9)'); tg.addColorStop(0.4, 'rgba(255,200,74,.55)'); tg.addColorStop(1, 'rgba(255,200,74,0)');
        g.globalCompositeOperation = 'lighter'; g.fillStyle = tg; g.fillRect(x - 2.5, y + 6, 5, tl); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x - 1, y + 6, 2, tl * 0.5);
        g.globalCompositeOperation = 'source-over';
      }
      // 本体（進む向きへ少し傾ける）
      g.translate(x, y); g.rotate(clamp(d.vx * 0.06, -0.25, 0.25)); if (d.face < 0) g.scale(-1, 1);
      if (im && im.complete && im.naturalWidth) g.drawImage(im, -W / 2, -H / 2, W, H);
      else { g.fillStyle = '#e8eef8'; g.fillRect(-6, -3, 12, 6); }
      // 回るプロペラ（左右の羽の上に、うすい楕円の残像）
      g.globalCompositeOperation = 'lighter';
      for (i = -1; i <= 1; i += 2) {
        var pw = 6 + 1.5 * Math.sin(t * 1.7 + i);
        g.globalAlpha = 0.35; g.fillStyle = '#bff4ff'; g.beginPath(); g.ellipse(i * 7.2, -H / 2 + 3.6, pw, 1.3, 0, 0, Math.PI * 2); g.fill();
      }
      // 目の光（向いている側）
      g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 0.3); g.fillStyle = '#7af3ff'; g.fillRect(0.5, -0.5, 1.5, 1.5);
      g.restore();
      // 呼ばれたばかりのときは、上に「2P」の札
      if (d.introT > 0 || d.idle < 2) {
        g.save(); g.globalAlpha = d.introT > 0 ? Math.min(1, d.introT / 30) : 0;
        g.fillStyle = '#ffc84a'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('2P', x, y - 12); g.restore();
      }
    }
  };
  R.droneState = drone;
})();

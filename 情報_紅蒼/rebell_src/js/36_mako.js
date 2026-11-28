// 助っ人「大森 茉子」（おおもり まこ）。玉龍高校のサポート／ヒーラーで、紅と蒼のお姉さん役。
//   ステージ 4 の龍が真の力を解き放ったとき（体力が半分を切ったとき。35_dragon.js の roar から）、画面の左上から跳び込んでくる。
//   はじめてのときだけ、紅・蒼・四角との会話（65_talk.js の mako）。そのあとは自分で動く（操作はいらない）:
//     リカバー     … 戦っている子の体力が 6 割を切ると、杖の光で体力を 24% 戻す（待ち時間 9 秒）
//     リザレクション … 相棒が倒れていると、起こして体力を 4 割に戻す（待ち時間 25 秒）
//     プロテクション … 龍が大技に入ると、光の膜で 1 回だけ攻撃を防ぐ（待ち時間 16 秒）
//     光弾         … 手が空いているときは、龍の頭をねらって小さな光弾を撃つ
//   大森はやられない（龍の攻撃は当たらない）。地面の上だけを歩き、穴は跳び越える。いつも主人公の少し後ろにいる。
//   絵は make_mako.py が切り出したコマ（09_mako_art.js。シートの絵は右向き）。会話の顔は REBELL_MAKO.pics。
(function () {
  'use strict';
  var R = window.REBELL, PI = Math.PI, clamp = R.clamp, GY = R.GY;
  var D = window.REBELL_MAKO || { frames: {}, pics: {} }, FR = D.frames, img = null, G, X;
  var SC = 0.72;      // 絵の縮尺（シートの絵は主人公より大きいので縮める。それでも少し背が高い = お姉さん）
  var HEAL_CD = 540, HEAL_AMT = 0.24, HEAL_LEN = 50, REZ_CD = 1500, DOME_CD = 960, DOME_LEN = 360, SHOT_CD = 70;
  R.MAKO_CFG = { HEAL_CD: HEAL_CD, DOME_CD: DOME_CD, REZ_CD: REZ_CD };
  if (D.img) { img = new Image(); img.src = D.img; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function fr(name, i) { var a = FR[name]; return a ? a[Math.max(0, Math.min(i, a.length - 1))] : null; }
  // 台詞（お姉さんらしく、やさしく、でも少しだけ叱る）。順に回して使う
  var SAY = {
    heal: ['茉子「無理はしないで。……はい、これで大丈夫」', '茉子「もう、また無茶して。ほら、じっとして」', '茉子「深呼吸。痛いのは、すぐ消えるからね」', '茉子「よくがんばってる。……でも、まだ倒れちゃだめだよ」'],
    rez: ['茉子「起きて。……まだ、終わってないよ」', '茉子「大丈夫、ちゃんと間に合った。立てる？」'],
    dome: ['茉子「守りは任せて。今のうちに！」', '茉子「大丈夫、受け止めるから！」', '茉子「前だけ見て。後ろは、私が支える」']
  };
  function say(m, k) { var a = SAY[k], i = (m.sayN[k] = (m.sayN[k] || 0) + 1) - 1; X.toast(a[i % a.length], '#ffb8f0'); }

  // x の近くで、立てる地面（画面の中）を探す
  function landX(x) {
    var lo = G.cam.x + 14, hi = G.cam.x + R.W - 14, d, a;
    x = clamp(x, lo, hi);
    for (d = 0; d <= 240; d += 4) for (a = -1; a <= 1; a += 2) { var q = x + a * d; if (q >= lo && q <= hi && X.groundAt(q) && X.groundAt(q - 6) && X.groundAt(q + 6)) return q; }
    return null;
  }
  function solid(a, b) { var s = a < b ? 1 : -1; for (var x = a; s > 0 ? x <= b : x >= b; x += s * 5) if (!X.groundAt(x)) return false; return true; }
  function hop(m, tx, dur, h) { m.st = 'hop'; m.t = 0; m.sx = m.x; m.sy = m.y; m.tx = tx; m.dur = dur; m.h = h; m.face = tx >= m.x ? 1 : -1; }
  function weak(e) { var b = X.hurtboxes(e), i; for (i = 0; i < b.length; i++) if (b[i].weak) return b[i]; return b[0]; }

  R.Mako = {
    on: function () { var m = R.game.mako; return !!(m && m.on); },
    // 龍が真の力を解き放ったとき: 画面の左上から跳び込み、主人公の少し後ろに降りる
    arrive: function () {
      G = R.game; X = R.GX;
      var p = G.pl, lx = landX(p.x - 52 >= G.cam.x + 26 ? p.x - 52 : p.x + 52); if (lx === null) lx = landX(p.x) || p.x;      // 後ろに場所がなければ、前に降りる
      G.mako = { on: true, st: 'hop', enter: true, t: 0, x: G.cam.x - 30, y: GY - 150, sx: 0, sy: 0, tx: lx, dur: 50, h: 30, face: 1,
        healCd: 60, rezCd: 120, domeCd: 240, domeT: 0, shotCd: 90, healT: 0, healLeft: 0, act: null, shots: [], sayN: {}, introT: 240, moveT: 0 };
      var m = G.mako; m.sx = m.x; m.sy = m.y;
      R.snd('dash');
    },
    // 龍を倒したあとの会話（dragon_end）の前に: 大森がまだ来ていなければ（一気に倒したとき）、会話なしで、その場に立たせる
    ensure: function () {
      var m = R.game.mako; if (m && m.on && !m.enter) return;
      if (!(m && m.on)) R.Mako.arrive();
      m = R.game.mako; m.x = m.tx; m.y = GY; m.st = 'idle'; m.t = 0; m.enter = false; m.face = R.game.pl.x >= m.x ? 1 : -1; R.game.makoMet = true;
    },
    // 跳び込みと、はじめての会話が終わったか（35_dragon.js は、それまで吠えたまま待つ）
    ready: function () { var m = R.game.mako; return !m || !m.enter; },
    update: function (X_) {
      G = R.game; X = X_;
      var m = G.mako; if (!m || !m.on) return;
      var p = G.pl, e = G.boss, i, s, k, c = p.chars[p.who], o = p.chars[p.who === 'kurenai' ? 'aoi' : 'kurenai'];
      m.t++; if (m.introT > 0) m.introT--;
      ['healCd', 'rezCd', 'domeCd', 'domeT', 'shotCd'].forEach(function (q) { if (m[q] > 0) m[q]--; });
      // 回復の光（50 フレームかけて、少しずつ戻す）
      if (m.healT > 0) {
        m.healT--; var add = m.healLeft / (m.healT + 1); m.healLeft -= add; if (!c.down) c.hp = Math.min(c.max, c.hp + add);
        if (m.healT % 3 === 0) X.part(p.x + rand(-9, 9), p.y - rand(2, 30), 0, -rand(0.6, 1.2), 18, m.healT % 6 ? '#7dffc4' : '#ffffff', 2, 0, true);
      }
      // 跳ぶ（跳び込み・穴を越える）
      if (m.st === 'hop') {
        var u = Math.min(1, m.t / m.dur);
        m.x = m.sx + (m.tx - m.sx) * u; m.y = m.sy + (GY - m.sy) * u - Math.sin(u * PI) * m.h;
        if (u >= 1) {
          m.y = GY; X.dust(m.x, GY, m.enter ? 10 : 5); m.st = 'idle'; m.t = 0;
          if (m.enter) {
            m.face = p.x >= m.x ? 1 : -1; R.snd('checkpoint');
            X.fx({ type: 'ring', x: m.x, y: GY - 20, life: 24, r: 46, col: '#7dffc4' });
            for (k = 0; k < 18; k++) X.part(m.x + rand(-20, 20), GY - rand(0, 40), rand(-1, 1), -rand(0.5, 1.6), 26, k % 2 ? '#ffb8f0' : '#7dffc4', 2, 0, true);
            if (!G.makoMet && R.TALKS && R.TALKS.mako && R.beginTalk) { G.makoMet = true; m.enter = false; R.beginTalk('mako', { vs: G.boss || { x: p.x + 100 } }); return; }
            m.enter = false; X.toast('茉子「お待たせ。――回復は、私が引き受けるから」', '#ffb8f0');
          }
        }
        return;
      }
      var fight = e && !e.dead && e.st !== 'die' && !G.bossDefeated && G.state === 'play';
      // 技の途中
      if (m.act) {
        var A = m.act; A.t++;
        if (A.k === 'heal' && A.t === 12) { m.healT = HEAL_LEN; m.healLeft = c.max * HEAL_AMT; R.snd('potion'); X.text(p.x, p.y - 46, 'リカバー！', '#7dffc4', true); X.fx({ type: 'ring', x: p.x, y: p.y - 17, life: 20, r: 30, col: '#7dffc4' }); say(m, 'heal'); }
        if (A.k === 'rez' && A.t === 40 && o.down) {
          o.down = false; o.hp = Math.round(o.max * 0.4); R.snd('levelup'); G.flash = Math.max(G.flash, 0.3);
          X.fx({ type: 'ring', x: p.x, y: p.y - 17, life: 30, r: 60, col: '#7dffc4' }); X.text(p.x, p.y - 50, 'リザレクション！', '#7dffc4', true);
          for (k = 0; k < 24; k++) X.part(p.x + rand(-16, 16), p.y - rand(0, 10), rand(-0.4, 0.4), -rand(1.2, 3), 30, k % 3 ? '#7dffc4' : '#ffffff', 2, 0, true);
          say(m, 'rez');
        }
        if (A.k === 'dome' && A.t === 14) { m.domeT = DOME_LEN; R.snd('checkpoint'); X.text(p.x, p.y - 48, 'プロテクション！', '#9af0ff', true); X.fx({ type: 'ring', x: p.x, y: p.y - 17, life: 18, r: 36, col: '#9af0ff' }); say(m, 'dome'); }
        if (A.k === 'shot' && A.t === 8 && fight) {
          var w = weak(e), sx = m.x + m.face * 14, sy = m.y - 26;
          if (w) { var dx = w.x + w.w / 2 - sx, dy = w.y + w.h / 2 - sy, dd = Math.sqrt(dx * dx + dy * dy) || 1; m.shots.push({ x: sx, y: sy, vx: dx / dd * 4.6, vy: dy / dd * 4.6, t: 0 }); R.snd('select'); }
        }
        if (A.t >= A.len) m.act = null;
      } else if (G.state === 'play') {
        // 次の手を選ぶ（倒れた相棒 → 体力 → 守り → 光弾 の順に大事）
        var big = fight && (e.st === 'rush' || e.st === 'swoop' || e.st === 'breath' || e.st === 'pillar' || e.st === 'meteor');
        if (o.down && m.rezCd <= 0) { m.act = { k: 'rez', t: 0, len: 60 }; m.rezCd = REZ_CD; }
        else if (!c.down && c.hp < c.max * 0.6 && m.healCd <= 0 && m.healT <= 0) { m.act = { k: 'heal', t: 0, len: 44 }; m.healCd = HEAL_CD; }
        else if (big && m.domeCd <= 0 && m.domeT <= 0) { m.act = { k: 'dome', t: 0, len: 30 }; m.domeCd = DOME_CD; }
        else if (fight && m.shotCd <= 0 && Math.abs(e.x - G.cam.x - R.W / 2) < R.W / 2 + 40) { m.act = { k: 'shot', t: 0, len: 20 }; m.shotCd = SHOT_CD; }
        if (m.act) { m.face = (m.act.k === 'shot' ? e.x : p.x) >= m.x ? 1 : -1; m.moveT = 0; }
        else {
          // 主人公の少し後ろへ。穴があれば跳び越える。立てる地面がなければ、その場で待つ
          var tx = landX(p.x - p.face * 46);
          if (tx !== null && Math.abs(tx - m.x) > 8) {
            if (solid(m.x, tx)) { var sp = Math.abs(tx - m.x) > 70 ? 2.6 : 1.5; m.x += clamp(tx - m.x, -sp, sp); m.face = tx > m.x ? 1 : -1; m.moveT++; m.run = sp > 2; }
            else hop(m, tx, 30 + Math.min(20, Math.abs(tx - m.x) / 8), 38);
          } else { m.moveT = 0; if (fight) m.face = e.x >= m.x ? 1 : -1; else m.face = p.x >= m.x ? 1 : -1; }
          if (!X.groundAt(m.x)) { var lx = landX(m.x); if (lx !== null) hop(m, lx, 24, 30); }
        }
      }
      // 光弾
      for (i = 0; i < m.shots.length; i++) {
        s = m.shots[i]; s.t++; s.x += s.vx; s.y += s.vy;
        if (s.t % 2 === 0) X.part(s.x, s.y, -s.vx * 0.1, -s.vy * 0.1, 12, '#ff9ae6', 2, 0, true);
        if (fight) {
          var hb = { x: s.x - 4, y: s.y - 4, w: 8, h: 8 }, hbs = X.hurtboxes(e);
          for (k = 0; k < hbs.length; k++) if (R.overlap(hb, hbs[k])) { X.damageEnemy(e, 5, R.sign(s.vx), 0, { gain: 0.3, stop: 0, col: 'gold', weak: hbs[k].weak, snd: 'hit', cx: s.x, cy: s.y }); s.dead = true; break; }
        }
        if (s.t > 90) s.dead = true;
      }
      m.shots = m.shots.filter(function (q) { return !q.dead; });
    },
    // 主人公が攻撃を受ける直前（50_game.js の hurtPlayer）: 光の膜があれば、1 回だけ防ぐ
    block: function (X_) {
      var m = R.game.mako; if (!m || !m.on || m.domeT <= 0) return false;
      var p = R.game.pl; m.domeT = 0; p.inv = Math.max(p.inv, 50);
      R.snd('guard'); X_.fx({ type: 'ring', x: p.x, y: p.y - X_.MID, life: 18, r: 34, col: '#9af0ff' });
      X_.burst(p.x, p.y - X_.MID, 14, ['#9af0ff', '#ffffff', '#7dffc4'], 3, 20); X_.text(p.x, p.y - 44, 'GUARD!', '#9af0ff', true);
      return true;
    },
    // 主人公と同じ高解像度の層に描く（会話の間も描く）
    draw: function (g, cam) {
      var m = R.game.mako; if (!m || !m.on) return;
      G = R.game; var p = G.pl, t = G.t, i, f, s, x = m.x - cam, y = m.y;
      if (G.state === 'talk' && G.talk && G.talk.exitOn) x += Math.max(0, G.talk.exitT - 8) * 3.4;      // 会話の中で二人が走り去るとき、大森も一緒に（龍を倒したあとの脱出）
      var tk = G.talk, out = 0, fc = m.face;      // makoOut = この台詞から、大森だけが右へ去っていく（第2章 第1話の前: 帝国の情報を集めに、別行動へ）
      if (G.state === 'talk' && tk) for (i = 0; i <= tk.i && i < tk.lines.length; i++) if (tk.lines[i].makoOut) { if (tk.makoOutT == null) tk.makoOutT = tk.T; out = tk.T - tk.makoOutT; }
      if (out > 40) { x += (out - 40) * 2.4; fc = 1; if (x > R.W + 30) return; }      // 二人の右から、さらに右（先）へ走り去る
      g.save();
      // プロテクション: 主人公を包む、六角形の網の半球
      if (m.domeT > 0 && G.state !== 'talk') {
        var a = m.domeT < 60 ? ((t >> 2) % 2 ? 0.25 : 0.6) : 0.5 + 0.1 * Math.sin(t * 0.15), px = p.x - cam, py = p.y;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a * 0.22; g.fillStyle = '#7dffc4'; g.beginPath(); g.ellipse(px, py, 24, 34, 0, PI, 2 * PI); g.fill();
        g.globalAlpha = a; g.strokeStyle = '#9af0ff'; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(px, py, 24, 34, 0, PI, 2 * PI); g.stroke();
        for (i = 1; i < 4; i++) {      // 縦の筋（細い楕円）と、横の筋
          g.beginPath(); g.ellipse(px, py, 24 * (1 - i * 0.28), 34, 0, PI, 2 * PI); g.stroke();
          var hy = 34 * i / 4, hw = 24 * Math.sqrt(1 - (i / 4) * (i / 4)); g.fillStyle = '#9af0ff'; g.fillRect(px - hw, py - hy, hw * 2, 0.8);
        }
        g.globalAlpha = a * 0.8; g.fillStyle = '#7dffc4'; g.fillRect(px - 24, py - 1, 48, 1.5);
        g.globalCompositeOperation = 'source-over';
      }
      // リカバーの光（杖の先から主人公へ）
      if (m.healT > 0 && G.state !== 'talk') {
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 + 0.3 * Math.sin(t * 0.6); g.strokeStyle = '#7dffc4'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x + m.face * 16, y - 30); g.quadraticCurveTo((x + p.x - cam) / 2, y - 52, p.x - cam, p.y - 18); g.stroke();
        g.globalAlpha = 0.25; g.fillStyle = '#7dffc4'; g.beginPath(); g.ellipse(p.x - cam, p.y, 18, 3, 0, 0, 2 * PI); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      // 光弾
      g.globalCompositeOperation = 'lighter';
      for (i = 0; i < m.shots.length; i++) {
        s = m.shots[i];
        g.globalAlpha = 0.35; g.fillStyle = '#ff4fd0'; g.beginPath(); g.arc(s.x - cam, s.y, 5.5, 0, 2 * PI); g.fill();
        g.globalAlpha = 0.9; g.fillStyle = '#ffb8f0'; g.beginPath(); g.arc(s.x - cam, s.y, 3, 0, 2 * PI); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(s.x - cam - 1, s.y - 1, 2, 2);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // 技の足もとの光（チャージキャスト）
      if (m.act && (m.act.k === 'rez' || m.act.k === 'dome' || m.act.k === 'heal')) {
        var r = 10 + 8 * Math.min(1, m.act.t / 16);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.strokeStyle = m.act.k === 'dome' ? '#9af0ff' : '#7dffc4'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, r, r * 0.25, 0, 0, 2 * PI); g.stroke();
        for (i = 0; i < 4; i++) { var an = t * 0.08 + i * PI / 2; g.fillStyle = '#ffffff'; g.fillRect(x + Math.cos(an) * r - 0.5, y - 14 + Math.sin(an) * 10 - 0.5, 1.5, 1.5); }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }
      // 本体
      if (m.st === 'hop') { var u = Math.min(1, m.t / m.dur); f = fr('jump', u < 0.2 ? 0 : u < 0.45 ? 1 : u < 0.7 ? 2 : u < 0.9 ? 3 : 4); }
      else if (m.act) f = m.act.k === 'shot' ? fr('shot', m.act.t < 6 ? 0 : m.act.t < 12 ? 1 : 2) : m.act.k === 'heal' ? fr('heal', m.act.t < 10 ? 0 : 1) : fr('cast', (m.act.t >> 3) % 2);
      else if (G.bossDefeated || (G.boss && G.boss.st === 'die')) f = fr('victory', 0);
      else if (out > 40) f = fr('run', (t >> 2) % 4);
      else if (G.state === 'talk') f = fr('stance', (t >> 4) % 3);
      else if (m.moveT > 0) f = m.run ? fr('run', (m.t >> 2) % 4) : fr('walk', (m.t >> 3) % 4);
      else f = fr('idle', (t >> 4) % 3);
      g.globalAlpha = 0.25; g.fillStyle = '#000000'; g.beginPath(); g.ellipse(x, GY, 8, 1.6, 0, 0, 2 * PI); g.fill(); g.globalAlpha = 1;
      if (img && img.complete && img.naturalWidth && f) {
        g.imageSmoothingEnabled = false;
        g.translate(x, y); g.scale(fc * SC, SC);
        g.drawImage(img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
      }
      g.restore();
      // 来たばかりのときは、上に名前の札
      if (m.introT > 0 && G.state === 'play') {
        g.save(); g.globalAlpha = Math.min(1, m.introT / 30); g.fillStyle = '#ffb8f0'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center';
        g.fillText('茉子', x, y - 46); g.restore();
      }
    }
  };
})();

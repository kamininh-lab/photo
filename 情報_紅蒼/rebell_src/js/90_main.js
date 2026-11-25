// 起動・メインループ・画面の合成
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, I = R.input, clamp = R.clamp;
  var cv, F, bgC, fgC, bg, fg, glowC, glow, SCALE = 3, bloom = true;
  R.IMG = {};

  function loadImages() {
    var A = window.REBELL_ASSETS || {};      // ポスター・原画・顔グラフィック・武器の絵
    Object.keys(A).forEach(function (k) { var im = new Image(); im.src = A[k]; R.IMG[k] = im; });
  }
  function resize() {
    var wrap = document.getElementById('wrap'), cssW = (wrap && wrap.clientWidth) || 960, dpr = window.devicePixelRatio || 1;
    var s = clamp(Math.round(cssW * dpr / R.W), 2, 5);
    if (s !== SCALE || cv.width !== R.W * s) { SCALE = s; cv.width = R.W * s; cv.height = R.H * s; }
  }

  // 背景の看板などに重ねる文字（ドット絵の上に高解像度で描く）
  function decals() {
    var S = G.S; if (S.id !== 'school') return;
    var BG = R.BG, cam = R.viewCam, gp = BG.gatePlaque, sg = BG.schoolSign, f = '"Yu Gothic","Yu Gothic UI","Meiryo",sans-serif';
    F.save(); F.setTransform(SCALE, 0, 0, SCALE, 0, 0); F.textBaseline = 'middle'; F.textAlign = 'center';
    var sx = R.schoolX(cam) + sg.x, sy = -7 + sg.y;
    if (sx > -sg.w && sx < R.W) {
      F.font = 'bold 10.5px ' + f; F.fillStyle = 'rgba(20,14,50,.9)'; F.fillText('鹿児島玉龍中学校・高等学校', sx + sg.w / 2 + 0.5, sy + sg.h / 2 + 1.2, sg.w - 6);
      F.fillStyle = '#ffffff'; F.fillText('鹿児島玉龍中学校・高等学校', sx + sg.w / 2, sy + sg.h / 2 + 0.6, sg.w - 6);
      F.font = '5.4px ' + f; F.fillStyle = 'rgba(20,14,50,.9)'; F.fillText('Kagoshima Gyokuryu J.H.S. & H.S.', sx + sg.w / 2 + 0.4, sy + sg.h + 6.4);
      F.fillStyle = '#e8e0ff'; F.fillText('Kagoshima Gyokuryu J.H.S. & H.S.', sx + sg.w / 2, sy + sg.h + 6);
    }
    var gx = S.gate + gp.x - cam, gy = R.GY - 60 + gp.y + R.viewOy;
    if (gx > -gp.w && gx < R.W) {
      F.font = 'bold ' + (gp.h * 0.74) + 'px "Yu Mincho","Hiragino Mincho ProN",serif';
      F.fillStyle = 'rgba(10,8,30,.9)'; F.fillText('玉　龍', gx + gp.w / 2 + 0.6, gy + gp.h / 2 + 1.2);
      F.fillStyle = '#d8d0ff'; F.fillText('玉　龍', gx + gp.w / 2, gy + gp.h / 2 + 0.6);
    }
    F.restore();
  }
  // 光のにじみ。明るい所だけを縮めた絵から取り出して、上から足す。
  // 主人公のスプライトは、にじみで色が白っぽくならないよう、このあとで描く
  function doBloom() {
    glow.globalCompositeOperation = 'source-over'; glow.imageSmoothingEnabled = true;
    glow.drawImage(cv, 0, 0, glowC.width, glowC.height);        // 背景・敵・斬撃の弧
    glow.drawImage(fgC, 0, 0, glowC.width, glowC.height);       // 火花や爆発
    glow.globalCompositeOperation = 'multiply'; glow.drawImage(glowC, 0, 0);
    F.save(); F.setTransform(1, 0, 0, 1, 0, 0); F.globalCompositeOperation = 'lighter'; F.globalAlpha = 0.5; F.imageSmoothingEnabled = true;
    F.drawImage(glowC, 0, 0, cv.width, cv.height); F.restore();
  }
  function vignette() {
    var gr = F.createRadialGradient(960, 540, 420, 960, 540, 1150);
    gr.addColorStop(0, 'rgba(6,2,24,0)'); gr.addColorStop(1, 'rgba(6,2,24,.5)'); F.fillStyle = gr; F.fillRect(0, 0, 1920, 1080);
  }

  function compose() {
    resize();
    F.setTransform(1, 0, 0, 1, 0, 0); F.globalAlpha = 1; F.globalCompositeOperation = 'source-over'; F.imageSmoothingEnabled = false;
    var st = G.state, world = st === 'play' || st === 'pause' || st === 'gameover' || st === 'clear' || st === 'talk';
    if (world) {      // 奥から順に: 背景 → 看板の文字 → 敵と斬撃の弧 →（光のにじみ）→ 主人公（細かい解像度）→ 弾・火花
      R.renderBack(bg); F.drawImage(bgC, 0, 0, cv.width, cv.height);
      decals();
      if (R.Cyber) R.Cyber.holo(F, SCALE, G.S, R.viewCam, R.viewOy, G.t);      // ホログラムの看板（細かい解像度で）
      R.renderMid(fg); F.imageSmoothingEnabled = false; F.drawImage(fgC, 0, 0, cv.width, cv.height);
      R.renderFront(fg);
      if (bloom) doBloom();
      R.renderChars(F, SCALE);
      F.setTransform(1, 0, 0, 1, 0, 0); F.globalAlpha = 1; F.imageSmoothingEnabled = false; F.drawImage(fgC, 0, 0, cv.width, cv.height);
    }
    F.setTransform(SCALE / 4, 0, 0, SCALE / 4, 0, 0);
    if (st === 'talk') { vignette(); R.drawTalk(F); }      // ステージの前の会話（HUD は出さない）
    else if (world) {
      vignette(); R.drawHUD(F);
      if (st === 'pause') R.drawPause(F); else if (st === 'gameover') R.drawGameOver(F); else if (st === 'clear') R.drawClear(F);
    } else if (st === 'logo') R.drawSplash(F);
    else if (st === 'title') {
      R.drawTitle(F);
      if (G.titleFade > 0) { F.fillStyle = 'rgba(0,0,0,' + Math.min(1, G.titleFade / 36) + ')'; F.fillRect(0, 0, 1920, 1080); }      // ロゴのあと、暗い画面から現れる
    }
    else if (st === 'intro') R.drawIntro(F);
    else if (st === 'ending') R.drawEnding(F);
  }

  function update() {
    I.poll();
    var ok = I.hit.ok || I.hit.jump || I.hit.attack;
    if (I.hit.mute && window.REBELL_AUDIO) { try { window.REBELL_AUDIO.setMuted(!window.REBELL_AUDIO.isMuted()); } catch (e) { } }
    if (I.hit.bloom) bloom = !bloom;
    switch (G.state) {
      case 'logo':      // 起動時のロゴ。キーやクリックで飛ばせる
        G.t++; G.stateT++;
        if ((I.any && G.stateT > 12) || G.stateT >= R.SPLASH_LEN) {
          G.titleFade = G.stateT >= R.SPLASH_LEN ? 40 : 16;
          G.state = 'title'; G.stateT = 0; R.bgm('title');
        }
        break;
      case 'title':
        G.t++; if (G.titleFade > 0) G.titleFade--;
        if (ok) { R.onGesture(); R.snd('start'); G.state = 'intro'; G.stateT = 0; G.titleFade = 0; }
        break;
      case 'intro':
        G.t++; G.stateT++;
        if ((ok && G.stateT > 20) || R.introDone()) { R.snd('select'); R.newGame(); }
        break;
      case 'talk':      // ステージの前の会話。決定で次の台詞へ、Esc で飛ばす
        R.updateTalk(ok, I.hit.pause);
        break;
      case 'play':
        if (I.hit.pause) { G.state = 'pause'; R.snd('select'); } else R.updatePlay();
        break;
      case 'pause':
        G.t++;
        if (I.hit.pause || I.hit.ok) { G.state = 'play'; R.snd('select'); }
        break;
      case 'gameover':
        G.t++; G.stateT++;
        if (G.stateT > 50 && ok) { R.snd('start'); R.continueGame(); }
        break;
      case 'clear':
        G.t++; G.stateT++;
        if (G.stateT > 60 && ok) {
          R.snd('select');
          if (G.stageIdx + 1 < R.STAGES.length) {
            R.startStage(G.stageIdx + 1, false, R.STAGES[G.stageIdx + 1].talk);      // HP と SP は、前のステージを終えたときのまま持ち越す（回復しない）。会話があれば、その前にはさむ
          } else { G.state = 'ending'; G.stateT = 0; R.bgm('title'); }
        }
        break;
      case 'ending':
        G.t++; G.stateT++;
        if (G.stateT > 120 && ok) { G.state = 'title'; G.stateT = 0; G.titleFade = 24; }      // エンディングからは、ロゴなしでタイトルへ
        break;
    }
  }

  var last = 0, acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (R.debugHold) return;
    var dt = Math.min(100, ts - last); last = ts; acc += dt;
    var n = 0;
    while (acc >= 16.6 && n < 4) { update(); acc -= 16.667; n++; }
    if (n >= 4) acc = 0;
    try { compose(); } catch (e) { if (!R.drawErr) { R.drawErr = e; var el = document.getElementById('err'); if (el) el.textContent += 'draw: ' + (e && e.stack || e) + '\n'; } }
  }
  // 動作確認用: n コマ進めて描く
  R.step = function (n, noDraw) { for (var i = 0; i < (n || 1); i++) update(); if (!noDraw) compose(); return G.state; };

  window.addEventListener('DOMContentLoaded', function () {
    cv = document.getElementById('screen'); F = cv.getContext('2d');
    bgC = R.mk(R.W, R.H); fgC = R.mk(R.W, R.H); bg = bgC.getContext('2d'); fg = fgC.getContext('2d');
    glowC = R.mk(120, 68); glow = glowC.getContext('2d');
    loadImages();
    R.buildEnemies(); R.buildStages();
    G.pl = null; G.S = R.STAGES[0];
    G.state = 'logo'; G.stateT = 0; G.titleFade = 0;      // まずロゴ（GYOKURYU → PHOTO TEAM → presents By KONOMI）を出してから、タイトルへ
    try { if (document.fonts && document.fonts.load) { document.fonts.load('20px DotGothic16'); } } catch (e) { }
    cv.addEventListener('pointerdown', function () { cv.focus(); });
    window.addEventListener('resize', resize);
    // 主人公と中ボスのスプライトを読み込んでから始める
    R.loadChars(function () { R.loadKarate(function () { R.loadDragon(function () { R.ready = true; requestAnimationFrame(frame); }); }); });
  });
})();

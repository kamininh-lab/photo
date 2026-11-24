// 紅（くれない）と蒼（あおい）の絵。
// 用意されたスプライトシートから切り出したコマ（06_sprites.js）を読み込み、1 コマずつ使えるようにする。
// シートの 1 ドットはゲームの 0.5 ドット（ゲームの画面より細かいので、キャラだけ高解像度で描く）。
(function () {
  'use strict';
  var R = window.REBELL;
  R.SPR = {};                 // 敵やアイテムの絵（30_enemies.js）もここに入る
  R.CHAR_K = 0.5;             // シートの 1 ドット = ゲームの 0.5 ドット
  R.CHAR_MID = 17;            // 体の中心の高さ（ゲームのドット数）。回転の軸やエフェクトの位置に使う

  // 立ちポーズ。シートの待機・構えのコマは 1 枚ごとに絵が少しずつ違い、順に回すとちらつくので、
  // きれいな 1 枚を選び、呼吸の動き（体と頭を 1 ドットずつ沈める）をプログラムで付ける。
  //   i = 使うコマ、knee・neck = 体を分ける高さ（足元からのドット数。ひざの上・首）、len = 呼吸 1 回のフレーム数
  R.STAND = {
    kurenai: { idle: { i: 1, knee: 16, neck: 40, len: 132 }, stance: { i: 0, knee: 15, neck: 37, len: 76 } },
    aoi: { idle: { i: 0, knee: 19, neck: 44, len: 132 }, stance: { i: 2, knee: 17, neck: 43, len: 76 } }
  };
  // 呼吸の段階 → [体の沈み, 頭の沈み]。体が先に沈み、頭が少し遅れてついてくる（戻るときも同じ）
  R.breath = function (st, t) {
    var u = (t % st.len) / st.len;
    return u < 0.30 ? [0, 0] : u < 0.39 ? [1, 0] : u < 0.80 ? [1, 1] : u < 0.89 ? [0, 1] : [0, 0];
  };

  // 1 コマ = { c: 絵, w, h, ox, oy: 基準点（体の中心・足元）, tint: 単色版の置き場 }
  function slice(img, f) {
    var c = R.mk(f[2], f[3]);
    c.getContext('2d').drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    return { c: c, w: f[2], h: f[3], ox: f[4], oy: f[5], tint: {} };
  }
  // 2 人ぶんの絵を読み込み、終わったら done() を呼ぶ
  R.loadChars = function (done) {
    var S = window.REBELL_SPRITES || {}, whos = ['kurenai', 'aoi'], left = whos.length;
    function fin() { if (--left === 0) done(); }
    whos.forEach(function (who) {
      var img = new Image();
      img.onload = function () {
        var out = {}, fr = S[who].frames;
        for (var g in fr) out[g] = fr[g].map(function (f) { return slice(img, f); });
        R.SPR[who] = out; fin();
      };
      img.onerror = function () {
        var el = document.getElementById('err'); if (el) el.textContent += 'スプライトを読み込めませんでした: ' + who + '\n';
        fin();
      };
      if (S[who]) img.src = S[who].img; else img.onerror();
    });
  };
  // コマを取り出す（番号がはみ出したら最後のコマ）
  R.frame = function (who, group, i) { var a = R.SPR[who][group]; return a[i < a.length ? i : a.length - 1]; };
  // 単色で塗りつぶしたコマ（被弾の白フラッシュ、残像）。一度作ったら使い回す
  R.tinted = function (f, col) { return f.tint[col] || (f.tint[col] = R.tint(f.c, col)); };
  // コマを描く。(x, y) = 基準点を置く位置、k = シートの 1 ドットを何ドットで描くか、face = 向き（1 / -1）
  R.drawFrame = function (g, f, x, y, k, face, col) {
    var c = col ? R.tinted(f, col) : f.c;
    g.save(); g.translate(x, y); g.scale((face || 1) * k, k);
    g.drawImage(c, -f.ox, -f.oy); g.restore();
  };
})();

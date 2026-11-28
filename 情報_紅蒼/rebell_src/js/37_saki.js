// 大倉 咲（サポート／アニマル・マリン）。いまは会話の中で立つだけ（第2章 第2話のボスを倒したあとの会話 beast_end）。戦いには、まだ加わらない。
//   絵は 09_saki_art.js（make_saki.py が作る）。主人公と同じ高解像度の層に描く（55_render.js の renderChars の会話のところから）
(function () {
  'use strict';
  var R = window.REBELL, D = window.REBELL_SAKI, img = null, SC = 1.08;
  if (D) { img = new Image(); img.src = D.img; }
  R.Saki = {
    // 会話の中で、咲の最初の台詞から歩いてきて、二人の向かい（ボスのいた側）に立つ
    draw: function (g, cam) {
      var G = R.game, tk = G.talk, p = G.pl, i, k0 = -1;
      if (!img || !tk || !D) return;
      for (i = 0; i < tk.lines.length; i++) if (tk.lines[i].who === 'saki') { k0 = i; break; }
      if (k0 < 0 || tk.i < k0) { tk.sakiT = null; return; }
      if (tk.sakiT == null) tk.sakiT = tk.T;
      var side = tk.vs && tk.vs.x < p.x ? -1 : 1;      // 二人が向いている側から来る
      var tx = p.x + side * 74; tx = Math.max(cam + 22, Math.min(cam + R.W - 22, tx));
      var u = Math.min(1, (tk.T - tk.sakiT) / 46), sx = side > 0 ? cam + R.W + 16 : cam - 16, x = sx + (tx - sx) * u - cam, y = p.y;
      var F = D.frames.idle, f = F[u < 1 ? (tk.T >> 2) % F.length : (tk.T >> 4) % F.length];
      if (u < 1) y -= Math.abs(Math.sin((tk.T - tk.sakiT) * 0.4)) * 2;      // 小走り
      var ln = tk.lines[tk.i]; if (u >= 1 && ln.who === 'saki' && tk.t < 14) y -= Math.round(4 * Math.sin(Math.PI * tk.t / 14));      // 話しはじめに、ぴょこん
      g.save();
      g.globalAlpha = 0.25; g.fillStyle = '#000000'; g.beginPath(); g.ellipse(x, p.y, 8, 1.6, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.imageSmoothingEnabled = false; g.translate(x, y); g.scale(-side * SC, SC);
      g.drawImage(img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
      g.restore();
    }
  };
})();

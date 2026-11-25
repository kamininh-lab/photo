// ステージの前の会話シーン。台詞ごとに、話す子の顔のカットイン（斜めの帯）がすべり込む。
// 画面は 1920x1080 の仮想座標（HUD と同じ）。二人の立ち姿だけは、ゲームの座標で 55_render.js から描く。
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, U = R.UI, T = U.T, panel = U.panel, PI = Math.PI;
  var PINK = '#ff4fb0', CYAN = '#37e6ff', PICS = {};
  var IN = 30, OUT = 34, SPEED = 0.55, GAP = 50;      // IN = 会話が始まるまでの間、OUT = 終わりの演出の長さ、SPEED = 1 フレームに出る文字数、GAP = 二人の間隔

  // 台本。who = 話す子、face = 表情（normal / anger / joy / damage）、
  //       pose = 立ち姿（'event' = 決めポーズ、'stance' = 構え。省略すると、ふつうの立ち姿）、text = 台詞（1 行ずつ。30 文字まで）
  // このみさんの作品解説に沿った会話にしてある:
  //   性格も戦い方も正反対の二人が、ひとつの魔法陣を介して共に戦う。違うからこそ噛み合う。
  //   紅 = 大鎌を手に、荒々しく踏み込む。蒼 = 静かな微笑みのまま刀を構え、流れを読む。
  R.TALKS = {
    // 四角 明宏（しかく あきひろ）= 二人の武器を作ったメカニック。通信で二人を支える（その場にはいないので、立ち姿は出ない）。
    //   四角の face は smile / serious / shout（シートの大きな絵と、カットインの絵）。台詞の中身はシートの説明と決め台詞に沿わせた
    stage1: [
      { who: 'kurenai', face: 'normal', text: ['うわ、機械兵だらけ……。', 'ねえ蒼、まとめて薙ぎ払っちゃっていい？'] },
      { who: 'aoi', face: 'normal', text: ['待って、紅。まずは流れを読ませて。', '姫さまを助ける前に、こちらが倒れたら意味がないから。'] },
      { who: 'shikaku', face: 'smile', text: ['――二人とも、聞こえる？　こちら四角。', '解析が終わった。ここからは、ぼくも通信で手伝うよ。'] },
      { who: 'kurenai', face: 'joy', text: ['四角！　いいところに！', 'この大鎌、今日もすっごく調子いいよ！'] },
      { who: 'shikaku', face: 'smile', text: ['当然。その大鎌も、蒼の刀も、ぼくが作ったんだから。', '壊れたら、直せばいい。……あ、もっといいものに改良しよう。'] },
      { who: 'aoi', face: 'joy', text: ['ふふ、頼りにしてる。', 'それで四角、姫さまの居場所は？'] },
      { who: 'shikaku', face: 'serious', text: ['この水道橋を抜けた先、玉龍学園のいちばん奥。', '姫さまは、あの《龍》に囚われている。'] },
      { who: 'kurenai', face: 'anger', text: ['だったら急がなきゃ！', '月がもっと紅くなる前に、助け出すんだから！'] },
      { who: 'kurenai', face: 'joy', text: ['へへっ、やることは、いつもどおりだね。', 'あたしが道をこじ開けて、蒼がその隙を縫う！'] },
      { who: 'aoi', face: 'joy', text: ['重くて強い大鎌と、軽くて速い刀。', '正反対だから、噛み合うんだよ。'] },
      { who: 'shikaku', face: 'serious', text: ['武器は魔法陣でつないである。疲れたら、すぐ交代して。', '力が満ちたら、重ねるんだ。――『紅蒼交錯』を。'] },
      { who: 'shikaku', face: 'shout', text: ['機械兵、来るよ！　道案内と解析は、ぼくに任せて。', '行って、二人とも！'] },
      { who: 'kurenai', face: 'anger', pose: 'event', text: ['よーし、行くよ、蒼！', '待ってて、姫さま。いま助けに行く！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['ええ、紅。背中は任せて。', '四角、案内をお願い。'] }
    ],
    // ステージ 2（鉄塔）の前: 見上げるほど高い塔を前に二人がためらい、四角が通信で励ます
    tower: [
      { who: 'kurenai', face: 'damage', text: ['……え、ちょっと待って。', 'これ、てっぺんが見えないんだけど……。'] },
      { who: 'aoi', face: 'normal', text: ['足場は細くて、風も強い。', '一度踏み外したら、もう戻れない高さね。'] },
      { who: 'kurenai', face: 'damage', text: ['あたし、高いところは、ちょっと……。', 'ねえ、回り道とか、ないのかな？'] },
      { who: 'shikaku', face: 'serious', text: ['――聞こえる？　こちら四角。', '学園へ渡る橋は、《龍》の結界で塞がれてる。'] },
      { who: 'shikaku', face: 'serious', text: ['この鉄塔のてっぺんから、結界の上を越えるしかない。', '道は、ここだけなんだ。'] },
      { who: 'aoi', face: 'damage', text: ['……でも、四角。', 'もし途中で、足を踏み外したら……。'] },
      { who: 'shikaku', face: 'smile', text: ['大丈夫。足場は全部、下からすり抜けられる。', '真下から跳べば、上の足場に乗れるよ。'] },
      { who: 'shikaku', face: 'smile', text: ['それに、その大鎌も刀も、ぼくが軽く作ってある。', '二人の跳ぶ力を、いちばん活かせるように。'] },
      { who: 'kurenai', face: 'normal', text: ['……四角の作った武器なら、信じられる。', 'でも、やっぱり下は見たくないなぁ。'] },
      { who: 'shikaku', face: 'shout', text: ['なら、上だけ見て！　下は、ぼくが見張ってる。', '途中の端末に触れれば、そこからやり直せる。'] },
      { who: 'aoi', face: 'joy', text: ['……ふふ。上だけ見て、か。', '紅、わたしが先に流れを読む。ついてきて。'] },
      { who: 'kurenai', face: 'anger', pose: 'event', text: ['ううん、先に行くのは、あたし！', '怖いのは、てっぺんに着いてから叫ぶ！'] },
      { who: 'shikaku', face: 'smile', text: ['その意気だ。てっぺんで、また通信する。', '――行って、二人とも！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['ええ。行きましょう、紅。', '姫さまは、この塔の、もっと先。'] }
    ],
    // 中ボス「黒瀬 龍士」と初めて会ったとき（52_karate.js の enter から）。
    // シートの説明に沿わせてある: カメラを手にする異色の武闘家。正体と目的は謎。卓越した空手の技術で立ちはだかる
    //   黒瀬の face: camera（カメラを構えた笑み）/ old（1 枚目のシートの絵）/ grin（不敵な笑みの寄り）/ reach（手を突き出す）
    kurose: [
      { who: 'kurose', face: 'camera', text: ['――そこまでだ。', 'いい月、いい顔だ。一枚、撮らせてもらう。'] },
      { who: 'kurenai', face: 'anger', text: ['誰！？　こっちは急いでるの！', '姫さまが、あの《龍》に捕まってるんだから！'] },
      { who: 'kurose', face: 'old', text: ['知っている。だから、ここで確かめる。', '姫を取り戻せるだけの腕が、あるのかどうかをな。'] },
      { who: 'aoi', face: 'normal', text: ['……紅、気をつけて。この人、流れが読めない。', '構えは空手。でも、あのカメラ……何かある。'] },
      { who: 'kurose', face: 'grin', text: ['いい読みだ。拳も、蹴りも、光も――', '全部見切れたら、通してやる。'] },
      { who: 'kurose', face: 'reach', text: ['黒瀬 龍士。通りすがりの、ただの空手使いだ。', 'さあ――二人まとめて、かかってこい。'] },
      { who: 'kurenai', face: 'anger', pose: 'stance', text: ['言ったね！　行くよ、蒼！'] }
    ]
  };
  // 話し手ごとの見た目。side = カットインがすべり込んでくる側（-1 = 左、1 = 右）。portrait = 顔グラフィックの代わりに、シートの大きな絵を使う
  var WHO = {
    kurenai: { side: -1, col: PINK, dark: '#40103c', lite: '#8a2062', mid: '#6a1a58', plate: '#5a1650', name: '紅', kana: 'くれない', en: 'KURENAI', icon: 'iconKurenai' },
    aoi: { side: 1, col: CYAN, dark: '#0c1450', lite: '#1a36a8', mid: '#152a80', plate: '#12246e', name: '蒼', kana: 'あおい', en: 'AOI', icon: 'iconAoi' },
    kurose: { side: 1, col: '#c98bff', dark: '#170a30', lite: '#4a2890', mid: '#2e1960', plate: '#2a1650', name: '黒瀬', kana: 'くろせ', en: 'KUROSE RYUJI', icon: null, portrait: true, pics: true },
    // 四角: 通信で話す。pics = 表情ごとの絵（09_shikaku_art.js）、tag = 帯に出す小さな札
    shikaku: { side: 1, col: '#ffc84a', dark: '#07122e', lite: '#1c4a86', mid: '#123260', plate: '#143058', name: '四角', kana: 'しかく', en: 'SHIKAKU AKIHIRO', icon: null, pics: true, tag: '通信中  ‐  SUPPORT' }
  };
  // 四角の絵を読み込んでおく（会話が始まるまでに間に合う）
  (function () {
    var D = window.REBELL_SHIKAKU || {}, k, im;
    for (k in D) { im = new Image(); im.src = D[k]; PICS['shikaku_' + k] = im; }
  })();

  function count(ln) { var n = 0, i; for (i = 0; i < ln.text.length; i++) n += ln.text[i].length; return n; }
  function shownOf(tk) { return tk.full ? 999 : Math.max(0, Math.floor((tk.t - 6) * SPEED)); }

  // 会話を始める（startStage から呼ばれる）。章の題と曲は、会話が終わってから出す
  //   i = 何番目の台詞か、t = その台詞が始まってからのフレーム数、T = 会話全体のフレーム数、
  //   inT = 入りの演出、outT = 終わりの演出（-1 = まだ）、full = 台詞を全部出したか、prev = すべり出ていく前のカットイン
  //   opt.vs = 向かい合っている相手（中ボス）。ステージの途中の会話で、終わったらそのまま戦いに戻る
  R.beginTalk = function (key, opt) {
    var C = G.pl.chars, lines = R.TALKS[key].filter(function (ln) { return !(C[ln.who] && C[ln.who].down); });      // 戦闘不能の子の台詞は飛ばす
    G.talk = { key: key, lines: lines, i: 0, t: 0, T: 0, inT: 0, outT: -1, full: false, prev: null, vs: (opt && opt.vs) || null };
    G.state = 'talk'; G.stateT = 0;
  };
  function leave(tk) { tk.outT = 0; tk.prev = null; R.snd('switch'); }
  function finish() {
    var vs = G.talk.vs;
    G.pl.animT = G.talk.T;      // 立ち姿の呼吸を、会話中の続きから
    G.talk = null; G.state = 'play'; G.stateT = 0;
    if (!vs) R.openStage();     // ステージの前の会話なら、ここで章の題と曲
  }
  // ok = 決定（台詞を全部出す → 次の台詞へ）、skip = 会話を飛ばす
  R.updateTalk = function (ok, skip) {
    var tk = G.talk, ln;
    if (!tk) { G.state = 'play'; return; }
    G.t++; tk.T++; tk.inT++;
    if (tk.vs && R.Karate) R.Karate.talkPose(tk.vs, tk.inT >= IN && tk.outT < 0 && tk.lines[tk.i].who === 'kurose', tk.T);      // 中ボスは、話すときだけ手招きする
    if (G.fadeDir) { G.fade = R.clamp(G.fade + G.fadeDir * 0.04, 0, 1); if (G.fade === 0 || G.fade === 1) G.fadeDir = 0; }
    if (tk.prev && ++tk.prev.t > 8) tk.prev = null;
    if (tk.outT >= 0) { if (++tk.outT >= OUT) finish(); return; }
    if (skip && tk.inT > 10) { leave(tk); return; }
    if (tk.inT < IN) return;
    tk.t++;
    if (ok && tk.t > 6) {
      ln = tk.lines[tk.i];
      if (shownOf(tk) < count(ln)) tk.full = true;                                    // 出ている途中なら、まず全部出す
      else if (tk.i + 1 < tk.lines.length) { tk.prev = { who: ln.who, face: ln.face, t: 0 }; tk.i++; tk.t = 0; tk.full = false; R.snd('select'); }
      else leave(tk);                                                                 // 最後の台詞のあと: 蒼が跳び去って、ステージが始まる
    }
  };

  // ---- 二人の立ち姿（ゲームの座標。55_render.js の renderChars から呼ばれる。draw = コマを描く関数）----
  R.talkChars = function (g, cam, draw) {
    var tk = G.talk; if (!tk) return;
    var ln = tk.lines[tk.i], p = G.pl, kx = p.x, started = tk.inT >= IN;
    // leap = 終わりに跳び去る距離（0 なら、その場に残る）
    function actor(who, x, face, ph, leap) {
      var S = R.STAND[who], st = S.idle, f, br, y = R.GY, a = 1, v;
      var speaking = started && tk.outT < 0 && ln.who === who;
      if (speaking && ln.pose === 'event') { f = R.frame(who, 'event', 1); st = null; }
      else { if (speaking && ln.pose === 'stance') st = S.stance; f = R.frame(who, st === S.idle ? 'idle' : 'stance', st.i); }
      if (st) { v = R.breath(st, tk.T + ph); br = { knee: st.knee, neck: st.neck, d: v[0], e: v[1] }; }
      if (speaking && tk.t < 14) y -= Math.round(5 * Math.sin(PI * tk.t / 14));       // 話しはじめに、ぴょこんと跳ねる
      if (leap && tk.outT >= 0) {                                                      // 終わり: 相棒は後ろへ跳んで、姿を消す（交代を待つ）
        v = Math.min(1, tk.outT / 26);
        x -= leap * R.ease(v); y -= Math.round(74 * Math.sin(PI * v * 0.8)); a = 1 - v * v;
        f = R.frame(who, 'jump', v < 0.3 ? 2 : v < 0.65 ? 3 : 4); br = null;
      }
      if (a <= 0) return;
      g.globalAlpha = a; draw(g, f, x - cam, y, face, 0, 1, 1, null, br); g.globalAlpha = 1;
    }
    if (tk.vs) {      // 中ボスと向かい合う: いま操作している子が前、相棒はその後ろに控える
      var fc = tk.vs.x >= kx ? 1 : -1, act = p.who, par = act === 'kurenai' ? 'aoi' : 'kurenai';
      if (!p.chars[par].down) actor(par, kx - fc * 30, fc, 40, fc * 44);      // 倒れている相棒は、立たせない
      actor(act, kx, fc, 0, 0);
      return;
    }
    actor('aoi', kx + GAP, -1, 40, GAP + 34);      // 蒼を先に描く（跳び去るとき、紅の後ろを通る）
    actor('kurenai', kx, 1, 0, 0);
  };
  // 中ボスの大きな絵（顔とカメラが入るように、上寄りを切り取る）
  function drawPortrait(g, x, y, w, h) {
    var im = R.IMG.midPortrait;
    if (!im || !im.complete || !im.naturalWidth) return;
    var sw = im.naturalWidth, sh = Math.min(im.naturalHeight, sw * h / w), sy = Math.min(im.naturalHeight - sh, im.naturalHeight * 0.06);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, 0, sy, sw, sh, x, y, w, h);
  }

  // ---- カットイン: 斜めの帯に、話す子の顔。紅は左から、蒼は右からすべり込む ----
  //   k = 出ぐあい（0〜1）、tt = 流れる光の筋の時刻、pt = この表情になってからのフレーム数
  function band(g, who, expr, k, tt, pt) {
    if (k <= 0) return;
    var W = WHO[who], K = W.side < 0, col = W.col, dark = W.dark, lite = W.lite, mid = W.mid;      // K = 左からすべり込む（紅）。蒼と中ボスは右から
    var w = 1250, h = 300, sk = 84, y = 138, x0 = K ? -90 : 1920 + 90 - w - sk, i, gr, im;
    g.save(); g.translate((1 - k) * (K ? -1 : 1) * (w + 240), 0);
    g.beginPath(); g.moveTo(x0 + sk, y); g.lineTo(x0 + w + sk, y); g.lineTo(x0 + w, y + h); g.lineTo(x0, y + h); g.closePath();
    g.save(); g.clip();
    gr = g.createLinearGradient(x0, 0, x0 + w + sk, 0); gr.addColorStop(K ? 0 : 1, lite); gr.addColorStop(K ? 1 : 0, dark);
    g.fillStyle = gr; g.fillRect(x0, y, w + sk, h);
    // 武器の絵（大鎌・刀）を、帯のまん中にうっすらと
    im = W.icon ? R.IMG[W.icon] : null;
    if (im && im.complete && im.naturalWidth) { g.globalAlpha = 0.34; g.imageSmoothingEnabled = true; g.drawImage(im, K ? x0 + 596 : x0 + w + sk - 596 - 330, y + 40, 330, 220); g.globalAlpha = 1; }
    // 顔（出た瞬間は少し大きく、すぐ戻る）
    var fw = 450, fh = 306, fx = K ? x0 + 150 : x0 + w + sk - 150 - fw, pop = 1 + 0.07 * Math.max(0, 1 - pt / 9);
    g.save(); g.translate(fx + fw / 2, y + h / 2); g.scale(pop, pop);
    im = W.pics ? (who === 'kurose' ? R.IMG['midPic_' + expr] : (PICS[who + '_' + expr] || PICS[who + '_smile'])) : null;      // 黒瀬の絵は 52_karate.js が読み込む
    if (im && im.complete && im.naturalWidth) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, -fw / 2, -fh / 2, fw, fh); }
    else if (W.portrait) drawPortrait(g, -fw / 2, -fh / 2, fw, fh); else U.drawFace(g, who, expr, 'hud', -fw / 2, -fh / 2, fw, fh);
    g.restore();
    // 顔の両端を、帯の色になじませる
    gr = g.createLinearGradient(K ? fx + fw - 150 : fx, 0, K ? fx + fw : fx + 150, 0);
    gr.addColorStop(K ? 0 : 1, 'rgba(0,0,0,0)'); gr.addColorStop(K ? 1 : 0, mid);
    g.fillStyle = gr; g.fillRect(K ? fx + fw - 150 : fx - 2, y, 154, h);
    gr = g.createLinearGradient(K ? fx : fx + fw - 70, 0, K ? fx + 70 : fx + fw, 0);
    gr.addColorStop(K ? 0 : 1, lite); gr.addColorStop(K ? 1 : 0, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(K ? fx - 2 : fx + fw - 70, y, 74, h);
    // 流れる光の筋
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.34;
    for (i = 0; i < 5; i++) { g.fillStyle = i % 2 ? col : '#ffffff'; g.fillRect(x0 + ((tt * 40 + i * 330) % (w + 300)) * (K ? 1 : -1) + (K ? 0 : w), y + 26 + i * 58, 280, 5 + i % 2 * 4); }
    g.restore();
    // ふち（上下と、画面の内側の端）
    var ex0 = K ? x0 + w + sk : x0 + sk, ex1 = K ? x0 + w : x0;
    g.lineJoin = 'miter'; g.lineWidth = 7; g.strokeStyle = '#ffffff';
    g.beginPath(); g.moveTo(x0 + sk, y); g.lineTo(x0 + w + sk, y); g.moveTo(x0, y + h); g.lineTo(x0 + w, y + h); g.moveTo(ex0, y); g.lineTo(ex1, y + h); g.stroke();
    g.lineWidth = 3; g.strokeStyle = col;
    g.beginPath(); g.moveTo(x0 + sk, y + 9); g.lineTo(x0 + w + sk, y + 9); g.moveTo(x0, y + h - 9); g.lineTo(x0 + w, y + h - 9); g.stroke();
    // 名前
    var nx = K ? x0 + w - 200 : x0 + sk + 216;
    T(g, W.name, nx, y + (W.name.length > 1 ? 184 : 190), W.name.length > 1 ? 140 : 168, col, 'center', U.MIN, '#ffffff', 9);
    T(g, W.en, nx, y + 246, 30, '#ffffff', 'center', U.font, '#120a30', 6);
    if (W.tag) {      // 通信の札（点が明滅する）
      panel(g, nx - 150, y + 24, 300, 40, 8, 'rgba(6,14,40,.8)', col, 3);
      g.fillStyle = (tt >> 4) % 2 ? '#ff5a6a' : '#7a2030'; g.beginPath(); g.arc(nx - 126, y + 44, 7, 0, PI * 2); g.fill();
      T(g, W.tag, nx + 12, y + 53, 24, '#ffffff', 'center', U.font, '#120a30', 5);
    }
    g.restore();
  }

  // ---- 台詞の枠 ----  k = 出ぐあい（下からせり上がる）
  function box(g, tk, ln, k) {
    var W = WHO[ln.who], K = W.side < 0, col = W.col, x = 250, w = 1420, h = 204, y = 806 + (1 - k) * 320, n = shownOf(tk), i;
    panel(g, x, y, w, h, 18, 'rgba(14,9,44,.92)', col, 5); panel(g, x + 9, y + 9, w - 18, h - 18, 12, null, 'rgba(255,255,255,.3)', 2);
    // 名札（紅は左、蒼と中ボスは右）
    var nw = 286, nx = K ? x + 46 : x + w - 46 - nw, two = W.name.length > 1;
    panel(g, nx, y - 36, nw, 62, 12, W.plate, col, 4);
    T(g, W.name, nx + (two ? 78 : 54), y + 12, 50, '#ffffff', 'center', U.MIN, '#120a30', 6);
    T(g, W.kana, nx + (two ? 142 : 100), y + 7, 30, '#ffffff', 'left', U.font, '#120a30', 5);
    // 台詞（1 文字ずつ出る）
    var y0 = y + (ln.text.length > 1 ? 106 : 138);
    for (i = 0; i < ln.text.length && n > 0; i++) { T(g, ln.text[i].slice(0, n), x + 70, y0 + i * 64, 44, '#ffffff', 'left', U.font, '#120a30', 8); n -= ln.text[i].length; }
    // 出し終わったら、続きの印
    if (shownOf(tk) >= count(ln) && tk.outT < 0 && (tk.T >> 4) % 2 === 0) {
      var ax = x + w - 74, ay = y + h - 50;
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(ax - 15, ay); g.lineTo(ax + 15, ay); g.lineTo(ax, ay + 18); g.closePath(); g.fill();
    }
  }

  R.drawTalk = function (g) {
    var tk = G.talk; if (!tk) return;
    var ln = tk.lines[tk.i], out = tk.outT >= 0, oa = out ? 1 - R.ease(Math.min(1, tk.outT / 18)) : 1, vis = R.ease(Math.min(1, tk.inT / 20)) * oa;
    g.save();
    // 背景を少し暗くして、上下に黒い帯（映画のような画面）
    g.fillStyle = 'rgba(6,3,22,' + (0.34 * vis) + ')'; g.fillRect(0, 0, 1920, 1080);
    var bh = 62 * vis; g.fillStyle = '#05030f'; g.fillRect(0, 0, 1920, bh); g.fillRect(0, 1080 - bh, 1920, bh + 2);
    // カットイン（前の台詞の帯はすべり出て、いまの台詞の帯がすべり込む）
    if (tk.prev) band(g, tk.prev.who, tk.prev.face, 1 - R.ease(Math.min(1, tk.prev.t / 7)), tk.T, 99);
    if (tk.inT >= IN) band(g, ln.who, ln.face, out ? oa : R.ease(Math.min(1, tk.t / 9)), tk.T, out ? 99 : tk.t);
    // 台詞の枠と、操作の案内
    if (tk.inT >= IN - 12) {
      box(g, tk, ln, out ? oa : R.ease(Math.min(1, (tk.inT - (IN - 12)) / 12)));
      g.globalAlpha = oa * R.clamp((tk.inT - IN) / 12, 0, 1);      // 案内は、枠が出きってから
      T(g, R.input.usePad ? 'A：次へ　　START：スキップ' : 'Enter / Space：次へ　　Esc：スキップ', 1668, 1058, 24, '#b8a8f0', 'right', U.font);
      g.globalAlpha = 1;
    }
    // ステージの入りのフェード
    if (G.fade > 0) { g.fillStyle = 'rgba(5,4,15,' + G.fade + ')'; g.fillRect(0, 0, 1920, 1080); }
    g.restore();
  };
})();

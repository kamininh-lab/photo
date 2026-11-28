// ステージの前の会話シーン。台詞ごとに、話す子の顔のカットイン（斜めの帯）がすべり込む。
// 画面は 1920x1080 の仮想座標（HUD と同じ）。二人の立ち姿だけは、ゲームの座標で 55_render.js から描く。
(function () {
  'use strict';
  var R = window.REBELL, G = R.game, U = R.UI, T = U.T, panel = U.panel, PI = Math.PI;
  var PINK = '#ff4fb0', CYAN = '#37e6ff', PICS = {};
  var IN = 30, OUT = 34, SPEED = 0.55, GAP = 50;      // IN = 会話が始まるまでの間、OUT = 終わりの演出の長さ、SPEED = 1 フレームに出る文字数、GAP = 二人の間隔

  // 台本。who = 話す子、face = 表情（normal / anger / joy / damage / sad 悲しみ / silly おとぼけ / shy 照れ）、
  //       pose = 立ち姿（'event' = 決めポーズ、'stance' = 構え。省略すると、ふつうの立ち姿）、text = 台詞（1 行ずつ。30 文字まで）
  // このみさんの作品解説に沿った会話にしてある:
  //   性格も戦い方も正反対の二人が、ひとつの魔法陣を介して共に戦う。違うからこそ噛み合う。
  //   紅 = 大鎌を手に、荒々しく踏み込む。蒼 = 静かな微笑みのまま刀を構え、流れを読む。
  R.TALKS = {
    // 四角 明宏（よすみ あきひろ）= 二人の武器を作ったメカニック。通信で二人を支える（その場にはいないので、立ち姿は出ない）。
    //   四角の face は smile / serious / shout（シートの大きな絵と、カットインの絵）。台詞の中身はシートの説明と決め台詞に沿わせた
    //   後半は、武器を作った四角が「おさらい」として、連続攻撃・チャージ攻撃・交代（切り替え）・合体技を自然に教える
    stage1: [
      { who: 'kurenai', face: 'silly', text: ['うわ、機械兵がいっぱい！', 'ねえ蒼、まとめて薙ぎ払っちゃっていい？'] },
      { who: 'aoi', face: 'normal', text: ['待って、紅。先に流れを読ませて。', '姫さまを助ける前に倒れたら、意味がないよ。'] },
      { who: 'shikaku', face: 'smile', text: ['――二人とも、聞こえる？　こちら四角。', '解析が終わった。ここからは、ぼくも通信で手伝うよ。'] },
      { who: 'kurenai', face: 'joy', text: ['四角！　ナイスタイミング！', 'この大鎌、今日もぜっこうちょうだよ！'] },
      { who: 'shikaku', face: 'smile', text: ['当然。その大鎌も、蒼の刀も、ぼくが作ったんだから。', '壊れたら、直せばいい。……あ、もっといいものに改良しよう。'] },
      { who: 'aoi', face: 'joy', text: ['ふふっ、頼りにしてるね。', 'それで四角、姫さまの居場所は？'] },
      { who: 'shikaku', face: 'serious', text: ['この水道橋を抜けた先、玉龍学園のいちばん奥。', '姫さまは、あの《龍》に囚われている。'] },
      { who: 'kurenai', face: 'joy', text: ['よーし、だったら急ごう！', '月がもっと紅くなる前に、ぱぱっと助け出すよ！'] },
      // ここから、武器のおさらい（連続攻撃 → チャージ攻撃 → 交代 → 合体技）
      { who: 'shikaku', face: 'serious', text: ['焦らないで。急ぐなら、武器のおさらいをしておこう。', '攻撃は、続けて振るほど技がつながって連撃になる。'] },
      { who: 'kurenai', face: 'silly', text: ['それなら得意！　どんどん振ればいいんだよね？', 'あたしの大鎌、止まらないよー！'] },
      { who: 'shikaku', face: 'smile', text: ['それと、攻撃ボタンを押したまま、力をためてみて。', '刃が光ったら離す。――大技のチャージ攻撃が出るよ。'] },
      { who: 'aoi', face: 'normal', text: ['重くて強い大鎌と、軽くて速い刀。', '正反対だから、相手に合わせて入れ替われるね。'] },
      { who: 'shikaku', face: 'serious', text: ['そう。二人の武器は、魔法陣でつないである。', '切り替えれば一瞬で交代。疲れた方は後ろで休める。'] },
      { who: 'kurenai', face: 'joy', text: ['へへっ、やることはいつもどおり！', 'あたしが道をこじ開けて、蒼がその隙を縫う！'] },
      { who: 'shikaku', face: 'serious', text: ['敵に攻撃を当てるほど、二人の交錯ゲージがたまる。', '満ちたら、力を重ねるんだ。――『紅蒼交錯』を。'] },
      { who: 'aoi', face: 'shy', text: ['二人の技を、ひとつに……。', 'うん。正反対だから、噛み合うんだよね。'] },
      { who: 'shikaku', face: 'shout', text: ['機械兵、来るよ！　道案内と解析は、ぼくに任せて。', '行って、二人とも！'] },
      { who: 'kurenai', face: 'joy', pose: 'event', text: ['よーし、行っくよー、蒼！', '待ってて、姫さま。いま助けに行くからね！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['うん。背中は任せて、紅。', '四角、案内をお願いね。'] }
    ],
    // ステージ 1 のボス「重機兵ガーディアン」が画面に入ってきたとき（50_game.js の updBossTrigger から）。
    //   四角が、地面を叩く衝撃波・突進のあとの隙・ぎりぎりのダッシュ回避からの反撃を教える
    guard: [
      { who: 'kurenai', face: 'surprise', text: ['わわっ、なにあれ！？　でっかい機械兵！', '道、ふさがれちゃってるよー！'] },
      { who: 'shikaku', face: 'serious', text: ['――重機兵ガーディアン。この水道橋の門番だ。', '装甲が厚くて、ふつうの機械兵とはわけが違う。'] },
      { who: 'aoi', face: 'normal', text: ['動きは重そう。でも、一撃も重そうだね。', '四角、何か弱いところはある？'] },
      { who: 'shikaku', face: 'serious', text: ['地面を叩くと、衝撃波が左右に走る。跳んでよけて。', '突進は、壁にぶつかったあとが隙だらけだよ。'] },
      { who: 'shikaku', face: 'smile', text: ['それと、攻撃をダッシュでぎりぎりよけてみて。', '見切れたら、反撃の一撃が重くなる。'] },
      { who: 'kurenai', face: 'joy', text: ['ぎりぎりでよけて、どーんと反撃！', 'へへっ、そういうの大好き！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['ふふっ、紅らしいね。', '私が流れを読むから、合わせていこう。'] },
      { who: 'kurenai', face: 'anger', pose: 'stance', text: ['よーし、まずはこいつから！', '行っくよー、蒼！'] }
    ],
    // 重機兵ガーディアンを倒したあと（50_game.js の updBossTrigger から）。終わると、ステージクリア。
    //   水道橋はここで終わり。四角が、この先の鉄塔へ向かうよう伝える（くわしい事情は、ステージ 2 の前の会話で）
    guard_end: [
      { who: 'kurenai', face: 'joy', text: ['やったー！　門番、撃破！', 'へへっ、ぎりぎりの反撃、決まったでしょ？'] },
      { who: 'aoi', face: 'joy', text: ['うん、すごかったよ、紅。', '息、ぴったりだったね。'] },
      { who: 'shikaku', face: 'smile', text: ['二人とも、おつかれさま。武器の具合はどう？', '……刃こぼれなし。さすが、ぼくの作品だね。'] },
      { who: 'kurenai', face: 'wry', text: ['四角、ちょっと自分のこと褒めすぎじゃない？', 'でも、ありがと！'] },
      { who: 'aoi', face: 'normal', text: ['水道橋は、ここで終わり。', '学園までは、まだ遠いね。'] },
      { who: 'shikaku', face: 'serious', text: ['この先に、空まで届く鉄塔がある。', '学園へ行く道は、そこにつながってる。'] },
      { who: 'kurenai', face: 'joy', pose: 'event', text: ['鉄塔かぁ……よーし、どんどん行こう！', '待っててね、姫さま！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['ふふっ、うん。行こう、紅。'] }
    ],
    // ステージ 2（鉄塔）の前: 見上げるほど高い塔を前に二人がためらい、四角が通信で励ます
    tower: [
      { who: 'kurenai', face: 'silly', text: ['うわー……てっぺん、見えない！', 'これ、雲の上まで続いてるんじゃない？'] },
      { who: 'aoi', face: 'normal', text: ['足場は細くて、風も強い。', '踏み外したら、戻れない高さだね。'] },
      { who: 'kurenai', face: 'wry', text: ['あはは……高いところ、ちょっとだけ苦手かも。', 'ねえ、回り道とか、ないかな？'] },
      { who: 'shikaku', face: 'serious', text: ['――聞こえる？　こちら四角。', '学園へ渡る橋は、《龍》の結界で塞がれてる。'] },
      { who: 'shikaku', face: 'serious', text: ['この鉄塔のてっぺんから、結界の上を越えるしかない。', '道は、ここだけなんだ。'] },
      { who: 'aoi', face: 'puzzled', text: ['……四角、ひとつ確認させて。', '途中で足を踏み外したら、どうなるの？'] },
      { who: 'shikaku', face: 'smile', text: ['大丈夫。足場は全部、下からすり抜けられる。', '真下から跳べば、上の足場に乗れるよ。'] },
      { who: 'shikaku', face: 'smile', text: ['それに、その大鎌も刀も、ぼくが軽く作ってある。', '二人の跳ぶ力を、いちばん活かせるように。'] },
      { who: 'kurenai', face: 'joy', text: ['四角の作った武器なら、ぜったい大丈夫！', '……でも、下はなるべく見ないでおこっと。'] },
      { who: 'shikaku', face: 'shout', text: ['なら、上だけ見て！　下は、ぼくが見張ってる。', '途中の端末に触れれば、そこからやり直せる。'] },
      { who: 'aoi', face: 'relief', text: ['上だけ見る、か。……うん、それならできそう。', '紅、私が先に流れを読むね。ついてきて。'] },
      { who: 'kurenai', face: 'joy', pose: 'event', text: ['ううん、先に行くのは、あたし！', 'てっぺんで、思いっきり叫んでやるんだから！'] },
      { who: 'shikaku', face: 'smile', text: ['その意気だ。てっぺんで、また通信する。', '――行って、二人とも！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['うん、行こう、紅。', '姫さまは、この塔の先だよ。'] }
    ],
    // ステージ 3（空中回廊）の前: 鉄塔のてっぺんから見下ろす雲海。結界の上を通る飛空艇の航路を、乗り継いで学園へ渡る
    //   四角は、止まらない流れ（強制スクロール）と、乗り物を乗り継ぐことを教える
    sky: [
      { who: 'kurenai', face: 'joy', text: ['わぁ……！　下、ぜんぶ雲だよ！', 'ここ、鉄塔のてっぺんより高くない！？'] },
      { who: 'shikaku', face: 'serious', text: ['――聞こえる？　こちら四角。', '学園の結界の上を、飛空艇の航路が通ってる。'] },
      { who: 'shikaku', face: 'serious', text: ['飛空艇、エアカー、浮き足場。', '乗り継いでいけば、結界を越えて学園に着ける。'] },
      { who: 'aoi', face: 'normal', text: ['……風が強いね。景色も流れていく。', '立ち止まってる時間は、なさそう。'] },
      { who: 'shikaku', face: 'shout', text: ['そう、航路の流れは止まらない。', '足もとが消える前に、次の足場へ跳んで！'] },
      { who: 'kurenai', face: 'joy', pose: 'event', text: ['高いのは、もう慣れっこ！……たぶん！', 'よーし、全部まとめて乗り継いじゃおう！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['右上へ、まっすぐ。', 'ふふっ、流れに乗っていこう、紅。'] }
    ],
    // ステージ 3（空中回廊）のゴール、飛空艇のデッキに降り立ったあと（50_game.js の updGoal から）。終わると、ステージクリア。
    //   飛空艇は学園の真上。デッキから飛び降りるところで終わり、ステージ 4 の前の会話「――よっ、と！　着地成功！」へつながる
    sky_end: [
      { who: 'kurenai', face: 'joy', text: ['着艦ーっ！　ぜんぶ乗り継いだよ！', 'へへっ、高いところ、もう怖くないもんね！'] },
      { who: 'aoi', face: 'joy', text: ['ふふっ、さっきは『たぶん』って言ってたのに。', '……でも、ほんとうに、よくがんばったね。'] },
      { who: 'shikaku', face: 'smile', text: ['二人とも、おつかれさま。航路は、ここで終わりだよ。', 'その飛空艇は、いま学園の真上にいる。'] },
      { who: 'aoi', face: 'normal', text: ['……下に見えるのが、玉龍学園。', '月の光が、あそこだけ紅く濁ってる。'] },
      { who: 'kurenai', face: 'surprise', text: ['えっ、ここから降りるの！？　階段とか……', '……ないよね。うん、知ってた！'] },
      { who: 'shikaku', face: 'serious', text: ['結界は、この真下で途切れてる。', 'デッキの端から飛び降りれば、学園の中に入れる。'] },
      { who: 'aoi', face: 'shy', text: ['姫さま、もうすぐだね。', '……紅、手、つなぐ？'] },
      { who: 'kurenai', face: 'joy', pose: 'event', text: ['へへっ、つながなくても平気！……でも、つなぐ！', 'せーのっ！'] }
    ],
    // ステージ 4（玉龍学園）の前:鉄塔から結界を越えて降り立つ。《龍》はもうすぐそこにいる、と四角が知らせる
    school: [
      { who: 'kurenai', face: 'joy', text: ['――よっ、と！　着地成功！', 'ここが玉龍学園かぁ！'] },
      { who: 'aoi', face: 'normal', text: ['月が、さっきより紅い……。', '空気が重いね。何かが、すぐ近くにいる。'] },
      { who: 'shikaku', face: 'serious', text: ['――二人とも、聞こえる？　こちら四角。', '結界の上、無事に越えられたみたいだね。'] },
      { who: 'shikaku', face: 'serious', text: ['でも、気をつけて。反応がとても大きい。', '《龍》は、もうすぐそこにいる。'] },
      { who: 'kurenai', face: 'surprise', text: ['えっ、すぐそこって……どのくらい！？', 'ま、まだ心の準備が……なんてね、へへっ！'] },
      { who: 'shikaku', face: 'shout', text: ['学園のいちばん奥、桜の並木の先だ。', '息づかいまで、こっちの計器に届いてる。'] },
      { who: 'aoi', face: 'normal', text: ['「行けば、わかる」――井立さんの言葉。', 'その答えも、きっとこの先にあるね。'] },
      { who: 'aoi', face: 'shy', text: ['姫さまも、そこにいる。', '……やっと、ここまで来たね。'] },
      { who: 'shikaku', face: 'serious', text: ['ただ、足もとは穴だらけだ。落ちたら戻れない。', '足場をひとつずつ、確かめて渡って。'] },
      { who: 'kurenai', face: 'joy', pose: 'event', text: ['龍がすぐそこなら、迷ってるヒマなんてない！', '待ってて、姫さま！'] },
      { who: 'shikaku', face: 'smile', text: ['その意気だ。最後まで、ぼくが見てる。', '――行って、二人とも！'] },
      { who: 'aoi', face: 'normal', pose: 'stance', text: ['うん。紅、四角。', '――ここで、終わらせよう。'] }
    ],
    // ステージ 4 のボス「玉龍」と会ったとき（35_dragon.js の intro から）。龍は話さない。紅・蒼・四角が龍を前に話す
    //   四角は、龍の動き（空を飛び、岸に降りて羽を休める・突進の光の帯）を知らせる
    dragon: [
      { who: 'kurenai', face: 'surprise', text: ['出たっ……！　これが、《龍》……！', 'ちょっと、おっきすぎない！？'] },
      { who: 'aoi', face: 'normal', text: ['紅い月と、同じ色の瞳……。', 'あの奥に、姫さまの気配がする。'] },
      { who: 'shikaku', face: 'shout', text: ['――反応、最大！　まちがいない、玉龍だ。', '姫さまは、あの龍の結界の中にいる。'] },
      { who: 'shikaku', face: 'serious', text: ['龍は空を飛び回って、ときどき岸に降りて羽を休める。', '降りたときが、攻めどきだよ。'] },
      { who: 'shikaku', face: 'serious', text: ['足もとは穴の上だ。突進の前の、光の帯に気をつけて。', '落ちたら、そこで終わりだからね。'] },
      { who: 'aoi', face: 'normal', text: ['……井立さんが、守っていた龍。', '理由は、倒してから確かめよう。'] },
      { who: 'kurenai', face: 'anger', pose: 'stance', text: ['龍でもなんでも、どーんと来い！', '姫さまは、返してもらうよ！'] },
      { who: 'aoi', face: 'normal', pose: 'stance', text: ['二人で、ひとつ。', '――行くよ、紅！'] }
    ],
    // 玉龍が真の力を解き放ったとき（HP が半分を切ったとき。35_dragon.js の roar から。はじめての 1 回だけ）。
    //   最後に蒼が押されかけたところで、助っ人の大森が駆けつける（36_mako.js → 会話 mako）
    dragon_rage: [
      { who: 'shikaku', face: 'shout', text: ['龍の力が跳ね上がった！　これが、真の力……！', '動きが速い。一撃も重い。まともに受けたら危ないよ！'] },
      { who: 'kurenai', face: 'serious', text: ['うわっ、さっきまでと全然ちがう……！', 'で、でも、ここで引くわけには……！'] },
      { who: 'aoi', face: 'normal', pose: 'stance', text: ['落ち着いて、紅。流れは、読めてる。', '……読めてる、けど――このままじゃ、押し切られる。'] }
    ],
    // 助っ人「大森 茉子」が駆けつけたとき（36_mako.js から。はじめての 1 回だけ）。大森は二人のお姉さん役。
    //   紅は「茉子ねえ」、蒼は「茉子さん」と呼ぶ。決め台詞はシートの「無理はしないで。――ちゃんと、私が支えるから。」
    //   四角の「予定には、なかった」は、四角が黒幕であることの伏線（kurose_end）
    mako: [
      { who: 'mako', face: 'command', text: ['――そこまで。二人とも、いったん息を整えて。', '回復は、私が引き受けるから。'] },
      { who: 'kurenai', face: 'surprise', text: ['茉子ねえ！？　なんで、ここに！？'] },
      { who: 'mako', face: 'joy', text: ['かわいい後輩たちが、龍に挑んでるって聞いたの。', '放っておけるわけ、ないでしょう？'] },
      { who: 'aoi', face: 'shy', text: ['茉子さん……。', '来てくれて、すごくうれしい。'] },
      { who: 'mako', face: 'puzzled', text: ['蒼。また一人で、全部背負おうとしてたでしょう。', '紅も。顔に「無茶してます」って書いてあるよ。'] },
      { who: 'kurenai', face: 'wry', text: ['うっ……ばれてる……。'] },
      { who: 'shikaku', face: 'serious', text: ['……大森 茉子さん。玉龍高校の。', '――予定には、なかったけど。……助かるよ。'] },
      { who: 'mako', face: 'anger', text: ['無理はしないで。', '――ちゃんと、私が支えるから。'] },
      { who: 'kurenai', face: 'joy', pose: 'stance', text: ['よーし、百人力！', '行っくよー、蒼！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['うん。茉子さん、背中はお願いね。'] }
    ],
    // 玉龍を倒したあと（50_game.js の updBossTrigger から）。終わると、ステージクリア → エンディング
    //   四角の裏切り（2026-11-28 の要望）: 龍はもともと四角が封じていて、わざと二人に倒させた。二人を始末しようとすると、
    //   大森が二人を連れて脱出し、黒瀬がおとりになって皆を逃がし、やられる。
    //   「龍は姫の番人だった」「四角が武器を止める」「黒瀬がカメラを託す」は、私の解釈（つじつま合わせ）
    //   exit = この台詞から、二人が右へ走り去る（大森も一緒に。36_mako.js の draw）
    dragon_end: [
      { who: 'kurenai', face: 'joy', text: ['やったぁ……！', '龍、倒したよー！'] },
      { who: 'aoi', face: 'relief', text: ['……よかった。', 'これで、姫さまを迎えに行けるね。'] },
      { who: 'mako', face: 'relief', text: ['……ふう。二人とも、よくがんばったね。', 'あとで、ちゃんと手当てさせてね。'] },
      { who: 'kurenai', face: 'smile', text: ['へへっ、四角、ありがとね！', '最後まで、ずーっと見ててくれて！'] },
      { who: 'shikaku', face: 'smirk', text: ['うん。最後まで、ずっと見てたよ。', '――本当に、よく倒してくれたね。'] },
      { who: 'shikaku', face: 'calc', turn: true, text: ['あの龍を学園に封じたのは、ぼくだ。結界を張ったのも。', 'でも、封じた本人には、とどめが刺せなくてね。'] },
      { who: 'aoi', face: 'puzzled', text: ['……四角？', '何を、言ってるの。'] },
      { who: 'shikaku', face: 'smirk', text: ['だから作ったんだ。龍を斬れる大鎌と、刀を。', 'それを振るえる二人が、ここまで来てくれるようにね。'] },
      { who: 'kurenai', face: 'surprise', text: ['うそ……。じゃあ、姫さまは……！？', '道案内も、解析も、ぜんぶ……！'] },
      { who: 'shikaku', face: 'calc', text: ['姫さまは、ぼくの結界の中だよ。龍は、その番人だった。', '番人は、もういない。……二人のおかげでね。'] },
      { who: 'aoi', face: 'sad', text: ['……井立さんが、龍を守っていたのは。', '「行けば、わかる」って、このことだったんだね。'] },
      { who: 'shikaku', face: 'sneer', text: ['役目は、ここまで。その武器は、ぼくが作った。', '――だから、止めるのも、ぼくだ。'] },
      { who: 'kurenai', face: 'surprise', text: ['えっ……大鎌が、光らない……！？', '蒼、刀は！？'] },
      { who: 'aoi', face: 'damage', text: ['……だめ。', '魔法陣が、消えてる。'] },
      { who: 'shikaku', face: 'order', text: ['さよなら、二人とも。', '機械兵、全機――始末して。'] },
      { who: 'mako', face: 'command', text: ['――そこまで。二人とも、私につかまって。', '言ったでしょう。ちゃんと、私が支えるって。'] },
      { who: 'shikaku', face: 'rage', text: ['……大森 茉子。やっぱり、きみだけは予定になかった。', 'でも、出口は全部、塞いであるよ。'] },
      { who: 'kurose', face: 'camera', text: ['――なら、こじ開けるまでだ。', 'いい顔になったな、四角 明宏。一枚、撮らせてもらう。'] },
      { who: 'kurenai', face: 'surprise', text: ['黒瀬さん！？'] },
      { who: 'kurose', face: 'old', text: ['行け。ここは、俺が引き受ける。', 'このカメラは持っていけ。真実は、全部ここに写してある。'] },
      { who: 'aoi', face: 'sad', text: ['黒瀬さん、一人じゃ……！'] },
      { who: 'mako', face: 'anger', exit: true, text: ['……行くよ、紅、蒼。', 'あの人の覚悟を、無駄にしないで。'] },
      { who: 'kurenai', face: 'regret', text: ['四角ぃーっ！　ぜったい、戻ってくるからね！', '姫さまも、黒瀬さんも、取り戻すんだから！'] },
      { who: 'kurose', face: 'reach', text: ['黒瀬 龍士。通りすがりの、ただの空手使いだ。', 'さあ――まとめて、かかってこい。'] },
      { who: 'shikaku', face: 'waver', text: ['……覚えておくと言ったのは、きみだったね。', 'ぼくも覚えておくよ。――おやすみ、黒瀬 龍士。'] },
      { who: 'kurose', face: 'grin', text: ['……ふっ。', 'いい、月だ――。'] }
    ],
    // 中ボス「黒瀬 龍士」と初めて会ったとき（52_karate.js の enter から）。
    // シートの説明に沿わせてある: カメラを手にする異色の武闘家。正体と目的は謎。卓越した空手の技術で立ちはだかる
    //   黒瀬の face: camera（カメラを構えた笑み）/ old（1 枚目のシートの絵）/ grin（不敵な笑みの寄り）/ reach（手を突き出す）
    kurose: [
      { who: 'kurose', face: 'camera', text: ['――そこまでだ。', 'いい月、いい顔だ。一枚、撮らせてもらう。'] },
      { who: 'kurenai', face: 'anger', text: ['だれ！？　ごめん、こっちは急いでるの！', '姫さまが、あの《龍》に捕まってるんだから！'] },
      { who: 'kurose', face: 'old', text: ['知っている。だから、ここで確かめる。', '姫を取り戻せるだけの腕が、あるのかどうかをな。'] },
      { who: 'aoi', face: 'normal', text: ['……紅、気をつけて。この人、流れが読めない。', '構えは空手。でも、あのカメラ……何かある。'] },
      { who: 'kurose', face: 'grin', text: ['いい読みだ。拳も、蹴りも、光も――', '全部見切れたら、通してやる。'] },
      { who: 'kurose', face: 'reach', text: ['黒瀬 龍士。通りすがりの、ただの空手使いだ。', 'さあ――二人まとめて、かかってこい。'] },
      { who: 'kurenai', face: 'anger', pose: 'stance', text: ['言ったね！　よーし、行くよ、蒼！'] }
    ],
    // 黒瀬を退けたあと（52_karate.js の stDie から）。紅と蒼は先へ走り去り、残った黒瀬が通信の向こうの四角に話しかける。
    //   exit = この台詞から、二人が右へ走り去る（画面から消える）。四角が黒幕であることを、ここでにおわせる（はっきりとは言わない）
    kurose_end: [
      { who: 'kurenai', face: 'joy', text: ['よーし、通してもらったし、先を急ごう！', '黒瀬さん、撮った写真、あとで見せてね！'] },
      { who: 'aoi', face: 'normal', text: ['……ありがとう、黒瀬さん。', '行こう、紅。龍の足もとまで、あと少しだよ。'] },
      { who: 'kurose', face: 'old', exit: true, text: ['…………。', '――さて。聞いているんだろう、通信の向こうの君。'] },
      { who: 'shikaku', face: 'smile', text: ['……あれ、ばれてた？　こちら四角。', 'あの二人の武器を作った、ただのメカニックだよ。'] },
      { who: 'kurose', face: 'grin', text: ['ただの、か。……君は、結界のことに詳しいな。', 'どこで塞がり、どこで途切れるか。全部知っていた。'] },
      { who: 'kurose', face: 'camera', text: ['橋を塞いだ場所も、結界の上の航路も。', 'まるで――結界を張った、本人のようだ。'] },
      { who: 'shikaku', face: 'calc', text: ['…………。', '解析が得意なだけだよ。それ以上の意味は、ないさ。'] },
      { who: 'kurose', face: 'old', text: ['そうか。だが、ファインダー越しだと、', '嘘は、よく見える。このカメラは真実を写すからな……'] },
      { who: 'shikaku', face: 'smirk', text: ['ふふっ、怖いなあ。……でも、もう遅いよ。', '月は、もうじゅうぶん紅くなった。'] },
      { who: 'kurose', face: 'grin', text: ['……四角 明宏。その名前、覚えておこう。'] }
    ],
    // ステージ 2 のボス「井立 快晴」:鉄塔のてっぺんで、《龍》を守るために立ちはだかる（53_idachi.js の stIntro から）。
    //   シートの決め台詞「守るために、強くなる。…それが、今の俺の答えだ。」に沿わせた。龍を守る理由は、ここでは明かさない
    //   井立の face: smile / close / shout / kick
    idachi: [
      { who: 'idachi', face: 'smile', text: ['――ここまで登ってきたか。', '風の中、よく落ちなかったな。いい根性だ。'] },
      { who: 'kurenai', face: 'anger', text: ['だれ！？　ちょっと、そこどいて！', 'あたしたち、この先の《龍》に用があるの！'] },
      { who: 'idachi', face: 'close', text: ['知ってる。だから、俺がここにいる。', '井立 快晴。……《龍》を守る者だ。'] },
      { who: 'shikaku', face: 'serious', text: ['――二人とも、気をつけて。彼の動き、データにない。', '空手……それも、相当な使い手だ。'] },
      { who: 'aoi', face: 'puzzled', text: ['《龍》を、守る……？', 'あの龍は、姫さまを囚えているのに。'] },
      { who: 'idachi', face: 'close', text: ['事情は、それぞれだ。', '俺には俺の、守ると決めたものがある。'] },
      { who: 'kurenai', face: 'anger', text: ['うーん、ぜんぜんわかんない！', 'とにかく、姫さまは返してもらうよ！'] },
      { who: 'idachi', face: 'shout', text: ['なら、拳で語れ。', '守るために、強くなる。……それが、今の俺の答えだ。'] },
      { who: 'aoi', face: 'normal', pose: 'stance', text: ['……紅、本気で行こう。', 'この人、迷いがない。'] },
      { who: 'kurenai', face: 'anger', pose: 'stance', text: ['上等！　てっぺんまで来たんだもん、', 'ここで負けるわけにはいかないよ！'] }
    ],
    // 井立を倒したあと（53_idachi.js の stDie から）。終わると、登頂してステージクリア
    idachi_end: [
      { who: 'idachi', face: 'smile', text: ['……ふっ。完敗だ。', '二人で、ひとつ。……いい拳だった。'] },
      { who: 'kurenai', face: 'joy', text: ['へへっ、だから言ったでしょ！', 'じゃあ、通してもらうね！'] },
      { who: 'aoi', face: 'normal', text: ['……ひとつ、聞かせて。', 'どうして、《龍》を守っていたの？'] },
      { who: 'idachi', face: 'close', text: ['……行けば、わかる。', '龍は、学園のいちばん奥だ。'] },
      { who: 'idachi', face: 'smile', text: ['結界の上の空を、飛空艇が渡っている。', '――その拳で、確かめてこい。'] },
      { who: 'kurenai', face: 'silly', text: ['……あれ？　なんか、悪い人じゃなさそう？'] },
      { who: 'aoi', face: 'joy', text: ['ふふっ。行こう、紅。', '答えは、あの龍のところにあるよ。'] }
    ],
    // 第2章 第1話（谷山）の前: 裏切りの夜が明けた、まぶしい昼の臨海通り。黒瀬のカメラを手に南へ。
    //   はじめは、学園から連れ出してくれた大森も一緒。井立と合流して帝国を調べるため、ここで別行動に移る（2026-11-28 の要望）。
    //   makoOut = この台詞から大森が右へ走り去る（36_mako.js）。街には帝国の手配書（40_stage.js の posters）。四角は出てこない
    taniyama: [
      { who: 'kurenai', face: 'wry', text: ['うわ、まぶしい……。', 'あんな夜のあとでも、朝はちゃんと来るんだね。'] },
      { who: 'mako', face: 'normal', text: ['……二人とも、少しは眠れた？', 'ここまで来れば、帝国の追っ手もすぐには来ないはず。'] },
      { who: 'aoi', face: 'shy', text: ['茉子さん……。', 'あの夜、連れ出してくれて、ありがとう。'] },
      { who: 'mako', face: 'command', text: ['お礼はいいの。それより、これからのことを話すね。', '――私は、ここで二人と別れる。'] },
      { who: 'kurenai', face: 'surprise', text: ['えっ！？　茉子ねえ、一緒に来てくれないの！？'] },
      { who: 'mako', face: 'puzzled', text: ['井立くんと、合流するつもりなの。', '龍を守っていた彼なら……きっと、何かを知ってる。'] },
      { who: 'mako', face: 'normal', text: ['二人で、帝国が何をしようとしているのか調べる。', 'わかったことは、必ず紅と蒼に届けるから。'] },
      { who: 'aoi', face: 'puzzled', text: ['井立さんと……。', 'でも、帝国のそばへ行くなんて、危なすぎるよ。'] },
      { who: 'mako', face: 'joy', text: ['ふふっ、心配してくれてありがとう。でも、無理はしない。', '――二人こそ、無茶しないでね。'] },
      { who: 'kurenai', face: 'regret', text: ['……うん。約束だよ、茉子ねえ。', 'ぜったい、また会おうね！'] },
      { who: 'mako', face: 'relief', makoOut: true, text: ['うん、約束。', 'またね、紅、蒼。'] },
      { who: 'aoi', face: 'sad', text: ['……行っちゃったね。', '黒瀬さんのカメラ、まだ温かい気がする。'] },
      { who: 'kurenai', face: 'regret', text: ['四角のこと……まだ、信じられないよ。', 'ずっと、一緒に戦ってると思ってたのに。'] },
      { who: 'aoi', face: 'normal', text: ['私も。……でも、ここで立ち止まってたら、', '黒瀬さんにも、茉子さんにも怒られちゃう。'] },
      { who: 'kurenai', face: 'surprise', text: ['ねえ蒼、あの貼り紙……！', 'あたしたちの顔が、でっかく描いてある！'] },
      { who: 'aoi', face: 'puzzled', text: ['「反逆者（REBELL）　紅・蒼」……。', '帝国の手配書だね。もう、こんなところまで。'] },
      { who: 'kurenai', face: 'wry', text: ['へへっ……似顔絵、ちょっと美人すぎない？', '……なんて、言ってる場合じゃないか。'] },
      { who: 'aoi', face: 'normal', text: ['帝国の機兵も、見回ってるみたい。', '谷山の臨海通りを抜けて、南へ急ごう。'] },
      { who: 'kurenai', face: 'resolve', pose: 'event', text: ['よーし！　カメラに写ってる「真実」、', 'ぜったい見つけてみせるんだから！'] },
      { who: 'aoi', face: 'joy', pose: 'stance', text: ['うん。行こう、紅。', '――今度は、二人で。'] }
    ],
    // 第2章 第1話のゴール（道路標識の下）のあと（50_game.js の updGoal から）。終わると、ステージクリア → 第2章のマップ。
    //   黒瀬のカメラが、次の行き先（平川の丘）を示す（私の解釈。第2話の平川動物公園へつなぐ）
    taniyama_end: [
      { who: 'kurenai', face: 'joy', text: ['ふうっ、臨海通り、突破ー！', '昼間の街って、走ってて気持ちいいね！'] },
      { who: 'aoi', face: 'relief', text: ['ふふっ、紅、ちょっと元気が戻ったね。'] },
      { who: 'kurenai', face: 'smile', text: ['へへっ、蒼が隣にいるからだよ。'] },
      { who: 'aoi', face: 'puzzled', text: ['……ねえ、紅。黒瀬さんのカメラ、', 'さっきから、小さく光ってる。'] },
      { who: 'kurenai', face: 'surprise', text: ['ほんとだ！　画面に……地図？', '南の、丘の上に印がついてる！'] },
      { who: 'aoi', face: 'normal', text: ['丘の上……平川のほうだね。', '黒瀬さんが、何かを残してくれたのかも。'] },
      { who: 'kurenai', face: 'resolve', pose: 'event', text: ['よーし、次は平川だ！', '真実まで、一直線に行くよ！'] }
    ]
  };
  // 話し手ごとの見た目。side = カットインがすべり込んでくる側（-1 = 左、1 = 右）。portrait = 顔グラフィックの代わりに、シートの大きな絵を使う
  var WHO = {
    kurenai: { side: -1, col: PINK, dark: '#40103c', lite: '#8a2062', mid: '#6a1a58', plate: '#5a1650', name: '紅', kana: 'くれない', en: 'KURENAI', icon: 'iconKurenai' },
    aoi: { side: 1, col: CYAN, dark: '#0c1450', lite: '#1a36a8', mid: '#152a80', plate: '#12246e', name: '蒼', kana: 'あおい', en: 'AOI', icon: 'iconAoi' },
    kurose: { side: 1, col: '#c98bff', dark: '#170a30', lite: '#4a2890', mid: '#2e1960', plate: '#2a1650', name: '黒瀬', kana: 'くろせ', en: 'KUROSE RYUJI', icon: null, portrait: true, pics: true, img: 'midPic_' },
    // 井立: ステージ 2 のボス。絵は smile（左上の大きな絵）/ close（真剣な寄り）/ shout（拳を突き出して叫ぶ）/ kick（蹴り）
    idachi: { side: 1, col: '#7af3ff', dark: '#050d26', lite: '#1a4aa8', mid: '#0e2a66', plate: '#0c2458', name: '井立', kana: 'いだち', en: 'IDACHI KAISEI', icon: null, pics: true, img: 'idaPic_' },
    // 大森 茉子: 助っ人の回復役（36_mako.js）。pics = 表情ごとの絵（09_mako_art.js）:
    //   normal / command 支援指示 / heal 回復 / sad / silly おとぼけ / shy 照れ / joy 喜び / anger 怒り（冷静）/ surprise / puzzled 困惑 / relief 安堵
    mako: { side: -1, col: '#ff8ae0', dark: '#1e0a2e', lite: '#6a2a8a', mid: '#3e1660', plate: '#3a1452', name: '大森', kana: 'おおもり', en: 'OMORI MAKO', icon: null, pics: true },
    // 四角: 通信で話す。pics = 表情ごとの絵（09_shikaku_art.js）、tag = 帯に出す小さな札
    shikaku: { side: 1, col: '#ffc84a', dark: '#07122e', lite: '#1c4a86', mid: '#123260', plate: '#143058', name: '四角', kana: 'よすみ', en: 'YOSUMI AKIHIRO', icon: null, pics: true, tag: '通信中  ‐  SUPPORT', tag2: '黒幕  ‐  MASTERMIND' }      // tag2 = 裏切りを明かしたあとの札（台詞の turn: true から）
  };
  // 四角の絵を読み込んでおく（会話が始まるまでに間に合う）
  (function () {
    var D = window.REBELL_SHIKAKU || {}, k, im;
    for (k in D) { im = new Image(); im.src = D[k]; PICS['shikaku_' + k] = im; }
    var M = (window.REBELL_MAKO && window.REBELL_MAKO.pics) || {};      // 大森の絵も（smile は joy と同じ絵）
    for (k in M) { im = new Image(); im.src = M[k]; PICS['mako_' + k] = im; }
    if (PICS.mako_joy) PICS.mako_smile = PICS.mako_joy;
  })();

  function count(ln) { var n = 0, i; for (i = 0; i < ln.text.length; i++) n += ln.text[i].length; return n; }
  function shownOf(tk) { return tk.full ? 999 : Math.max(0, Math.floor((tk.t - 6) * SPEED)); }

  // 会話を始める（startStage から呼ばれる）。章の題と曲は、会話が終わってから出す
  //   i = 何番目の台詞か、t = その台詞が始まってからのフレーム数、T = 会話全体のフレーム数、
  //   inT = 入りの演出、outT = 終わりの演出（-1 = まだ）、full = 台詞を全部出したか、prev = すべり出ていく前のカットイン
  //   opt.vs = 向かい合っている相手（中ボス）。ステージの途中の会話で、終わったらそのまま戦いに戻る
  R.beginTalk = function (key, opt) {
    var C = G.pl.chars, lines = R.TALKS[key].filter(function (ln) { return !(C[ln.who] && C[ln.who].down) && !(ln.who === 'mako' && !(G.mako && G.mako.on)); });      // 戦闘不能の子の台詞は飛ばす（大森の台詞は、大森が来ているときだけ）
    G.talk = { key: key, lines: lines, i: 0, t: 0, T: 0, inT: 0, outT: -1, full: false, prev: null, vs: (opt && opt.vs) || null, mid: !!(opt && opt.mid), onEnd: (opt && opt.onEnd) || null };      // onEnd = 会話が終わったときに呼ぶ      // mid = 相手のいない、ステージの途中・終わりの会話（二人が向かい合って話す）
    G.state = 'talk'; G.stateT = 0;
  };
  function leave(tk) { tk.outT = 0; tk.prev = null; R.snd('switch'); }
  function finish() {
    var vs = G.talk.vs || G.talk.mid, cb = G.talk.onEnd;
    G.pl.animT = G.talk.T;      // 立ち姿の呼吸を、会話中の続きから
    G.talk = null; G.state = 'play'; G.stateT = 0;
    if (!vs) R.openStage();     // ステージの前の会話なら、ここで章の題と曲
    if (cb) cb();
  }
  // ok = 決定（台詞を全部出す → 次の台詞へ）、skip = 会話を飛ばす
  R.updateTalk = function (ok, skip) {
    var tk = G.talk, ln;
    if (!tk) { G.state = 'play'; return; }
    G.t++; tk.T++; tk.inT++;
    if (tk.inT >= IN && tk.lines[tk.i].exit) tk.exitOn = true;      // 二人が走り去る台詞まで来た
    if (tk.exitOn) tk.exitT = (tk.exitT || 0) + 1;
    if (tk.vs && tk.vs.talkPose) tk.vs.talkPose(tk.vs, tk.inT >= IN && tk.outT < 0 && tk.lines[tk.i].who === tk.vs.talkWho, tk.T);      // 向かい合う相手（黒瀬・井立）は、話すときだけ身ぶりをする
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
    // run = 走り去りはじめてからのフレーム数（0 なら立ったまま）
    function actor(who, x, face, ph, leap, run) {
      var S = R.STAND[who], st = S.idle, f, br, y = p.y, a = 1, v;      // いま立っている高さ（鉄塔のてっぺんでも）
      var speaking = started && tk.outT < 0 && ln.who === who;
      if (speaking && ln.pose === 'event') { f = R.frame(who, 'event', 1); st = null; }
      else { if (speaking && ln.pose === 'stance') st = S.stance; f = R.frame(who, st === S.idle ? 'idle' : 'stance', st.i); }
      if (st) { v = R.breath(st, tk.T + ph); br = { knee: st.knee, neck: st.neck, d: v[0], e: v[1] }; }
      if (speaking && tk.t < 14) y -= Math.round(5 * Math.sin(PI * tk.t / 14));       // 話しはじめに、ぴょこんと跳ねる
      if (run > 0) {      // 先へ走り去る（画面の右の外へ出たら、描かない）
        x += run * Math.min(3.6, run * 0.3); f = R.frame(who, 'run', Math.floor(run / 4) % R.SPR[who].run.length); br = null; face = 1;
        if (x - cam > R.W + 40) return;
      } else if (leap && tk.outT >= 0) {                                                      // 終わり: 相棒は後ろへ跳んで、姿を消す（交代を待つ）
        v = Math.min(1, tk.outT / 26);
        x -= leap * R.ease(v); y -= Math.round(74 * Math.sin(PI * v * 0.8)); a = 1 - v * v;
        f = R.frame(who, 'jump', v < 0.3 ? 2 : v < 0.65 ? 3 : 4); br = null;
      }
      if (a <= 0) return;
      g.globalAlpha = a; draw(g, f, x - cam, y, face, 0, 1, 1, null, br); g.globalAlpha = 1;
    }
    if (tk.vs) {      // 中ボスと向かい合う: いま操作している子が前、相棒はその後ろに控える
      var fc = tk.vs.x >= kx ? 1 : -1, act = p.who, par = act === 'kurenai' ? 'aoi' : 'kurenai';
      var bx = kx - fc * 30;      // 相棒の位置。画面の端（龍の戦いの入り口など）では、画面の中に寄せる
      bx = fc > 0 ? Math.max(bx, cam + 8) : Math.min(bx, cam + R.W - 8);
      var ex = tk.exitOn ? tk.exitT : 0;      // 走り去る: 相棒が先に、操作している子が少し遅れて
      if (!p.chars[par].down) actor(par, bx, fc, 40, fc * 44, Math.max(0, ex - 4));      // 倒れている相棒は、立たせない
      actor(act, kx, fc, 0, 0, Math.max(0, ex - 14));
      return;
    }
    if (tk.mid) kx = Math.min(kx, cam + R.W - GAP - 24);      // ステージの終わりの会話: 蒼が画面の右へはみ出さないように
    if (!(tk.mid && p.chars.aoi.down)) actor('aoi', kx + GAP, -1, 40, GAP + 34);      // 蒼を先に描く（跳び去るとき、紅の後ろを通る）
    if (!(tk.mid && p.chars.kurenai.down)) actor('kurenai', kx, 1, 0, 0);
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
  function band(g, who, expr, k, tt, pt, turned) {      // turned = 四角が裏切りを明かしたあと（札を変える）
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
    im = W.pics ? (W.img ? R.IMG[W.img + expr] : (PICS[who + '_' + expr] || PICS[who + '_smile'])) : null;      // 黒瀬・井立の絵は 52_karate.js / 53_idachi.js が読み込む（img = R.IMG の名前の頭）
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
    if (W.tag) {      // 通信の札（点が明滅する）。裏切りのあとは、紅い札に
      var tg2 = turned && W.tag2;
      panel(g, nx - 150, y + 24, 300, 40, 8, tg2 ? 'rgba(48,4,16,.88)' : 'rgba(6,14,40,.8)', tg2 ? '#ff4a5e' : col, 3);
      g.fillStyle = (tt >> 4) % 2 ? '#ff5a6a' : '#7a2030'; g.beginPath(); g.arc(nx - 126, y + 44, 7, 0, PI * 2); g.fill();
      T(g, tg2 || W.tag, nx + 12, y + 53, 24, tg2 ? '#ffd0d6' : '#ffffff', 'center', U.font, '#120a30', 5);
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
    var turned = false, tj; for (tj = 0; tj <= tk.i && tj < tk.lines.length; tj++) if (tk.lines[tj].turn) turned = true;      // この会話で、四角がもう裏切りを明かしたか
    if (tk.prev) band(g, tk.prev.who, tk.prev.face, 1 - R.ease(Math.min(1, tk.prev.t / 7)), tk.T, 99, turned && !tk.lines[tk.i].turn);
    if (tk.inT >= IN) band(g, ln.who, ln.face, out ? oa : R.ease(Math.min(1, tk.t / 9)), tk.T, out ? 99 : tk.t, turned);
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

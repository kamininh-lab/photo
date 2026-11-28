// ステージの地形データと、地形・遠景のドット絵
(function () {
  'use strict';
  var R = window.REBELL, GY = R.GY;
  var ST = ['#24213f', '#2f2b55', '#3d3868', '#4f4984', '#655e9e', '#8078b8', '#a39bd0'];

  R.STAGES = [
    {
      id: 'city', title: '第1話　ネオン廃都の水道橋', sub: 'STAGE 1  -  NEON RUINS AQUEDUCT', bgm: 'city', len: 3840, talk: 'stage1',
      // 高低差のある地形（配置は Codex の設計。上の道と下の道の 2 層で、上の道は穴の手前で下に合流する）
      //   blocks = 石の段 [x, 幅, 高さ]（地面から積み上がった、乗れる壁。側面は壁キックで蹴れる）/ spikes = トゲ [x, 幅]
      //   springs = バネ [x, …]（踏むと約 134 ドット跳ね上がる）/ movers = 動く足場 [x, y, 幅, dx, dy, 周期フレーム]（2 点の間を往復）
      //   plats = 下からすり抜けられる足場 [x, y, 幅]
      // 下の道は、紅のふつうのジャンプ（高さ 60・段差 48 まで）だけで通れる。落ちると即ゲームオーバーなので、穴の手前には 60 ドットの平地を残す
      ground: [[0, 880], [990, 1480], [1600, 2290], [2390, 3840]],
      blocks: [[300, 54, 32], [354, 62, 68], [1008, 52, 36], [1060, 60, 76], [1172, 64, 130], [1830, 58, 32], [2050, 58, 40], [2620, 56, 32]],
      spikes: [[626, 36], [1318, 36], [1920, 36], [2140, 30], [2716, 36]],
      springs: [478, 1730, 2460],
      movers: [[596, 96, 64, 56, -16, 120], [1900, 100, 68, 68, -24, 144]],
      plats: [[444, 112, 64], [534, 88, 58], [724, 104, 64], [908, 168, 54],
      [1120, 150, 30], [1142, 108, 30], [1256, 80, 76], [1350, 116, 52], [1510, 168, 58],
      [1786, 88, 84], [2048, 88, 72], [2144, 120, 60], [2316, 168, 52],
      [2516, 88, 80], [2620, 76, 82], [2730, 100, 62], [2810, 136, 54], [3180, 138, 64], [3560, 138, 64]],
      enemies: [['robot', 260], ['robot', 386], ['robot', 562], ['robot', 692], ['drone', 704, 60], ['robot', 794],
      ['robot', 1032], ['drone', 1262, 104], ['robot', 1280], ['robot', 1380], ['drone', 1394, 86],
      ['robot', 1802], ['robot', 1858], ['drone', 1890, 128], ['robot', 1992], ['drone', 2050, 56], ['robot', 2080],
      ['robot', 2190], ['robot', 2530], ['drone', 2560, 124], ['robot', 2648], ['robot', 2790], ['drone', 2804, 82], ['robot', 2836]],
      items: [['crystal', 328, 140], ['crystal', 391, 102], ['crystal', 494, 103], ['crystal', 522, 52], ['crystal', 566, 68], ['crystal', 750, 82], ['crystal', 934, 148],
      ['crystal', 1132, 130], ['crystal', 1160, 88], ['crystal', 1202, 44], ['chest', 1294, 80], ['crystal', 1538, 148],
      ['crystal', 1746, 103], ['crystal', 1774, 52], ['crystal', 1820, 68], ['crystal', 2076, 66], ['crystal', 2342, 148],
      ['crystal', 2476, 103], ['crystal', 2504, 52], ['crystal', 2550, 68], ['chest', 2660, 76], ['crystal', 2762, 80], ['potion', 2980, 176]],
      checkpoints: [150, 1650, 2920],
      ruins: [[24, 3], [1610, 2], [2880, 2], [3700, 1]],
      boss: { type: 'guard', x: 3560, arena: [3040, 3800], trigger: 3130, name: '重機兵ガーディアン', sub: 'HEAVY GUARDIAN' }
    },
    {
      // 縦に登るステージ: 画面 1 枚ぶんの幅（カメラは横に動かない）の鉄塔を、技を使い分けて上へ登る。
      //   配置は Codex と相談して決めた（区間ごとに技を 1 つ教え、終盤で組み合わせる）:
      //     A ふもと（ジャンプ・二段ジャンプ）→ B 壁キックの縦穴 → C 動く足場と崩れる足場・バネ → D 上昇気流 →
      //     E 分かれ道（紅は鎖の楔をたぐって縦に、蒼は空中ダッシュと空中射撃の浮きで横に大きく渡る）→ F レーザー柵 →
      //     G 最後の縦穴（壁キック → ダッシュ → 楔、の連携）→ H てっぺん
      //   plats は下からすり抜けられる。カメラは登った高さに合わせて上がるだけで、下には戻らない。画面の下へ消えたら、その場でゲームオーバー（つづきは最後の端末から）。
      //   y は上ほど小さい（地面 = 192、てっぺん = -2100）。checkpoints / springs / rings は [x, y]、walls / fans = [x, y, 幅, 高さ]、
      //   crumbles = 崩れる足場 [x, y, 幅]、lasers = レーザー柵 [x, y, 幅, 周期, ずれ]、goal = てっぺんの足場（立つとステージクリア。ボスはいない）
      id: 'tower', title: '第2話　天を衝く鉄塔', sub: 'STAGE 2  -  SKYWARD TOWER', bgm: 'city', len: 480, vertical: true, talk: 'tower',
      top: -2310, startX: 100, pxPerM: 14,
      ground: [[0, 480]],
      walls: [[176, -414, 24, 250], [272, -414, 24, 250], [176, -2040, 24, 186], [276, -2040, 24, 186]],
      springs: [[124, -696]],
      movers: [[150, -462, 64, 136, -50, 156]],      // [x, y, 幅, dx, dy, 周期]
      crumbles: [[320, -556, 70], [245, -602, 60]],
      fans: [[144, -928, 64, 132], [283, -1105, 66, 141]],
      rings: [[117, -1276], [86, -1398], [258, -1510], [268, -2130]],
      lasers: [[293, -1542, 87, 180, 0], [180, -1732, 68, 160, 40], [252, -1954, 24, 144, 0]],
      plats: [
        // A ふもと
        [72, 145, 103], [134, 98, 110], [207, 51, 90], [160, 4, 100], [147, -78, 90], [168, -120, 135],
        // B 壁キックの縦穴（中の小さな出っ張りは、二段ジャンプでも登れる救済）
        [200, -190, 28], [244, -263, 28], [200, -336, 28], [152, -420, 180],
        // C 動く足場・崩れる足場・バネ（-537 は崩れる足場から落ちたときの受け床、-610 は機兵の寄り道）
        [230, -537, 174], [162, -648, 95], [84, -696, 90], [355, -610, 103], [104, -802, 116],
        // D 上昇気流
        [187, -920, 110], [238, -970, 105], [238, -1097, 64], [166, -1150, 120],
        // E 紅の道（楔の下の棚）と、蒼の道（右 → 左 → 右）・合流の床
        [78, -1288, 80], [61, -1407, 72],
        [344, -1228, 92], [64, -1324, 86], [259, -1410, 104], [190, -1204, 120], [176, -1500, 148],
        // F レーザー柵
        [324, -1476, 125], [296, -1550, 90], [292, -1628, 100], [208, -1676, 114], [114, -1656, 200], [145, -1758, 110], [168, -1810, 136],
        // G 最後の縦穴 と H てっぺん
        [200, -1902, 76], [152, -2040, 192], [40, -2100, 400]],
      goal: [40, -2100, 400],      // てっぺんの足場（ボス戦の場。幅を広げてある）
      // ボス「井立 快晴」: てっぺんに着くと、空から降ってくる（53_idachi.js）。倒すとクリア
      boss: { type: 'idachi', x: 360, name: '井立 快晴', sub: 'GUARDIAN OF THE DRAGON  -  IDACHI KAISEI' },
      enemies: [['drone', 390, 10], ['robot', 414, -610], ['drone', 401, -1040]],
      items: [['crystal', 124, 129], ['crystal', 189, 82], ['crystal', 252, 35], ['crystal', 192, -94],
      ['crystal', 236, -220], ['crystal', 236, -290], ['crystal', 236, -360], ['crystal', 214, -206],
      ['crystal', 300, -575], ['crystal', 275, -620], ['chest', 440, -610], ['crystal', 124, -760], ['potion', 150, -818],
      ['crystal', 176, -880], ['crystal', 176, -840], ['crystal', 316, -1060], ['crystal', 316, -1020],
      ['crystal', 117, -1240], ['crystal', 86, -1362], ['crystal', 258, -1474], ['crystal', 390, -1244], ['crystal', 107, -1340], ['crystal', 311, -1426],
      ['potion', 200, -1516], ['crystal', 336, -1566], ['crystal', 262, -1692], ['crystal', 200, -1774],
      ['crystal', 238, -1918], ['crystal', 238, -1990], ['crystal', 268, -2094]],
      checkpoints: [[219, -120], [205, -420], [121, -802], [230, -1150], [305, -1500], [219, -1810]]
    },
    {
      // 空中のステージ（強制スクロール）: 鉄塔のてっぺんから、結界の上の空を、飛空艇・エアカー・浮き足場を乗り継いで学園へ渡る。
      //   画面は path に沿って、右上へゆっくり進み続ける（止まらない）。画面の左端に押し出され、画面の下へ落ちたらゲームオーバー（つづきは最後の端末から）。
      //   path = カメラの道のり [カメラの左端の x, カメラの上向きの量 cam.y]（間は直線でつなぐ。cam.y が増えるほど、上の景色が映る）。speed = 1 フレームに進む量
      //   plats = 浮き足場 [x, y, 幅]（下からすり抜けられる）。y は世界の y（上ほど小さい）
      //   movers = 乗り物 [x, y, 幅, dx, dy, 周期, 種類]（2 点の間を往復）。種類: 'ship' = 飛空艇（広い甲板）、'car' = エアカー（屋根に乗る）、省略 = 浮きリフト
      //   goal = 学園の手前に浮かぶ、大きな飛空艇の着艦デッキ（乗るとステージクリア）
      id: 'sky', title: '第3話　紅月の空中回廊', sub: 'STAGE 3  -  SKY CORRIDOR', bgm: 'city', len: 3780, sky: true, talk: 'sky',
      speed: 0.5, startX: 80, startY: 176, pxPerM: 14, goalMsg: '着艦！ ― 結界の上を越えた', endTalk: 'sky_end',
      path: [[0, 0], [360, 0], [1000, 240], [1260, 240], [1900, 500], [2160, 500], [2800, 720], [3300, 720]],
      ground: [],
      plats: [[0, 176, 170], [210, 160, 60], [520, 150, 60], [600, 140, 50], [820, 84, 56], [1150, -30, 60], [1240, -64, 70],
      [1560, -96, 60], [1770, -176, 54], [1910, -250, 60], [2110, -320, 90], [2470, -352, 56], [2676, -426, 64], [3040, -544, 60], [3110, -548, 360]],
      movers: [[300, 170, 150, 60, -6, 320, 'ship'], [680, 110, 44, 72, 0, 200, 'car'], [900, 60, 40, 0, -50, 180], [960, 10, 170, 50, -10, 360, 'ship'],
      [1330, -60, 200, 70, -6, 400, 'ship'], [1640, -130, 44, 84, -24, 200, 'car'], [1850, -196, 40, 0, -46, 170], [1990, -276, 44, 80, -30, 210, 'car'],
      [2220, -318, 180, 80, -8, 380, 'ship'], [2550, -384, 44, 92, -30, 200, 'car'], [2770, -456, 40, 0, -44, 170], [2830, -506, 160, 60, -10, 360, 'ship']],
      enemies: [['drone', 450, 110], ['drone', 760, 50], ['drone', 1100, -80], ['robot', 1290, -64], ['drone', 1480, -130], ['drone', 1720, -210],
      ['drone', 1990, -340], ['drone', 2420, -390], ['drone', 2640, -470], ['drone', 2950, -580]],
      items: [['crystal', 250, 140], ['crystal', 380, 150], ['crystal', 545, 130], ['crystal', 700, 90], ['crystal', 848, 64], ['crystal', 1050, -15], ['crystal', 1180, -50],
      ['potion', 1300, -80], ['crystal', 1420, -80], ['crystal', 1590, -116], ['crystal', 1700, -150], ['crystal', 1797, -196], ['crystal', 1940, -270], ['crystal', 2050, -300],
      ['chest', 2185, -320], ['crystal', 2300, -340], ['crystal', 2498, -372], ['crystal', 2610, -410], ['crystal', 2708, -446], ['crystal', 2900, -530], ['crystal', 3070, -564]],
      checkpoints: [[1262, -64], [2135, -320]],
      goal: [3110, -548, 360]
    },
    {
      id: 'school', title: '第4話　玉龍学園　紅い月の下で', sub: 'STAGE 4  -  GYOKURYU ACADEMY', bgm: 'school', len: 3360, talk: 'school',
      // 足場だけの過酷なステージ: 地面があるのは、出発点（〜400）・小さな島 2 つ・中ボスの区間・龍の岸だけ。
      // あとは底なしの穴の上を、小さな足場・動く足場・石の柱（blocks。穴の底から立つ）で渡る。落ちると即ゲームオーバー。
      // 足場の間は 16〜50 ドット、上がり幅は 40 ドットまで（紅のふつうのジャンプで届く）。動く足場は、近づくのを待って乗る。
      // 龍との戦い（2764〜3046）も穴の上: 固定の足場 4 つと動く足場 2 つ。龍は空を飛び回り、ときどき右の岸（3046〜）に降りて羽を休める
      ground: [[0, 400], [990, 1090], [1560, 1640], [2090, 2764], [3046, 3360]],
      blocks: [[760, 48, 70], [1320, 44, 110], [1408, 44, 130]],
      spikes: [[1052, 24]],
      springs: [1082],
      movers: [[570, 120, 40, 50, 0, 140], [1180, 150, 44, 0, -60, 150], [1730, 140, 44, 60, -40, 160], [2838, 166, 40, 70, -34, 124], [2884, 100, 40, 64, 0, 136]],
      plats: [[430, 170, 44], [505, 140, 40], [690, 110, 40], [842, 150, 40], [900, 128, 40],
      [1120, 160, 40], [1250, 96, 40], [1490, 100, 40],
      [1672, 160, 40], [1850, 96, 40], [1920, 130, 40], [1992, 160, 50],
      [2784, 158, 36], [2870, 120, 32], [2946, 86, 32], [3004, 152, 32]],
      enemies: [['robot', 300], ['drone', 520, 96], ['drone', 700, 66], ['drone', 880, 88], ['robot', 1040], ['drone', 1150, 110],
      ['drone', 1290, 50], ['robot', 1342], ['drone', 1470, 56], ['robot', 1600], ['drone', 1700, 110], ['drone', 1880, 56], ['drone', 2000, 110]],
      items: [['crystal', 452, 150], ['crystal', 525, 120], ['crystal', 710, 90], ['crystal', 862, 130], ['crystal', 920, 108],
      ['chest', 1016, 192], ['crystal', 1100, 112], ['crystal', 1114, 72], ['crystal', 1140, 140], ['crystal', 1270, 76], ['crystal', 1430, 42], ['crystal', 1510, 80], ['potion', 1620, 176],
      ['crystal', 1692, 140], ['crystal', 1870, 76], ['crystal', 2012, 140], ['crystal', 2806, 138], ['crystal', 2964, 66]],
      checkpoints: [340, 2150, 2704],
      sakura: [96, 2170, 2600],
      gate: 196,
      // 中ボス: 桜の下で立ちはだかる空手使い（一騎打ち。画面 1 枚ぶんの広さで、カメラは動かない）。
      // ここにいた機兵 2 体とドローン 1 体・薬は外し、薬は中ボスが置いていく。3 つ目の端末は、中ボスの先（龍の手前）へ移した
      mid: { type: 'karate', x: 2545, arena: [2190, 2670], trigger: 2300, name: '黒瀬 龍士', sub: 'MID BOSS  -  KUROSE RYUJI', bgm: 'midboss' },
      boss: { type: 'dragon', x: 3160, arena: [2740, 3250], trigger: 2752, name: '玉　龍', sub: 'GYOKURYU  -  THE JADE DRAGON' }
    },
    {
      // 第2章 第1話（2026-11-28 の要望「夜でなく、明るい街にして少し長めのマップを進むステージ」）: 谷山の臨海通りを、昼間に南へ走り抜ける。
      //   ch = 章（なければ第1章）。day = 昼のステージ（空・遠景・地形を昼の絵に。月・ネオンの霧・雨・光のにじみは出さない）
      //   第1章の第1話（3840）より長い 5400。穴は浅めで、海ぞいの運河（落ちるとゲームオーバー）。石の段の代わりに、コンテナを積む
      //   運河の手前と向こう岸のすぐ近くには、地上の機兵を置かない（跳ぶところでぶつかって、押し戻されないように）。
      //   ボスはいない: 通りの終わりの道路標識の下（goal）まで行くとクリア。posters = 帝国の手配書の立て看板の x
      id: 'taniyama', ch: 2, day: true, title: '第1話　谷山　白昼の臨海通り', sub: 'STAGE 1  -  TANIYAMA BAYSIDE', bgm: 'city', len: 5400,
      talk: 'taniyama', endTalk: 'taniyama_end', withMako: true,      // withMako = ステージの前の会話に大森がいる（会話の途中で別行動へ。50_game.js）
      goalMsg: '臨海通りを抜けた！ ― 南へ',
      // アクションを足した版（2026-11-28 の要望「もっとアクション性があるステージに」。ユーザーが選んだ 3 つ: 乗り物と仕掛け・敵の待ち伏せ・追われる区間）
      //   乗り物: movers の 7 番目が 'truck' = 走るトラック（荷台に乗って、スパイク帯を越える）、'crane' = クレーンのつり荷（運河の上を行き来する）
      //   仕掛け: crumbles = 崩れる足場（2 つ目の運河）、lasers = レーザー柵（ひざの高さ。跳び越えるか、消えるのを待つ）
      //   ambushes = 待ち伏せ: trigger を越えると arena に閉じこめられ、waves を全部倒すまで進めない（50_game.js の updStageEvents）
      //   chase = 追われる区間: trigger を越えると、帝国の重装ローラー車が後ろから迫る。to まで走り抜けると、標識の柱にぶつかって止まる
      //   運河は 116〜130 ドット（二段ジャンプなら届く。つり荷・崩れる足場に乗れば楽）
      ground: [[0, 1320], [1436, 2570], [2700, 3920], [4036, 5400]],
      blocks: [[420, 64, 30], [484, 64, 58], [900, 70, 32], [1180, 56, 40], [1560, 64, 32], [1624, 64, 64], [1688, 64, 96],
      [2780, 64, 30], [2844, 64, 62], [4130, 64, 34], [4194, 64, 68], [4600, 60, 40], [4860, 64, 34]],
      spikes: [[700, 180], [1500, 30], [2960, 200], [4420, 30], [4740, 30]],
      springs: [1000, 3740],
      movers: [[690, 146, 56, 132, 0, 210, 'truck'], [1318, 150, 50, 80, 0, 170, 'crane'], [2950, 146, 56, 76, 0, 180, 'truck'], [3076, 146, 56, 76, 0, 180, 'truck'],
      [3918, 150, 50, 80, -12, 170, 'crane']],
      crumbles: [[2578, 176, 36], [2624, 164, 36], [2668, 178, 30]],
      lasers: [[1880, 181, 40, 150, 0], [3800, 181, 40, 150, 60]],
      plats: [[560, 120, 70], [960, 130, 70], [1100, 104, 60], [1760, 100, 80], [1950, 128, 60], [2150, 120, 70], [2260, 92, 60],
      [2420, 124, 64], [2930, 96, 60], [3180, 100, 70], [3420, 126, 64], [3520, 96, 60],
      [4270, 100, 70], [4380, 124, 60], [4700, 116, 70], [4960, 128, 64]],
      enemies: [['robot', 620], ['drone', 780, 60], ['robot', 1060], ['drone', 1130, 80], ['robot', 1240],
      ['drone', 1700, 50], ['robot', 1820], ['robot', 1990], ['drone', 2760, 70], ['robot', 2900], ['drone', 3060, 50],
      ['robot', 3240], ['drone', 3850, 70]],
      ambushes: [
        { trigger: 2200, arena: [2040, 2560], waves: [[['robot', 2090], ['robot', 2510], ['drone', 2300, 132]], [['robot', 2080], ['robot', 2520], ['drone', 2180, 132], ['drone', 2420, 132]]] },
        { trigger: 3380, arena: [3190, 3710], waves: [[['robot', 3240], ['robot', 3660], ['drone', 3330, 132], ['drone', 3560, 132]], [['robot', 3230], ['robot', 3450], ['robot', 3670], ['drone', 3300, 132], ['drone', 3600, 132]]] }
      ],
      chase: { trigger: 4110, to: 5110, speed: 1.45 },
      items: [['crystal', 450, 140], ['crystal', 516, 112], ['crystal', 595, 100], ['crystal', 740, 120], ['crystal', 800, 120], ['crystal', 860, 120], ['crystal', 995, 110], ['crystal', 1130, 84],
      ['chest', 1212, 152], ['crystal', 1360, 126], ['crystal', 1400, 126], ['crystal', 1590, 140], ['crystal', 1656, 108], ['crystal', 1720, 76], ['potion', 1800, 80],
      ['crystal', 1980, 108], ['crystal', 2185, 100], ['crystal', 2290, 72], ['crystal', 2452, 104], ['crystal', 2596, 156], ['crystal', 2642, 144], ['crystal', 2812, 140], ['crystal', 2876, 110],
      ['crystal', 2990, 122], ['crystal', 3060, 122], ['crystal', 3130, 122], ['chest', 3215, 80], ['crystal', 3452, 106], ['crystal', 3550, 76], ['potion', 3760, 176],
      ['crystal', 3960, 118], ['crystal', 4010, 112], ['crystal', 4162, 140], ['crystal', 4226, 106], ['crystal', 4305, 80], ['crystal', 4410, 104], ['crystal', 4735, 96],
      ['crystal', 4992, 108]],
      checkpoints: [150, 1470, 2740, 4072],
      posters: [300, 1150, 2000, 2440, 3500, 4500],
      goal: [5200, GY, 200]
    },
    {
      // 第2章 第2話（2026-11-28 の要望。ユーザーが選んだ形: 夕方の動物園・ボスあり・大倉 咲は会話で登場）: 平川動物公園。
      //   day + dusk = 昼の絵の作りを使い、夕焼けの色をかぶせる（55_render.js の renderBack）。中景は動物園の丘（buildZooMid）、地形は buildZoo。
      //   帝国に乗っ取られた園内を、右へ進む。岩（blocks）を登り、お堀（穴）をゴンドラ（movers の 'gondola'）や足場で渡る。
      //   signs = 案内板 [x, 文字]（文字は 90_main.js の dayDecals）。cages = 檻 [x, 中の動物]（絵だけ）
      //   ボスは、帝国の機獣（重機兵ガーディアンの動きを使い、ツノ・キバ・尾を描き足したもの。skin: 'beast'）。倒すと、大倉 咲が現れる（会話 beast_end）
      id: 'hirakawa', ch: 2, day: true, dusk: true, title: '第2話　夕暮れの動物公園', sub: 'STAGE 2  -  HIRAKAWA ZOO', bgm: 'school', len: 4600,
      talk: 'hirakawa',
      ground: [[0, 980], [1076, 2100], [2196, 3200], [3296, 4600]],
      blocks: [[360, 60, 34], [420, 60, 62], [760, 56, 40], [1300, 64, 36], [1364, 64, 70], [1700, 56, 44], [2400, 60, 36], [2460, 60, 66], [3420, 60, 36]],
      spikes: [[600, 36], [1500, 36], [1880, 150], [3560, 36]],
      springs: [880, 2280],
      movers: [[975, 150, 50, 72, 0, 170, 'gondola'], [1872, 146, 52, 106, 0, 200, 'gondola'], [2096, 150, 50, 74, -10, 170, 'gondola'], [3196, 150, 50, 62, 0, 160, 'gondola']],
      crumbles: [[2610, 156, 40], [2676, 132, 40]],
      lasers: [[1620, 181, 40, 150, 0], [3640, 181, 40, 150, 50]],
      plats: [[500, 120, 70], [640, 96, 60], [840, 128, 60], [1180, 120, 70], [1440, 96, 64], [1600, 124, 60], [2010, 112, 60], [2330, 112, 60],
      [2540, 124, 60], [2744, 104, 70], [3000, 120, 70], [3110, 96, 60], [3480, 116, 64]],
      enemies: [['robot', 300], ['drone', 560, 70], ['robot', 700], ['drone', 800, 60], ['robot', 1280], ['drone', 1460, 50],
      ['robot', 1580], ['robot', 1780], ['drone', 1980, 60], ['robot', 2380], ['drone', 2520, 70], ['drone', 3400, 60], ['robot', 3520], ['robot', 3700]],
      ambushes: [
        { trigger: 2840, arena: [2670, 3190], waves: [[['robot', 2720], ['robot', 3140], ['drone', 2860, 132], ['drone', 3040, 132]], [['robot', 2710], ['robot', 2980], ['robot', 3150], ['drone', 2800, 132], ['drone', 3080, 132]]] }
      ],
      items: [['crystal', 390, 136], ['crystal', 450, 108], ['crystal', 535, 100], ['crystal', 670, 76], ['crystal', 870, 108], ['crystal', 1000, 126], ['crystal', 1050, 126],
      ['crystal', 1215, 100], ['chest', 1396, 100], ['crystal', 1472, 76], ['crystal', 1630, 104], ['crystal', 1900, 122], ['crystal', 1960, 122], ['crystal', 2040, 92],
      ['potion', 2130, 126], ['crystal', 2360, 92], ['crystal', 2490, 104], ['crystal', 2630, 136], ['crystal', 2696, 112], ['chest', 2778, 104], ['crystal', 3030, 100],
      ['crystal', 3140, 76], ['crystal', 3222, 126], ['crystal', 3510, 96], ['potion', 3760, 176]],
      checkpoints: [150, 1120, 2240, 3740],
      posters: [240, 2180],
      signs: [[60, '平川動物公園', 'HIRAKAWA ZOO'], [1100, 'ゾウ', 'ELEPHANT'], [2220, 'フラミンゴ', 'FLAMINGO'], [3310, 'コアラ館', 'KOALA HOUSE']],
      cages: [[520, 'giraffe'], [1150, 'elephant'], [1640, 'zebra'], [2290, 'flamingo'], [2960, 'giraffe'], [3350, 'koala']],
      boss: { type: 'guard', skin: 'beast', hp: 760, x: 4340, arena: [3820, 4580], trigger: 3910, name: '帝国機獣 ベヒモス', sub: 'IMPERIAL MECHA BEAST  -  BEHEMOTH', talk: 'beast', endTalk: 'beast_end' }
    }
  ];

  // 石積みの壁
  function bricks(P, r, x, y, w, h, bright) {
    var c = P.ctx; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    var o = bright ? 1 : 0;
    P.rect(x, y, w, h, ST[1 + o]);
    for (var by = y, row = 0; by < y + h; by += 8, row++) {
      for (var bx = x - (row % 2) * 8 - (x % 16); bx < x + w; bx += 16) {
        var k = r();
        P.rect(bx, by, 15, 7, ST[(k < 0.25 ? 1 : k < 0.75 ? 2 : 3) + o]);
        P.rect(bx, by, 15, 1, ST[(k < 0.5 ? 3 : 4) + o]);
        if (k > 0.9) P.rect(bx + 3, by + 3, 4, 2, ST[1 + o]);
        if (k < 0.08) P.rect(bx + 6, by + 2, 5, 3, ST[4 + o]);
      }
    }
    c.restore();
  }
  function moss(P, r, x0, x1, y) {
    for (var x = x0; x < x1; x += 3) {
      if (r() < 0.16) {
        var n = 2 + (r() * 5 | 0);
        for (var i = 0; i < n; i++) P.rect(x + (r() * 5 | 0), y + i, 1 + (r() * 2 | 0), 1, r() < 0.5 ? '#5d6a3a' : '#3f4a2c');
      }
    }
  }
  function platform(P, x, y, w, school) {
    P.rect(x, y, w, 8, ST[3]); P.rect(x, y, w, 1, school ? '#ffe0f6' : '#f6d2ff'); P.rect(x, y + 1, w, 1, ST[5]);
    P.rect(x, y + 6, w, 2, ST[1]);
    for (var i = x + 6; i < x + w - 4; i += 12) P.rect(i, y + 3, 1, 3, ST[1]);
    P.rect(x + 2, y + 8, w - 4, 1, '#37e6ff'); P.rect(x + 6, y + 9, w - 12, 1, '#1aa6c8');
    P.rect(x + 3, y + 10, 3, 3, '#7af3ff'); P.rect(x + w - 6, y + 10, 3, 3, '#7af3ff');
    P.px(x + 4, y + 13, '#37e6ff'); P.px(x + w - 5, y + 13, '#37e6ff');
  }
  // 石の段（地面から積み上がった、乗れる壁）
  function block(P, r, x, h, w, S) {
    var y = GY - h, deep = !S.ground.some(function (g) { return x + w / 2 >= g[0] && x + w / 2 <= g[1]; });      // 穴の中の柱は、底まで続く
    bricks(P, r, x, y, w, deep ? R.H - y : h, true);
    P.rect(x, y, 2, deep ? R.H - y : h, ST[5]); P.rect(x + w - 2, y, 2, deep ? R.H - y : h, ST[1]);
    P.rect(x, y, w, 1, '#ffe2ff'); P.rect(x, y + 1, w, 1, '#c79ae8'); P.rect(x, y + 2, w, 1, ST[4]);
    moss(P, r, x, x + w, y + 3);
  }
  // トゲ（桃色に光る結晶の牙）
  function spikes(P, x, w) {
    for (var i = 0; i + 6 <= w; i += 6) {
      P.poly([[x + i, GY], [x + i + 3, GY - 9], [x + i + 6, GY]], '#ff2e88');
      P.poly([[x + i + 2, GY], [x + i + 3, GY - 7], [x + i + 4, GY]], '#ffb0e0');
      P.px(x + i + 3, GY - 9, '#ffffff');
    }
  }
  // 穴: 奥の景色が床に見えないよう、底なしの暗がりにする（下ほど濃く、底に赤い光）
  function pits(P, S) {
    var c = P.ctx, i, x0, x1, y, gr;
    for (i = 0; i + 1 < S.ground.length; i++) {
      x0 = S.ground[i][1]; x1 = S.ground[i + 1][0]; y = GY - 28;
      gr = c.createLinearGradient(0, y, 0, R.H);
      gr.addColorStop(0, 'rgba(8,4,26,0)'); gr.addColorStop(0.2, 'rgba(8,4,26,.84)'); gr.addColorStop(0.8, 'rgba(8,4,26,.97)'); gr.addColorStop(1, 'rgba(120,10,50,.95)');
      c.fillStyle = gr; c.fillRect(x0, y, x1 - x0, R.H - y);
    }
  }
  function terrain(P, r, S) {
    pits(P, S);
    (S.blocks || []).forEach(function (b) { block(P, r, b[0], b[2], b[1], S); });
    (S.spikes || []).forEach(function (k) { spikes(P, k[0], k[1]); });
  }
  // 崩れた石のアーチ（ステージ1 冒頭の遺跡）
  function ruin(P, r, x, n, banner) {
    var span = 78, pw = 20, top = 46, w = n * span + pw, c = P.ctx, i, k;
    bricks(P, r, x, top, w, GY - top, true);
    c.globalCompositeOperation = 'destination-out';
    for (i = 0; i < n; i++) {
      var ax = x + pw + i * span, aw = span - pw;
      P.rect(ax, 108, aw, GY - 108, '#000'); P.ell(ax + aw / 2 - 0.5, 108, aw / 2, 30, '#000');
    }
    for (k = x; k < x + w; k += 6) { if (r() < 0.55) P.rect(k, top, 6, 2 + (r() * 9 | 0), '#000'); }     // 崩れた上端
    P.rect(x + w - 10, top, 10, 20 + (r() * 20 | 0), '#000');
    c.globalCompositeOperation = 'source-over';
    for (i = 0; i <= n; i++) {       // 柱の陰影
      var px = x + i * span;
      P.rect(px, 110, 2, GY - 110, ST[5]); P.rect(px + pw - 3, 110, 3, GY - 110, ST[1]);
      P.rect(px - 2, 104, pw + 4, 5, ST[4]); P.rect(px - 2, 104, pw + 4, 1, ST[6]); P.rect(px - 2, GY - 6, pw + 4, 6, ST[3]); P.rect(px - 2, GY - 6, pw + 4, 1, ST[5]);
    }
    moss(P, r, x, x + w, top + 10);
    for (i = 0; i < n * 3; i++) {      // つた
      var vx = x + (r() * w | 0), vl = 10 + (r() * 34 | 0);
      for (k = 0; k < vl; k += 2) P.rect(vx + Math.round(Math.sin(k * 0.4 + i) * 1.5), top + 12 + k, 2, 2, k % 4 ? '#4a5a34' : '#6a7a40');
    }
    if (banner) for (i = 0; i < n; i += 2) c.drawImage(banner, x + pw + i * span + 20, 86);
  }

  function buildCity(S, BG) {
    var cv = R.mk(S.len, R.H), P = R.painter(cv.getContext('2d')), r = R.rng(7741), i, x;
    S.ruins.forEach(function (q) { ruin(P, r, q[0], q[1], BG.banner); });
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      // 欄干
      for (x = x0 + 10; x < x1 - 6; x += 40) { P.rect(x, 175, 5, 17, ST[2]); P.rect(x, 175, 1, 17, ST[4]); P.rect(x - 1, 173, 7, 2, ST[3]); P.rect(x - 1, 173, 7, 1, ST[5]); }
      P.rect(x0 + 6, 179, w - 12, 2, ST[2]); P.rect(x0 + 6, 179, w - 12, 1, ST[4]); P.rect(x0 + 6, 186, w - 12, 1, ST[1]);
      // 橋の下のトラス
      for (x = x0; x < x1; x += 32) {
        P.rect(x, GY + 20, 3, 58, '#17143a'); P.line(x + 1, GY + 22, x + 32, GY + 52, 2, '#17143a'); P.line(x + 32, GY + 22, x + 1, GY + 52, 2, '#17143a');
        P.rect(x, GY + 20, 1, 58, '#2a2660');
      }
      P.rect(x0, GY + 52, w, 4, '#17143a'); P.rect(x0, GY + 52, w, 1, '#2f2b66');
      for (x = x0 + 48; x < x1 - 20; x += 96) {      // ピンクの灯り
        P.rect(x, GY + 26, 3, 3, '#ff7ad1'); P.rect(x + 4, GY + 26, 3, 3, '#ff7ad1'); P.rect(x, GY + 28, 7, 3, '#ff4fb0'); P.rect(x + 1, GY + 31, 5, 2, '#d9368f'); P.rect(x + 2, GY + 33, 3, 1, '#d9368f');
      }
      // 橋げたと橋脚
      bricks(P, r, x0, GY, w, 17, true);
      P.rect(x0, GY + 17, w, 5, ST[1]); P.rect(x0, GY + 17, w, 1, ST[4]);
      bricks(P, r, x0, GY + 17, 16, 62, false); bricks(P, r, x1 - 16, GY + 17, 16, 62, false);
      for (x = x0 + 208; x < x1 - 120; x += 208) bricks(P, r, x, GY + 17, 18, 62, false);
      P.rect(x0, GY, w, 1, '#ffe2ff'); P.rect(x0, GY + 1, w, 1, '#c79ae8'); P.rect(x0, GY + 2, w, 1, ST[4]);
      for (x = x0; x < x1; x += 5) if (r() < 0.3) P.rect(x, GY, 2 + (r() * 4 | 0), 1, '#ff9ad8');
      moss(P, r, x0, x1, GY + 3); moss(P, r, x0, x1, GY + 18);
    });
    terrain(P, r, S);
    S.plats.forEach(function (p) { platform(P, p[0], p[1], p[2], false); });
    return cv;
  }

  function buildSchool(S, BG) {
    var cv = R.mk(S.len, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(9931), x, i;
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      // 奥の柵
      for (x = x0 + 6; x < x1 - 6; x += 30) { P.rect(x, 168, 6, 24, ST[1]); P.rect(x, 168, 1, 24, ST[3]); P.rect(x - 1, 166, 8, 2, ST[2]); }
      P.rect(x0 + 4, 173, w - 8, 3, ST[1]); P.rect(x0 + 4, 173, w - 8, 1, ST[3]); P.rect(x0 + 4, 182, w - 8, 3, ST[1]); P.rect(x0 + 4, 182, w - 8, 1, ST[3]);
    });
    S.sakura.forEach(function (sx) { c.drawImage(BG.sakura, sx - BG.sakuraBase.x, GY - BG.sakuraBase.y); });
    c.drawImage(BG.gate, S.gate, GY - 60);
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      bricks(P, r, x0, GY + 8, w, 70, false);
      for (x = x0 + 60; x < x1 - 40; x += 104) {      // 石橋のアーチ
        P.ell(x, R.H + 4, 30, 44, ST[4]); P.ell(x, R.H + 4, 27, 41, '#100e2a');
        P.ell(x, R.H + 10, 20, 30, '#1b1740');
      }
      // ぬれた路面にネオンが映る
      P.rect(x0, GY, w, 8, '#4a3f8c');
      for (x = x0; x < x1; x += 2) {
        var k = r();
        if (k < 0.5) P.rect(x, GY + 1 + (r() * 7 | 0), 2 + (r() * 7 | 0), 1, k < 0.2 ? '#ff7ad1' : k < 0.3 ? '#37e6ff' : k < 0.4 ? '#8a6ad0' : '#6a55b4');
      }
      P.rect(x0, GY, w, 1, '#ffe6f8'); P.rect(x0, GY + 1, w, 1, '#d8a6ee');
      for (x = x0; x < x1; x += 4) if (r() < 0.35) P.rect(x, GY, 2 + (r() * 5 | 0), 1, '#ff9ad8');
      P.rect(x0, GY + 8, w, 2, ST[4]); P.rect(x0, GY + 10, w, 1, ST[0]);
      bricks(P, r, x0, GY + 8, 14, 70, true); bricks(P, r, x1 - 14, GY + 8, 14, 70, true);
    });
    terrain(P, r, S);
    S.plats.forEach(function (p) { platform(P, p[0], p[1], p[2], true); });
    return cv;
  }

  // 縦のステージ（鉄塔）の地形。絵の y = 世界の y - S.top（上ほど小さい世界の y を、絵の中では 0 から数える）
  function buildTower(S) {
    var oy = -S.top, LH = 300 + oy, cv = R.mk(S.len, LH), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(5517), x, y, i;
    // 塔の骨組み（左右の柱と、ななめの筋かい。乗れない飾り）
    for (y = S.goal[1] - 60 + oy; y < LH; y += 96) {
      P.line(12, y, 468, y + 96, 2, '#1c1846'); P.line(468, y, 12, y + 96, 2, '#1c1846');
      P.rect(0, y, S.len, 3, '#221d52'); P.rect(0, y, S.len, 1, '#3a3380');
    }
    [[0, 14], [466, 14]].forEach(function (q) {
      P.rect(q[0], 0, q[1], LH, '#241f56'); P.rect(q[0] + (q[0] ? 0 : q[1] - 2), 0, 2, LH, '#4a4396');
      for (y = (S.goal[1] - 60 + oy) % 24; y < LH; y += 24) { P.rect(q[0] + 3, y, q[1] - 6, 2, '#17143a'); if (r() < 0.18) P.rect(q[0] + 5, y + 8, 3, 3, r() < 0.5 ? '#ff4fb0' : '#37e6ff'); }
    });
    // 地面（塔のふもとの鉄の床）
    bricks(P, r, 0, GY + oy, S.len, LH - GY - oy, true);
    P.rect(0, GY + oy, S.len, 1, '#ffe2ff'); P.rect(0, GY + oy + 1, S.len, 1, '#c79ae8'); P.rect(0, GY + oy + 2, S.len, 1, ST[4]);
    moss(P, r, 0, S.len, GY + oy + 3);
    // 縦穴の壁（石積み。側面は壁キックで蹴れる）
    (S.walls || []).forEach(function (w) {
      bricks(P, r, w[0], w[1] + oy, w[2], w[3], true);
      P.rect(w[0], w[1] + oy, 2, w[3], ST[5]); P.rect(w[0] + w[2] - 2, w[1] + oy, 2, w[3], ST[1]);
      P.rect(w[0], w[1] + oy, w[2], 1, '#ffe2ff'); P.rect(w[0], w[1] + oy + w[3] - 2, w[2], 2, ST[0]);
    });
    // てっぺん: 電波塔のアンテナと、赤い航空灯
    var gx = S.goal[0] + S.goal[2] / 2, gy = S.goal[1] + oy;
    P.rect(gx - 2, gy - 150, 4, 150, '#3d3684'); P.rect(gx - 2, gy - 150, 1, 150, '#7a70d0');
    for (i = 0; i < 6; i++) { P.line(gx - 18 + i * 3, gy, gx - 1, gy - 150 + i * 12, 1, '#2a2462'); P.line(gx + 18 - i * 3, gy, gx + 1, gy - 150 + i * 12, 1, '#2a2462'); }
    P.rect(gx - 5, gy - 156, 10, 6, '#ff2e48'); P.rect(gx - 3, gy - 155, 6, 3, '#ffb0c0');
    P.rect(gx - 30, gy - 70, 60, 3, '#3d3684'); P.rect(gx - 32, gy - 74, 4, 6, '#ff2e48'); P.rect(gx + 28, gy - 74, 4, 6, '#ff2e48');
    S.plats.forEach(function (p) { platform(P, p[0], p[1] + oy, p[2], false); });
    return cv;
  }
  // 鉄塔の奥に見える、別の塔の骨組み（縦にくり返す 480x384）
  function buildLattice() {
    var cv = R.mk(480, 384), P = R.painter(cv.getContext('2d')), r = R.rng(3131), y, i, x;
    [[70, 46], [330, 60]].forEach(function (q) {
      var x0 = q[0], w = q[1];
      P.rect(x0, 0, 4, 384, '#1a1644'); P.rect(x0 + w, 0, 4, 384, '#1a1644');
      for (y = 0; y < 384; y += 48) { P.rect(x0, y, w + 4, 3, '#1a1644'); P.line(x0 + 2, y, x0 + w + 2, y + 48, 1, '#171340'); P.line(x0 + w + 2, y, x0 + 2, y + 48, 1, '#171340'); }
      for (i = 0; i < 5; i++) { y = r() * 384 | 0; P.rect(x0 + (r() < 0.5 ? 0 : w), y, 4, 3, r() < 0.5 ? '#ff4fb0' : '#37e6ff'); }
    });
    for (i = 0; i < 40; i++) { x = r() * 480 | 0; y = r() * 384 | 0; P.px(x, y, r() < 0.5 ? '#3a3380' : '#5a50a8'); }
    return cv;
  }

  // ステージ1 の中景: 二段アーチの水道橋（左右がつながる 960px）。石積みの目地・アーチのふち・灯りまで描き込む
  function buildViaduct() {
    var cv = R.mk(960, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(4242), x, y, i;
    function tier(y0, pierW, span, deck, pal, bottom, lights) {
      var top = y0 + deck, aw = span - pierW, ar = aw / 2, ay = top + ar + 5;
      // 壁（石積み）
      P.rect(0, top, 960, bottom - top, pal[1]);
      for (y = top; y < bottom; y += 6) {
        for (x = -((y / 6 | 0) % 2) * 6; x < 960; x += 12) {
          var k = r();
          P.rect(x, y, 11, 5, k < 0.3 ? pal[0] : k < 0.8 ? pal[1] : pal[2]);
          if (k > 0.86) P.rect(x + 2, y + 1, 5, 1, pal[3]);
        }
      }
      // アーチのふち（明るい石）を描いてから、開口部を抜く
      for (x = 0; x < 960; x += span) {
        P.ell(x + pierW + ar - 0.5, ay, ar + 2, ar + 2, pal[3]); P.rect(x + pierW - 2, ay, aw + 4, bottom - ay, pal[3]);
      }
      c.globalCompositeOperation = 'destination-out';
      for (x = 0; x < 960; x += span) { P.rect(x + pierW, ay, aw, 300, '#000'); P.ell(x + pierW + ar - 0.5, ay, ar, ar, '#000'); }
      c.globalCompositeOperation = 'source-over';
      // 橋げた
      P.rect(0, y0, 960, deck, pal[2]); P.rect(0, y0, 960, 1, pal[4]); P.rect(0, y0 + 1, 960, 1, pal[3]); P.rect(0, top - 2, 960, 2, pal[0]);
      for (x = 0; x < 960; x += 8) P.rect(x, y0 + 3, 1, deck - 5, pal[1]);
      // 橋脚の陰影と灯り
      for (x = 0; x < 960; x += span) {
        P.rect(x, top, 2, bottom - top, pal[3]); P.rect(x + pierW - 2, top, 2, bottom - top, pal[0]);
        P.rect(x - 2, ay - 1, pierW + 4, 3, pal[3]); P.rect(x - 2, ay - 1, pierW + 4, 1, pal[4]);
        if (lights && r() < 0.75) {
          var lc = r() < 0.5 ? ['#ff4fb0', '#ffb0e0'] : ['#37e6ff', '#c0f8ff'], ly = top + 10 + (r() * 14 | 0);
          P.rect(x + (pierW >> 1) - 1, ly, 3, 4, lc[0]); P.rect(x + (pierW >> 1), ly + 1, 1, 2, lc[1]);
        }
      }
      // 欄干と、ところどころ崩れた縁
      P.rect(0, y0 - 6, 960, 1, pal[2]); P.rect(0, y0 - 6, 960, 1, pal[3]);
      for (x = 4; x < 960; x += 16) { P.rect(x, y0 - 6, 2, 6, pal[2]); P.px(x, y0 - 6, pal[4]); }
      c.globalCompositeOperation = 'destination-out';
      for (x = 0; x < 960; x += 3) if (r() < 0.12) P.rect(x, y0 - 6, 3 + (r() * 14 | 0), 6 + (r() < 0.3 ? 2 : 0), '#000');
      c.globalCompositeOperation = 'source-over';
      // つた
      for (i = 0; i < 26; i++) {
        var vx = r() * 960 | 0, vl = 4 + (r() * 14 | 0);
        for (y = 0; y < vl; y += 2) P.rect(vx + Math.round(Math.sin(y * 0.5 + i) * 1.2), top + y, 2, 2, y % 4 ? '#3c4a3a' : '#55663e');
      }
    }
    tier(82, 10, 44, 8, ['#1e1a4c', '#262158', '#2e2866', '#3d3684', '#5a50a8'], 200, false);
    tier(116, 16, 80, 12, ['#2a2462', '#352e78', '#40388c', '#5a50b0', '#9a8ae0'], 200, true);
    return cv;
  }
  // 空のステージの雲の帯（左右がつながる 960x110）。col = [影, 本体, 月に照らされた上のふち]、sc = 雲の大きさ
  function buildClouds(seed, col, sc) {
    var cv = R.mk(960, 150), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(seed), L = [], i, k, q;
    for (i = 0; i < 34; i++) L.push([r() * 960, 50 + r() * 34, (16 + r() * 34) * sc, (7 + r() * 10) * sc]);
    [[0, 4, 1, 1], [1, 0, 1, 1], [2, -3, 0.7, 0.5]].forEach(function (s) {      // 影 → 本体 → 上のふち
      for (i = 0; i < L.length; i++) for (k = -1; k <= 1; k++) { q = L[i]; P.ell(Math.round(q[0] + k * 960), Math.round(q[1] + s[1]), Math.round(q[2] * s[2]), Math.round(q[3] * s[3]), col[s[0]]); }
    });
    // 雲の底は平らにつなげて、下へ行くほど薄くする（下の雲海。帯の下の端で、景色がまっすぐ切れないように）
    var n = parseInt(col[0].slice(1), 16), rgb = (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255), gr = c.createLinearGradient(0, 84, 0, 150);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',.75)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = gr; c.fillRect(0, 84, 960, 66);
    return cv;
  }
  // ---- 昼の谷山（第2章 第1話）----
  var DAY = { sky0: '#3e9cf2', sky1: '#9fd8ff', sky2: '#fff0d6', walk: ['#d8cbb4', '#c4b59c', '#ece2cc', '#a8987e'], road: ['#4a4f60', '#5a6072', '#3a3e4c'] };
  // 空（480x270）: 青空、太陽、白い雲
  function buildDaySky() {
    var cv = R.mk(R.W, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8101), gr = c.createLinearGradient(0, 0, 0, R.H), i;
    gr.addColorStop(0, DAY.sky0); gr.addColorStop(0.55, DAY.sky1); gr.addColorStop(1, DAY.sky2); c.fillStyle = gr; c.fillRect(0, 0, R.W, R.H);
    var sg = c.createRadialGradient(392, 44, 6, 392, 44, 90); sg.addColorStop(0, 'rgba(255,255,235,.95)'); sg.addColorStop(0.25, 'rgba(255,246,200,.45)'); sg.addColorStop(1, 'rgba(255,246,200,0)');
    c.fillStyle = sg; c.fillRect(0, 0, R.W, R.H);
    P.disc(392, 44, 15, '#fffbe8'); P.disc(392, 44, 12, '#ffffff');
    for (i = 0; i < 90; i++) P.px(r() * R.W, 4 + r() * 100, 'rgba(255,255,255,.35)');      // 高い空のちり
    return cv;
  }
  // 流れる雲（左右がつながる 960x110）
  function buildDayClouds() {
    var cv = R.mk(960, 110), P = R.painter(cv.getContext('2d')), r = R.rng(8202), L = [], i, k, q;
    for (i = 0; i < 9; i++) { var cx = r() * 960, cy = 24 + r() * 60, n = 4 + (r() * 4 | 0); for (k = 0; k < n; k++) L.push([cx + (k - n / 2) * 13 + r() * 6, cy - r() * 8, 10 + r() * 12, 6 + r() * 5]); }
    [['#b9d8f2', 0, 3], ['#ffffff', 0, 0], ['#ffffff', -2, -2]].forEach(function (s, j) {
      for (i = 0; i < L.length; i++) for (k = -1; k <= 1; k++) { q = L[i]; P.ell(Math.round(q[0] + k * 960 + s[1]), Math.round(q[1] + s[2]), Math.round(q[2] * (j === 2 ? 0.6 : 1)), Math.round(q[3] * (j === 2 ? 0.5 : 1)), s[0]); }
    });
    return cv;
  }
  // 遠景（960x270。ほとんど動かない）: 錦江湾ごしの桜島と、大隅の山なみ、きらめく海
  function buildDayFar() {
    var cv = R.mk(960, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8303), x, y, i;
    for (x = 0; x < 960; x++) { var h = 22 + 10 * Math.sin(x * 0.011) + 6 * Math.sin(x * 0.037 + 1) + 3 * Math.sin(x * 0.09); P.rect(x, 150 - h, 1, h, '#9fc6de'); P.rect(x, 150 - h, 1, 1, '#c6e2f2'); }      // 大隅の山なみ
    // 桜島（二つの峰と、たなびく噴煙）
    for (x = -150; x <= 150; x++) {
      var u = Math.abs(x) / 150, hh = 78 * Math.pow(1 - u, 1.15) + (Math.abs(x + 24) < 26 ? 7 * (1 - Math.abs(x + 24) / 26) : 0);
      P.rect(360 + x, 152 - hh, 1, hh, '#7fa8c8'); P.rect(360 + x, 152 - hh, 1, 2, '#a8c8de');
      if (x < 0 && r() < 0.5) P.rect(360 + x, 152 - hh + 4 + (r() * hh * 0.6 | 0), 1, 3, '#6f98b8');
    }
    for (i = 0; i < 26; i++) { var t = i / 25; P.ell(356 + t * 120 + r() * 8, 66 - t * 38 + r() * 6, 8 + t * 18, 5 + t * 8, 'rgba(236,240,246,' + (0.8 - t * 0.6) + ')'); }
    // 海
    var gr = c.createLinearGradient(0, 150, 0, R.H); gr.addColorStop(0, '#5fb0e0'); gr.addColorStop(1, '#2f7ec0'); c.fillStyle = gr; c.fillRect(0, 150, 960, R.H - 150);
    for (i = 0; i < 260; i++) { x = r() * 960 | 0; y = 152 + (r() * 110 | 0); P.rect(x, y, 2 + (r() * 6 | 0), 1, r() < 0.5 ? '#bfe8ff' : '#ffffff'); }
    for (i = 0; i < 3; i++) { x = 120 + i * 300 + (r() * 80 | 0); P.rect(x, 158 + i * 3, 14, 3, '#f4f8ff'); P.rect(x + 3, 155 + i * 3, 6, 3, '#d8e4f4'); P.px(x + 8, 154 + i * 3, '#ff4060'); }      // 船
    return cv;
  }
  // 中景（左右がつながる 960x270）: 港のクレーン・倉庫・七ツ島のメガソーラー・ヤシの木・明るいビル
  function buildDayMid() {
    var cv = R.mk(960, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8404), x, y, i, k;
    var B = ['#f2e6d8', '#e8d8f0', '#d8ecf4', '#f6dcd8', '#e0f0e0'];
    // 岸壁
    P.rect(0, 172, 960, R.H - 172, '#b8c4cc'); P.rect(0, 172, 960, 2, '#e8f0f4');
    // メガソーラー（青いパネルが斜めに並ぶ）
    for (k = 0; k < 2; k++) {
      var sx0 = 40 + k * 500;
      for (y = 0; y < 4; y++) for (x = 0; x < 9; x++) {
        var px0 = sx0 + x * 22 + y * 6, py0 = 150 + y * 6;
        P.poly([[px0, py0 + 5], [px0 + 18, py0 + 5], [px0 + 22, py0], [px0 + 4, py0]], '#2a5ab8'); P.rect(px0 + 5, py0 + 1, 16, 1, '#7ab0ff'); P.rect(px0 + 2, py0 + 3, 16, 1, '#3e70d0');
      }
    }
    // 倉庫とビル
    for (x = 0; x < 960;) {
      var w = 40 + (r() * 50 | 0), h = 24 + (r() * 60 | 0), col = B[(r() * B.length) | 0];
      if (!((x > 30 && x < 270) || (x > 530 && x < 770)) || h < 40) {
        P.rect(x, 172 - h, w, h, col); P.rect(x, 172 - h, w, 2, '#ffffff'); P.rect(x + w - 3, 172 - h, 3, h, 'rgba(0,0,0,.08)');
        for (y = 172 - h + 6; y < 166; y += 7) for (i = x + 4; i < x + w - 6; i += 7) P.rect(i, y, 4, 3, r() < 0.15 ? '#ffd36a' : '#8fc4e8');
        if (r() < 0.35) { P.rect(x + 4, 172 - h - 6, 14, 5, r() < 0.5 ? '#ff4fb0' : '#37b8e6'); P.rect(x + 5, 172 - h - 5, 12, 1, '#ffffff'); }      // 屋上の看板
      }
      x += w + 2 + (r() * 10 | 0);
    }
    // 港のガントリークレーン（赤と白）
    [150, 420, 700].forEach(function (cx, n) {
      var top = 60 + n * 8;
      P.rect(cx, top, 4, 172 - top, '#e04848'); P.rect(cx + 30, top, 4, 172 - top, '#e04848');
      for (y = top; y < 172; y += 12) { P.line(cx + 2, y, cx + 32, y + 12, 1, '#c03838'); P.rect(cx, y, 34, 1, y % 24 ? '#ffffff' : '#e04848'); }
      P.rect(cx - 30, top - 6, 96, 6, '#f4f4f4'); P.rect(cx - 30, top - 6, 96, 1, '#ffffff'); P.rect(cx - 30, top - 1, 96, 1, '#c8c8d0');
      P.rect(cx - 10 + n * 6, top, 10, 6, '#3a3e4c'); P.rect(cx - 6 + n * 6, top + 6, 1, 22, '#3a3e4c'); P.rect(cx - 10 + n * 6, top + 28, 10, 6, ['#ff9a3a', '#3ab0a0', '#4a7ae0'][n]);
      P.px(cx + 2, top - 8, '#ff3048'); P.px(cx + 32, top - 8, '#ff3048');
    });
    // 積まれたコンテナ
    for (i = 0; i < 14; i++) { x = r() * 940 | 0; var ch2 = ['#ff9a3a', '#3ab0a0', '#4a7ae0', '#e05050', '#f0c040'][i % 5]; P.rect(x, 162, 22, 10, ch2); P.rect(x, 162, 22, 1, '#ffffff'); for (k = x + 3; k < x + 22; k += 3) P.rect(k, 164, 1, 7, 'rgba(0,0,0,.18)'); }
    // ヤシの木（フェニックス）
    for (i = 0; i < 8; i++) {
      x = 60 + i * 120 + (r() * 30 | 0); var th = 38 + (r() * 16 | 0);
      for (y = 0; y < th; y++) P.rect(x + Math.round(Math.sin(y * 0.05) * 2), 172 - y, 3, 1, y % 3 ? '#8a6a48' : '#a8845c');
      var tx = x + 1 + Math.round(Math.sin(th * 0.05) * 2), ty = 172 - th;
      for (k = 0; k < 7; k++) { var an = -Math.PI / 2 + (k - 3) * 0.55; for (y = 0; y < 16; y++) P.rect(tx + Math.cos(an) * y, ty + Math.sin(an) * y * 0.6 + y * y * 0.035, 2, 2, y % 4 ? '#3aa050' : '#58c068'); }
    }
    return cv;
  }
  function dayPlat(P, x, y, w) {      // 足場（鉄の足場板。黄色いふち）
    P.rect(x, y, w, 6, '#9aa4b4'); P.rect(x, y, w, 1, '#ffffff'); P.rect(x, y + 1, w, 1, '#f0c040'); P.rect(x, y + 5, w, 1, '#5a6272');
    for (var i = x + 4; i < x + w - 2; i += 8) P.rect(i, y + 2, 2, 2, '#6a7484');
    P.line(x + 4, y + 6, x + 12, y + 14, 1, '#6a7484'); P.line(x + w - 4, y + 6, x + w - 12, y + 14, 1, '#6a7484');
  }
  function container(P, r, x, h, w, S) {      // コンテナ（石の段の代わり）。穴の中なら、底まで積み上げる
    var y = GY - h, deep = !S.ground.some(function (g) { return x + w / 2 >= g[0] && x + w / 2 <= g[1]; }), hh = deep ? R.H - y : h;
    var cols = [['#ff9a3a', '#ffc27a', '#c86a20'], ['#3ab0a0', '#7ae0d0', '#24806e'], ['#4a7ae0', '#8ab0ff', '#2c50a8'], ['#e05050', '#ff9090', '#a83030']], col = cols[(x / 7 | 0) % 4], k;
    P.rect(x, y, w, hh, col[0]); P.rect(x, y, w, 2, col[1]); P.rect(x, y, 2, hh, col[1]); P.rect(x + w - 2, y, 2, hh, col[2]);
    for (k = x + 5; k < x + w - 3; k += 4) P.rect(k, y + 4, 1, hh - 6, col[2]);
    for (k = y + 30; k < y + hh; k += 30) P.rect(x, k, w, 2, col[2]);      // 積み重ねの継ぎ目
    P.rect(x + w / 2 - 6, y + 8, 12, 6, '#ffffff'); P.rect(x + w / 2 - 5, y + 9, 10, 1, col[2]); P.rect(x + w / 2 - 5, y + 11, 6, 1, col[2]);      // ロゴの札
  }
  function daySpikes(P, x, w) {      // 道路のスパイク（黄色と黒の台に、銀のとげ）
    P.rect(x, GY - 3, w, 3, '#f0c040'); for (var i = x; i < x + w; i += 6) P.rect(i, GY - 3, 3, 3, '#2a2a30');
    for (i = 0; i + 6 <= w; i += 6) { P.poly([[x + i, GY - 3], [x + i + 3, GY - 11], [x + i + 6, GY - 3]], '#c8d0dc'); P.poly([[x + i + 2, GY - 3], [x + i + 3, GY - 9], [x + i + 3, GY - 3]], '#ffffff'); }
  }
  function buildTown(S, BG) {
    var cv = R.mk(S.len, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8505), x, i, k;
    // 穴: 海ぞいの運河（深い青の水面がのぞく）
    for (i = 0; i + 1 < S.ground.length; i++) {
      var x0 = S.ground[i][1], x1 = S.ground[i + 1][0], gr = c.createLinearGradient(0, GY, 0, R.H);
      gr.addColorStop(0, 'rgba(20,50,90,.2)'); gr.addColorStop(0.35, '#1a4a78'); gr.addColorStop(1, '#0a2448'); c.fillStyle = gr; c.fillRect(x0, GY - 10, x1 - x0, R.H - GY + 10);
      for (k = 0; k < 18; k++) P.rect(x0 + (r() * (x1 - x0 - 8) | 0), 232 + (r() * 34 | 0), 3 + (r() * 6 | 0), 1, '#6ab8f0');
      P.rect(x0, 228, x1 - x0, 1, '#8ad0ff');
    }
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      // ガードレールの奥: ヤシの並木と街灯
      for (x = x0 + 40; x < x1 - 20; x += 150) {
        var th = 70 + (r() * 20 | 0), y;
        for (y = 0; y < th; y++) P.rect(x + Math.round(Math.sin(y * 0.04) * 2), GY - y, 4, 1, y % 4 ? '#8a6a48' : '#a8845c');
        var tx = x + 2 + Math.round(Math.sin(th * 0.04) * 2), ty = GY - th;
        for (k = 0; k < 9; k++) { var an = -Math.PI / 2 + (k - 4) * 0.42; for (y = 0; y < 22; y++) P.rect(tx + Math.cos(an) * y, ty + Math.sin(an) * y * 0.6 + y * y * 0.03, 3, 2, y % 5 ? '#2e9a48' : '#5ac46a'); }
      }
      for (x = x0 + 115; x < x1 - 20; x += 150) {      // 街灯（ネオンの輪）
        P.rect(x, GY - 76, 2, 76, '#6a7484'); P.rect(x, GY - 76, 12, 2, '#6a7484'); P.rect(x + 9, GY - 74, 6, 3, '#e8f4ff'); P.rect(x + 8, GY - 71, 8, 1, '#37b8e6');
      }
      // ガードレール
      for (x = x0 + 6; x < x1 - 6; x += 24) { P.rect(x, 176, 3, 16, '#b8c0cc'); P.rect(x, 176, 1, 16, '#ffffff'); }
      P.rect(x0 + 4, 178, w - 8, 4, '#e8eef4'); P.rect(x0 + 4, 178, w - 8, 1, '#ffffff'); P.rect(x0 + 4, 181, w - 8, 1, '#9aa4b0');
      // 歩道（タイル）と、縁石・車道・岸壁
      P.rect(x0, GY, w, 10, DAY.walk[0]);
      for (x = x0; x < x1; x += 10) { P.rect(x, GY, 1, 10, DAY.walk[1]); if (r() < 0.3) P.rect(x + 2, GY + 2 + (r() * 6 | 0), 5, 1, DAY.walk[2]); }
      P.rect(x0, GY + 4, w, 1, DAY.walk[1]); P.rect(x0, GY, w, 1, '#ffffff'); P.rect(x0, GY + 1, w, 1, DAY.walk[2]);
      P.rect(x0, GY + 10, w, 3, '#e8e8ec'); P.rect(x0, GY + 13, w, 1, '#9a9aa4');
      P.rect(x0, GY + 14, w, 34, DAY.road[0]);
      for (x = x0; x < x1; x += 4) if (r() < 0.35) P.rect(x, GY + 15 + (r() * 32 | 0), 2, 1, DAY.road[1]);
      for (x = x0 + 10; x < x1 - 20; x += 40) P.rect(x, GY + 30, 20, 2, '#ffffff');      // 白い破線
      P.rect(x0, GY + 48, w, R.H - GY - 48, '#c8ccd4'); P.rect(x0, GY + 48, w, 2, '#e8ecf0');
      for (x = x0; x < x1; x += 24) P.rect(x, GY + 50, 1, R.H - GY - 50, '#a8acb8');
      for (x = x0 + 30; x < x1 - 30; x += 120) { P.rect(x, GY + 58, 10, 6, '#3a3e4c'); P.rect(x + 2, GY + 60, 6, 2, '#ff9a3a'); }      // 岸壁の排水口
      P.rect(x0, GY, 2, R.H - GY, '#9aa4b0'); P.rect(x1 - 2, GY, 2, R.H - GY, '#7a8494');
    });
    // 帝国の手配書の立て看板（文字は 90_main.js の decals で描く）
    (S.posters || []).forEach(function (px) {
      P.rect(px + 4, GY - 40, 2, 40, '#6a7484'); P.rect(px + 30, GY - 40, 2, 40, '#6a7484');
      P.rect(px, GY - 66, 36, 30, '#a00a1e'); P.rect(px + 2, GY - 64, 32, 26, '#fff4e0');
      P.ell(px + 11, GY - 50, 5, 6, '#ff8a3a'); P.ell(px + 11, GY - 49, 3, 4, '#f0c8a8');      // 紅（橙の髪）
      P.ell(px + 25, GY - 50, 5, 6, '#3a48d8'); P.ell(px + 25, GY - 49, 3, 4, '#f0c8a8');      // 蒼（青い髪）
      P.rect(px + 2, GY - 42, 32, 4, '#a00a1e');
    });
    // ゴール: 道路の案内標識（緑の板。文字は decals）と、市の境の線
    var gl = S.goal, gx = gl[0] + 30;
    P.rect(gx, GY - 110, 4, 110, '#8a94a4'); P.rect(gx + 136, GY - 110, 4, 110, '#8a94a4'); P.rect(gx, GY - 110, 140, 4, '#8a94a4');
    P.rect(gx + 8, GY - 104, 124, 40, '#1e8a4e'); P.rect(gx + 9, GY - 103, 122, 38, '#ffffff'); P.rect(gx + 10, GY - 102, 120, 36, '#1e8a4e');
    for (x = gl[0]; x < gl[0] + gl[2]; x += 8) { P.rect(x, GY + 2, 4, 3, '#ffffff'); P.rect(x + 4, GY + 5, 4, 3, '#ffffff'); }
    S.blocks.forEach(function (b) { container(P, r, b[0], b[2], b[1], S); });
    S.spikes.forEach(function (k2) { daySpikes(P, k2[0], k2[1]); });
    S.plats.forEach(function (p) { dayPlat(P, p[0], p[1], p[2]); });
    return cv;
  }
  // ---- 夕方の平川動物公園（第2章 第2話）----
  // 夕焼けの空（480x270）: 上は紫、地平線は橙。低い大きな夕日
  function buildDuskSky() {
    var cv = R.mk(R.W, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8606), gr = c.createLinearGradient(0, 0, 0, R.H), i;
    gr.addColorStop(0, '#3a2a78'); gr.addColorStop(0.35, '#b0508c'); gr.addColorStop(0.62, '#ff9a5a'); gr.addColorStop(0.8, '#ffd68a'); gr.addColorStop(1, '#ffe8b0'); c.fillStyle = gr; c.fillRect(0, 0, R.W, R.H);
    var sg = c.createRadialGradient(330, 142, 8, 330, 142, 130); sg.addColorStop(0, 'rgba(255,250,210,.95)'); sg.addColorStop(0.3, 'rgba(255,190,110,.5)'); sg.addColorStop(1, 'rgba(255,150,90,0)');
    c.fillStyle = sg; c.fillRect(0, 0, R.W, R.H);
    P.disc(330, 142, 22, '#fff0c0'); P.disc(330, 142, 18, '#fffbe0');
    for (i = 0; i < 40; i++) P.px(r() * R.W, r() * 60, 'rgba(255,255,255,' + (0.3 + r() * 0.5) + ')');      // 一番星
    for (i = 0; i < 7; i++) { var bx = 60 + r() * 360, by = 40 + r() * 70; P.rect(bx, by, 3, 1, '#2a1a40'); P.px(bx - 1, by - 1, '#2a1a40'); P.px(bx + 3, by - 1, '#2a1a40'); }      // ねぐらへ帰る鳥
    return cv;
  }
  // 動物園の中景（左右がつながる 960x270）: 丘と森、観覧車、ロケットの模型、大きな鳥かご、キリンとゾウの影
  function buildZooMid() {
    var cv = R.mk(960, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8707), x, y, i, k;
    for (x = 0; x < 960; x++) { var h = 34 + 16 * Math.sin(x * 0.0131) + 9 * Math.sin(x * 0.0327 + 1.3); P.rect(x, 176 - h, 1, h + 100, '#3f8a58'); P.rect(x, 176 - h, 1, 2, '#6ab878'); }      // 奥の丘
    for (i = 0; i < 70; i++) { x = r() * 960; y = 150 + r() * 22; var tr = 7 + r() * 9; P.ell(x, y - tr, tr, tr * 1.1, r() < 0.5 ? '#2e7a48' : '#3a9058'); P.ell(x - 2, y - tr - 2, tr * 0.6, tr * 0.6, '#58b070'); P.rect(x - 1, y, 2, 6, '#6a4a30'); }      // 森
    // 観覧車
    var wx = 210, wy = 96, wr = 44;
    P.line(wx, wy, wx - 22, 176, 2, '#c8ccd8'); P.line(wx, wy, wx + 22, 176, 2, '#c8ccd8');
    for (k = 0; k < 12; k++) { var an = k * Math.PI / 6; P.line(wx, wy, wx + Math.cos(an) * wr, wy + Math.sin(an) * wr, 1, '#e8ecf4'); P.rect(wx + Math.cos(an) * wr - 3, wy + Math.sin(an) * wr - 2, 7, 6, ['#ff6a8a', '#ffd36a', '#6ac8ff', '#8ae08a'][k % 4]); }
    for (k = 0; k < 48; k++) { var a2 = k * Math.PI / 24; P.px(wx + Math.cos(a2) * wr, wy + Math.sin(a2) * wr, '#ffffff'); }
    P.disc(wx, wy, 4, '#ff6a8a');
    // ロケットの模型（となりの錦江湾公園）
    var rx = 640; P.rect(rx - 3, 70, 7, 104, '#f4f4f8'); P.rect(rx - 3, 70, 2, 104, '#ffffff'); P.rect(rx + 2, 70, 2, 104, '#c8ccd8'); P.poly([[rx - 3, 70], [rx + 0.5, 54], [rx + 4, 70]], '#e04848');
    P.rect(rx - 7, 150, 4, 24, '#e8e8f0'); P.rect(rx + 4, 150, 4, 24, '#e8e8f0'); P.rect(rx - 3, 110, 7, 3, '#e04848'); P.rect(rx - 3, 140, 7, 2, '#3a3e4c');
    // 大きな鳥かご（丸い屋根）
    var cx2 = 820; P.ell(cx2, 150, 40, 36, 'rgba(232,236,244,.35)');
    for (k = -5; k <= 5; k++) P.line(cx2 + k * 7, 176, cx2 + k * 4, 116, 1, '#dfe4ee');
    for (k = 0; k < 4; k++) P.rect(cx2 - 38 + k * 2, 132 + k * 12, 76 - k * 4, 1, '#dfe4ee');
    // キリンとゾウの影（丘の上）
    function giraffe(gx, gy) { P.rect(gx, gy - 18, 16, 9, '#c88a3a'); P.rect(gx + 1, gy - 9, 2, 9, '#c88a3a'); P.rect(gx + 12, gy - 9, 2, 9, '#c88a3a'); P.line(gx + 14, gy - 16, gx + 22, gy - 40, 3, '#c88a3a'); P.rect(gx + 20, gy - 44, 8, 4, '#c88a3a'); P.px(gx + 22, gy - 46, '#6a4a20'); for (var q = 0; q < 6; q++) P.px(gx + 2 + q * 2, gy - 15 + (q % 2) * 3, '#8a5a20'); }
    function elephant(ex, ey) { P.ell(ex, ey - 12, 14, 10, '#9aa0b4'); P.rect(ex - 10, ey - 6, 4, 6, '#8a90a4'); P.rect(ex + 5, ey - 6, 4, 6, '#8a90a4'); P.ell(ex + 14, ey - 16, 7, 7, '#9aa0b4'); P.line(ex + 19, ey - 14, ex + 22, ey - 2, 2, '#8a90a4'); P.ell(ex + 10, ey - 17, 4, 6, '#7a8094'); }
    giraffe(90, 150); giraffe(470, 146); elephant(360, 158); elephant(720, 160);
    // 手前の芝と生け垣
    P.rect(0, 172, 960, R.H - 172, '#4a9a5c'); P.rect(0, 172, 960, 2, '#7ac888');
    for (x = 0; x < 960; x += 12) P.ell(x + 6, 172, 8, 5, r() < 0.5 ? '#2e7a48' : '#3a9058');
    return cv;
  }
  function rock(P, r, x, h, w, S) {      // 岩（石の段の代わり）。お堀の中なら、底まで続く
    var y = GY - h, deep = !S.ground.some(function (g) { return x + w / 2 >= g[0] && x + w / 2 <= g[1]; }), hh = deep ? R.H - y : h, k, i;
    P.rect(x, y, w, hh, '#8a7a6a'); P.rect(x, y, w, 2, '#c8b8a0'); P.rect(x, y, 2, hh, '#a89884'); P.rect(x + w - 2, y, 2, hh, '#5a4e42');
    for (k = y + 4; k < y + hh - 2; k += 9) for (i = x + ((k / 9 | 0) % 2) * 7; i < x + w; i += 14) { P.rect(i, k, 13, 8, r() < 0.5 ? '#7a6c5e' : '#948472'); P.rect(i, k, 13, 1, '#a89884'); }
    for (i = x; i < x + w; i += 3) if (r() < 0.5) P.rect(i, y, 2, 2 + (r() * 4 | 0), r() < 0.5 ? '#4a9a5c' : '#6ab878');      // こけ
  }
  function deck(P, x, y, w) {      // 木のデッキ（足場）
    P.rect(x, y, w, 6, '#a8703c'); P.rect(x, y, w, 1, '#e0b078'); P.rect(x, y + 5, w, 1, '#6a4420');
    for (var i = x + 8; i < x + w; i += 10) P.rect(i, y + 1, 1, 4, '#7a5028');
    P.rect(x + 4, y + 6, 3, 10, '#7a5028'); P.rect(x + w - 7, y + 6, 3, 10, '#7a5028'); P.line(x + 6, y + 14, x + 16, y + 6, 1, '#7a5028'); P.line(x + w - 6, y + 14, x + w - 16, y + 6, 1, '#7a5028');
  }
  function thorns(P, x, w) {      // いばらの柵（帝国が張った。触れると痛い）
    P.rect(x, GY - 3, w, 3, '#3a2a30');
    for (var i = 0; i + 6 <= w; i += 6) { P.poly([[x + i, GY - 3], [x + i + 3, GY - 12], [x + i + 6, GY - 3]], '#8a1024'); P.poly([[x + i + 2, GY - 3], [x + i + 3, GY - 10], [x + i + 3, GY - 3]], '#ff4a5e'); }
  }
  function cage(P, r, x, kind) {      // 檻（帝国の旗つき）。中に、動物の影
    var w = 76, h = 62, y = GY - h, k;
    P.rect(x, y, w, h, 'rgba(30,24,44,.55)');
    var ax = x + w / 2, ay = GY - 2, col = '#1c1630';
    if (kind === 'giraffe') { P.rect(ax - 12, ay - 22, 20, 10, col); P.rect(ax - 11, ay - 12, 3, 12, col); P.rect(ax + 4, ay - 12, 3, 12, col); P.line(ax + 6, ay - 20, ax + 14, ay - 50, 4, col); P.rect(ax + 12, ay - 54, 10, 5, col); }
    else if (kind === 'elephant') { P.ell(ax - 4, ay - 20, 20, 15, col); P.rect(ax - 18, ay - 10, 6, 10, col); P.rect(ax + 4, ay - 10, 6, 10, col); P.ell(ax + 16, ay - 26, 10, 10, col); P.line(ax + 24, ay - 22, ax + 27, ay - 4, 3, col); }
    else if (kind === 'zebra') { P.rect(ax - 14, ay - 24, 26, 11, col); P.rect(ax - 13, ay - 13, 3, 13, col); P.rect(ax + 7, ay - 13, 3, 13, col); P.line(ax + 10, ay - 22, ax + 17, ay - 34, 5, col); P.rect(ax + 14, ay - 38, 10, 6, col); }
    else if (kind === 'flamingo') { for (k = -1; k <= 1; k++) { P.ell(ax + k * 18, ay - 24, 6, 4, col); P.rect(ax + k * 18, ay - 20, 1, 20, col); P.line(ax + k * 18 + 4, ay - 26, ax + k * 18 + 7, ay - 38, 1, col); P.rect(ax + k * 18 + 6, ay - 40, 4, 2, col); } }
    else { P.rect(ax - 2, ay - 56, 4, 56, '#3a2a20'); P.rect(ax - 20, ay - 40, 40, 3, '#3a2a20'); P.ell(ax + 8, ay - 46, 7, 7, col); P.ell(ax + 3, ay - 51, 3, 3, col); P.ell(ax + 13, ay - 51, 3, 3, col); }      // コアラ（木の上）
    for (k = x; k <= x + w; k += 6) { P.rect(k, y, 2, h, '#5a5068'); P.rect(k, y, 1, h, '#8a80a0'); }
    P.rect(x - 2, y - 4, w + 5, 5, '#3a3048'); P.rect(x - 2, y - 4, w + 5, 1, '#8a80a0'); P.rect(x - 2, GY - 4, w + 5, 4, '#3a3048');
    P.rect(x + w - 10, y - 26, 2, 24, '#5a5068'); P.rect(x + w - 8, y - 26, 12, 9, '#a00a1e'); P.rect(x + w - 4, y - 23, 3, 3, '#ffd36a');      // 帝国の旗
    P.rect(x + 4, y + 6, 8, 6, '#ff3048'); P.rect(x + 6, y + 8, 4, 2, '#ffd0d6');      // 錠
  }
  function buildZoo(S, BG) {
    var cv = R.mk(S.len, R.H), c = cv.getContext('2d'), P = R.painter(c), r = R.rng(8808), x, i, k;
    // 穴: お堀（水面に夕日がきらめく）
    for (i = 0; i + 1 < S.ground.length; i++) {
      var x0 = S.ground[i][1], x1 = S.ground[i + 1][0], gr = c.createLinearGradient(0, GY, 0, R.H);
      gr.addColorStop(0, 'rgba(20,60,80,.2)'); gr.addColorStop(0.3, '#1e6a88'); gr.addColorStop(1, '#0e3a58'); c.fillStyle = gr; c.fillRect(x0, GY - 8, x1 - x0, R.H - GY + 8);
      for (k = 0; k < 20; k++) P.rect(x0 + (r() * (x1 - x0 - 8) | 0), 226 + (r() * 40 | 0), 3 + (r() * 6 | 0), 1, r() < 0.4 ? '#ffd68a' : '#7ad0e8');
      P.rect(x0, 222, x1 - x0, 1, '#a8e8f8');
    }
    S.ground.forEach(function (g) {
      var x0 = g[0], x1 = g[1], w = x1 - x0;
      for (x = x0 + 70; x < x1 - 30; x += 190) {      // 木
        var th = 50 + (r() * 20 | 0); P.rect(x, GY - th, 5, th, '#6a4a30'); P.rect(x, GY - th, 2, th, '#8a6a48');
        P.ell(x + 2, GY - th - 8, 24, 20, '#2e7a48'); P.ell(x - 8, GY - th - 2, 14, 12, '#3a9058'); P.ell(x + 12, GY - th - 12, 14, 12, '#58b070');
      }
      for (x = x0 + 150; x < x1 - 20; x += 190) {      // 園の街灯（まるい灯り）
        P.rect(x, GY - 60, 2, 60, '#4a4458'); P.disc(x + 1, GY - 64, 5, '#fff0b0'); P.disc(x + 1, GY - 64, 3, '#ffffff');
      }
      // 木の柵
      for (x = x0 + 6; x < x1 - 6; x += 16) { P.rect(x, 174, 4, 18, '#a8703c'); P.rect(x, 174, 1, 18, '#e0b078'); P.poly([[x, 174], [x + 2, 170], [x + 4, 174]], '#a8703c'); }
      P.rect(x0 + 4, 179, w - 8, 3, '#8a5a30'); P.rect(x0 + 4, 179, w - 8, 1, '#e0b078'); P.rect(x0 + 4, 186, w - 8, 2, '#8a5a30');
      // 園路（れんが）と、その下の土・石垣
      P.rect(x0, GY, w, 12, '#c88a6a');
      for (k = 0; k < 2; k++) for (x = x0 - (k * 8); x < x1; x += 16) { P.rect(x, GY + k * 6, 15, 5, r() < 0.5 ? '#d89a78' : '#b87a5a'); }
      P.rect(x0, GY, w, 1, '#ffe0c0'); P.rect(x0, GY + 12, w, 2, '#7a5a48');
      P.rect(x0, GY + 14, w, 22, '#4a9a5c'); for (x = x0; x < x1; x += 5) if (r() < 0.5) P.rect(x, GY + 14 + (r() * 20 | 0), 2, 2, r() < 0.5 ? '#6ab878' : '#3a8048');
      for (x = x0 + 20; x < x1 - 10; x += 60) { var fc = ['#ff7a9a', '#ffd36a', '#ffffff', '#c89aff'][(x / 60 | 0) % 4]; for (k = 0; k < 5; k++) P.px(x + (r() * 16 | 0), GY + 17 + (r() * 14 | 0), fc); }      // 花
      P.rect(x0, GY + 36, w, R.H - GY - 36, '#8a7a6a');
      for (k = GY + 38; k < R.H; k += 10) for (x = x0 - ((k / 10 | 0) % 2) * 9; x < x1; x += 18) { P.rect(x, k, 17, 9, r() < 0.5 ? '#7a6c5e' : '#948472'); P.rect(x, k, 17, 1, '#a89884'); }
      P.rect(x0, GY, 2, R.H - GY, '#a89884'); P.rect(x1 - 2, GY, 2, R.H - GY, '#5a4e42');
    });
    (S.cages || []).forEach(function (q) { cage(P, r, q[0], q[1]); });
    // 案内板（文字は 90_main.js の dayDecals）と、帝国の手配書
    (S.signs || []).forEach(function (q) { P.rect(q[0] + 4, GY - 44, 3, 44, '#6a4a30'); P.rect(q[0] + 55, GY - 44, 3, 44, '#6a4a30'); P.rect(q[0], GY - 72, 62, 30, '#3a2a20'); P.rect(q[0] + 2, GY - 70, 58, 26, '#f4e8c8'); P.rect(q[0] + 2, GY - 70, 58, 2, '#4a9a5c'); });
    (S.posters || []).forEach(function (px) {
      P.rect(px + 4, GY - 40, 2, 40, '#6a7484'); P.rect(px + 30, GY - 40, 2, 40, '#6a7484');
      P.rect(px, GY - 66, 36, 30, '#a00a1e'); P.rect(px + 2, GY - 64, 32, 26, '#fff4e0');
      P.ell(px + 11, GY - 50, 5, 6, '#ff8a3a'); P.ell(px + 11, GY - 49, 3, 4, '#f0c8a8'); P.ell(px + 25, GY - 50, 5, 6, '#3a48d8'); P.ell(px + 25, GY - 49, 3, 4, '#f0c8a8');
      P.rect(px + 2, GY - 42, 32, 4, '#a00a1e');
    });
    // ボスの広場: コアラ館の建物（奥）
    var bx = S.boss.arena[0] + 250;
    P.rect(bx, GY - 96, 220, 96, '#e8dcc8'); P.rect(bx, GY - 96, 220, 3, '#ffffff'); P.poly([[bx - 14, GY - 96], [bx + 110, GY - 132], [bx + 234, GY - 96]], '#7a9a5a'); P.poly([[bx - 14, GY - 96], [bx + 110, GY - 132], [bx + 110, GY - 128], [bx - 2, GY - 96]], '#9aba72');
    for (k = 0; k < 4; k++) { P.rect(bx + 20 + k * 50, GY - 70, 30, 36, '#3a4a68'); P.rect(bx + 20 + k * 50, GY - 70, 30, 2, '#8aa8d8'); }
    P.rect(bx + 92, GY - 44, 36, 44, '#4a3a2a'); P.rect(bx + 94, GY - 42, 32, 42, '#1c1630');
    P.rect(bx + 60, GY - 122, 3, 30, '#5a5068'); P.rect(bx + 63, GY - 122, 22, 14, '#a00a1e'); P.rect(bx + 71, GY - 118, 5, 5, '#ffd36a');
    S.blocks.forEach(function (b) { rock(P, r, b[0], b[2], b[1], S); });
    S.spikes.forEach(function (k2) { thorns(P, k2[0], k2[1]); });
    S.plats.forEach(function (p) { deck(P, p[0], p[1], p[2]); });
    return cv;
  }
  R.drawDay = function (g, S, camX, t) {      // 昼の遠景（drawBackdrop から）
    var BG = R.BG, x;
    var mid = S.id === 'hirakawa' ? BG.zooMid : BG.dayMid;
    g.drawImage(S.dusk ? BG.duskSky : BG.daySky, 0, 0);
    x = -Math.round(camX * 0.02 + t * 0.05) % 960; g.drawImage(BG.dayCloud, x, 0); g.drawImage(BG.dayCloud, x + 960, 0);
    x = -Math.round(camX * 0.04) % 960; g.drawImage(BG.dayFar, x - 60, 0); g.drawImage(BG.dayFar, x + 900, 0);
    x = -Math.round(camX * 0.25) % 960; g.drawImage(mid, x, 0); g.drawImage(mid, x + 960, 0);
  };

  R.buildStages = function () {
    var BG = R.BG = window.REBELL_BG_SCHOOL.build();
    BG.viaduct = buildViaduct(); BG.lattice = buildLattice();
    BG.daySky = buildDaySky(); BG.dayCloud = buildDayClouds(); BG.dayFar = buildDayFar(); BG.dayMid = buildDayMid();
    BG.duskSky = buildDuskSky(); BG.zooMid = buildZooMid();
    BG.cloudFar = buildClouds(6101, ['#231d55', '#3a2f7a', '#6a4a9a'], 0.8); BG.cloudNear = buildClouds(6202, ['#2a2062', '#4a3a8c', '#c86aa8'], 1.25);
    R.STAGES.forEach(function (S) {
      S.layer = S.id === 'city' ? buildCity(S, BG) : S.id === 'hirakawa' ? buildZoo(S, BG) : S.day ? buildTown(S, BG) : S.vertical ? buildTower(S) : S.sky ? R.mk(4, 4) : buildSchool(S, BG);      // 空のステージの足場と乗り物は、55_render.js が毎フレーム描く
      S.solids = S.ground.map(function (g) { return { x: g[0], y: GY, w: g[1] - g[0], h: 120 }; });
      S.blockRects = (S.blocks || []).map(function (b) { return { x: b[0], y: GY - b[2], w: b[1], h: b[2] + 60 }; });      // 石の段も、ぶつかる地形に入れる
      S.solids = S.solids.concat(S.blockRects);
      S.solids = S.solids.concat((S.walls || []).map(function (w) { return { x: w[0], y: w[1], w: w[2], h: w[3] }; }));      // 宙に浮いた壁（下から頭をぶつける）
      S.platRects = S.plats.map(function (p) { return { x: p[0], y: p[1], w: p[2] }; });
    });
  };

  // 学園ステージの校舎の位置（カメラ位置から決まる）
  R.schoolX = function (camX) { return Math.round(150 - camX * 0.22); };

  // 遠景を描く
  R.drawBackdrop = function (g, S, camX, t, rage, oy) {
    var BG = R.BG, x, y, CY = R.Cyber;
    if (S.day) { R.drawDay(g, S, camX, t); return; }      // 昼のステージ（月・サーチライト・エアカーは出さない）
    g.drawImage(BG.sky, 0, 0);
    if (R.Moon) R.Moon.draw(g, S, camX, t, oy || 0);      // 紅い月: 最終ステージへ向かうほど大きく、不気味に（15_moon.js）
    if (CY) CY.sky(g, S, camX, t, oy || 0);      // サーチライト・広告飛行船（14_cyber.js）
    if (S.vertical) {      // 鉄塔: 登るほど、街の灯りが下へ沈んでいく。奥の塔の骨組みは、ゆっくり流れる
      oy = oy || 0;
      g.drawImage(BG.far, -240, Math.round(Math.min(150, oy * 0.1)));
      if (CY) CY.mid(g, S, camX, t, oy);      // 空を走るエアカー
      y = Math.round(oy * 0.4) % 384;
      g.globalAlpha = 0.9; g.drawImage(BG.lattice, 0, y - 384); g.drawImage(BG.lattice, 0, y); g.globalAlpha = 1;
      if (rage) { g.fillStyle = 'rgba(255,30,70,.1)'; g.fillRect(0, 0, R.W, R.H); }
      return;
    }
    if (S.sky) {      // 空のステージ: 上へ進むほど、下の街の灯りと雲海が沈んでいく。雲は 2 層で、手前ほど速く流れる
      oy = oy || 0;
      x = -Math.round(camX * 0.05) % 960; y = 40 + Math.round(oy * 0.22);
      g.drawImage(BG.far, x, y); g.drawImage(BG.far, x + 960, y);
      if (CY) CY.mid(g, S, camX, t, oy);      // 空を走るエアカー
      [[BG.cloudFar, 0.12, 0.3, 120, 0.06], [BG.cloudNear, 0.3, 0.55, 190, 0.18]].forEach(function (L) {
        var cx = -Math.round(camX * L[1] + t * L[4]) % 960, cy = L[3] + Math.round(oy * L[2]);
        for (var k = 0; k < 3; k++) {      // 同じ帯を、上に 330 ずつずらして重ねる（上へ進むと、次の雲の層をくぐる）
          var yy = cy - k * 330; if (yy > R.H || yy < -150) continue;
          g.drawImage(L[0], cx, yy); g.drawImage(L[0], cx + 960, yy);
        }
      });
      // 風の筋（右から左へ、速く流れる）
      g.fillStyle = 'rgba(220,210,255,.22)';
      for (var i = 0; i < 9; i++) { var wx = ((i * 173 - t * (3 + i % 3)) % 560 + 560) % 560 - 40, wy = (i * 61 + 23) % 250 + 8; g.fillRect(wx, wy, 14 + (i % 4) * 8, 1); }
      if (rage) { g.fillStyle = 'rgba(255,30,70,.1)'; g.fillRect(0, 0, R.W, R.H); }
      return;
    }
    if (S.id === 'school') g.drawImage(BG.volcano, Math.round(250 - camX * 0.03), 28);
    x = -Math.round(camX * 0.1) % 960; g.drawImage(BG.far, x, 0); g.drawImage(BG.far, x + 960, 0);
    if (S.id === 'city') {
      x = -Math.round(camX * 0.32) % 960; g.drawImage(BG.viaduct, x, 0); g.drawImage(BG.viaduct, x + 960, 0);
    } else {
      g.drawImage(BG.school, R.schoolX(camX), 19);      // 校舎は少し沈めて、屋根の上に巨大な紅い月をのぞかせる（15_moon.js）
    }
    if (CY) CY.mid(g, S, camX, t, oy || 0);      // 空を走るエアカー（水道橋・校舎の手前を横切る）
    if (rage) { g.fillStyle = 'rgba(255,30,70,' + (0.10 + 0.05 * Math.sin(t * 0.08)) + ')'; g.fillRect(0, 0, R.W, R.H); }
  };
})();

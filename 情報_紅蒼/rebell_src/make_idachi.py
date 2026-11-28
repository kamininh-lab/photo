# -*- coding: utf-8 -*-
"""ステージ 2 のボス「井立 快晴」（空手家。龍を守る者）のシートから、ゲームで使うコマと顔の絵を切り出して js/07_idachi_art.js を作る。
使い方:  python rebell_src/make_idachi.py [確認用の一覧画像を出すフォルダ]

シートは art/source/E9752ECD-….png（1536x1024）。作りは黒瀬のシートと同じ（紺色の背景に、黒い学生服の人物）なので、
切り抜きは make_midboss.py の関数をそのまま使う。ちがうのは技の光の色で、黒瀬は紫、井立は青。
そこで「光を取り除く」判定（fx_mask）だけを、青い光向けに差し替える（目の青い点は、まわりが体なら残す）。
1 コマ = [atlas の x, y, 幅, 高さ, 基準点 x, 基準点 y]。基準点は「上半身の中心・足元」。絵の 1 ドット = ゲームの 1 ドット。
"""
import base64, io, os, sys
import numpy as np
from PIL import Image
import sprite_tools as T
import make_sprites as MS
import make_midboss as MB

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_ART = os.path.join(os.path.dirname(HERE), 'art', 'source')
SHEET = 'idate-sprites.png'      # もとの名前は E9752ECD-….png
# 段の帯（見出しの文字より下）
BAND = {'A': (108, 173), 'B': (238, 306), 'C': (368, 436), 'D': (495, 574), 'E': (640, 712)}


def blue_fx(c):
    """技の青い光（水色〜青の明るい画素）"""
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    m = (b >= 120) & (b - r >= 60) & (g >= 60)
    # 体に囲まれた小さな青（目）は残す: 5x5 のまわりが、ほとんど光でない画素なら光とみなさない
    keep = np.zeros_like(m)
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        win = m[max(0, y - 2):y + 3, max(0, x - 2):x + 3]
        if win.sum() <= 4:
            keep[y, x] = True
    return m & ~keep


MB.fx_mask = blue_fx

N = {'nofx': True}
S = {'solo': True}
NS = {'nofx': True, 'solo': True}
CFG = {
    # --- 基本・移動 ---
    'idle': ('A', 'row', [(418, 456), (472, 510), (530, 569), (585, 624), (640, 680)]),
    'stance': ('A', 'row', [(712, 772), (774, 832), (834, 892), (894, 955)]),
    'walk': ('A', 'row', [(995, 1042), (1044, 1090), (1090, 1135)]),
    'run': ('A', 'row', [(1145, 1196, N), (1196, 1240, N), (1240, 1286, N), (1286, 1330, N)]),
    'dash': ('A', 'row', [(1340, 1408, NS), (1408, 1458, NS), (1458, 1512, NS)]),
    # --- ジャンプ・空中 ---
    'jump': ('B', 'own', [(418, 470), (470, 532), (532, 592), (592, 648), (648, 708)]),
    'airatk': ('B', 'own', [(745, 800), (800, 856), (856, 914), (914, 999)]),
    'airspin': ('B', 'own', [(1028, 1106, N), (1106, 1168, N), (1168, 1276, N)]),
    'land': ('B', 'row', [(1300, 1376, S), (1376, 1446, S), (1446, 1520, S)]),
    # --- 通常攻撃 ---
    'combo1': ('C', 'row', [(416, 476, N), (476, 536, N), (536, 596, N), (596, 662, N)]),       # 3 連打（突き）
    'combo2': ('C', 'row', [(686, 739, N), (739, 791, N), (791, 839, N), (839, 945, NS)]),     # 打ち上げ
    'combo3': ('C', 'row', [(960, 1021, N), (1021, 1083, N), (1083, 1141, N), (1141, 1189, N), (1189, 1242, N)]),      # 連続蹴り
    'finish': ('C', 'row', [(1252, 1326, N), (1326, 1402, NS), (1402, 1528, NS)]),            # 飛び蹴り
    # --- 必殺技 ---
    'senpu': ('D', 'row', [(412, 478, N), (482, 642, N)]),                                     # 旋風脚
    'rush': ('D', 'row', [(662, 728, N)]),                                                      # 連撃突（突き進む姿と残像は、ゲームの中で描く）
    'hien': ('D', 'row', [(945, 1022, N)]),                                                     # 真・飛燕蹴: 構え
    'hienair': ('D', 'own', [(1022, 1102, NS), (1102, 1232, NS)]),                              #             飛び二段蹴り
    'souten': ('D', 'row', [(1362, 1424, NS)]),                                                 # 蒼天破（体だけ。衝撃波はゲームの中で描く）
    # --- 被弾 ---
    'hurt': ('E', 'row', [(415, 488, N)]),
    'hurtbig': ('E', 'row', [(495, 575, N)]),
    'blown': ('E', 'own', [(585, 633, N), (633, 672, N)]),
    'down': ('E', 'row', [(680, 742, N), (742, 790, N)]),
    'getup': ('E', 'row', [(792, 876, N)]),
    'stagger': ('E', 'row', [(880, 950, N)]),
    # --- その他 ---
    'guard': ('E', 'row', [(968, 1082, N)]),
    'step': ('E', 'row', [(1086, 1146, NS), (1146, 1196, N)]),
    'kiai': ('E', 'row', [(1236, 1292, NS)]),
    'camera': ('E', 'row', [(1310, 1420, S)]),
    'victory': ('E', 'row', [(1425, 1520, N)]),
}

# 顔: 表情アイコン 10 個（枠の中の顔の部分 58x64）と、会話のカットインに使う大きな絵（450x306 の枠に合わせた横長）
ICON_NAMES = ['normal', 'smile', 'serious', 'surprise', 'anger', 'sad', 'silly', 'shy', 'confused', 'resolve']
ICON_XY = [(21, 774), (91, 774), (163, 774), (235, 774), (307, 774), (21, 887), (91, 887), (163, 887), (235, 887), (307, 887)]
ICON_BOX = (2, 4, 58, 64)      # 枠の左上からのずれ・幅・高さ
ICON_SIZE = (96, 106)
PICS = {'smile': (20, 70, 320, 274), 'close': (690, 765, 960, 949), 'shout': (930, 770, 1180, 940), 'kick': (1210, 770, 1520, 981)}
PIC_SIZE = (450, 306)


def extract():
    a = T.load(os.path.join(SOURCE_ART, SHEET))
    frames = {}
    for name, cfg in CFG.items():
        band, base, items = cfg
        got = []
        for it in items:
            xa, xb = it[0], it[1]; o = it[2] if len(it) > 2 else {}
            y0, y1 = o.get('y0', BAND[band][0]), o.get('y1', BAND[band][1])
            rgba, (ox, oy) = MB.cutout(a, xa, xb, y0, y1, o)
            if rgba is None:
                raise SystemExit('空のコマ: %s %s' % (name, (xa, xb)))
            rgba, (dx, dy) = T.trim(rgba)
            top = oy + dy
            got.append({'img': rgba, 'top': top, 'bottom': top + rgba.shape[0], 'bx': MB.torso_x(rgba), 'o': o})
        ground = int(round(np.median([f['bottom'] for f in got])))
        for f in got:
            f['oy'] = int(round((ground if base == 'row' else f['bottom']) - f['top'])) + f['o'].get('dy', 0)
            f['ox'] = int(round(f['bx'])) + f['o'].get('dx', 0)
        frames[name] = got
    return frames


def faces(dev):
    src = Image.open(os.path.join(SOURCE_ART, SHEET)).convert('RGB')
    dx, dy, w, h = ICON_BOX
    W, H = ICON_SIZE
    strip = Image.new('RGB', (W * len(ICON_NAMES), H))
    for i, (x, y) in enumerate(ICON_XY):
        strip.paste(src.crop((x + dx, y + dy, x + dx + w, y + dy + h)).resize((W, H), Image.LANCZOS), (i * W, 0))
    pics = {k: src.crop(b).resize(PIC_SIZE, Image.LANCZOS) for k, b in PICS.items()}
    if dev:
        pics = {k: v.resize((v.width // 2, v.height // 2), Image.LANCZOS) for k, v in pics.items()}
    q = (45, 40) if dev else (92, 88)
    iu = MB.data_uri(strip, 'WEBP', quality=q[0], method=6)[0]
    pd = {k: MB.data_uri(v, 'WEBP', quality=q[1], method=6)[0] for k, v in pics.items()}
    return iu, pd, strip, pics


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    frames = extract()
    n = sum(len(v) for v in frames.values())
    atlas = MS.pack(frames, 512)
    table = ', '.join('%s: [%s]' % (k, ', '.join('[%d,%d,%d,%d,%d,%d]' % (f['x'], f['y'], f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs)) for k, fs in frames.items())
    for path, colors, rare, dev in ((os.path.join(HERE, 'js', '07_idachi_art.js'), 96, True, False), (os.path.join(HERE, 'idachi_dev.js'), 28, False, True)):
        uri, size, kind = MS.encode(atlas, colors, rare)
        iu, pd, strip, pics = faces(dev)
        W, H = ICON_SIZE
        pl = ',\n    '.join('%s: "%s"' % (k, v) for k, v in pd.items())
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write('// make_idachi.py が生成したファイル（手で編集しない）。ステージ 2 のボス「井立 快晴」のシートから切り出したコマと顔の絵\n'
                    '// 1 コマ = [x, y, 幅, 高さ, 基準点 x, 基準点 y]。絵の 1 ドットはゲームの 1 ドット\n'
                    'window.REBELL_IDACHI = {\n  img: "%s",\n  frames: { %s },\n  icons: "%s",\n  iconSize: [%d, %d],\n  iconNames: %s,\n  pics: {\n    %s\n  }\n};\n'
                    % (uri, table, iu, W, H, repr(ICON_NAMES).replace("'", '"'), pl))
        print('frames', n, 'atlas', atlas.size, colors, 'colors', kind, size // 1024, 'KB ->', path, os.path.getsize(path) // 1024, 'KB')
        if dbg and not dev:
            strip.save(os.path.join(dbg, 'icons_idachi.png'))
            for k, v in pics.items():
                v.save(os.path.join(dbg, 'pic_idachi_%s.png' % k))
    if dbg:
        MB.contact(frames, os.path.join(dbg, 'contact_idachi.png'))
        atlas.save(os.path.join(dbg, 'atlas_idachi.png'))


if __name__ == '__main__':
    main()

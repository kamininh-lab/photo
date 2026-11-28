# -*- coding: utf-8 -*-
"""助っ人「大森 茉子」（回復役。主人公たちのお姉さん）のシートから、ゲームで使うコマと会話の絵を切り出して js/09_mako_art.js を作る。
使い方:  python rebell_src/make_mako.py [確認用の一覧画像を出すフォルダ]

シート 2 枚（art/source）:
  A3D98E67-….png（1536x1024）… スプライトシート。作りは黒瀬・井立のシートと同じ（紺色の背景に、黒い制服の人物）なので、
                                 切り抜きは make_midboss.py の関数を使う。技の光は緑なので、光を取り除く判定だけ差し替える
  82469B3C-….png（1671x941） … 顔カットイン集（クール版）。会話の帯の「顔」の枠 450x306（横 3 : 縦 2）に合わせて切り出す
1 コマ = [atlas の x, y, 幅, 高さ, 基準点 x, 基準点 y]。基準点は「上半身の中心・足元」。絵の 1 ドット = ゲームの 1 ドット。
"""
import os, sys
import numpy as np
from PIL import Image
import sprite_tools as T
import make_sprites as MS
import make_midboss as MB

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_ART = os.path.join(os.path.dirname(HERE), 'art', 'source')
SHEET = 'omori-sprites.png'      # もとの名前は A3D98E67-….png
FACES = 'omori-cutin-cool.png'      # もとの名前は 82469B3C-….png
BAND = {'A': (112, 174), 'B': (238, 302), 'C': (368, 428), 'D': (500, 572), 'E': (648, 712)}


def green_fx(c):
    """回復の緑の光・杖の先の水色の光"""
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return ((g >= 110) & (g - r >= 50)) | ((b >= 150) & (g >= 150) & (r <= 150)) | ((g >= 50) & (g - r >= 28) & (b - r >= 10))      # 最後は、暗い青緑のにじみ


MB.fx_mask = green_fx

N = {'nofx': True}
NS = {'nofx': True, 'solo': True}
CFG = {
    'idle': ('A', 'row', [(420, 456, N), (474, 511, N), (528, 566, N)]),
    'stance': ('A', 'row', [(808, 856, N), (858, 905, N), (905, 952, N)]),      # 構え（支援姿勢）
    'walk': ('A', 'row', [(995, 1033, N), (1035, 1072, N), (1074, 1112, N), (1112, 1150, N)]),
    'run': ('A', 'row', [(1163, 1206, N), (1206, 1250, N), (1250, 1291, N), (1291, 1332, N)]),
    'jump': ('B', 'own', [(424, 470, N), (482, 534, N), (545, 596, N), (600, 650, N), (655, 702, N)]),
    'shot': ('C', 'row', [(690, 736, NS), (746, 792, NS), (803, 850, NS)]),     # 光弾（弾は、ゲームの中で描く）
    'cast': ('C', 'row', [(1008, 1052, NS), (1070, 1114, NS)]),  # チャージキャスト（光の輪は、ゲームの中で描く）
    'heal': ('D', 'row', [(420, 466, NS), (488, 540, NS)]),     # リカバー（光は、ゲームの中で描く）
    'cheer': ('E', 'row', [(1236, 1297, NS)]),                                  # 応援
    'victory': ('E', 'row', [(1432, 1502, NS)]),
}

PICS = {'normal': (149, 92, 512, 334), 'command': (669, 92, 1032, 334), 'heal': (1219, 92, 1582, 334),
        'sad': (119, 378, 332, 520), 'silly': (534, 378, 747, 520), 'shy': (944, 378, 1157, 520), 'joy': (1359, 378, 1572, 520),
        'anger': (117, 566, 333, 710), 'surprise': (532, 566, 748, 710), 'puzzled': (942, 566, 1158, 710), 'relief': (1357, 566, 1573, 710)}
PIC_SIZE = (450, 306)


def extract():
    a = T.load(os.path.join(SOURCE_ART, SHEET))
    frames = {}
    for name, (band, base, items) in CFG.items():
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
            f['oy'] = int(round((ground if base == 'row' else f['bottom']) - f['top']))
            f['ox'] = int(round(f['bx']))
        frames[name] = got
    return frames


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    frames = extract()
    atlas = MS.pack(frames, 512)
    table = ', '.join('%s: [%s]' % (k, ', '.join('[%d,%d,%d,%d,%d,%d]' % (f['x'], f['y'], f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs)) for k, fs in frames.items())
    uri, size, kind = MS.encode(atlas, 96, True)
    src = Image.open(os.path.join(SOURCE_ART, FACES)).convert('RGB')
    pics = {k: src.crop(b).resize(PIC_SIZE, Image.LANCZOS) for k, b in PICS.items()}
    pl = ',\n    '.join('%s: "%s"' % (k, MB.data_uri(v, 'WEBP', quality=86, method=6)[0]) for k, v in pics.items())
    path = os.path.join(HERE, 'js', '09_mako_art.js')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// make_mako.py が生成したファイル（手で編集しない）。助っ人「大森 茉子」のコマと、会話のカットインの絵\n'
                '// 1 コマ = [x, y, 幅, 高さ, 基準点 x, 基準点 y]。絵の 1 ドットはゲームの 1 ドット\n'
                'window.REBELL_MAKO = {\n  img: "%s",\n  frames: { %s },\n  pics: {\n    %s\n  }\n};\n' % (uri, table, pl))
    print('frames', sum(len(v) for v in frames.values()), 'atlas', atlas.size, kind, size // 1024, 'KB ->', path, os.path.getsize(path) // 1024, 'KB')
    if dbg:
        MB.contact(frames, os.path.join(dbg, 'contact_mako.png'))
        atlas.save(os.path.join(dbg, 'atlas_mako.png'))


if __name__ == '__main__':
    main()

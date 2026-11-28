# -*- coding: utf-8 -*-
"""新キャラ「大倉 咲」（サポート／アニマル・マリン）のシートから、会話に使う絵と立ち姿を切り出して js/09_saki_art.js を作る。
使い方:  python rebell_src/make_saki.py [確認用の一覧画像を出すフォルダ]

シート（art/source/DC700547-….png、1448x1086）。作りは大森のシートと同じ（紺色の背景に、黒い制服の人物）なので、切り抜きは make_midboss.py の関数を使う。
  立ち姿 … 「待機（ループ）」の 3 コマだけ（第2章 第2話のゴールの会話で立たせる。戦いには、まだ加わらない）
  会話の絵（450x306）… normal = 左上の大きな絵、joy・relief = 下のカットイン、ほかは「表情アイコン」を引きのばしたもの（小さいので、少しぼやける）
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
import sprite_tools as T
import make_sprites as MS
import make_midboss as MB

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_ART = os.path.join(os.path.dirname(HERE), 'art', 'source')
SHEET = 'DC700547-A3DB-4A83-92A2-75027113A8C3.png'
N = {'nofx': True}
IDLE = [(334, 361), (379, 405), (421, 448)]
IDLE_Y = (78, 126)
PIC_SIZE = (450, 306)
TOL = 46      # 背景とみなす色の近さ（RGB の差の合計）
PICS = {'normal': (24, 96, 189, 208), 'joy': (110, 925, 345, 1082), 'relief': (545, 922, 780, 1079)}
# 表情アイコン（74x94 くらい）: 目と口のあたりを横 3 : 縦 2 に切る
ICONS = {'smile': 95, 'serious': 172, 'surprise': 248, 'trouble': 320, 'shy': 465, 'resolve': 539}
ICON_Y, ICON_W, ICON_H = 754, 73, 94      # アイコンの全体。枠の高さに合わせて約 3.3 倍にし、左右は暗い青でうめる


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    rgb = np.asarray(Image.open(os.path.join(SOURCE_ART, SHEET)).convert('RGB')).astype(int)
    got = []
    for xa, xb in IDLE:
        c = rgb[IDLE_Y[0]:IDLE_Y[1], xa:xb]; h, w = c.shape[:2]
        bg = np.median(np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]]), axis=0)
        near = np.abs(c - bg).sum(axis=2) < TOL
        out = np.zeros((h, w), bool); st = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
        while st:
            y, x = st.pop()
            if 0 <= y < h and 0 <= x < w and near[y, x] and not out[y, x]:
                out[y, x] = True; st += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
        rgba = np.dstack([c, np.where(out, 0, 255)]).astype(np.uint8)
        rgba, (dx, dy) = T.trim(rgba)
        got.append({'img': rgba, 'top': dy, 'bottom': dy + rgba.shape[0], 'bx': rgba.shape[1] / 2.0, 'o': N})
    ground = int(round(np.median([f['bottom'] for f in got])))
    for f in got:
        f['oy'] = int(round(ground - f['top'])); f['ox'] = int(round(f['bx']))
    frames = {'idle': got}
    atlas = MS.pack(frames, 128)
    table = ', '.join('%s: [%s]' % (k, ', '.join('[%d,%d,%d,%d,%d,%d]' % (f['x'], f['y'], f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs)) for k, fs in frames.items())
    uri, size, kind = MS.encode(atlas, 96, True)
    src = Image.open(os.path.join(SOURCE_ART, SHEET)).convert('RGB')
    pics = {k: src.crop(b).resize(PIC_SIZE, Image.LANCZOS) for k, b in PICS.items()}
    for k, x in ICONS.items():
        ic = src.crop((x, ICON_Y, x + ICON_W, ICON_Y + ICON_H)); w = int(round(ICON_W * PIC_SIZE[1] / float(ICON_H)))
        bgp = ic.resize(PIC_SIZE, Image.BICUBIC).filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.45))      # うしろは、同じ絵を大きくぼかして暗くしたもの
        bgp.paste(ic.resize((w, PIC_SIZE[1]), Image.LANCZOS), ((PIC_SIZE[0] - w) // 2, 0)); pics[k] = bgp
    pl = ',\n    '.join('%s: "%s"' % (k, MB.data_uri(v, 'WEBP', quality=84, method=6)[0]) for k, v in pics.items())
    path = os.path.join(HERE, 'js', '09_saki_art.js')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// make_saki.py が生成したファイル（手で編集しない）。「大倉 咲」の立ち姿と、会話のカットインの絵\n'
                '// 1 コマ = [x, y, 幅, 高さ, 基準点 x, 基準点 y]\n'
                'window.REBELL_SAKI = {\n  img: "%s",\n  frames: { %s },\n  pics: {\n    %s\n  }\n};\n' % (uri, table, pl))
    print('frames', len(got), [f['img'].shape for f in got], 'atlas', atlas.size, kind, '->', path, os.path.getsize(path) // 1024, 'KB')
    if dbg:
        MB.contact(frames, os.path.join(dbg, 'contact_saki.png'))
        names = list(pics)
        sh = Image.new('RGB', (450 * 3, 306 * 3))
        for i, k in enumerate(names):
            sh.paste(pics[k], ((i % 3) * 450, (i // 3) * 306))
        sh.save(os.path.join(dbg, 'saki_pics.png'))


if __name__ == '__main__':
    main()

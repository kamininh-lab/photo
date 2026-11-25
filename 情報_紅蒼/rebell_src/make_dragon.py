# -*- coding: utf-8 -*-
"""art/source/DRAGON.png（ラスボス・龍（最終形態）の大型スプライトシート）からコマを切り出して、js/08_dragon_art.js を作る。
使い方:  python rebell_src/make_dragon.py [確認用の画像を出すフォルダ]

シートは 8 段（待機・前進・咆哮・爪撃・ブレス・被弾・翼展開・崩壊）、全部で 35 コマ。龍は左向き。
1 コマ = [atlas の x, y, 幅, 高さ, 基準点 x, 基準点 y]。基準点は「胴の中心・足元」。絵の 1 ドット ≒ ゲームの 1 ドット
（段によって描かれた大きさが少し違うので、段ごとの倍率でそろえる）。
背景は、枠の紺色とつながっている部分だけを抜く（龍の体も青いので、色だけでは分けられない）。
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
import sprite_tools as T
import make_sprites as MS

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'art', 'source', 'DRAGON.png')
# 組の名前: (帯の y 範囲, 倍率, [コマの x 範囲…])。x の範囲は、前景の列のとぎれ目から読み取ったもの
CFG = [
    ('idle', (54, 167), 0.87, [(244, 527), (602, 891), (959, 1263), (1324, 1628)]),
    ('walk', (178, 274), 1.0, [(248, 526), (601, 882), (952, 1241), (1322, 1626)]),
    ('roar', (283, 378), 1.0, [(246, 485), (537, 770), (823, 1065), (1101, 1350), (1402, 1647)]),
    ('claw', (386, 486), 0.97, [(260, 528), (603, 870), (944, 1258), (1311, 1604)]),
    ('breath', (494, 591), 1.0, [(225, 428), (465, 679), (718, 1036), (1045, 1391), (1403, 1651)]),
    ('hurt', (600, 694), 1.0, [(271, 530), (618, 872), (946, 1243), (1337, 1621)]),
    ('wing', (702, 808), 0.92, [(258, 518), (577, 846), (899, 1231), (1270, 1643)]),
    ('fall', (818, 922), 0.95, [(231, 490), (501, 773), (788, 1069), (1078, 1366), (1366, 1655)]),
]


def bgish(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return (r <= 40) & (g <= 52) & (b >= 20) & (b <= 112) & (b - r >= 14) & (r + g + b <= 190)


def cut(a, x0, x1, y0, y1):
    c = a[y0:y1, x0:x1]; h, w = c.shape[:2]
    pad = np.ones((h + 2, w + 2), bool); pad[1:-1, 1:-1] = bgish(c)
    lab, sizes = T.components(pad)
    fg = ~(lab[1:-1, 1:-1] == lab[0, 0])
    # 翼と体に囲まれて、枠とつながっていない背景（大きなかたまりだけ）も抜く
    hole = pad[1:-1, 1:-1] & fg
    lab, sizes = T.components(hole)
    for area, n in sizes:
        if area >= 150:
            fg[lab == n] = False
    lab, sizes = T.components(fg)
    main_id = max(sizes)[1]
    near = lab == main_id
    for _ in range(6):
        near = T.dilate(near)
    for area, n in sizes:      # 体から離れた小さなかけら（コマの間の矢印、格子の点）を捨てる。炎や火花は残す
        sel = lab == n
        if n == main_id:
            continue
        mean = c[sel].mean(0)
        arrow = 100 <= area <= 170 and mean[2] > 185 and 130 < mean[0] < 185 and mean[1] < 80      # コマの間の「▶」
        if area < 14 or arrow or mean.sum() < 70 or (area < 120 and not (near & sel).any()):
            fg[sel] = False
    # 足元の黒い影は消す（空を飛ぶので、影が体について回ると変）
    dark = c.sum(-1) < 80
    dark[:h - 11] = False
    fg &= ~dark
    lab, sizes = T.components(fg)
    for area, n in sizes:
        if area < 6:
            fg[lab == n] = False
    out = np.zeros((h, w, 4), np.uint8); out[..., :3] = np.clip(c, 0, 255); out[..., 3] = fg * 255
    return out


def scale(rgba, k):
    if abs(k - 1) < 1e-6:
        return rgba
    h, w = rgba.shape[:2]; nw, nh = int(round(w * k)), int(round(h * k))
    f = rgba.astype(np.float32); al = f[..., 3:4] / 255.0
    pre = np.concatenate([f[..., :3] * al, al * 255.0], axis=-1)
    ch = [np.asarray(Image.fromarray(pre[..., i], 'F').resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    a2 = np.clip(ch[3], 0, 255) / 255.0; ok = a2 >= 0.5
    out = np.zeros((nh, nw, 4), np.uint8)
    for i in range(3):
        out[..., i] = np.clip(np.round(np.where(ok, ch[i] / np.maximum(a2, 1e-3), 0)), 0, 255)
    out[..., 3] = ok * 255
    return out


def body_x(rgba):
    """胴の中心の x（青い装甲の画素の中央）"""
    r, g, b = rgba[..., 0].astype(int), rgba[..., 1].astype(int), rgba[..., 2].astype(int)
    m = (rgba[..., 3] > 0) & (b > 110) & (r < 95) & (b - r > 55) & (g < 110)
    xs = np.nonzero(m)[1]
    if len(xs) < 40:
        xs = np.nonzero(rgba[..., 3] > 0)[1]
    return int(round(float(np.median(xs))))


def extract():
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
    frames = {}
    for name, (y0, y1), k, spans in CFG:
        got = []
        for (x0, x1) in spans:
            rgba = scale(cut(a, x0 - 3, x1 + 3, y0, y1 + 2), k)
            h0 = rgba.shape[0]
            rgba, (dx, dy) = T.trim(rgba)
            got.append({'img': rgba, 'ox': body_x(rgba), 'oy': h0 - 2 - dy})      # 足元 = 帯の下端
        frames[name] = got
    return frames


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    frames = extract()
    atlas = MS.pack(frames, 1024)
    table = ', '.join('%s: [%s]' % (n, ', '.join('[%d,%d,%d,%d,%d,%d]' % (f['x'], f['y'], f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs)) for n, fs in frames.items())
    uri, size, kind = MS.encode(atlas, 160, True)
    js = ('// make_dragon.py が生成したファイル（手で編集しない）。ラスボス・龍のシートから切り出したコマ（左向き）\n'
          '// 1 コマ = [x, y, 幅, 高さ, 基準点 x, 基準点 y]。基準点は「胴の中心・足元」\n'
          'window.REBELL_DRAGON = {\n  img: "%s",\n  frames: { %s }\n};\n' % (uri, table))
    path = os.path.join(HERE, 'js', '08_dragon_art.js')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(js)
    print('frames', sum(len(v) for v in frames.values()), 'atlas', atlas.size, kind, size // 1024, 'KB ->', path)
    for n, fs in frames.items():
        print(' ', n, ['%dx%d ox%d oy%d' % (f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs])
    if dbg:
        Z = 1; W = 1500; rows = []
        for n, fs in frames.items():
            up = max(f['oy'] for f in fs) + 4
            im = Image.new('RGB', (W, up + 14), (62, 52, 122)); d = ImageDraw.Draw(im); x = 4
            for f in fs:
                t = Image.fromarray(f['img'], 'RGBA'); im.paste(t, (x, up - f['oy']), t)
                d.line([(x + f['ox'], up - 6), (x + f['ox'], up + 6)], fill=(0, 255, 0)); x += f['img'].shape[1] + 8
            d.line([(0, up), (W, up)], fill=(0, 160, 0)); d.text((2, 0), n, fill=(255, 255, 0)); rows.append(im)
        sheet = Image.new('RGB', (W, sum(r.size[1] for r in rows)), (0, 0, 0)); y = 0
        for r in rows:
            sheet.paste(r, (0, y)); y += r.size[1]
        sheet.save(os.path.join(dbg, 'dragon_frames.png'))


if __name__ == '__main__':
    main()

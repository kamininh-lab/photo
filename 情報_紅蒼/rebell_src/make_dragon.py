# -*- coding: utf-8 -*-
"""art/source/DRAGON.png（ラスボス・龍のスプライトシート）の「全身リファレンス（立ち絵・基本形）」を切り出して、
js/08_dragon_art.js を作る。
使い方:  python rebell_src/make_dragon.py [確認用の画像を出すフォルダ]

シートの小さなアニメーションのコマ（1 コマ 45x30 ドットほど）は、画面いっぱいのボスには粗すぎるので、
大きな立ち絵 1 枚を使い、動き（身を乗り出す・のけぞる・翼のゆれ）はゲームの中で付ける（js/35_dragon.js）。
背景は、枠の紺色とつながっている部分だけを抜く（龍の体も青いので、色だけでは分けられない）。
"""
import base64, io, os, sys
import numpy as np
from PIL import Image
import sprite_tools as T
import make_sprites as MS

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'art', 'source', 'DRAGON.png')
BOX = (698, 73, 1154, 243)          # 立ち絵の範囲
CUT = (1084, 73, 1154, 160)         # 右上の「サイズ目安」の札（立ち絵に重なるので除く）
SCALE = 0.75                        # シートの 1 ドット → ゲームの 0.75 ドット
# シート上の位置（あとで切り出しの左上と倍率に合わせて直す）: 足元の基準点・胸のコア・口・頭
FEET, CORE, MOUTH, HEAD = (858, 240), (814, 188), (742, 166), (764, 148)


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
    x0, y0, x1, y1 = BOX
    c = a[y0:y1, x0:x1]
    h, w = c.shape[:2]
    # 背景らしい色: 暗い紺（枠の地と、うすい格子の線）
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    bgish = (r <= 40) & (g <= 52) & (b >= 34) & (b <= 112) & (b - r >= 26) & (r + g + b <= 190)
    bgish[(CUT[1] - y0):(CUT[3] - y0), (CUT[0] - x0):(CUT[2] - x0)] = True
    pad = np.ones((h + 2, w + 2), bool); pad[1:-1, 1:-1] = bgish
    lab, sizes = T.components(pad)
    bg = lab[1:-1, 1:-1] == lab[0, 0]
    fg = ~bg
    fg &= ~((g - r > 40) & (b > 110) & (np.arange(h)[:, None] < 4))      # 上端にかかる、枠の水色の線
    lab, sizes = T.components(fg)
    main_id = max(sizes)[1]
    near = lab == main_id
    for _ in range(3):
        near = T.dilate(near)
    for area, n in sizes:      # 体から離れた小さなかけら（格子の交点など）を捨てる
        sel = lab == n
        if n != main_id and (area < 40 or not (near & sel).any()):
            fg[sel] = False
    rgba = np.zeros((h, w, 4), np.uint8); rgba[..., :3] = np.clip(c, 0, 255); rgba[..., 3] = fg * 255
    rgba, (dx, dy) = T.trim(rgba)
    im = Image.fromarray(rgba, 'RGBA')
    nw, nh = int(round(im.width * SCALE)), int(round(im.height * SCALE))
    f = np.asarray(im).astype(np.float32); al = f[..., 3:4] / 255.0
    pre = np.concatenate([f[..., :3] * al, al * 255.0], axis=-1)
    ch = [np.asarray(Image.fromarray(pre[..., i], 'F').resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    a2 = np.clip(ch[3], 0, 255) / 255.0; ok = a2 >= 0.5
    out = np.zeros((nh, nw, 4), np.uint8)
    for i in range(3):
        out[..., i] = np.clip(np.round(np.where(ok, ch[i] / np.maximum(a2, 1e-3), 0)), 0, 255)
    out[..., 3] = ok * 255
    small = Image.fromarray(out, 'RGBA')
    uri, size, kind = MS.encode(small, 128, True)

    def pt(p):
        return [int(round((p[0] - x0 - dx) * SCALE)), int(round((p[1] - y0 - dy) * SCALE))]
    feet, core, mouth, head = pt(FEET), pt(CORE), pt(MOUTH), pt(HEAD)
    js = ('// make_dragon.py が生成したファイル（手で編集しない）。ラスボス「紅蒼の終焉龍」の立ち絵（シートの全身リファレンスから）\n'
          '// feet = 足元の基準点、core = 胸のコア（弱点）、mouth = 口、head = 頭。どれも絵の左上からのドット数。絵は左向き\n'
          'window.REBELL_DRAGON = {\n  img: "%s",\n  w: %d, h: %d, feet: %s, core: %s, mouth: %s, head: %s\n};\n'
          % (uri, nw, nh, feet, core, mouth, head))
    path = os.path.join(HERE, 'js', '08_dragon_art.js')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(js)
    print('dragon', (nw, nh), kind, size // 1024, 'KB', 'feet', feet, 'core', core, 'mouth', mouth, 'head', head, '->', path)
    if dbg:
        big = Image.new('RGBA', (nw, nh), (62, 52, 122, 255)); big.alpha_composite(Image.open(io.BytesIO(base64.b64decode(uri.split(',')[1]))).convert('RGBA'))
        px = big.load()
        for p, col in ((feet, (0, 255, 0, 255)), (core, (255, 255, 0, 255)), (mouth, (255, 255, 255, 255)), (head, (0, 255, 255, 255))):
            for k in range(-3, 4):
                for q in ((p[0] + k, p[1]), (p[0], p[1] + k)):
                    if 0 <= q[0] < nw and 0 <= q[1] < nh:
                        px[q[0], q[1]] = col
        big.resize((nw * 4, nh * 4), Image.NEAREST).convert('RGB').save(os.path.join(dbg, 'dragon_cut.png'))


if __name__ == '__main__':
    main()

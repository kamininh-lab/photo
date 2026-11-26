# -*- coding: utf-8 -*-
"""art/source の「四角 明宏」のシートから、「装備・ガジェット」のドローンの絵を切り出して、js/09_drone_art.js を作る。
使い方:  python rebell_src/make_drone.py [確認用の画像を出すフォルダ]

背景（紺色の地と細い格子）は、枠の外側から色の近い所を塗りつぶして透明にする。
プロペラはゲームの中で回して見せるので、絵はそのまま 1 枚だけ使う。
"""
import os, sys, io, base64
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'art', 'source', '9806F106-69D2-4777-A6FD-6E40D70D3EC1.png')
BOX = (774, 778, 848, 840)      # ドローンのまわりを少し広めに
TOL = 46                        # 背景とみなす色の近さ


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    im = Image.open(SRC).convert('RGBA').crop(BOX)
    w, h = im.size
    px = im.load()
    # 背景の色 = 四隅の平均
    cs = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sum(c[i] for c in cs) // 4 for i in range(3))

    def near(c):
        return sum(abs(c[i] - bg[i]) for i in range(3)) < TOL and max(c[:3]) < 90

    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        seen[x][y] = True
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    im = im.crop(im.getbbox())
    print('drone', im.size, 'bg', bg)
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    if dbg:
        im.save(os.path.join(dbg, 'drone.png'))
        big = Image.new('RGBA', (im.width * 6, im.height * 6), (255, 0, 255, 255))
        big.alpha_composite(im.resize((im.width * 6, im.height * 6), Image.NEAREST))
        big.save(os.path.join(dbg, 'drone_big.png'))
    path = os.path.join(HERE, 'js', '09_drone_art.js')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('// make_drone.py が生成したファイル（手で編集しない）。四角のドローン（2P のお助け）の絵\n'
                 'window.REBELL_DRONE = "data:image/png;base64,%s";\n' % base64.b64encode(buf.getvalue()).decode('ascii'))
    print('->', path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()

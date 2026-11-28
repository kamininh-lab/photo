# -*- coding: utf-8 -*-
"""art/source の「四角 明宏」のシートから、会話のカットインに使う絵を切り出して、js/09_shikaku_art.js を作る。
使い方:  python rebell_src/make_shikaku.py [確認用の画像を出すフォルダ]

切り出すのは 3 枚（どれも横 3 : 縦 2 くらい。会話の帯の「顔」の枠 450x306 に合わせる）:
  smile   … シート左上の大きな絵（ほおづえをついた笑顔）
  serious … 「カットイン（演出用イラスト例）」の 1 枚目（眼鏡ごしの真剣な目）
  shout   … 同 2 枚目（手を突き出して叫ぶ）
"""
import os, sys, io, base64
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'art', 'source', 'shikaku-sprites.png')      # もとの名前は 9806F106-….png
CUTS = [('smile', (0, 56, 272, 241)), ('serious', (862, 762, 1070, 903)), ('shout', (1136, 762, 1296, 871))]
# 裏切りのカットイン（shikaku-betrayal-cutin.png、1672x941）: 龍を倒したあとの会話（dragon_end）などで使う
#   smirk 不敵な微笑 / calc 冷徹な計算 / sneer ほくそ笑み / order 冷静な指示 / rage 怒り / waver 葛藤・迷い
SRC2 = os.path.join(os.path.dirname(HERE), 'art', 'source', 'shikaku-betrayal-cutin.png')
CUTS2 = [('smirk', (60, 185, 460, 457)), ('calc', (640, 180, 1040, 452)), ('sneer', (1190, 180, 1590, 452)),
         ('order', (110, 590, 510, 862)), ('rage', (620, 590, 1020, 862)), ('waver', (1180, 600, 1580, 872))]
OUT_W, OUT_H = 450, 306


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    im1, im2 = Image.open(SRC).convert('RGB'), Image.open(SRC2).convert('RGB')
    parts = []
    for name, box, im in [(n, b, im1) for n, b in CUTS] + [(n, b, im2) for n, b in CUTS2]:
        c = im.crop(box).resize((OUT_W, OUT_H), Image.LANCZOS)
        buf = io.BytesIO(); c.save(buf, 'WEBP', quality=88, method=6)
        parts.append('  %s: "data:image/webp;base64,%s"' % (name, base64.b64encode(buf.getvalue()).decode('ascii')))
        print(name, box, len(buf.getvalue()) // 1024, 'KB')
        if dbg:
            c.save(os.path.join(dbg, 'shikaku_%s.png' % name))
    path = os.path.join(HERE, 'js', '09_shikaku_art.js')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('// make_shikaku.py が生成したファイル（手で編集しない）。四角 明宏の、会話のカットインに使う絵\n'
                 'window.REBELL_SHIKAKU = {\n' + ',\n'.join(parts) + '\n};\n')
    print('->', path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()

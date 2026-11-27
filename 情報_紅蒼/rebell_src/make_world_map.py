# -*- coding: utf-8 -*-
"""ステージを選ぶ全体マップ（62_map.js）の下絵を描いて、js/09_map_art.js を作る。
使い方:  python rebell_src/make_world_map.py [確認用の PNG の出力先]

街を上空から斜めに見下ろした絵（960x540 のドット絵。ゲームでは 2 倍に拡大して出す）。
左下 = 第一章の水道橋、中央 = 第二章の鉄塔、雲の上 = 第三章の航路、右上 = 第四章の学園（紅い結界のドームと《龍》）。
道のり・マス・ピン・文字は、ここでは描かない（ゲームの中で、進み具合に合わせて描く）。
道のりの座標は 62_map.js の PATH と合わせてある（水道橋の上 → 鉄塔の足もと → てっぺん → 雲の上 → 学園）。
"""
import base64, io, math, os, random, re, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 960, 540
rnd = random.Random(7)
PINK, CYAN = (255, 79, 176), (55, 230, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def glow(img, layer, radius, k=1):
    """layer を radius でぼかして、明るさを足す"""
    b = layer.filter(ImageFilter.GaussianBlur(radius))
    for _ in range(k):
        img.alpha_composite(b)
    img.alpha_composite(layer)


# ---------- 地形（960x540 のドット絵） ----------
base = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(base)
HZ = 96      # 地平線
for y in range(H):      # 空 → 地面
    if y < HZ:
        c = lerp((10, 5, 30), (60, 18, 60), y / HZ)
    else:
        c = lerp((26, 14, 52), (14, 9, 34), (y - HZ) / (H - HZ))
    d.line([(0, y), (W, y)], fill=c + (255,))
# 紅い月（地平線の上）
moon = Image.new('RGBA', (W, H)); md = ImageDraw.Draw(moon)
md.ellipse([400, 6, 520, 126], fill=(205, 30, 62, 255))
md.ellipse([418, 20, 470, 60], fill=(225, 60, 80, 255)); md.ellipse([470, 70, 500, 96], fill=(180, 22, 52, 255))
mg = Image.new('RGBA', (W, H)); ImageDraw.Draw(mg).ellipse([370, -24, 550, 156], fill=(255, 40, 80, 90))
base.alpha_composite(mg.filter(ImageFilter.GaussianBlur(24)))
base.alpha_composite(moon)
# 遠くの街の影（地平線）
x = 0
while x < W:
    w = rnd.randint(8, 22); h = rnd.randint(8, 40)
    d.rectangle([x, HZ - h, x + w, HZ], fill=(22, 12, 44, 255))
    for _ in range(w * h // 40):
        d.point((x + rnd.randint(1, w - 1), HZ - rnd.randint(1, h - 1)), fill=rnd.choice([PINK, CYAN, (255, 210, 120)]) + (200,))
    x += w + rnd.randint(0, 3)
d.line([(0, HZ), (W, HZ)], fill=(120, 60, 150, 255))

# 運河（第一章の水道橋が渡る）
canal = [(0, 470), (120, 452), (260, 430), (400, 418), (520, 420), (600, 436)]
for i in range(len(canal) - 1):
    d.line([canal[i], canal[i + 1]], fill=(12, 30, 66, 255), width=30)
for i in range(60):
    t = rnd.random(); k = int(t * (len(canal) - 1)); u = t * (len(canal) - 1) - k
    a, b = canal[k], canal[k + 1]; px, py = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + rnd.randint(-10, 10)
    d.line([(px, py), (px + rnd.randint(3, 9), py)], fill=rnd.choice([PINK, CYAN]) + (120,))


def on_canal(x, y):
    for i in range(len(canal) - 1):
        (ax, ay), (bx, by) = canal[i], canal[i + 1]
        if ax <= x <= bx:
            cy = ay + (by - ay) * (x - ax) / (bx - ax)
            return abs(y - cy) < 20
    return False


# 学園の結界（あとで描くドームの範囲には、街のビルを置かない）
DOME = (835, 175, 118, 84)      # 中心 x, y, 横の半径, 縦の半径


def in_dome(x, y, pad=0):
    cx, cy, rx, ry = DOME
    return ((x - cx) / (rx + pad)) ** 2 + ((y - cy) / (ry + pad)) ** 2 < 1


# 街区（上から見たビルの屋根。奥ほど小さく、暗い）
y = HZ + 6
while y < H:
    k = (y - HZ) / (H - HZ)
    bh = int(8 + 14 * k); gap = int(3 + 4 * k)
    x = rnd.randint(-10, 0)
    while x < W:
        bw = rnd.randint(int(8 + 10 * k), int(16 + 18 * k))
        cx, cy = x + bw / 2, y + bh / 2
        if not on_canal(cx, cy) and not in_dome(cx, cy, 10) and not (440 < cx < 500 and 300 < cy < 420):
            top = lerp((30, 20, 64), (46, 32, 88), rnd.random())
            top = lerp((18, 10, 40), top, 0.35 + 0.45 * k)
            d.rectangle([x, y, x + bw, y + bh], fill=top + (255,))
            d.line([(x, y), (x + bw, y)], fill=lerp(top, (150, 120, 220), 0.35) + (255,))      # 屋根のふち
            d.line([(x, y + bh), (x + bw, y + bh)], fill=(8, 4, 20, 255))
            for _ in range(int(bw * bh / 70)):      # 屋上の明かり・看板
                d.point((x + rnd.randint(1, bw - 1), y + rnd.randint(1, bh - 1)), fill=rnd.choice([PINK, CYAN, (255, 214, 120), (190, 160, 255)]) + (rnd.randint(110, 230),))
            if rnd.random() < 0.08:      # ネオンの看板
                d.rectangle([x + 2, y + 2, x + min(bw - 2, 9), y + 4], fill=rnd.choice([PINK, CYAN]) + (230,))
        x += bw + gap
    y += bh + gap + 2
# 大通り（ネオンの線）
for pts, col in (([(0, 330), (300, 318), (470, 312)], CYAN), ([(470, 312), (560, 300), (720, 250)], PINK)):
    d.line(pts, fill=(10, 6, 24, 255), width=6); d.line(pts, fill=col + (150,), width=1)

# ---------- 第一章: 水道橋（運河の上に、アーチの連なる石の橋） ----------
aq = [(20, 452), (120, 438), (250, 418), (380, 406)]
for i in range(len(aq) - 1):
    d.line([aq[i], aq[i + 1]], fill=(40, 30, 70, 255), width=14)      # 影
for i in range(len(aq) - 1):
    d.line([(aq[i][0], aq[i][1] - 4), (aq[i + 1][0], aq[i + 1][1] - 4)], fill=(118, 108, 160, 255), width=10)
    d.line([(aq[i][0], aq[i][1] - 9), (aq[i + 1][0], aq[i + 1][1] - 9)], fill=(170, 160, 210, 255), width=1)
L = 0
for i in range(len(aq) - 1):      # 側面のアーチ
    (ax, ay), (bx, by) = aq[i], aq[i + 1]; n = int(math.hypot(bx - ax, by - ay) / 9)
    for j in range(n):
        px = ax + (bx - ax) * j / n; py = ay + (by - ay) * j / n
        d.rectangle([px + 1, py + 1, px + 5, py + 5], fill=(24, 16, 46, 255))
        if (j + i) % 4 == 0:
            d.point((px + 3, py - 4), fill=PINK + (255,))
# 門番（重機兵ガーディアン）の影
d.rectangle([372, 392, 384, 404], fill=(60, 50, 90, 255)); d.point((378, 396), fill=(255, 60, 60, 255))
# 雨（第一章のあたりだけ）
rain = Image.new('RGBA', (W, H)); rd = ImageDraw.Draw(rain)
for _ in range(260):
    x0 = rnd.randint(-40, 420); y0 = rnd.randint(330, 540)
    rd.line([(x0, y0), (x0 + 3, y0 + 9)], fill=(160, 190, 255, 70))
base.alpha_composite(rain)

# ---------- 第二章: 鉄塔（足もとの四角い台から、画面の上へ高く突き出す。影は右下へ長く） ----------
TX, TY, TT = 470, 392, 186      # 足もと x, y, てっぺんの y
sh = Image.new('RGBA', (W, H)); ImageDraw.Draw(sh).polygon([(458, 392), (482, 392), (640, 520), (620, 528)], fill=(0, 0, 10, 140))
base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(2)))
d.rectangle([448, 380, 492, 404], fill=(40, 30, 70, 255), outline=(120, 100, 170, 255))
for yy in range(TT, TY - 10, 2):      # 鉄骨（下ほど太い）
    k = (yy - TT) / (TY - TT); hw = 3 + 17 * k ** 1.4
    d.rectangle([TX - hw - 1, yy, TX - hw, yy + 1], fill=(170, 160, 220, 255)); d.rectangle([TX + hw, yy, TX + hw + 1, yy + 1], fill=(170, 160, 220, 255))
    if yy % 8 == 0:
        d.line([(TX - hw, yy), (TX + hw, yy)], fill=(90, 80, 140, 255))
    if yy % 16 == 0:
        d.line([(TX - hw, yy), (TX + 3 + 17 * ((yy + 16 - TT) / (TY - TT)) ** 1.4, yy + 16)], fill=(70, 62, 120, 255))
d.rectangle([TX - 9, TT + 6, TX + 9, TT + 9], fill=(120, 110, 180, 255))      # てっぺんの足場
d.line([(TX, TT - 22), (TX, TT + 6)], fill=(180, 170, 230, 255))              # アンテナ
for yy in (TT - 22, TT + 40, TT + 100, TT + 160):
    d.point((TX, yy), fill=(255, 50, 70, 255)); d.point((TX + 1, yy), fill=(255, 50, 70, 255))

# ---------- 第三章: 雲海と、飛空艇の航路 ----------
cl = Image.new('RGBA', (W, H)); cd = ImageDraw.Draw(cl)
for _ in range(70):
    cx = rnd.randint(470, 800); cy = rnd.randint(150, 300) - (cx - 470) * 0.18
    rx = rnd.randint(18, 46); ry = rx * 0.38
    cd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(120, 96, 190, 70))
for _ in range(40):
    cx = rnd.randint(480, 780); cy = rnd.randint(150, 290) - (cx - 470) * 0.18
    rx = rnd.randint(10, 26); ry = rx * 0.35
    cd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(200, 170, 255, 50))
base.alpha_composite(cl.filter(ImageFilter.GaussianBlur(3)))

# ---------- 第四章: 玉龍学園（紅い結界のドームの中。校舎・桜並木・奥に龍） ----------
cx, cy, rx, ry = DOME
d.ellipse([cx - rx + 6, cy - ry + 10, cx + rx - 6, cy + ry - 2], fill=(34, 20, 58, 255))      # 学園の敷地
for bx, by, bw, bh in ((770, 175, 60, 18), (800, 148, 70, 16), (840, 196, 52, 16), (868, 160, 34, 30)):      # 校舎の屋根
    d.rectangle([bx, by, bx + bw, by + bh], fill=(70, 56, 120, 255), outline=(170, 150, 230, 255))
    for wx in range(bx + 3, bx + bw - 2, 5):
        d.point((wx, by + bh // 2), fill=rnd.choice([PINK, CYAN, (255, 214, 120)]) + (220,))
for i in range(22):      # 桜並木（奥の龍へ続く道）
    t = i / 21; px = 760 + 150 * t; py = 228 - 120 * t + math.sin(i * 1.7) * 3
    for s in (-1, 1):
        q = (px + s * 7, py + s * 3)
        d.ellipse([q[0] - 4, q[1] - 3, q[0] + 4, q[1] + 3], fill=(255, 150, 200, 255))
        d.point(q, fill=(255, 220, 240, 255))
d.line([(760, 228), (910, 108)], fill=(255, 200, 230, 120), width=2)
# 龍の影（学園のいちばん奥）
# 結界のドーム（半透明の紅）
dm = Image.new('RGBA', (W, H)); dd = ImageDraw.Draw(dm)
dd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 40, 80, 46), outline=(255, 90, 120, 200), width=2)
for k in range(1, 4):
    dd.ellipse([cx - rx * (1 - k * 0.24), cy - ry, cx + rx * (1 - k * 0.24), cy + ry], outline=(255, 90, 120, 60))
    dd.line([(cx - rx * math.sqrt(1 - (k / 4) ** 2), cy - ry * k / 4), (cx + rx * math.sqrt(1 - (k / 4) ** 2), cy - ry * k / 4)], fill=(255, 90, 120, 60))
glow(base, dm, 6)
# 学園へ渡る橋（結界で塞がれている）
d.line([(560, 300), (640, 282), (722, 238)], fill=(90, 80, 140, 255), width=5)
d.line([(560, 300), (640, 282), (722, 238)], fill=(170, 160, 210, 255), width=1)
d.line([(716, 230), (728, 246)], fill=(255, 60, 90, 255), width=2); d.line([(728, 230), (716, 246)], fill=(255, 60, 90, 255), width=2)


# 飛空艇（航路の上に 2 隻）
for ax, ay in ((590, 122), (712, 120)):
    d.ellipse([ax - 16, ay - 12, ax + 16, ay - 2], fill=(70, 60, 120, 255), outline=(200, 190, 255, 255))
    d.rectangle([ax - 6, ay - 3, ax + 6, ay], fill=(40, 30, 80, 255)); d.line([(ax - 11, ay - 7), (ax + 11, ay - 7)], fill=CYAN + (255,))

# 龍: ゲームの龍のスプライト（翼を広げた正面の姿）を、結界の奥に小さく置く
js = open(os.path.join(HERE, 'js', '08_dragon_art.js'), encoding='utf-8').read()
dimg = Image.open(io.BytesIO(base64.b64decode(re.search(r'img: "data:image/\w+;base64,([^"]+)"', js).group(1)))).convert('RGBA')
fw = [int(v) for v in re.search(r'wing: \[(?:\[[^\]]*\], ){3}\[([^\]]*)\]', js).group(1).split(',')]
dsp = dimg.crop((fw[0], fw[1], fw[0] + fw[2], fw[1] + fw[3]))
dsp = dsp.resize((int(dsp.width * 0.31), int(dsp.height * 0.31)), Image.LANCZOS)
cx, cy, rx, ry = DOME
gx, gy = cx + 26 - dsp.width // 2, cy - ry + 4 - dsp.height // 2
gl = Image.new('RGBA', (W, H)); ImageDraw.Draw(gl).ellipse([gx - 10, gy - 5, gx + dsp.width + 10, gy + dsp.height + 5], fill=(255, 40, 70, 150))
base.alpha_composite(gl.filter(ImageFilter.GaussianBlur(10)))
base.alpha_composite(dsp, (gx, gy))

# 作戦図らしく: うすい方眼・走査線・四隅のかぎ・まわりを暗く（四角が通信で送ってくる地図、という見立て）
ho = Image.new('RGBA', (W, H)); hd = ImageDraw.Draw(ho)
for x in range(0, W, 40):
    hd.line([(x, HZ), (x, H)], fill=(120, 220, 255, 16 if x % 200 else 34))
for y in range(HZ + 4, H, 40):
    hd.line([(0, y), (W, y)], fill=(120, 220, 255, 16 if (y - HZ - 4) % 200 else 34))
for y in range(0, H, 3):
    hd.line([(0, y), (W, y)], fill=(0, 0, 20, 22))
for (x, y, sx, sy) in ((6, 6, 1, 1), (W - 7, 6, -1, 1), (6, H - 7, 1, -1), (W - 7, H - 7, -1, -1)):
    hd.line([(x, y), (x + 26 * sx, y)], fill=(160, 230, 255, 200)); hd.line([(x, y), (x, y + 26 * sy)], fill=(160, 230, 255, 200))
base.alpha_composite(ho)
vg = Image.new('L', (W, H), 0); vd = ImageDraw.Draw(vg)
vd.ellipse([-160, -120, W + 160, H + 120], fill=255)
vg = vg.filter(ImageFilter.GaussianBlur(90))
dark = Image.new('RGBA', (W, H), (4, 2, 16, 255)); dark.putalpha(vg.point(lambda v: int((255 - v) * 0.6)))
base.alpha_composite(dark)

out = base.convert('RGB')
if len(sys.argv) > 1:
    out.save(sys.argv[1])
buf = io.BytesIO(); out.save(buf, 'WEBP', quality=90, method=6)
path = os.path.join(HERE, 'js', '09_map_art.js')
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// make_world_map.py が生成したファイル（手で編集しない）。全体マップ（62_map.js）の下絵（960x540）\n'
            'window.REBELL_MAP = "data:image/webp;base64,%s";\n' % base64.b64encode(buf.getvalue()).decode('ascii'))
print('map', out.size, len(buf.getvalue()) // 1024, 'KB ->', path)

# -*- coding: utf-8 -*-
"""第2章のマップ（62_map.js）の下絵を描いて、js/09_map2_art.js を作る。
使い方:  python rebell_src/make_world_map2.py [確認用の PNG の出力先]

サイバーパンクの指宿・谷山方面を、北を上にして真上から見た作戦図（960x540 のドット絵。描き方は第1章の make_world_map.py と同じ）。
  左 = 薩摩半島（上から 谷山 → 平川 → 喜入 → 指宿 → 山川。左下に池田湖と開聞岳）、中央 = 錦江湾、右 = 大隅半島、上の中央 = 桜島の南側。
  場所は、経度・緯度を P() で下絵の座標に直す。縦は 1km = 10.8 ドット、横は 1km = 19 ドット（横に引きのばしてある）。
ステージのマス（62_map.js の第2章の PATH と合わせる）:
  谷山（臨海の工業地帯）→ 平川動物公園 → 喜入（石油基地）→ 指宿 → 開聞岳（山の上）。
道のり・マス・地名の文字は、ここでは描かない（ゲームの中で描く）。
"""
import base64, io, math, os, random, sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 960, 540
rnd = random.Random(23)
PINK, CYAN, AMBER, RED = (255, 79, 176), (55, 230, 255), (255, 214, 120), (255, 60, 90)

LON0, LAT0, KX, KY = 130.415, 31.59, 1809.0, 1200.0      # 左上の経度・緯度と、1 度あたりのドット数
KMX, KMY = 19.0, 10.8                                    # 1km あたりのドット数（横・縦）


def P(lon, lat):
    return ((lon - LON0) * KX, (LAT0 - lat) * KY)


def PP(pts):
    return [P(a, b) for a, b in pts]


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def smooth(pts, n=2):
    """角を丸める（チャイキンの方法）"""
    for _ in range(n):
        q = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            q.append((a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25))
            q.append((a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75))
        q.append(pts[-1]); pts = q
    return pts


def walk(pts, step):
    """折れ線の上を step ずつ進んだ点と、進む向き"""
    out = []; rest = 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L == 0:
            continue
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L; t = rest
        while t <= L:
            out.append((a[0] + ux * t, a[1] + uy * t, ux, uy)); t += step
        rest = t - L
    return out


def noise(scale, seed, octaves=3):
    """なめらかな乱れ（0〜1）"""
    rs = np.random.RandomState(seed); out = np.zeros((H, W), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        gw, gh = int(W / scale * 2 ** o) + 3, int(H / scale * 2 ** o) + 3
        g = Image.fromarray((rs.rand(gh, gw) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        out += np.asarray(g, np.float32) / 255 * amp; tot += amp; amp *= 0.5
    return out / tot


def poly_mask(pts):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.asarray(im) > 0


def edge(m):
    """ふち（内側の 1 ドット）"""
    e = np.zeros_like(m)
    e[1:, :] |= m[1:, :] & ~m[:-1, :]; e[:-1, :] |= m[:-1, :] & ~m[1:, :]
    e[:, 1:] |= m[:, 1:] & ~m[:, :-1]; e[:, :-1] |= m[:, :-1] & ~m[:, 1:]
    return e


def up(m, dy):
    """上へ dy ドットずらす"""
    if dy <= 0:
        return m.copy()
    out = np.zeros_like(m); out[:-dy, :] = m[dy:, :]
    return out


def blurf(m, r):
    return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


Y, X = np.mgrid[0:H, 0:W].astype(np.float32)


def blob(lon, lat, rkm, h=1.0):
    """なだらかな山（中心・半径 km・高さ）"""
    x, y = P(lon, lat)
    return np.clip(1 - np.hypot((X - x) / (rkm * KMX), (Y - y) / (rkm * KMY)), 0, 1) * h


def gauss(lon, lat, rkm):
    x, y = P(lon, lat)
    return np.exp(-(((X - x) / (rkm * KMX)) ** 2 + ((Y - y) / (rkm * KMY)) ** 2))


# ---------- 地形: 陸・海 ----------
SATSUMA = [(130.566, 31.60), (130.567, 31.565), (130.573, 31.557), (130.566, 31.549), (130.578, 31.546), (130.582, 31.540), (130.570, 31.536),      # 与次郎・鴨池港・マリンポート
           (130.562, 31.530), (130.558, 31.522), (130.561, 31.512), (130.553, 31.506), (130.542, 31.503), (130.546, 31.497), (130.554, 31.495),      # 東開町・谷山港
           (130.551, 31.488), (130.546, 31.485), (130.549, 31.472), (130.536, 31.466), (130.525, 31.462), (130.518, 31.452), (130.514, 31.440),      # 七ツ島・和田・平川
           (130.518, 31.428), (130.524, 31.416), (130.533, 31.404), (130.540, 31.394), (130.546, 31.387),                                            # 瀬々串・中名
           (130.552, 31.387), (130.566, 31.381), (130.567, 31.366), (130.553, 31.362),                                                               # 喜入の石油基地（埋め立て地）
           (130.554, 31.357), (130.561, 31.348), (130.571, 31.335), (130.579, 31.322), (130.589, 31.306), (130.599, 31.292), (130.611, 31.280),      # 前之浜・生見・今和泉
           (130.623, 31.272), (130.640, 31.270), (130.656, 31.272), (130.666, 31.268), (130.669, 31.258), (130.661, 31.248), (130.654, 31.240),      # 宮ヶ浜・田良岬・魚見岳
           (130.656, 31.228), (130.653, 31.218), (130.649, 31.210), (130.641, 31.209), (130.634, 31.204), (130.640, 31.199), (130.649, 31.202),      # 摺ヶ浜・山川港（丸い入り江）
           (130.651, 31.195), (130.641, 31.185), (130.623, 31.175), (130.601, 31.165), (130.590, 31.152), (130.582, 31.160), (130.570, 31.168),      # 竹山・長崎鼻
           (130.556, 31.170), (130.545, 31.160), (130.530, 31.154), (130.512, 31.160), (130.504, 31.175), (130.495, 31.190), (130.480, 31.205),      # 開聞岳のふもと
           (130.460, 31.222), (130.440, 31.235), (130.412, 31.245)]                                                                                  # 頴娃
OSUMI = [(130.746, 31.60), (130.740, 31.570), (130.728, 31.545), (130.712, 31.520), (130.700, 31.495), (130.698, 31.470), (130.708, 31.445),         # 牛根・海潟・垂水
         (130.722, 31.425), (130.742, 31.405), (130.760, 31.388), (130.775, 31.365), (130.785, 31.340), (130.790, 31.310), (130.790, 31.285),        # 新城・古江・高須・浜田
         (130.784, 31.255), (130.775, 31.230), (130.768, 31.205), (130.755, 31.180), (130.740, 31.160), (130.722, 31.130)]                           # 大根占・根占
sat = poly_mask([(-6, -6)] + PP(SATSUMA) + [(-6, P(130.412, 31.245)[1])])
osu = poly_mask(PP(OSUMI) + [(W + 6, H + 6), (W + 6, -6)])
# 桜島（南側だけが見える）: 高さの場
SKX, SKY = P(130.6583, 31.5806)      # 南岳
_dx, _dy = (X - 446) / 124.0, (Y - 2) / 52.0
_th = np.arctan2(_dy, _dx)
_rr = np.hypot(_dx, _dy) / (1 + 0.05 * np.cos(3 * (_th - 1.2)) + 0.03 * np.cos(7 * (_th - 0.4)))
sakura = _rr < 1
hsk = np.clip(1 - np.hypot((X - SKX) / 130.0, (Y - SKY) / 47.0), 0, 1) ** 0.85 * sakura
SKN, SKRISE = 9, 2
# 知林ヶ島・池田湖・鰻池
CHX, CHY = P(130.674, 31.2765)
chirin = ((X - CHX) / 8.0) ** 2 + ((Y - CHY) / 4.6) ** 2 < 1
IKX, IKY = P(130.563, 31.233)
_ia = np.arctan2((Y - IKY) / 21.0, (X - IKX) / 36.0)
rI = np.hypot((X - IKX) / 36.0, (Y - IKY) / 21.0) / (1 + 0.06 * np.cos(3 * (_ia - 0.6)) + 0.04 * np.cos(5 * (_ia + 1.0)))
ikeda = rI < 1
UNX, UNY = P(130.611, 31.226)
unagi = ((X - UNX) / 6.0) ** 2 + ((Y - UNY) / 3.6) ** 2 < 1
lakes = ikeda | unagi
land = sat | osu | sakura | chirin
solid = land.copy()

# 開聞岳（薩摩富士）: きれいな円すい。等高線の板を 3 ドットずつ上へ重ねる
KAX, KAY = P(130.5285, 31.180)
rK = np.hypot((X - KAX) / 44.0, (Y - KAY) / 26.0)
hka = np.clip(1 - rK, 0, 1) ** 1.2
KAN, KARISE = 12, 3
KATOP = (KAX, KAY - KAN * KARISE)      # 山頂（絵の中の位置）= 第2章の 5 つめのマス

# ---------- 町の広がり（0〜1。ここにビルを置く） ----------
TOWNS = [(130.552, 31.578, 2.2, 1.0), (130.546, 31.553, 1.8, 1.0), (130.522, 31.522, 2.3, 1.0), (130.548, 31.512, 1.6, 0.9), (130.506, 31.496, 1.4, 0.75),
         (130.526, 31.472, 1.0, 0.6), (130.500, 31.545, 1.6, 0.65), (130.482, 31.532, 1.2, 0.5),                                             # 鹿児島市の南・谷山
         (130.510, 31.445, 0.8, 0.6), (130.521, 31.416, 0.7, 0.55), (130.541, 31.378, 1.2, 0.9), (130.558, 31.348, 0.7, 0.55),
         (130.574, 31.321, 0.7, 0.5), (130.595, 31.291, 0.9, 0.7), (130.617, 31.272, 0.9, 0.7),                                             # 平川〜宮ヶ浜
         (130.640, 31.238, 2.3, 1.0), (130.630, 31.256, 1.0, 0.8), (130.652, 31.228, 0.9, 0.95), (130.633, 31.207, 1.0, 0.85),              # 指宿・山川
         (130.611, 31.196, 0.5, 0.35), (130.540, 31.200, 0.6, 0.4), (130.47, 31.232, 0.8, 0.5), (130.442, 31.378, 1.0, 0.65),                # 大山・開聞・頴娃・知覧
         (130.703, 31.493, 1.0, 0.7), (130.762, 31.388, 0.5, 0.35), (130.852, 31.378, 2.4, 0.9), (130.777, 31.362, 0.4, 0.3),
         (130.787, 31.246, 0.7, 0.5), (130.772, 31.203, 0.7, 0.5), (130.93, 31.39, 1.2, 0.4), (130.90, 31.33, 0.8, 0.3)]                     # 大隅半島
urb = np.zeros((H, W), np.float32)
for lon, lat, r, s in TOWNS:
    urb = np.maximum(urb, gauss(lon, lat, r) * s)

# ---------- 山と平地: 高さの場（0〜1） ----------
n1, n2, n3 = noise(120, 31, 2), noise(26, 32, 3), noise(46, 33, 3)
near_land = blurf(land, 13)
ridge = 1 - np.abs(2 * n3 - 1)      # 尾根のすじ
hl = np.clip((near_land - 0.64) / 0.30, 0, 1) * np.clip(0.22 + 0.80 * n1 + 0.50 * (ridge - 0.5), 0, 1.15)


def ll_mask(pts):
    return poly_mask(PP(pts))


def ell_mask(lon, lat, rkm):
    x, y = P(lon, lat)
    return ((X - x) / (rkm * KMX)) ** 2 + ((Y - y) / (rkm * KMY)) ** 2 < 1


flat = (ll_mask([(130.50, 31.60), (130.57, 31.60), (130.565, 31.52), (130.555, 31.495), (130.548, 31.47), (130.53, 31.462), (130.512, 31.468),
                 (130.498, 31.49), (130.488, 31.52), (130.482, 31.555)])                                                                     # 谷山の平野
        | ell_mask(130.541, 31.378, 1.2)                                                                                                    # 喜入
        | ll_mask([(130.600, 31.262), (130.625, 31.279), (130.66, 31.275), (130.664, 31.245), (130.658, 31.215), (130.65, 31.198),
                   (130.628, 31.20), (130.615, 31.22), (130.606, 31.24)])                                                                   # 指宿の平野
        | ll_mask([(130.41, 31.31), (130.455, 31.295), (130.50, 31.262), (130.522, 31.215), (130.56, 31.205), (130.60, 31.20), (130.64, 31.212),
                   (130.655, 31.195), (130.63, 31.172), (130.59, 31.150), (130.555, 31.165), (130.50, 31.18), (130.44, 31.228), (130.41, 31.24)])   # 頴娃・開聞の台地（畑）
        | ell_mask(130.442, 31.378, 1.9)                                                                                                    # 知覧
        | ll_mask([(130.775, 31.40), (130.80, 31.43), (130.96, 31.46), (130.96, 31.30), (130.86, 31.30), (130.80, 31.325), (130.778, 31.36)])   # 鹿屋の台地
        | ell_mask(130.782, 31.215, 1.6) | ell_mask(130.706, 31.49, 1.2))                                                                   # 根占・垂水
hl = hl * (1 - blurf(flat, 6)) * (1 - 0.9 * np.clip(urb * 1.4, 0, 1))      # 平野と町は、平らに
for b in (blob(130.538, 31.556, 0.9, 0.5), blob(130.515, 31.548, 1.0, 0.5),                  # 紫原・桜ヶ丘の台地
          blob(130.662, 31.257, 0.65, 0.85),                                                # 魚見岳
          blob(130.475, 31.262, 1.7, 0.8), blob(130.535, 31.276, 1.9, 0.85), blob(130.598, 31.243, 0.9, 0.6),      # 大野岳・鬼門平・清見岳（池田湖のまわり）
          blob(130.642, 31.187, 0.45, 0.6), blob(130.82, 31.50, 5.0, 1.0), blob(130.86, 31.46, 4.0, 0.9)):         # 竹山・高隈山
    hl = np.maximum(hl, b)
hl = np.maximum(hl, np.clip(1 - np.abs(rI - 1.5) / 0.5, 0, 1) * 0.62 * (Y < IKY + 6))      # 池田湖のカルデラのふち（南は開いている）
hl = np.clip(hl + 0.2 * (n2 - 0.5) * (hl > 0.06), 0, 1) * (sat | osu) * ~lakes * (rK > 1.05)
hl = np.where(chirin, 0.5, hl)
LTHR = (0.14, 0.27, 0.40, 0.54, 0.68, 0.84)

# ---------- 下地: 海 ----------
near = blurf(solid, 18)
sea = np.zeros((H, W, 3), np.float32)
for i, (c0, c1) in enumerate(zip((6, 10, 34), (18, 44, 92))):
    sea[..., i] = c0 + (c1 - c0) * np.clip(near * 1.5, 0, 1)
base = Image.fromarray(sea.astype(np.uint8), 'RGB')
d = ImageDraw.Draw(base, 'RGBA')
lights = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lights)      # 光るもの（最後に、にじませて足す）


def paint(mask, color, img=None):
    img = img or base
    a = color[3] if len(color) > 3 else 255
    src = Image.new(img.mode, (W, H), tuple(color[:3]) + ((255,) if img.mode == 'RGBA' else ()))
    img.paste(src, (0, 0), Image.fromarray(mask.astype(np.uint8) * a))


def new_layer():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def comp(layer):
    base.paste(layer, (0, 0), layer)


def dash(dr, pts, fill, on=3, off=3, width=1):
    acc = 0.0; draw = True
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L == 0:
            continue
        t = 0.0
        while t < L - 1e-6:
            need = (on if draw else off) - acc; t2 = min(L, t + need)
            if draw:
                dr.line([(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L), (a[0] + (b[0] - a[0]) * t2 / L, a[1] + (b[1] - a[1]) * t2 / L)], fill=fill, width=width)
            acc += t2 - t; t = t2
            if acc >= (on if draw else off) - 1e-6:
                acc = 0.0; draw = not draw


# 紅い月の映りこみ（錦江湾のまんなか）
MOON = (566, 300, 27)
ml, md = new_layer()
md.ellipse([MOON[0] - MOON[2], MOON[1] - MOON[2], MOON[0] + MOON[2], MOON[1] + MOON[2]], fill=(214, 34, 70, 235))
md.ellipse([MOON[0] - 18, MOON[1] - 16, MOON[0] - 2, MOON[1] - 4], fill=(236, 70, 96, 235))
for yy in range(MOON[1] - MOON[2], MOON[1] + MOON[2] + 44, 1):      # さざ波で、横に切れる
    k = (yy - (MOON[1] - MOON[2])) / (2.0 * MOON[2])
    if (yy % 4 == 3) or (k > 0.55 and yy % 3 == 0) or (k > 0.85 and yy % 2 == 0):
        md.line([(MOON[0] - 60, yy), (MOON[0] + 60, yy)], fill=(0, 0, 0, 0))
for i in range(24):      # 下へのびる、ゆらめき
    yy = MOON[1] + MOON[2] + 2 + i * 2; w = max(2, 22 - i) + rnd.randint(-3, 3)
    md.line([(MOON[0] - w + rnd.randint(-4, 4), yy), (MOON[0] + w + rnd.randint(-4, 4), yy)], fill=(214, 34, 70, max(0, 150 - i * 6)))
mg, mgd = new_layer(); mgd.ellipse([MOON[0] - 48, MOON[1] - 48, MOON[0] + 48, MOON[1] + 58], fill=(255, 40, 80, 64))
comp(mg.filter(ImageFilter.GaussianBlur(20))); comp(ml)

# 海の等深線と、さざ波
for thr, a in ((0.34, 60), (0.15, 40), (0.05, 24)):
    paint(edge(near > thr) & ~solid, (90, 200, 255, a))
for _ in range(900):
    x0, y0 = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
    if not solid[y0, x0]:
        d.line([(x0, y0), (x0 + rnd.randint(2, 7), y0)], fill=rnd.choice([(70, 150, 255), (90, 220, 255), (255, 90, 160)]) + (rnd.randint(26, 70),))

# ---------- 陸の下地・畑・山 ----------
paint(land, (27, 19, 56, 255))
gnd = noise(14, 3, 2)
paint(land & (gnd > 0.56), (33, 23, 66, 255))
# 畑（お茶・さつまいも）: 平らで町でないところに、畝のすじ
f1, f2 = noise(24, 41, 2), noise(40, 42, 2)
field = (sat | osu) & (hl < 0.2) & (urb < 0.28) & ~lakes & (rK > 1.08)
paint(field, (22, 36, 52, 255))
for ang, sel in ((0.5, f1 > 0.52), (-0.9, f1 <= 0.52)):
    st = ((X * math.cos(ang) + Y * math.sin(ang)) % 4) < 1.3
    paint(field & sel & st & (f2 > 0.36), (40, 116, 104, 120))
    paint(field & sel & st & (f2 > 0.62), (96, 210, 170, 80))
cover = np.zeros((H, W), bool)      # 山の板が覆うところ（ビルは置かない）
NL = len(LTHR)
far = osu | sakura      # 大隅半島と桜島は、舞台の外。少し沈んだ色に
for k, thr in enumerate(LTHR, 1):
    m = (hl >= thr); t = k / NL
    for dy in range((k - 1) * 2 + 1, k * 2 + 1):
        paint(up(m, dy), lerp((14, 54, 60), (40, 124, 108), t) + (255,))      # 斜面
        paint(up(m & far, dy), lerp((18, 50, 66), (40, 96, 108), t) + (255,))
    top = up(m, k * 2)
    paint(top, lerp((9, 28, 36), (20, 64, 62), t) + (255,))
    paint(up(m & far, k * 2), lerp((11, 28, 44), (20, 50, 64), t) + (255,))
    paint(edge(top), lerp((36, 100, 120), (130, 236, 220), t) + (int(90 + 120 * t),))
    cover |= top | up(m, (k - 1) * 2)
hill_top = up(hl >= LTHR[0], 2)
for _ in range(14000):      # 木立ち
    x0, y0 = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
    if hill_top[y0, x0] and rnd.random() < 0.6:
        if osu[min(H - 1, y0 + 4), x0]:
            d.point((x0, y0), fill=rnd.choice([(8, 26, 36), (22, 66, 80), (14, 44, 58)]) + (220,))
        else:
            d.point((x0, y0), fill=rnd.choice([(6, 24, 28), (22, 76, 66), (12, 48, 46), (36, 108, 88), (6, 24, 28)]) + (220,))

# 湖（池田湖・鰻池）
for m in (ikeda, unagi):
    paint(up(m, 0), (14, 62, 132, 255))
paint(ikeda & (rI < 0.8), (20, 86, 160, 255)); paint(ikeda & (rI < 0.45), (30, 110, 186, 255))
paint(edge(ikeda) | edge(unagi), (140, 238, 255, 255)); paint(edge(ikeda) | edge(unagi), (90, 220, 255, 170), lights)
for _ in range(26):
    x0, y0 = IKX + rnd.randint(-30, 30), IKY + rnd.randint(-17, 17)
    if ikeda[int(y0), int(x0)]:
        d.line([(x0, y0), (x0 + rnd.randint(2, 5), y0)], fill=(170, 240, 255, 150))
# イッシー（池田湖のぬし）: こぶが 3 つと、小さな頭
ix, iy = IKX + 8, IKY + 4
for k, (ox, r0) in enumerate(((-9, 3), (-2, 4), (6, 3))):
    d.pieslice([ix + ox - r0, iy - r0, ix + ox + r0, iy + r0], 180, 360, fill=(10, 30, 50, 255)); d.arc([ix + ox - r0, iy - r0, ix + ox + r0, iy + r0], 180, 360, fill=(120, 255, 190, 255))
d.line([(ix + 11, iy), (ix + 13, iy - 6)], fill=(10, 30, 50, 255), width=2); d.rectangle([ix + 12, iy - 8, ix + 16, iy - 6], fill=(10, 30, 50, 255))
d.point((ix + 15, iy - 7), fill=(255, 240, 120, 255)); ld.point((ix + 15, iy - 7), fill=(255, 240, 120, 255))
d.line([(ix - 14, iy + 1), (ix + 17, iy + 1)], fill=(170, 240, 255, 170))

# ---------- 川 ----------
RIVERS = [[(130.47, 31.565), (130.50, 31.548), (130.525, 31.534), (130.558, 31.527)],            # 永田川（谷山）
          [(130.598, 31.252), (130.622, 31.250), (130.648, 31.246), (130.656, 31.243)],          # 二反田川（指宿）
          [(130.80, 31.50), (130.745, 31.497), (130.702, 31.492)],                               # 本城川（垂水）
          [(130.80, 31.44), (130.84, 31.40), (130.88, 31.375), (130.96, 31.35)]]                 # 肝属川（鹿屋）
rivers_px = [smooth(PP(r), 2) for r in RIVERS]
for r in rivers_px:
    d.line(r, fill=(14, 62, 132, 255), width=3, joint='curve'); d.line(r, fill=(52, 190, 250, 230), width=1, joint='curve'); ld.line(r, fill=(52, 190, 250, 70), width=1)

# 岸の線（陸と海の境目を、はっきり）
inner = (X > 0) & (X < W - 1) & (Y > 0) & (Y < H - 1)
paint(edge(land) & inner, (140, 238, 255, 255)); paint(edge(land) & inner, (90, 220, 255, 150), lights)

# ---------- 道路・線路 ----------
JR = [(130.541, 31.60), (130.5405, 31.556), (130.533, 31.540), (130.5211, 31.5236), (130.508, 31.508), (130.502, 31.490), (130.502, 31.468), (130.5083, 31.447),
      (130.520, 31.416), (130.533, 31.398), (130.543, 31.377), (130.556, 31.350), (130.573, 31.322), (130.593, 31.292), (130.616, 31.272), (130.630, 31.254),
      (130.641, 31.237), (130.640, 31.222), (130.632, 31.208), (130.611, 31.196), (130.569, 31.1905), (130.553, 31.193), (130.540, 31.199), (130.515, 31.207),
      (130.475, 31.229), (130.45, 31.243), (130.41, 31.258)]      # JR 指宿枕崎線（駅の位置を結んだ線）
STATIONS = [3, 7, 10, 13, 16, 18, 20]      # 谷山・平川・喜入・今和泉・指宿・山川・西大山
ROADS = [
    [(130.563, 31.60), (130.561, 31.545), (130.556, 31.52), (130.552, 31.497), (130.540, 31.475), (130.522, 31.462), (130.512, 31.447)],                    # 産業道路
    [(130.495, 31.535), (130.47, 31.50), (130.455, 31.46), (130.468, 31.42), (130.485, 31.38), (130.50, 31.34), (130.518, 31.30), (130.534, 31.272),
     (130.545, 31.256)],                                                                                                                                     # 指宿スカイライン（尾根の道）
    [(130.50, 31.495), (130.47, 31.44), (130.452, 31.40), (130.442, 31.378), (130.43, 31.35), (130.41, 31.33)],                                             # 知覧へ
    [(130.585, 31.242), (130.61, 31.246), (130.641, 31.237)],                                                                                               # 池田湖から指宿へ
    [(130.632, 31.205), (130.615, 31.185), (130.595, 31.172), (130.565, 31.178), (130.545, 31.19), (130.51, 31.20), (130.47, 31.224), (130.43, 31.243),
     (130.41, 31.25)],                                                                                                                                       # 国道 226 号（南の海ぞい）
    [(130.545, 31.19), (130.566, 31.203), (130.592, 31.214)],                                                                                                # 開聞から池田湖へ
    [(130.746, 31.60), (130.730, 31.545), (130.704, 31.495), (130.702, 31.47), (130.726, 31.425), (130.764, 31.388), (130.80, 31.385), (130.852, 31.378),
     (130.90, 31.39), (130.96, 31.40)],                                                                                                                      # 大隅: 垂水から鹿屋へ
    [(130.764, 31.388), (130.780, 31.362), (130.794, 31.31), (130.788, 31.255), (130.774, 31.205), (130.759, 31.18), (130.73, 31.135)],                     # 大隅: 根占へ
]
TRAM = [(130.552, 31.60), (130.548, 31.562), (130.541, 31.552), (130.531, 31.536), (130.5236, 31.5247)]      # 市電（谷山まで）
jr_px = smooth(PP(JR), 1)
r226 = [(x + 3, y + 1) for x, y in smooth(PP(JR[3:19]), 1)]      # 国道 226 号（線路のすぐ海がわ）
roads_px = [smooth(PP(r), 2) for r in ROADS] + [r226]
tram_px = smooth(PP(TRAM), 1)
for r in roads_px:
    d.line(r, fill=(9, 6, 24, 255), width=3, joint='curve')
for r in roads_px:
    d.line(r, fill=PINK + (150,), width=1); ld.line(r, fill=PINK + (60,), width=1)
d.line(jr_px, fill=(9, 6, 24, 255), width=3, joint='curve'); dash(d, jr_px, (214, 208, 244, 255), 3, 2)
d.line(tram_px, fill=(9, 6, 24, 255), width=3, joint='curve'); d.line(tram_px, fill=(120, 255, 150, 255), width=1); ld.line(tram_px, fill=(120, 255, 150, 130), width=1)

# ---------- 町のビル（町の広がりに合わせて、ばらまく） ----------
ko = Image.new('L', (W, H), 0); kd = ImageDraw.Draw(ko)      # ビルを置かないところ
for r in roads_px + [jr_px, tram_px]:
    kd.line(r, fill=255, width=4)
for r in rivers_px:
    kd.line(r, fill=255, width=5)
SOLAR = PP([(130.527, 31.485), (130.545, 31.485), (130.548, 31.472), (130.536, 31.466), (130.525, 31.469)])      # 七ツ島のメガソーラー
BASE = PP([(130.551, 31.386), (130.565, 31.381), (130.566, 31.366), (130.553, 31.363)])                          # 喜入の石油基地
ZOO = P(130.4925, 31.4517)                                                                                       # 平川動物公園
kd.polygon(SOLAR, fill=255); kd.polygon(BASE, fill=255)
kd.ellipse([ZOO[0] - 30, ZOO[1] - 18, ZOO[0] + 30, ZOO[1] + 18], fill=255)
flat_ok = land & ~cover & ~lakes & ~(np.asarray(ko) > 0) & (rK > 1.05) & ~sakura


def is_flat(x, y):
    xi, yi = int(round(x)), int(round(y))
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return False
    return bool(flat_ok[yi, xi])


TANI, IBU = P(130.535, 31.52), P(130.642, 31.236)
blocks = []
for (ox, oy), ang, box in ((TANI, 14, (120, -10, 300, 160)), (IBU, -34, (340, 365, 480, 485)), (P(130.852, 31.378), 24, (690, 180, 960, 340)), ((300, 300), 6, None)):
    bx, by = math.cos(math.radians(ang)), math.sin(math.radians(ang)); ax, ay = -by, bx
    A = [-760]; B = [-760]
    while A[-1] < 760:
        A.append(A[-1] + rnd.randint(6, 9))
    while B[-1] < 760:
        B.append(B[-1] + rnd.randint(7, 11))
    for i in range(len(A) - 1):
        for j in range(len(B) - 1):
            a0, a1, b0, b1 = A[i], A[i + 1] - 2, B[j], B[j + 1] - 2
            quad = [(ox + ax * u + bx * v, oy + ay * u + by * v) for u, v in ((a0, b0), (a0, b1), (a1, b1), (a1, b0))]
            cx, cy = sum(p[0] for p in quad) / 4, sum(p[1] for p in quad) / 4
            if cx < 2 or cy < 2 or cx > W - 3 or cy > H - 3:
                continue
            inside = [bb for bb in ((120, -10, 300, 160), (340, 365, 480, 485), (690, 180, 960, 340)) if bb[0] <= cx < bb[2] and bb[1] <= cy < bb[3]]
            if (box is None and inside) or (box is not None and not (box[0] <= cx < box[2] and box[1] <= cy < box[3])):
                continue      # 場所ごとに、碁盤の目の向きを変える
            if rnd.random() > float(urb[int(cy), int(cx)]) * 1.5:
                continue
            if not all(is_flat(px, py) for px, py in quad + [(cx, cy)]):
                continue
            blocks.append((max(p[1] for p in quad), quad, cx, cy))
blocks.sort(key=lambda b: b[0])
for _, quad, cx, cy in blocks:
    u = float(urb[int(cy), int(cx)]); dim = bool(osu[int(cy), int(cx)])
    h = int(round(1.0 + 3.2 * u * u + rnd.random() * 1.8 + (rnd.randint(3, 6) if rnd.random() < 0.05 * u else 0))); tall = h >= 6
    roof = lerp((27, 20, 60), (46, 34, 96), rnd.random()); roof = lerp(roof, (64, 40, 112), 0.35 * u)
    if dim:
        roof = lerp(roof, (16, 16, 44), 0.45)
    if rnd.random() < 0.5:      # 街灯
        d.point(quad[rnd.randint(0, 3)], fill=rnd.choice([AMBER, AMBER, (255, 170, 120), PINK]) + (rnd.randint(110, 200),))
    for i in range(4):      # 手前を向いた壁
        p, q = quad[i], quad[(i + 1) % 4]
        mx, my = (p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy
        if my <= 0:
            continue
        wall = (58, 39, 112) if mx > 0 else (31, 21, 68)
        d.polygon([p, q, (q[0], q[1] - h), (p[0], p[1] - h)], fill=wall + (255,))
        L = math.hypot(q[0] - p[0], q[1] - p[1])
        for _ in range(int(L * h / 5.0 * rnd.uniform(0.25, 1.0))):
            uu = rnd.random(); wx, wy = p[0] + (q[0] - p[0]) * uu, p[1] + (q[1] - p[1]) * uu - rnd.random() * (h - 1) - 0.5
            col = rnd.choice([AMBER, AMBER, AMBER, (255, 170, 120), CYAN, PINK])
            d.point((wx, wy), fill=col + (rnd.randint(150, 255),))
            if rnd.random() < (0.12 if dim else 0.3):
                ld.point((wx, wy), fill=col + (150,))
    top = [(x, y - h) for x, y in quad]
    d.polygon(top, fill=roof + (255,))
    for i in range(4):
        p, q = top[i], top[(i + 1) % 4]
        if (p[1] + q[1]) / 2 - (cy - h) < 0:
            d.line([p, q], fill=lerp(roof, (170, 150, 240), 0.42 if not tall else 0.7) + (255,))
    if tall or rnd.random() < 0.05 + 0.12 * u:      # 屋上のネオン
        col = rnd.choice([PINK, CYAN, PINK, AMBER]); i = rnd.randint(0, 3); p, q = top[i], top[(i + 1) % 4]
        d.line([p, q], fill=col + (235,)); ld.line([p, q], fill=col + (120,))
    elif rnd.random() < 0.3:
        tx, ty = sum(p[0] for p in top) / 4, sum(p[1] for p in top) / 4
        d.point((tx, ty), fill=rnd.choice([AMBER, CYAN, (200, 170, 255)]) + (190,))
tg, tgd = new_layer()      # 町の明るさ
for (x0, y0), rx, ry, col in ((P(130.532, 31.522), 46, 34, (255, 60, 170, 50)), (IBU, 30, 24, (255, 150, 90, 56)), (P(130.852, 31.378), 30, 20, (120, 120, 255, 30))):
    tgd.ellipse([x0 - rx, y0 - ry, x0 + rx, y0 + ry], fill=col)
comp(tg.filter(ImageFilter.GaussianBlur(14)))
for k in STATIONS:      # 駅
    x0, y0 = P(*JR[k]); d.rectangle([x0 - 2, y0 - 1, x0 + 2, y0 + 1], fill=(230, 226, 255, 255), outline=(60, 50, 110, 255)); ld.point((x0, y0), fill=(230, 226, 255, 200))
tw_ = walk(jr_px, 2)      # 特急「指宿のたまて箱」（白と黒の車体）
tx0, ty0, tux, tuy = tw_[int(len(tw_) * 0.47)]
d.line([(tx0 - tux * 4, ty0 - tuy * 4), (tx0, ty0)], fill=(245, 245, 255, 255), width=2); d.line([(tx0, ty0), (tx0 + tux * 4, ty0 + tuy * 4)], fill=(14, 12, 24, 255), width=2)
ld.point((tx0, ty0), fill=(255, 255, 255, 220))

# ---------- 目印 ----------
# 谷山: 臨海の工業地帯（倉庫・クレーン・大きなショッピングモール）
for (lon, lat) in ((130.552, 31.516), (130.556, 31.508), (130.548, 31.500), (130.550, 31.492), (130.545, 31.510)):
    x0, y0 = P(lon, lat)
    for k in range(3):
        d.rectangle([x0 + k * 5 - 6, y0 - 2 + k, x0 + k * 5 - 2, y0 + 1 + k], fill=(52, 44, 96, 255), outline=(140, 130, 200, 255))
    d.line([(x0 + 8, y0 - 6), (x0 + 8, y0 + 1)], fill=(255, 214, 120, 255)); d.line([(x0 + 8, y0 - 6), (x0 + 12, y0 - 5)], fill=(255, 214, 120, 255)); ld.point((x0 + 8, y0 - 6), fill=AMBER + (220,))
mx0, my0 = P(130.5416, 31.5176)
d.rectangle([mx0 - 6, my0 - 1, mx0 + 6, my0 + 5], fill=(22, 14, 50, 255)); d.rectangle([mx0 - 6, my0 - 4, mx0 + 6, my0 + 2], fill=(84, 50, 130, 255), outline=PINK + (255,)); ld.rectangle([mx0 - 6, my0 - 4, mx0 + 6, my0 + 2], outline=PINK + (150,))
# 七ツ島のメガソーラー
sl, sd = new_layer(); sd.polygon(SOLAR, fill=(12, 26, 78, 255)); comp(sl)
smask = poly_mask(SOLAR)
paint(smask & ((Y % 3) < 1.0), (40, 130, 255, 255)); paint(smask & ((Y % 3) < 1.0) & ((X % 5) < 1.0), (190, 240, 255, 255))
paint(edge(smask), (120, 220, 255, 255)); paint(smask & ((Y % 3) < 1.0), (40, 130, 255, 90), lights)
# 平川動物公園（丘の上の園地・観覧車・足あとの印）と、錦江湾公園のロケット
d.ellipse([ZOO[0] - 26, ZOO[1] - 15, ZOO[0] + 26, ZOO[1] + 15], fill=(14, 60, 48, 255), outline=(120, 255, 190, 255))
for (ox, oy, r0) in ((-15, -5, 5), (12, -7, 4), (16, 6, 5), (-10, 8, 4), (0, -10, 3)):
    d.ellipse([ZOO[0] + ox - r0, ZOO[1] + oy - r0 * 0.6, ZOO[0] + ox + r0, ZOO[1] + oy + r0 * 0.6], outline=(90, 210, 160, 255))
ld.ellipse([ZOO[0] - 26, ZOO[1] - 15, ZOO[0] + 26, ZOO[1] + 15], outline=(120, 255, 190, 130))
WH = (ZOO[0] - 33, ZOO[1] - 12, 6)
for dr, a in ((d, 255), (ld, 170)):
    dr.line([(WH[0], WH[1]), (WH[0] - 3, WH[1] + 8)], fill=(170, 160, 220, a)); dr.line([(WH[0], WH[1]), (WH[0] + 3, WH[1] + 8)], fill=(170, 160, 220, a))
    dr.ellipse([WH[0] - WH[2], WH[1] - WH[2], WH[0] + WH[2], WH[1] + WH[2]], outline=PINK + (a,))
    for k in range(8):
        an = k * math.pi / 4
        dr.point((WH[0] + math.cos(an) * WH[2], WH[1] + math.sin(an) * WH[2]), fill=(CYAN if k % 2 else AMBER) + (255,))
pw0 = (ZOO[0] + 34, ZOO[1] - 14)      # 足あと
for dr, a in ((d, 255), (ld, 200)):
    dr.ellipse([pw0[0] - 3, pw0[1] - 1, pw0[0] + 3, pw0[1] + 4], fill=(255, 170, 220, a))
    for (ox, oy) in ((-4, -4), (-1, -6), (2, -6), (5, -4)):
        dr.rectangle([pw0[0] + ox - 1, pw0[1] + oy - 1, pw0[0] + ox, pw0[1] + oy], fill=(255, 170, 220, a))
rk0 = (ZOO[0] + 30, ZOO[1] + 20)      # ロケットの模型
d.rectangle([rk0[0], rk0[1] - 9, rk0[0] + 1, rk0[1]], fill=(240, 240, 255, 255)); d.rectangle([rk0[0], rk0[1] - 11, rk0[0] + 1, rk0[1] - 10], fill=RED + (255,))
d.point((rk0[0] - 1, rk0[1]), fill=(255, 150, 60, 255)); d.point((rk0[0] + 2, rk0[1]), fill=(255, 150, 60, 255)); ld.rectangle([rk0[0], rk0[1] - 9, rk0[0] + 1, rk0[1]], fill=(240, 240, 255, 120))
# 喜入の石油基地（丸いタンクの列・炎の塔・沖の桟橋とタンカー）
bl, bd = new_layer(); bd.polygon(BASE, fill=(40, 34, 74, 255)); comp(bl)
bmask = poly_mask(BASE)
bx0, by0 = min(p[0] for p in BASE), min(p[1] for p in BASE)
for gy in range(int(by0) + 4, int(by0) + 30, 5):
    for gx in range(int(bx0) + 4, int(bx0) + 30, 5):
        if bmask[min(H - 1, gy + 1), min(W - 1, gx + 1)] and bmask[max(0, gy - 2), max(0, gx - 2)]:
            d.ellipse([gx - 2, gy - 1, gx + 2, gy + 2], fill=(70, 66, 110, 255)); d.ellipse([gx - 2, gy - 2, gx + 2, gy + 1], fill=(176, 176, 214, 255), outline=(236, 236, 255, 255))
            if rnd.random() < 0.4:
                d.point((gx, gy + 2), fill=AMBER + (255,)); ld.point((gx, gy + 2), fill=AMBER + (200,))
paint(edge(bmask), (150, 236, 255, 255))
fx0, fy0 = BASE[1][0] - 2, BASE[1][1] + 3      # 炎の塔
d.line([(fx0, fy0), (fx0, fy0 - 7)], fill=(200, 200, 230, 255)); d.rectangle([fx0 - 1, fy0 - 10, fx0 + 1, fy0 - 8], fill=(255, 150, 60, 255)); ld.ellipse([fx0 - 4, fy0 - 13, fx0 + 4, fy0 - 5], fill=(255, 110, 40, 200))
jx0, jy0 = BASE[2][0], (BASE[1][1] + BASE[2][1]) / 2      # 沖の桟橋
d.line([(jx0, jy0), (jx0 + 30, jy0)], fill=(150, 150, 200, 255))
for xx in range(int(jx0) + 4, int(jx0) + 30, 6):
    d.point((xx, jy0 - 1), fill=AMBER + (255,)); ld.point((xx, jy0 - 1), fill=AMBER + (180,))


def tanker(x, y, L=22, vertical=True):
    if vertical:
        d.polygon([(x - 3, y - L / 2 + 3), (x, y - L / 2), (x + 3, y - L / 2 + 3), (x + 3, y + L / 2), (x - 3, y + L / 2)], fill=(92, 30, 44, 255), outline=(220, 120, 140, 255))
        d.line([(x, y - L / 2 + 5), (x, y + L / 2 - 6)], fill=(200, 96, 110, 255)); d.rectangle([x - 2, y + L / 2 - 5, x + 2, y + L / 2 - 2], fill=(230, 230, 250, 255))
        ld.point((x, y + L / 2 - 4), fill=AMBER + (230,)); ld.point((x, y - L / 2 + 1), fill=RED + (230,))
    else:
        d.polygon([(x - L / 2, y - 2), (x + L / 2 - 3, y - 2), (x + L / 2, y), (x + L / 2 - 3, y + 2), (x - L / 2, y + 2)], fill=(92, 30, 44, 255), outline=(220, 120, 140, 255))
        d.rectangle([x - L / 2 + 1, y - 1, x - L / 2 + 4, y + 1], fill=(230, 230, 250, 255)); ld.point((x - L / 2 + 2, y), fill=AMBER + (230,))
        d.line([(x - L / 2 - 2, y), (x - L / 2 - 12, y + 1)], fill=(150, 230, 255, 130))


tanker(jx0 + 34, jy0 + 1, 24, True)
tanker(430, 176, 20, False); tanker(360, 120, 16, False)
# 指宿: 砂むし温泉の湯けむり（あとで、にじみの上に描く）と、知林ヶ島へつづく砂の道
TARA = P(130.666, 31.2685)
dash(d, [(TARA[0] + 1, TARA[1] - 1), (CHX - 6, CHY + 2)], (255, 236, 190, 255), 2, 2); dash(ld, [(TARA[0] + 1, TARA[1] - 1), (CHX - 6, CHY + 2)], (255, 236, 190, 170), 2, 2)
paint(up(chirin, 2), (22, 74, 60, 255)); paint(edge(up(chirin, 2)), (110, 220, 200, 255))
# 山川港の船と、長崎鼻の灯台・竜宮神社
yx0, yy0 = P(130.640, 31.2035)
for (ox, oy) in ((-3, 0), (2, -2), (4, 2)):
    d.rectangle([yx0 + ox - 1, yy0 + oy, yx0 + ox + 1, yy0 + oy], fill=(236, 240, 255, 255)); ld.point((yx0 + ox, yy0 + oy), fill=AMBER + (160,))
nx0, ny0 = P(130.5895, 31.1545)
lb, lbd = new_layer(); lbd.polygon([(nx0, ny0 - 3), (nx0 + 46, ny0 + 16), (nx0 + 30, ny0 + 30)], fill=(255, 250, 200, 46)); comp(lb.filter(ImageFilter.GaussianBlur(2)))
d.rectangle([nx0 - 1, ny0 - 7, nx0, ny0 - 1], fill=(245, 245, 255, 255)); d.rectangle([nx0 - 1, ny0 - 9, nx0, ny0 - 8], fill=(255, 250, 180, 255)); ld.ellipse([nx0 - 4, ny0 - 12, nx0 + 3, ny0 - 5], fill=(255, 250, 180, 230))
d.line([(nx0 - 9, ny0 - 9), (nx0 - 4, ny0 - 9)], fill=RED + (255,)); d.line([(nx0 - 8, ny0 - 9), (nx0 - 8, ny0 - 5)], fill=RED + (255,)); d.line([(nx0 - 5, ny0 - 9), (nx0 - 5, ny0 - 5)], fill=RED + (255,))
fpx, fpy = P(130.598, 31.166)      # フラワーパーク
for _ in range(16):
    d.point((fpx + rnd.randint(-6, 6), fpy + rnd.randint(-3, 3)), fill=rnd.choice([(255, 120, 200), (255, 220, 90), (120, 255, 170), (160, 180, 255), (255, 150, 90)]) + (255,))
# 鴨池のフェリー乗り場・マリンポートの客船・沖小島
cx0, cy0 = P(130.583, 31.5415)
d.polygon([(cx0 - 9, cy0 - 2), (cx0 + 7, cy0 - 2), (cx0 + 10, cy0), (cx0 + 7, cy0 + 2), (cx0 - 9, cy0 + 2)], fill=(240, 244, 255, 255))
for xx in range(int(cx0) - 7, int(cx0) + 7, 3):
    d.point((xx, cy0), fill=(60, 150, 255, 255))
ld.rectangle([cx0 - 8, cy0 - 1, cx0 + 7, cy0 + 1], fill=(200, 230, 255, 90))
ox0, oy0 = P(130.588, 31.538 - 0.012)
d.ellipse([ox0 - 3, oy0 - 2, ox0 + 3, oy0 + 1], fill=(22, 74, 60, 255), outline=(140, 238, 255, 255))
# 鹿屋の航空基地（滑走路の灯り）
ax0, ay0 = P(130.842, 31.366)
for k in range(12):
    d.point((ax0 + k * 3, ay0 - k * 0.5), fill=(120, 190, 255, 255)); ld.point((ax0 + k * 3, ay0 - k * 0.5), fill=(120, 190, 255, 150))

# ---------- 開聞岳（等高線の板を重ねた円すい） ----------
for k in range(1, KAN + 1):
    m = (hka >= k / (KAN + 0.6)) & sat
    t = k / KAN
    for dy in range((k - 1) * KARISE + 1, k * KARISE + 1):
        paint(up(m, dy), lerp((20, 70, 78), (120, 226, 214), t) + (255,))      # 板の側面
    top = up(m, k * KARISE)
    paint(top, lerp((12, 40, 46), (40, 104, 110), t ** 1.2) + (255,))
    oc = lerp((80, 200, 200), (236, 255, 250), t)
    paint(edge(top), oc + (int(150 + 100 * t),)); paint(edge(top), oc + (int(40 + 110 * t),), lights)
d.ellipse([KATOP[0] - 2, KATOP[1] - 1, KATOP[0] + 2, KATOP[1] + 1], fill=(240, 255, 250, 255)); ld.ellipse([KATOP[0] - 5, KATOP[1] - 4, KATOP[0] + 5, KATOP[1] + 3], fill=(170, 255, 236, 220))
for _ in range(120):      # ふもとの森
    an = rnd.uniform(0, 2 * math.pi); rr = rnd.uniform(0.86, 1.08); x0, y0 = KAX + math.cos(an) * 44 * rr, KAY + math.sin(an) * 26 * rr
    if 0 <= x0 < W and 0 <= y0 < H and sat[int(y0), int(x0)]:
        d.point((x0, y0), fill=rnd.choice([(8, 34, 30), (30, 96, 70), (52, 140, 100)]) + (230,))

# ---------- 桜島（上の端に、南側だけ） ----------
for k in range(0, SKN + 1):
    m = sakura & (hsk >= k / (SKN + 1.0)) if k else sakura
    t = k / SKN
    for dy in range(max(0, (k - 1) * SKRISE + 1), k * SKRISE + 1):
        paint(up(m, dy), lerp((46, 28, 78), (170, 52, 92), t) + (255,))
    top = up(m, k * SKRISE)
    paint(top, lerp((30, 20, 58), (86, 30, 64), t ** 1.3) + (255,))
    oc = lerp((120, 150, 255), (255, 92, 150), min(1, t * 1.5))
    paint(edge(top) & inner, oc + (int(140 + 100 * t),)); paint(edge(top) & inner, oc + (int(30 + 80 * t),), lights)
paint(edge(sakura) & inner & ~osu, (150, 236, 255, 255))
cg, cgd = new_layer(); cgd.ellipse([SKX - 26, -16, SKX + 26, 12], fill=(255, 70, 40, 170)); comp(cg.filter(ImageFilter.GaussianBlur(7)))
ld.ellipse([SKX - 9, -6, SKX + 9, 4], fill=(255, 110, 50, 230))
for pts in ([(0, 4), (-10, 18), (-26, 34), (-40, 50)], [(4, 4), (16, 20), (34, 36), (50, 48)], [(0, 6), (2, 26), (-4, 46)]):      # 溶岩の筋
    g = [(SKX + px, SKY - 8 + py) for px, py in pts]
    d.line(smooth(g, 2), fill=(255, 96, 60, 190), width=1); ld.line(smooth(g, 2), fill=(255, 80, 50, 120), width=1)

# 舞台の外（大隅半島）は、少し暗く沈める
paint(osu & ~sakura, (4, 4, 22, 70))

# ---------- 海の上: 航路・船・イルカ ----------
for route in ([(130.573, 31.556), (130.63, 31.532), (130.698, 31.497)], [(130.649, 31.204), (130.70, 31.202), (130.766, 31.205)]):      # 鴨池〜垂水、山川〜根占のフェリー
    dash(d, smooth(PP(route), 2), (120, 235, 255, 190), 4, 4)


def ship(x, y, s=1, col=(236, 240, 255)):
    d.polygon([(x - 6 * s, y), (x + 5 * s, y), (x + 8 * s, y - 2), (x - 6 * s, y - 2)], fill=col + (255,))
    d.rectangle([min(x - 3 * s, x + 2 * s), y - 4, max(x - 3 * s, x + 2 * s), y - 3], fill=(170, 180, 230, 255)); d.point((x + 1 * s, y - 5), fill=RED + (255,))
    d.line([(x - 8 * s, y + 1), (x - 15 * s, y + 2)], fill=(150, 230, 255, 150)); ld.point((x, y - 3), fill=AMBER + (220,))


sx0, sy0 = P(130.640, 31.528); ship(sx0, sy0)
sx1, sy1 = P(130.69, 31.2025); ship(sx1, sy1 + 2, -1)
for (x0, y0) in ((330, 200), (480, 110), (610, 190), (520, 380), (300, 60), (150, 500), (90, 470), (420, 520)):      # 漁船の明かり
    d.point((x0, y0), fill=AMBER + (255,)); d.point((x0 + 1, y0), fill=(255, 255, 255, 200)); ld.point((x0, y0), fill=AMBER + (200,))
    d.line([(x0 - 5, y0 + 1), (x0 - 1, y0 + 1)], fill=(150, 230, 255, 110))
for (x0, y0, s) in ((352, 236, 1), (368, 243, 1), (338, 247, -1)):      # 錦江湾のイルカ（水の上へ跳ねたところ）
    body = [(x0 - 6 * s, y0 + 1), (x0 - 3 * s, y0 - 2), (x0 + 1 * s, y0 - 3), (x0 + 5 * s, y0 - 1), (x0 + 7 * s, y0 + 2)]
    d.line(body, fill=(170, 240, 255, 255), width=2); ld.line(body, fill=(170, 240, 255, 130), width=1)
    d.line([(x0 - 1 * s, y0 - 3), (x0 - 2 * s, y0 - 6)], fill=(170, 240, 255, 255))                      # 背びれ
    d.line([(x0 - 6 * s, y0 + 1), (x0 - 9 * s, y0 - 1)], fill=(170, 240, 255, 255)); d.line([(x0 - 6 * s, y0 + 1), (x0 - 9 * s, y0 + 3)], fill=(170, 240, 255, 255))      # 尾びれ
    d.line([(x0 - 8, y0 + 5), (x0 + 9, y0 + 5)], fill=(120, 200, 255, 120)); d.point((x0 + 9 * s, y0 + 4), fill=(230, 250, 255, 255))

# ---------- 光のにじみ ----------
black = Image.new('RGBA', (W, H), (0, 0, 0, 255))
g1 = Image.alpha_composite(black, lights.filter(ImageFilter.GaussianBlur(4))).convert('RGB')
g2 = Image.alpha_composite(black, lights.filter(ImageFilter.GaussianBlur(1.2))).convert('RGB')
base = ImageChops.add(ImageChops.add(base, g1), g2.point(lambda v: v // 2))
d = ImageDraw.Draw(base, 'RGBA')

# 桜島の噴煙（東へ流れる）と、指宿の湯けむり
sm, smd = new_layer()
for i in range(34):
    t = i / 33.0; px = SKX + 8 + 120 * t + rnd.randint(-4, 4); py = 2 + 22 * t ** 0.7 + rnd.randint(-3, 3) * (1 + t); r0 = 6 + 13 * t
    smd.ellipse([px - r0, py - r0 * 0.6, px + r0, py + r0 * 0.6], fill=lerp((170, 96, 116), (76, 66, 106), min(1, t * 2)) + (int(150 - 80 * t),))
SUNA = P(130.654, 31.229)
for i in range(16):
    px = SUNA[0] + rnd.randint(-5, 6); py = SUNA[1] + rnd.randint(-16, 10); r0 = rnd.randint(2, 5)
    smd.ellipse([px - r0, py - r0 * 0.8 - 6, px + r0, py + r0 * 0.8 - 6], fill=(255, 236, 244, rnd.randint(60, 120)))
comp(sm.filter(ImageFilter.GaussianBlur(1.6)))
for k in range(3):      # 温泉のしるし（3 本の湯気）
    hx = SUNA[0] + 10 + k * 3
    d.line([(hx, SUNA[1] + 2), (hx - 1, SUNA[1] - 1), (hx + 1, SUNA[1] - 4), (hx, SUNA[1] - 7)], fill=(255, 190, 220, 255))
d.arc([SUNA[0] + 7, SUNA[1] - 1, SUNA[0] + 19, SUNA[1] + 6], 0, 180, fill=(255, 190, 220, 255))

# ---------- 作戦図らしく: うすい方眼・走査線・方位・四隅のかぎ・まわりを暗く ----------
ho, hd = new_layer()
for x in range(0, W, 40):
    hd.line([(x, 0), (x, H)], fill=(120, 220, 255, 13 if x % 200 else 30))
for y in range(20, H, 40):
    hd.line([(0, y), (W, y)], fill=(120, 220, 255, 13 if (y - 20) % 200 else 30))
for y in range(0, H, 3):
    hd.line([(0, y), (W, y)], fill=(0, 0, 20, 20))
for (x, y, sx, sy) in ((6, 6, 1, 1), (W - 7, 6, -1, 1), (6, H - 7, 1, -1), (W - 7, H - 7, -1, -1)):
    hd.line([(x, y), (x + 26 * sx, y)], fill=(160, 230, 255, 200)); hd.line([(x, y), (x, y + 26 * sy)], fill=(160, 230, 255, 200))
NX, NY = 46, 490      # 方位（北が上）。左下の海に
hd.ellipse([NX - 13, NY - 13, NX + 13, NY + 13], outline=(150, 226, 255, 170))
hd.polygon([(NX, NY - 17), (NX - 5, NY + 2), (NX, NY - 2), (NX + 5, NY + 2)], fill=(240, 250, 255, 240))
hd.polygon([(NX, NY + 12), (NX - 4, NY + 1), (NX, NY + 4), (NX + 4, NY + 1)], fill=(90, 150, 200, 200))
for seg in (((NX - 3, NY - 22), (NX - 3, NY - 29)), ((NX - 3, NY - 29), (NX + 3, NY - 22)), ((NX + 3, NY - 22), (NX + 3, NY - 29))):
    hd.line(seg, fill=(240, 250, 255, 240))
comp(ho)
vg = Image.new('L', (W, H), 0); ImageDraw.Draw(vg).ellipse([-170, -130, W + 170, H + 130], fill=255)
vg = vg.filter(ImageFilter.GaussianBlur(90))
dark = Image.new('RGBA', (W, H), (4, 2, 16, 255)); dark.putalpha(vg.point(lambda v: int((255 - v) * 0.40)))
comp(dark)

out = base.convert('RGB')
if len(sys.argv) > 1:
    out.save(sys.argv[1])
path = os.path.join(HERE, 'js', '09_map2_art.js')
if os.path.isdir(os.path.dirname(path)):
    buf = io.BytesIO(); out.save(buf, 'WEBP', quality=90, method=6)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// make_world_map2.py が生成したファイル（手で編集しない）。第2章のマップ（62_map.js）の下絵（960x540）\n'
                'window.REBELL_MAP2 = "data:image/webp;base64,%s";\n' % base64.b64encode(buf.getvalue()).decode('ascii'))
    print('map2', out.size, len(buf.getvalue()) // 1024, 'KB ->', path)
else:
    print('map2', out.size, '(js は書き出していない)', 'KATOP', [round(v) for v in KATOP], 'ZOO', [round(v) for v in ZOO])

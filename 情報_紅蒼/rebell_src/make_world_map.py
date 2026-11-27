# -*- coding: utf-8 -*-
"""ステージを選ぶ全体マップ（62_map.js）の下絵を描いて、js/09_map_art.js を作る。
使い方:  python rebell_src/make_world_map.py [確認用の PNG の出力先]

サイバーパンクの鹿児島市を、北を上にして真上から見た作戦図（960x540 のドット絵。ゲームでは 2 倍に拡大して出す）。
  左 = 市街地（甲突川・鹿児島中央駅・天文館・城山・鹿児島駅）、中央 = 錦江湾、右 = 桜島。
  建物・台地・桜島は、高さのぶんだけ上へずらして重ねて描く（立体の模型を、少し南から見下ろした見た目）。
ステージの場所:
  第一章の水道橋 = 左下の台地から甲突川を越えて城山のふもとへ渡る高架の水路、第二章の鉄塔 = 城山の上、
  第三章の航路 = 鉄塔のてっぺんから右上へ（城山の上を越えて学園の真上まで）、第四章の学園 = 北の玉龍学園（紅い結界のドーム）。
道のり・マス・ピン・地名の文字は、ここでは描かない（ゲームの中で描く）。
道のりの座標は 62_map.js の PATH と合わせてある（この下の AQ・TX/TY/TT・ROUTE・DOME を直したら、PATH も直す）。
"""
import base64, io, math, os, random, sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 960, 540
rnd = random.Random(11)
PINK, CYAN, AMBER, RED = (255, 79, 176), (55, 230, 255), (255, 214, 120), (255, 60, 90)

# 実際の位置（鹿児島中央駅から東・北へ何 km か）→ 下絵の座標。横は少し引きのばしてある
SX, SY, OX, OY = 150.0, 118.0, 215.0, 420.0


def P(x, y):
    return (OX + SX * x, OY - SY * y)


def PP(pts):
    return [P(x, y) for x, y in pts]


# ---------- ステージの場所（62_map.js の PATH と合わせる） ----------
AQ = [(6, 532), (297, 262)]                     # 第一章: 水道橋（左下の台地 → 甲突川を越えて城山のふもと）
TX, TY, TT = 297, 262, 100                      # 第二章: 鉄塔（城山の上）（足もと x, y, てっぺんの y）
ROUTE = [(297, 100), (340, 70), (395, 48), (446, 38), (480, 46)]      # 第三章: 飛空艇の航路
DOME = (480, 124, 66, 34, 58)                   # 第四章: 学園の結界（中心 x, y, 横の半径, 縦の半径, 高さ）


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


def seg_dist(ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = np.clip(((X - ax) * vx + (Y - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(X - (ax + t * vx), Y - (ay + t * vy)), t


def poly_dist(pts):
    dd = np.full((H, W), 1e9, np.float32)
    for a, b in zip(pts, pts[1:]):
        dd = np.minimum(dd, seg_dist(a[0], a[1], b[0], b[1])[0])
    return dd


# ---------- 地形: 陸・海・桜島 ----------
COAST = [(3.27, 3.6), (3.0, 2.9), (2.85, 2.6), (2.98, 2.5), (2.95, 2.3), (2.75, 2.25), (2.7, 2.2), (2.6, 2.05),      # 磯の崖 → 祇園之洲
         (2.58, 1.98), (2.95, 1.86), (2.92, 1.74), (2.52, 1.84), (2.5, 1.7),                                        # 北ふ頭・桜島フェリー乗り場
         (2.52, 1.62), (2.85, 1.5), (2.82, 1.36), (2.47, 1.42), (2.42, 1.2), (2.36, 0.95),                          # 水族館・ウォーターフロント
         (2.36, 0.85), (2.75, 0.72), (2.72, 0.56), (2.33, 0.62), (2.3, 0.3),                                        # 南ふ頭
         (2.3, 0.2), (2.62, 0.1), (2.6, -0.15), (2.26, -0.1), (2.22, -0.5), (2.15, -0.9), (2.1, -1.2)]              # 新港 → 甲突川の河口
coast_px = PP(COAST)
land = poly_mask([(-5, -5)] + coast_px + [(coast_px[-1][0], H + 5), (-5, H + 5)])

# 桜島: 高さの場（北岳と南岳の 2 つの峰）。等高線の板を 3 ドットずつ上へずらして重ねる
SCX, SCY, SRX, SRY = 890.0, 262.0, 122.0, 132.0
_dx, _dy = (X - SCX) / SRX, (Y - SCY) / SRY
_th = np.arctan2(_dy, _dx)
_wob = (1 + 0.05 * np.cos(3 * (_th - np.pi)) + 0.04 * np.cos(5 * (_th - 2.6)) + 0.018 * np.cos(9 * (_th - 1.0)) + 0.010 * np.cos(14 * (_th - 0.3)))
_rr = np.hypot(_dx, _dy) / _wob
island = _rr < 1
NORTH, SOUTH = (886, 236), (892, 286)      # 北岳・南岳（地面の位置）
_north = np.exp(-(((X - NORTH[0]) / 30) ** 2 + ((Y - NORTH[1]) / 26) ** 2))
_south = np.exp(-(((X - SOUTH[0]) / 27) ** 2 + ((Y - SOUTH[1]) / 24) ** 2))
hs = 0.46 * np.clip(1 - _rr, 0, 1) ** 0.9 + 0.60 * np.maximum(_north, 0.95 * _south) + 0.05 * (noise(34, 5) - 0.5)
SN, SSTEP, SRISE = 12, 0.08, 3


def s_rise(x, y):
    """桜島の上の点が、絵の中でどれだけ上へずれるか"""
    xi, yi = int(min(W - 1, max(0, x))), int(min(H - 1, max(0, y)))
    if not island[yi, xi]:
        return 0
    return SRISE * int(min(SN, max(0, hs[yi, xi] / SSTEP)))


# 川
KOT = smooth(PP([(-1.45, 3.1), (-0.8, 2.3), (-0.43, 1.52), (-0.25, 1.0), (-0.09, 0.63), (0.28, 0.22), (0.62, -0.31), (1.19, -0.75), (1.7, -1.05)]), 3)      # 甲突川
INA = smooth(PP([(0.95, 3.6), (1.15, 3.0), (1.25, 2.5), (1.5, 2.15), (2.0, 2.1), (2.45, 2.2), (2.7, 2.2)]), 3)                                            # 稲荷川
dK, dI = poly_dist(KOT), poly_dist(INA)
KX, KY = [p[0] for p in KOT], [p[1] for p in KOT]

# 台地と城山: 高さの場（0〜1）。3 段の板を 2 ドットずつ上へずらして重ねる
n1, n2 = noise(110, 21, 2), noise(30, 22, 3)
pw = np.clip((66 + 80 * (n1 - 0.5) + 0.16 * np.clip(Y - 300, 0, 999) - X) / 20, 0, 1) * np.clip(dK / 36 - 0.25, 0, 1)            # 西の台地（武岡・原良）
_e = ((X - 480) / 96) ** 2 + ((Y - 116) / 70) ** 2
pn = np.clip((84 + 70 * (n1 - 0.5) - Y) / 18, 0, 1) * np.clip(dK / 36 - 0.25, 0, 1) * np.clip(dI / 16 - 0.35, 0, 1) * np.clip((_e - 1) * 3, 0, 1)      # 北の台地（吉野・坂元）。学園は谷あいに
_ds, _ts = seg_dist(284, 288, 372, 158)
shiro = np.clip(1 - _ds / (36 - 9 * _ts), 0, 1)
_dn, _tn = seg_dist(372, 158, 388, 112)
shiro = np.maximum(shiro, np.clip(1 - _dn / 17, 0, 1) * 0.75)                                 # 北の台地へつながる尾根
taga = np.clip(1 - np.hypot((X - 588) / 24, (Y - 122) / 20), 0, 1)                            # 多賀山
hl = np.maximum(np.maximum(pw, pn), np.maximum(shiro * 1.15, taga))
hl = np.clip(hl + 0.22 * (n2 - 0.5) * (hl > 0.06), 0, 1) * land
LTHR = (0.26, 0.48, 0.70, 0.90)

# ---------- 下地: 海 ----------
solid = land | island
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


# 紅い月の映りこみ（錦江湾の北）
MOON = (752, 70, 30)
ml, md = new_layer()
md.ellipse([MOON[0] - MOON[2], MOON[1] - MOON[2], MOON[0] + MOON[2], MOON[1] + MOON[2]], fill=(214, 34, 70, 235))
md.ellipse([MOON[0] - 20, MOON[1] - 18, MOON[0] - 2, MOON[1] - 4], fill=(236, 70, 96, 235))
for yy in range(MOON[1] - MOON[2], MOON[1] + MOON[2] + 44, 1):      # さざ波で、横に切れる
    k = (yy - (MOON[1] - MOON[2])) / (2.0 * MOON[2])
    if (yy % 4 == 3) or (k > 0.55 and yy % 3 == 0) or (k > 0.85 and yy % 2 == 0):
        md.line([(MOON[0] - 60, yy), (MOON[0] + 60, yy)], fill=(0, 0, 0, 0))
for i in range(26):      # 下へのびる、ゆらめき
    yy = MOON[1] + MOON[2] + 2 + i * 2; w = max(2, 24 - i) + rnd.randint(-3, 3)
    md.line([(MOON[0] - w + rnd.randint(-4, 4), yy), (MOON[0] + w + rnd.randint(-4, 4), yy)], fill=(214, 34, 70, max(0, 150 - i * 6)))
mg, mgd = new_layer(); mgd.ellipse([MOON[0] - 52, MOON[1] - 52, MOON[0] + 52, MOON[1] + 62], fill=(255, 40, 80, 70))
comp(mg.filter(ImageFilter.GaussianBlur(20))); comp(ml)

# 海の等深線と、さざ波
for thr, a in ((0.34, 60), (0.15, 40), (0.05, 24)):
    paint(edge(near > thr) & ~solid, (90, 200, 255, a))
for _ in range(620):
    x0, y0 = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
    if not solid[y0, x0]:
        d.line([(x0, y0), (x0 + rnd.randint(2, 7), y0)], fill=rnd.choice([(70, 150, 255), (90, 220, 255), (255, 90, 160)]) + (rnd.randint(26, 70),))

# ---------- 陸の下地・台地 ----------
paint(land, (27, 19, 56, 255))
gnd = noise(14, 3, 2)
paint(land & (gnd > 0.56), (33, 23, 66, 255))
cover = np.zeros((H, W), bool)      # 台地の板が覆うところ（街のビルは置かない）
NL = len(LTHR)
forest = (shiro > 0.05) | (taga > 0.05)      # 城山と多賀山は、森の色に
for k, thr in enumerate(LTHR, 1):
    m = (hl >= thr); t = k / NL
    for dy in range((k - 1) * 2 + 1, k * 2 + 1):
        paint(up(m, dy), lerp((18, 58, 64), (40, 110, 104), t) + (255,))      # 崖
        paint(up(m & forest, dy), lerp((16, 70, 56), (44, 132, 92), t) + (255,))
    top = up(m, k * 2)
    paint(top, lerp((12, 30, 44), (20, 50, 62), t) + (255,))
    paint(up(m & forest, k * 2), lerp((10, 40, 36), (22, 78, 58), t) + (255,))
    paint(edge(top), lerp((40, 110, 120), (110, 220, 200), t) + (int(120 + 90 * t),))
    cover |= top | up(m, (k - 1) * 2)
hill_top = up(hl >= LTHR[0], 2)
for _ in range(9000):      # 木立ち（城山と台地のふち）と、台地の住宅の明かり
    x0, y0 = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
    if not hill_top[y0, x0]:
        continue
    yg = min(H - 1, y0 + 4)
    if forest[yg, x0]:
        if rnd.random() < 0.8:
            d.point((x0, y0), fill=rnd.choice([(8, 34, 30), (30, 96, 70), (16, 62, 50), (52, 140, 100), (8, 34, 30)]) + (235,))
    elif hl[yg, x0] < LTHR[1] + 0.06:      # 台地のふちは木立ち
        if rnd.random() < 0.5:
            d.point((x0, y0), fill=rnd.choice([(10, 40, 40), (26, 80, 72), (16, 56, 54)]) + (220,))
    elif rnd.random() < 0.22:      # 台地の上は住宅地
        c = rnd.choice([AMBER, AMBER, (255, 170, 120), CYAN]) + (rnd.randint(90, 200),)
        d.point((x0, y0), fill=c)
        if rnd.random() < 0.25:
            ld.point((x0, y0), fill=c)

# ---------- 川 ----------
for pts, wd in ((KOT, 11), (INA, 5)):
    d.line(pts, fill=(14, 40, 40, 255), width=wd, joint='curve')            # 川べりの緑
d.line(KOT, fill=(14, 62, 132, 255), width=6, joint='curve'); d.line(KOT, fill=(52, 190, 250, 255), width=2, joint='curve')
d.line(INA, fill=(14, 62, 132, 255), width=3, joint='curve'); d.line(INA, fill=(52, 190, 250, 230), width=1, joint='curve')
ld.line(KOT, fill=(52, 190, 250, 110), width=2, joint='curve'); ld.line(INA, fill=(52, 190, 250, 70), width=1, joint='curve')
for (x0, y0, ux, uy) in walk(KOT, 9):
    if rnd.random() < 0.5:
        d.point((x0 + rnd.randint(-2, 2), y0 + rnd.randint(-1, 1)), fill=(200, 250, 255, 230))

# 岸の線（陸と海の境目を、はっきり）
paint(edge(land) & (X < W - 1) & (Y > 0) & (Y < H - 1) & (X > 0), (140, 238, 255, 255))
paint(edge(land), (90, 220, 255, 150), lights)

# ---------- 道路・線路・市電 ----------
ROADS = [
    [(0.1, 0.0), (0.65, -0.2), (1.3, -0.38), (2.25, -0.5)],                              # ナポリ通り・パース通り
    [(0.95, 1.05), (1.42, 0.92), (2.33, 0.7)],                                           # 照国通り
    [(1.15, 1.32), (1.5, 1.2), (2.38, 1.02)],                                            # 朝日通り
    [(2.07, 1.95), (2.45, 2.25), (2.8, 2.75), (3.05, 3.3)],                              # 国道 10 号（磯へ）
    [(1.05, 0.55), (0.7, 0.95), (0.2, 1.25), (-0.25, 1.75), (-0.7, 2.5), (-1.05, 3.2)],  # 国道 3 号（甲突川の東）
    [(2.07, 1.95), (2.3, 1.2), (2.25, 0.4), (2.15, -0.5), (2.05, -1.25)],                # 港ぞいの道
    [(0.0, 0.0), (-0.6, -0.12), (-1.5, -0.3)],                                           # 西口から武岡へ
    [(1.31, 0.74), (1.75, 0.2), (2.0, -0.4), (2.0, -1.25)],                              # 天文館から南へ
    [(0.3, 0.22), (0.5, -0.3), (0.75, -0.8), (0.9, -1.25)],                              # 甲突川の西岸
]
TO_SCHOOL = PP([(2.07, 1.95), (1.95, 2.12), (1.85, 2.32)])                               # 鹿児島駅から学園へ（橋は結界で塞がれている）
TRAMS = [[(2.07, 1.95), (1.62, 1.50), (1.5, 1.2), (1.42, 0.92), (1.31, 0.74), (1.05, 0.55), (0.6, 0.38), (0.3, 0.22), (0.08, 0.05), (0.1, -0.4), (0.2, -0.8), (0.32, -1.25)],
         [(1.05, 0.55), (1.0, 0.1), (1.02, -0.35), (1.15, -0.75), (1.22, -1.25)]]
JR = [[(0.05, -1.3), (0.02, -0.5), (0.0, 0.0), (-0.02, 0.35), (-0.08, 0.62)],
      [(-0.08, 0.62), (-0.38, 1.05), (-0.6, 1.55), (-0.95, 2.25), (-1.3, 2.8), (-1.5, 3.0)],
      [(-0.08, 0.62), (0.15, 1.0), (0.38, 1.3)],
      [(1.3, 2.0), (1.7, 2.0), (2.07, 1.95), (2.45, 2.3), (2.75, 2.8), (3.0, 3.4)]]
TUNNEL = PP([(0.38, 1.3), (1.3, 2.0)])
SHIN = PP([(-1.5, 0.12), (-0.7, 0.06), (0.0, 0.0)])
roads_px = [smooth(PP(r), 2) for r in ROADS] + [TO_SCHOOL]
trams_px = [smooth(PP(r), 1) for r in TRAMS]
jr_px = [smooth(PP(r), 2) for r in JR]


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


for r in roads_px:
    d.line(r, fill=(9, 6, 24, 255), width=4, joint='curve')
for r in roads_px:
    d.line(r, fill=PINK + (170,), width=1); ld.line(r, fill=PINK + (70,), width=1)
for r in jr_px + [SHIN]:
    d.line(r, fill=(9, 6, 24, 255), width=3, joint='curve')
for r in jr_px:
    dash(d, r, (214, 208, 244, 255), 3, 2)
dash(d, TUNNEL, (150, 144, 190, 150), 1, 3)                               # 城山のトンネル
d.line(SHIN, fill=(170, 240, 255, 255), width=1); ld.line(SHIN, fill=(170, 240, 255, 110), width=1)
for r in trams_px:      # 市電（芝生の軌道）
    d.line(r, fill=(9, 6, 24, 255), width=4, joint='curve')
for r in trams_px:
    d.line(r, fill=(120, 255, 150, 255), width=1); ld.line(r, fill=(120, 255, 150, 130), width=1)

for r, us in ((trams_px[0], (0.16, 0.43, 0.71, 0.9)), (trams_px[1], (0.5,))):      # 市電の車両
    w_ = walk(r, 2)
    for u in us:
        x0, y0, ux, uy = w_[int(u * (len(w_) - 1))]
        d.line([(x0 - ux * 2, y0 - uy * 2), (x0 + ux * 2, y0 + uy * 2)], fill=(255, 246, 150, 255), width=2); ld.point((x0, y0), fill=(255, 246, 150, 220))

# ---------- 街のビル（斜めの碁盤の目。高さのぶん、上へ伸ばす） ----------
ko = Image.new('L', (W, H), 0); kd = ImageDraw.Draw(ko)      # ビルを置かないところ
for r in roads_px + trams_px:
    kd.line(r, fill=255, width=5)
for r in jr_px + [SHIN]:
    kd.line(r, fill=255, width=4)
kd.line(KOT, fill=255, width=13); kd.line(INA, fill=255, width=7)
kd.line(AQ, fill=255, width=16)
kd.ellipse([DOME[0] - DOME[2] - 6, DOME[1] - DOME[3] - 6, DOME[0] + DOME[2] + 6, DOME[1] + DOME[3] + 8], fill=255)
kd.rectangle([196, 392, 262, 446], fill=255)                               # 鹿児島中央駅
kd.rectangle([512, 180, 540, 200], fill=255)                               # 鹿児島駅
flat = land & ~cover & ~(np.asarray(ko) > 0)


def is_flat(x, y):
    xi, yi = int(round(x)), int(round(y))
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return xi < 600
    return bool(flat[yi, xi])


def b_height(cx, cy):
    t = math.exp(-((cx - 411) ** 2 + (cy - 333) ** 2) / (2 * 62.0 ** 2))      # 天文館
    c = math.exp(-((cx - 236) ** 2 + (cy - 428) ** 2) / (2 * 42.0 ** 2))      # 鹿児島中央駅
    k = math.exp(-((cx - 522) ** 2 + (cy - 200) ** 2) / (2 * 34.0 ** 2))      # 鹿児島駅
    h = 1.2 + 6.0 * t + 4.2 * c + 2.2 * k + rnd.random() * 2.4
    if rnd.random() < 0.02 + 0.16 * t + 0.10 * c:      # 高いビル
        h += rnd.randint(5, 11)
    return h, t, c


blocks = []
for (ox, oy), ang, pa, pb, south in (((411, 333), 30, (8, 12), (9, 15), False), ((215, 420), 13, (8, 13), (10, 16), True)):
    bx, by = math.cos(math.radians(ang)), math.sin(math.radians(ang)); ax, ay = -by, bx
    A = [-760]; B = [-760]
    while A[-1] < 760:
        A.append(A[-1] + rnd.randint(*pa))
    while B[-1] < 760:
        B.append(B[-1] + rnd.randint(*pb))
    for i in range(len(A) - 1):
        for j in range(len(B) - 1):
            a0, a1, b0, b1 = A[i], A[i + 1] - 2, B[j], B[j + 1] - 2
            cuts = [(b0, b1)]
            if b1 - b0 > 11 and rnd.random() < 0.3:      # 1 つの街区を、2 つの建物に
                m = (b0 + b1) / 2 + rnd.randint(-1, 1); cuts = [(b0, m - 1), (m + 1, b1)]
            for c0, c1 in cuts:
                quad = [(ox + ax * u + bx * v, oy + ay * u + by * v) for u, v in ((a0, c0), (a0, c1), (a1, c1), (a1, c0))]
                cx, cy = sum(p[0] for p in quad) / 4, sum(p[1] for p in quad) / 4
                if cx < -20 or cy < -20 or cx > W + 20 or cy > H + 20:
                    continue
                if (cy > float(np.interp(cx, KX, KY))) != south:
                    continue
                if not all(is_flat(px, py) for px, py in quad + [(cx, cy)]):
                    continue
                if rnd.random() < 0.05:
                    continue
                blocks.append((max(p[1] for p in quad), quad, cx, cy))
blocks.sort(key=lambda b: b[0])
for _, quad, cx, cy in blocks:
    h, t, c = b_height(cx, cy)
    if rnd.random() < 0.03:      # 公園・空き地
        d.polygon(quad, fill=(14, 42, 38, 255)); continue
    h = int(round(h)); tall = h >= 9
    roof = lerp((27, 20, 60), (46, 34, 96), rnd.random()); roof = lerp(roof, (70, 38, 110), 0.4 * t); roof = lerp(roof, (34, 46, 112), 0.35 * c)
    if rnd.random() < 0.5:      # 街灯（通りの角）
        d.point(quad[rnd.randint(0, 3)], fill=rnd.choice([AMBER, AMBER, (255, 170, 120), PINK]) + (rnd.randint(110, 200),))
    for i in range(4):      # 手前を向いた壁
        p, q = quad[i], quad[(i + 1) % 4]
        mx, my = (p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy
        if my <= 0:
            continue
        wall = (58, 39, 112) if mx > 0 else (31, 21, 68)
        d.polygon([p, q, (q[0], q[1] - h), (p[0], p[1] - h)], fill=wall + (255,))
        L = math.hypot(q[0] - p[0], q[1] - p[1])
        for _ in range(int(L * h / 5.5 * rnd.uniform(0.25, 1.0))):
            u = rnd.random(); wx, wy = p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - rnd.random() * (h - 1) - 0.5
            col = rnd.choice([AMBER, AMBER, AMBER, (255, 170, 120), CYAN, PINK])
            d.point((wx, wy), fill=col + (rnd.randint(150, 255),))
            if rnd.random() < 0.3:
                ld.point((wx, wy), fill=col + (150,))
    top = [(x, y - h) for x, y in quad]
    d.polygon(top, fill=roof + (255,))
    for i in range(4):
        p, q = top[i], top[(i + 1) % 4]
        if (p[1] + q[1]) / 2 - (cy - h) < 0:
            d.line([p, q], fill=lerp(roof, (170, 150, 240), 0.42 if not tall else 0.7) + (255,))
    if tall or rnd.random() < 0.06 + 0.2 * t:      # 屋上のネオン
        col = rnd.choice([PINK, CYAN, PINK, AMBER])
        for i in ((0, 1, 2, 3) if tall and rnd.random() < 0.5 else (rnd.randint(0, 3),)):
            p, q = top[i], top[(i + 1) % 4]
            d.line([p, q], fill=col + (235,)); ld.line([p, q], fill=col + (120,))
        if tall:
            tx, ty = sum(p[0] for p in top) / 4, sum(p[1] for p in top) / 4
            d.point((tx, ty), fill=RED + (255,)); ld.point((tx, ty), fill=RED + (200,))
    elif rnd.random() < 0.25:
        tx, ty = sum(p[0] for p in top) / 4, sum(p[1] for p in top) / 4
        d.point((tx + rnd.randint(-1, 1), ty + rnd.randint(-1, 1)), fill=rnd.choice([AMBER, CYAN, (200, 170, 255)]) + (190,))

# 天文館のアーケード（明るい通り）
for ang, n in ((30, 3), (120, 2)):
    ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang)); vx, vy = -uy, ux
    for k in range(n):
        o = (k - (n - 1) / 2) * 15; L = 34 - 6 * abs(k - (n - 1) / 2)
        p = (411 + vx * o - ux * L, 325 + vy * o - uy * L); q = (411 + vx * o + ux * L, 325 + vy * o + uy * L)
        col = CYAN if ang == 30 else PINK
        d.line([p, q], fill=(255, 255, 255, 110), width=3); d.line([p, q], fill=col + (255,), width=1); ld.line([p, q], fill=col + (200,), width=2)
tg, tgd = new_layer(); tgd.ellipse([411 - 44, 327 - 30, 411 + 44, 327 + 30], fill=(255, 60, 170, 60)); tgd.ellipse([236 - 30, 424 - 22, 236 + 30, 424 + 22], fill=(60, 200, 255, 44))
comp(tg.filter(ImageFilter.GaussianBlur(16)))      # 繁華街の明るさ（天文館は桃色、中央駅は水色）

# ---------- 目印の建物 ----------
# 鹿児島中央駅（線路に沿った駅舎・駅ビルと観覧車）
d.rectangle([200, 396, 208, 448], fill=(50, 44, 96, 255), outline=(150, 140, 210, 255))
d.rectangle([222, 396, 229, 448], fill=(50, 44, 96, 255), outline=(150, 140, 210, 255))
for yy in range(399, 447, 4):
    d.point((204, yy), fill=AMBER + (230,)); d.point((225, yy), fill=CYAN + (230,))
d.polygon([(231, 414), (255, 414), (255, 432), (231, 432)], fill=(22, 14, 50, 255))
d.rectangle([231, 406, 255, 426], fill=(74, 56, 132, 255), outline=(190, 170, 250, 255))
for xx in range(234, 254, 3):
    d.point((xx, 429), fill=AMBER + (255,)); ld.point((xx, 429), fill=AMBER + (200,))
WH = (246, 393, 13)      # 観覧車
for dr, a in ((d, 255), (ld, 190)):
    dr.line([(WH[0], WH[1]), (WH[0] - 6, 408)], fill=(170, 160, 220, a)); dr.line([(WH[0], WH[1]), (WH[0] + 6, 408)], fill=(170, 160, 220, a))
    for k in range(8):
        an = k * math.pi / 8
        dr.line([(WH[0] - math.cos(an) * WH[2], WH[1] - math.sin(an) * WH[2]), (WH[0] + math.cos(an) * WH[2], WH[1] + math.sin(an) * WH[2])], fill=(255, 150, 215, 130 if dr is d else 60))
    dr.ellipse([WH[0] - WH[2], WH[1] - WH[2], WH[0] + WH[2], WH[1] + WH[2]], outline=PINK + (a,))
    for k in range(12):
        an = k * math.pi / 6
        dr.point((WH[0] + math.cos(an) * WH[2], WH[1] + math.sin(an) * WH[2]), fill=(CYAN if k % 2 else AMBER) + (255,))
# 鹿児島駅
d.rectangle([514, 184, 538, 192], fill=(56, 46, 104, 255), outline=(160, 150, 220, 255))
for xx in range(517, 537, 4):
    d.point((xx, 195), fill=AMBER + (230,))
# 水族館（ふ頭の上の丸い屋根）と、フェリー乗り場
d.ellipse([618, 232, 636, 246], fill=(24, 70, 110, 255), outline=(120, 230, 255, 255)); d.arc([621, 234, 633, 244], 200, 340, fill=(220, 250, 255, 255))
ld.ellipse([618, 232, 636, 246], outline=(120, 230, 255, 140))
d.rectangle([596, 205, 612, 211], fill=(60, 50, 108, 255), outline=(170, 160, 226, 255))
# ふ頭の倉庫と明かり
for (x0, y0, x1, y1) in ((612, 190, 646, 198), (585, 327, 616, 338), (566, 404, 598, 418)):
    for xx in range(x0, x1, 8):
        d.rectangle([xx, y0 + (xx - x0) * 0.26, xx + 5, y0 + (xx - x0) * 0.26 + 4], fill=(44, 36, 86, 255), outline=(120, 110, 180, 255))
    d.point((x1, y1), fill=AMBER + (255,)); ld.point((x1, y1), fill=AMBER + (220,))
# 沖の防波堤
for a, b in (((666, 250), (672, 300)), ((652, 356), (650, 392))):
    d.line([a, b], fill=(120, 130, 190, 255), width=2); d.point(a, fill=RED + (255,)); d.point(b, fill=(120, 255, 150, 255))

# ---------- 桜島 ----------
for k in range(0, SN + 1):
    m = island & (hs >= k * SSTEP) if k else island
    t = k / SN
    for dy in range(max(0, (k - 1) * SRISE + 1), k * SRISE + 1):
        paint(up(m, dy), lerp((52, 30, 86), (190, 56, 96), t) + (255,))      # 板の側面
    top = up(m, k * SRISE)
    paint(top, lerp((34, 22, 64), (92, 32, 68), t ** 1.3) + (255,))
    oc = lerp((120, 150, 255), (255, 92, 150), min(1, t * 1.6)) if t < 0.75 else lerp((255, 92, 150), (255, 170, 90), (t - 0.75) * 4)
    paint(edge(top), oc + (int(150 + 100 * t),))
    paint(edge(top), oc + (int(40 + 90 * t),), lights)
paint(edge(island) & (X < W - 1), (150, 236, 255, 255)); paint(edge(island) & (X < W - 1), (110, 220, 255, 140), lights)
for _ in range(900):      # 溶岩原のざらつきと、ふもとの集落の明かり
    x0, y0 = rnd.randint(760, W - 1), rnd.randint(120, 400)
    if island[y0, x0]:
        rz = s_rise(x0, y0)
        if hs[y0, x0] < 0.07 and rnd.random() < 0.25:
            d.point((x0, y0 - rz), fill=rnd.choice([AMBER, AMBER, CYAN]) + (rnd.randint(120, 220),))
        else:
            d.point((x0, y0 - rz), fill=rnd.choice([(12, 8, 28), (90, 34, 70), (60, 26, 60)]) + (150,))
CR = (SOUTH[0], SOUTH[1] - s_rise(*SOUTH))      # 南岳の火口（絵の中の位置）
for pts in ([(0, 3), (14, 20), (26, 44), (40, 72)], [(-2, 3), (-16, 18), (-34, 40), (-52, 66)], [(2, 4), (4, 30), (-4, 58)]):      # 溶岩の筋
    g = [(SOUTH[0] + px, SOUTH[1] + py) for px, py in pts]; g = [(x, y - s_rise(x, y)) for x, y in smooth(g, 2)]
    d.line(g, fill=(255, 96, 60, 210), width=1); ld.line(g, fill=(255, 80, 50, 150), width=1)
cg, cgd = new_layer(); cgd.ellipse([CR[0] - 16, CR[1] - 12, CR[0] + 16, CR[1] + 10], fill=(255, 70, 40, 150)); comp(cg.filter(ImageFilter.GaussianBlur(7)))
d.ellipse([CR[0] - 6, CR[1] - 4, CR[0] + 6, CR[1] + 3], fill=(255, 120, 60, 255), outline=(255, 220, 150, 255))
ld.ellipse([CR[0] - 7, CR[1] - 5, CR[0] + 7, CR[1] + 4], fill=(255, 110, 50, 230))
d.rectangle([760, 262, 770, 265], fill=(150, 150, 200, 255))      # 桜島港
for xx in range(772, 790, 4):
    d.point((xx, 268 + (xx % 3)), fill=AMBER + (255,))

# フェリーの航路と船
FERRY = [(600, 216), (640, 232), (700, 250), (764, 264)]
dash(d, smooth(FERRY, 2), (120, 235, 255, 200), 4, 4)


def ship(x, y, s=1, col=(236, 240, 255)):
    d.polygon([(x - 6 * s, y), (x + 5 * s, y), (x + 8 * s, y - 2), (x - 6 * s, y - 2)], fill=col + (255,))
    d.rectangle([min(x - 3 * s, x + 2 * s), y - 4, max(x - 3 * s, x + 2 * s), y - 3], fill=(170, 180, 230, 255)); d.point((x + 1 * s, y - 5), fill=RED + (255,))
    d.line([(x - 8 * s, y + 1), (x - 15 * s, y + 2)], fill=(150, 230, 255, 150)); ld.point((x, y - 3), fill=AMBER + (220,))


ship(668, 242); ship(728, 257, -1); ship(606, 212)
for (x0, y0) in ((690, 330), (720, 180), (640, 420), (700, 470), (690, 140), (744, 372)):
    d.point((x0, y0), fill=AMBER + (255,)); d.point((x0 + 1, y0), fill=(255, 255, 255, 200)); ld.point((x0, y0), fill=AMBER + (200,))
    d.line([(x0 - 5, y0 + 1), (x0 - 1, y0 + 1)], fill=(150, 230, 255, 110))

# ---------- 第一章: 水道橋（台地から鹿児島中央駅へ渡る、高架の水路） ----------
AH = 8      # 橋げたの高さ
(ax0, ay0), (ax1, ay1) = AQ
sl, sd = new_layer(); sd.line([(ax0 + 5, ay0 + AH + 3), (ax1 + 5, ay1 + AH + 3)], fill=(0, 0, 8, 130), width=6); comp(sl.filter(ImageFilter.GaussianBlur(2)))
for (x0, y0, ux, uy) in walk(AQ, 13):      # 橋脚とアーチ
    if x0 < 30:
        continue
    d.rectangle([x0 - 1, y0, x0 + 1, y0 + AH], fill=(66, 58, 112, 255)); d.line([(x0 - 1, y0), (x0 - 1, y0 + AH)], fill=(130, 120, 186, 255))
    d.arc([x0 + 1, y0 + 1, x0 + 12, y0 + 9 - 5], 180, 360, fill=(96, 88, 148, 255))
d.line([(ax0, ay0 + 3), (ax1, ay1 + 3)], fill=(44, 38, 84, 255), width=3)
d.line(AQ, fill=(126, 116, 176, 255), width=7)                                     # 石の水路
d.line([(ax0, ay0 - 3), (ax1, ay1 - 3)], fill=(196, 186, 240, 255), width=1)
d.line(AQ, fill=(22, 112, 190, 255), width=3); d.line(AQ, fill=(110, 236, 255, 255), width=1)      # 水
ld.line(AQ, fill=(70, 220, 255, 150), width=1)
for (x0, y0, ux, uy) in walk(AQ, 26):
    d.point((x0 + 4, y0 - 5), fill=PINK + (255,)); ld.point((x0 + 4, y0 - 5), fill=PINK + (230,))
rl, rd = new_layer()      # 雨（第一章のあたりだけ）
for _ in range(210):
    x0 = rnd.randint(-30, 300); y0 = rnd.randint(300, 540) - x0 * 0.3 + 60
    rd.line([(x0, y0), (x0 + 3, y0 + 8)], fill=(160, 195, 255, 62))
comp(rl)

# ---------- 第四章: 玉龍学園と、紅い結界 ----------
cx, cy, rx, ry, dh = DOME
d.ellipse([cx - rx + 4, cy - ry + 3, cx + rx - 4, cy + ry - 3], fill=(30, 18, 52, 255))      # 敷地
for (bx0, by0, bw, bh2) in ((424, 108, 34, 7), (430, 122, 30, 7), (446, 96, 26, 6), (506, 106, 24, 6)):      # 校舎
    d.rectangle([bx0, by0 + 3, bx0 + bw, by0 + bh2 + 3], fill=(26, 18, 56, 255))
    d.rectangle([bx0, by0, bx0 + bw, by0 + bh2], fill=(92, 76, 150, 255), outline=(200, 184, 250, 255))
    for xx in range(bx0 + 3, bx0 + bw - 1, 4):
        d.point((xx, by0 + bh2 + 2), fill=rnd.choice([AMBER, PINK, CYAN]) + (240,))
d.ellipse([498, 122, 532, 140], outline=(230, 150, 190, 255)); d.ellipse([503, 125, 527, 137], fill=(20, 52, 50, 255))      # グラウンド
for i in range(15):      # 桜の並木（正門から奥へ）
    t = i / 14; px, py = 480 - 36 * t + math.sin(t * 5) * 3, 152 - 52 * t
    for s in (-1, 1):
        q = (px + s * 5, py + s * 1.5)
        d.ellipse([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 1], fill=(255, 150, 204, 255)); d.point(q, fill=(255, 226, 242, 255))
for _ in range(24):
    an = rnd.uniform(math.pi, 2 * math.pi); q = (cx + math.cos(an) * (rx - 10) * rnd.uniform(0.6, 1), cy + math.sin(an) * (ry - 6) * rnd.uniform(0.7, 1))
    d.ellipse([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 1], fill=(255, 150, 204, 235))


def dome_pt(el, az):
    return (cx + rx * math.cos(el) * math.cos(az), cy + ry * math.cos(el) * math.sin(az) - dh * math.sin(el))


dm, dd = new_layer()
N_AZ = 72
ring0 = [dome_pt(0, 2 * math.pi * i / N_AZ) for i in range(N_AZ)]
dmask = Image.new('L', (W, H), 0); dmd = ImageDraw.Draw(dmask)
for i in range(N_AZ):
    for j in range(24):
        az0, az1 = 2 * math.pi * i / N_AZ, 2 * math.pi * (i + 1) / N_AZ; e0, e1 = math.pi / 2 * j / 24, math.pi / 2 * (j + 1) / 24
        dmd.polygon([dome_pt(e0, az0), dome_pt(e0, az1), dome_pt(e1, az1), dome_pt(e1, az0)], fill=255)
dnp = np.asarray(dmask) > 0
paint(dnp, (255, 40, 80, 50))
shade = np.clip((Y - (cy - dh)) / (dh + ry), 0, 1)      # 下ほど濃い
paint(dnp & (shade > 0.62), (255, 40, 80, 26)); paint(dnp & (shade < 0.25), (255, 130, 160, 22))
for az_deg in range(0, 360, 30):      # 経線
    az = math.radians(az_deg); pts = [dome_pt(math.pi / 2 * j / 24, az) for j in range(22)]
    dd.line(pts, fill=(255, 100, 130, 150 if math.sin(az) > -0.1 else 60), width=1)
for el_deg in (30, 58):      # 緯線
    pts = [dome_pt(math.radians(el_deg), 2 * math.pi * i / N_AZ) for i in range(N_AZ + 1)]
    for i in range(N_AZ):
        dd.line([pts[i], pts[i + 1]], fill=(255, 100, 130, 140 if math.sin(2 * math.pi * (i + 0.5) / N_AZ) > 0 else 50))
comp(dm)
paint(edge(dnp), (255, 96, 128, 255)); paint(edge(dnp), (255, 70, 110, 190), lights)
hole = [dome_pt(math.radians(76), 2 * math.pi * i / 24) for i in range(24)]      # てっぺんの切れ目（飛空艇から、ここへ飛び降りる）
d.polygon(hole, fill=(12, 6, 26, 235)); d.line(hole + [hole[0]], fill=(255, 210, 220, 255)); ld.line(hole + [hole[0]], fill=(255, 150, 180, 220))
bx_ = 507; by_ = int(round(float(np.interp(bx_, [p[0] for p in INA], [p[1] for p in INA]))))      # 学園へ渡る橋（結界で塞がれている）
d.line([(bx_ - 5, by_ + 3), (bx_ + 3, by_ - 5)], fill=(170, 160, 214, 255), width=3)
for dr, a in ((d, 255), (ld, 220)):
    dr.line([(bx_ - 6, by_ - 6), (bx_ + 4, by_ + 4)], fill=RED + (a,), width=2); dr.line([(bx_ + 4, by_ - 6), (bx_ - 6, by_ + 4)], fill=RED + (a,), width=2)

# ---------- 光のにじみ ----------
black = Image.new('RGBA', (W, H), (0, 0, 0, 255))
g1 = Image.alpha_composite(black, lights.filter(ImageFilter.GaussianBlur(4))).convert('RGB')
g2 = Image.alpha_composite(black, lights.filter(ImageFilter.GaussianBlur(1.2))).convert('RGB')
base = ImageChops.add(ImageChops.add(base, g1), g2.point(lambda v: v // 2))
d = ImageDraw.Draw(base, 'RGBA')

# 桜島の噴煙（南岳から、北東へ流れる）
sm, smd = new_layer()
for i in range(46):
    t = i / 45; px = CR[0] + 6 + 62 * t + rnd.randint(-4, 4) * (1 + 2 * t); py = CR[1] - 6 - 150 * t ** 0.85 + rnd.randint(-4, 4) * (1 + 2 * t)
    r0 = 5 + 17 * t + rnd.randint(-2, 2)
    smd.ellipse([px - r0, py - r0 * 0.8, px + r0, py + r0 * 0.8], fill=lerp((150, 84, 110), (70, 60, 100), min(1, t * 2.2)) + (int(150 - 80 * t),))
for i in range(30):
    t = i / 29; px = CR[0] + 2 + 60 * t + rnd.randint(-5, 5); py = CR[1] - 10 - 150 * t ** 0.85 + rnd.randint(-6, 3); r0 = 3 + 10 * t
    smd.ellipse([px - r0, py - r0 * 0.7, px + r0, py + r0 * 0.7], fill=lerp((230, 140, 150), (130, 116, 160), min(1, t * 2)) + (int(120 - 60 * t),))
comp(sm.filter(ImageFilter.GaussianBlur(1.6)))

# ---------- 第三章: 雲と、飛空艇の航路 ----------
cl, cd = new_layer()
rpts = walk(ROUTE[:4], 5)
for _ in range(64):      # 航路のすぐ下に、雲の帯
    px, py, ux, uy = rnd.choice(rpts); px += rnd.randint(-12, 12); py += 20 + rnd.randint(-8, 9); r0 = rnd.randint(12, 30)
    cd.ellipse([px - r0, py - r0 * 0.36, px + r0, py + r0 * 0.36], fill=(128, 104, 196, 50))
for _ in range(36):
    px, py, ux, uy = rnd.choice(rpts); px += rnd.randint(-10, 10); py += 16 + rnd.randint(-6, 7); r0 = rnd.randint(7, 18)
    cd.ellipse([px - r0, py - r0 * 0.34, px + r0, py + r0 * 0.34], fill=(206, 180, 255, 46))
comp(cl.filter(ImageFilter.GaussianBlur(2.5)))

# ---------- 第二章: 鉄塔（鹿児島中央駅から、雲の上まで） ----------
def tw(yy):
    return 3.5 + 10.5 * ((yy - TT) / float(TY - TT)) ** 1.5


d.polygon([(TX - 19, TY - 3), (TX + 19, TY - 3), (TX + 19, TY + 9), (TX - 19, TY + 9)], fill=(46, 38, 88, 255), outline=(160, 150, 220, 255))      # 足もとの台
for yy in range(TT, TY - 2, 10):      # 筋かい
    y2 = min(TY - 3, yy + 10)
    d.line([(TX - tw(yy), yy), (TX + tw(y2), y2)], fill=(104, 96, 160, 255)); d.line([(TX + tw(yy), yy), (TX - tw(y2), y2)], fill=(104, 96, 160, 255))
    d.line([(TX - tw(yy), yy), (TX + tw(yy), yy)], fill=(134, 124, 190, 255))
for yy in range(TT, TY - 2):      # 柱
    hw = tw(yy)
    d.point((TX - hw, yy), fill=(210, 200, 250, 255)); d.point((TX - hw + 1, yy), fill=(150, 140, 206, 255))
    d.point((TX + hw, yy), fill=(210, 200, 250, 255)); d.point((TX + hw - 1, yy), fill=(150, 140, 206, 255))
for yy in (TT + 70, TT + 140):      # 途中の足場
    d.rectangle([TX - tw(yy) - 3, yy - 1, TX + tw(yy) + 3, yy + 1], fill=(176, 166, 230, 255))
    d.point((TX - tw(yy) - 3, yy), fill=CYAN + (255,)); d.point((TX + tw(yy) + 3, yy), fill=CYAN + (255,))
d.rectangle([TX - 10, TT - 2, TX + 10, TT + 2], fill=(186, 176, 236, 255), outline=(236, 228, 255, 255))      # てっぺんの足場
d.line([(TX, TT - 24), (TX, TT - 2)], fill=(220, 212, 255, 255))                                               # アンテナ
gl, gd = new_layer()
for yy in (TT - 24, TT + 35, TT + 105, TT + 175):
    d.rectangle([TX - 1, yy - 1, TX + 1, yy + 1], fill=(255, 60, 80, 255)); gd.ellipse([TX - 5, yy - 5, TX + 5, yy + 5], fill=(255, 50, 70, 150))
comp(gl.filter(ImageFilter.GaussianBlur(2.5)))
cl2, cd2 = new_layer()      # 塔にかかる雲の輪
for _ in range(22):
    px = TX + rnd.randint(-46, 46); py = int(TT + (TY - TT) * 0.5) + rnd.randint(-9, 9); r0 = rnd.randint(12, 26)
    cd2.ellipse([px - r0, py - r0 * 0.34, px + r0, py + r0 * 0.34], fill=(190, 166, 250, 60))
comp(cl2.filter(ImageFilter.GaussianBlur(2)))


def airship(x, y, s=1.0, big=False):
    w0, h0 = int(15 * s), int(5 * s)
    d.ellipse([x - w0, y - h0, x + w0, y + h0], fill=(74, 64, 128, 255), outline=(214, 204, 255, 255))
    d.line([(x - w0 + 3, y - 1), (x + w0 - 3, y - 1)], fill=CYAN + (255,))
    d.polygon([(x - w0, y), (x - w0 - 5 * s, y - 4 * s), (x - w0 - 5 * s, y + 4 * s)], fill=(110, 98, 170, 255))
    d.rectangle([x - 5 * s, y + h0, x + 5 * s, y + h0 + 2 * s], fill=(36, 28, 74, 255), outline=(150, 140, 210, 255))
    d.point((x + w0 - 2, y), fill=RED + (255,)); d.point((x - 2, y + h0 + 1), fill=AMBER + (255,)); d.point((x + 2, y + h0 + 1), fill=AMBER + (255,))
    if big:
        d.line([(x - w0 + 4, y + 2), (x + w0 - 4, y + 2)], fill=PINK + (230,))


for (x0, y0) in ((330, 66), (392, 40), (440, 30)):
    airship(x0, y0)
bm, bmd = new_layer(); hc = dome_pt(math.radians(76), 0)[1]
bmd.polygon([(cx - 6, 54), (cx + 6, 54), (cx + 13, hc), (cx - 13, hc)], fill=(120, 230, 255, 46)); comp(bm)      # 飛空艇から結界の切れ目へ
airship(cx + 2, 40, 1.7, True)

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
NX, NY = 920, 48      # 方位（北が上）
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
path = os.path.join(HERE, 'js', '09_map_art.js')
if os.path.isdir(os.path.dirname(path)):
    buf = io.BytesIO(); out.save(buf, 'WEBP', quality=90, method=6)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// make_world_map.py が生成したファイル（手で編集しない）。全体マップ（62_map.js）の下絵（960x540）\n'
                'window.REBELL_MAP = "data:image/webp;base64,%s";\n' % base64.b64encode(buf.getvalue()).decode('ascii'))
    print('map', out.size, len(buf.getvalue()) // 1024, 'KB ->', path)
else:
    print('map', out.size, '(js は書き出していない)')

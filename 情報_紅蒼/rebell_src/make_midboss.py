# -*- coding: utf-8 -*-
"""フォルダにある「kurose-sprites.png」（空手使い・黒瀬龍士のスプライトシート）から、ゲームで使うコマを切り出して
js/07_midboss.js を作る。
使い方:  python rebell_src/make_midboss.py [確認用の一覧画像を出すフォルダ]

シートは 1672x941。濃い紺色の背景に、黒い服の人物が並ぶ（主人公のシートと違い、明るさでは背景と分けられない）。
そこで「青だけが強い色＝背景」とみなし、コマのふちからつながっている背景だけを抜く。
1 コマ = [atlas の x, y, 幅, 高さ, 基準点 x, 基準点 y]。基準点は「上半身の中心・足元」。絵の 1 ドット = ゲームの 1 ドット。
段によって絵の大きさが違う（「その他アクション」の段だけ約 1.5 倍）ので、その段は縮めて大きさをそろえる。
"""
import base64, io, os, sys
import numpy as np
from PIL import Image, ImageDraw
import sprite_tools as T
import make_sprites as MS

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_ART = os.path.join(os.path.dirname(HERE), 'art', 'source')
SHEET = 'kurose-sprites.png'
# 2 枚目のシート（バリエーション。1536x1024）: 新しい技のコマ・表情アイコン 7 つ・カットイン 2 枚・大きな絵
SHEET2 = 'kurose-sprites-16x16.png'      # もとの名前は EE62119D-….png
OUTLINE = np.array(T.OUTLINE, np.uint8)
# 段の帯（見出しの線より下、ラベルの文字より上）。N1・N2 は 2 枚目のシート
BAND = {'A': (86, 143), 'B': (197, 246), 'C': (303, 357), 'D': (399, 453), 'E': (512, 580), 'F': (652, 702), 'G': (778, 871),
        'N1': (252, 328), 'N2': (382, 463)}
G_SCALE = 0.66      # 「その他アクション」の段を、ほかの段の大きさに合わせる倍率（立ち姿の背丈 83 → 55）


def sp(x0, x1, n):
    return ('split', x0, x1, n)


# グループ名: (段, 基準線の取り方, [コマ…], {並び全体の指定})
#   コマは (x0, x1) / (x0, x1, {オプション}) / sp(x0, x1, 分割数)
#   オプション: nofx=紫の光（技のエフェクト）を取り除く, fx=光のかたまり（体ではない）, solo=体とつながっているものだけ残す,
#              dx・dy=基準点の手直し, y0・y1=帯の上書き
#   基準線 'row' = その並びで共通の地面 / 'own' = コマごとの足元（空中のコマ）
CFG = {
    # --- 基本・移動 ---
    'idle': ('A', 'row', [(568, 600), (603, 632), (639, 669)]),
    'breath': ('A', 'row', [(715, 746), (756, 788), (798, 830)]),
    'stance': ('A', 'row', [(878, 912), (923, 960), (969, 1012)]),
    'walk': ('A', 'row', [(1089, 1121), (1125, 1159), (1162, 1200)]),
    'run': ('A', 'row', [(1229, 1266), (1266, 1303), (1306, 1346)]),
    'dash': ('A', 'row', [(1376, 1429), (1429, 1475), (1475, 1525)]),      # 3 人がくっついて並んでいるので、分け目は拡大して読み取った
    'stop': ('A', 'row', [(1561, 1588), (1611, 1638)]),
    # --- ジャンプ ---
    'rise': ('B', 'own', [(590, 622), (629, 663), (667, 700), (705, 738)]),
    'apex': ('B', 'own', [(762, 790), (796, 826), (833, 860)]),
    'fall': ('B', 'own', [(919, 958), (977, 1016), (1034, 1069)]),
    'land': ('B', 'row', [(1126, 1164), (1179, 1220), (1234, 1272)]),
    # --- 空手の技 ---
    'straight': ('C', 'row', [(555, 589), (592, 632), (634, 684), (685, 738)]),
    'hook': ('C', 'row', [(767, 807), (814, 868)]),
    'backfist': ('C', 'row', [(901, 936), (951, 987)]),
    'elbow': ('C', 'row', [(1028, 1059), (1068, 1107)]),
    'front': ('C', 'row', [(1136, 1177), (1180, 1251)]),
    'round': ('C', 'row', [(1295, 1338), (1354, 1396)]),
    'knee': ('C', 'row', [(1431, 1464), (1474, 1513)]),
    'low': ('C', 'row', [(1542, 1588), (1593, 1648)]),
    'rapid': ('D', 'row', [(553, 599), (599, 653), (656, 703), (714, 769), (774, 822), (833, 884), (895, 939), (964, 993), (1008, 1058),
                           (1067, 1114), (1132, 1173), (1193, 1231), (1251, 1301), (1314, 1363), (1379, 1432), (1450, 1509), (1521, 1580)]),
    # --- 必殺技 ---
    'palm': ('E', 'row', [(549, 587), (588, 652, {'nofx': True})]),
    'spin': ('E', 'row', [(751, 791), (803, 857), (858, 906), (905, 951)]),
    'riseknee': ('E', 'row', [(969, 1007), (1016, 1052), (1056, 1107)]),
    'smash': ('E', 'row', [(1127, 1165), (1170, 1221)]),
    'erupt': ('E', 'row', [(1222, 1325, {'fx': True})]),
    'rush': ('E', 'row', [(1350, 1407, {'nofx': True, 'solo': True})]),      # 連撃ラッシュの先頭の 1 人（後ろに続く残像は、ゲームの中で描く）
    # --- 被弾 ---
    'hurt': ('F', 'row', [(564, 598), (604, 660)]),
    'hurtbig': ('F', 'row', [(728, 780), (784, 853)]),
    'stagger': ('F', 'row', [(914, 950), (963, 1026)]),
    'down': ('F', 'row', [(1279, 1326), (1332, 1377), (1382, 1453)]),
    'getup': ('F', 'row', [(1494, 1541), (1544, 1594), (1598, 1649)]),
    # --- カメラ・挑発ほか（この段だけ絵が大きいので縮める）---
    'guard': ('G', 'row', [(560, 614)]),
    'step': ('G', 'row', [(639, 686), (686, 741)]),
    'taunt': ('G', 'row', [(755, 803, {'solo': True}), (817, 856, {'solo': True})]),      # 宙に浮いて見える手（シートの描き損じ）は使わない
    'roar': ('G', 'row', [(878, 966)]),
    'pose': ('G', 'row', [(1006, 1047)]),
    'camera': ('G', 'row', [(1087, 1133), (1140, 1186), (1196, 1241), (1247, 1296)]),
    'victory': ('G', 'row', [(1546, 1645)]),
}
# 2 枚目のシートから足すコマ（新しい技）
CFG2 = {
    'akick': ('N1', 'own', [(852, 923, {'y0': 262}), (935, 1000), (1009, 1074)]),          # 空中攻撃（蹴り）: 跳び上がって、斜めに蹴り落ちる
    'hiza': ('N2', 'row', [(1119, 1157), (1172, 1207, {'y0': 394})]),                       # 飛び膝蹴り: 沈む → 踏み切る
    'hizaair': ('N2', 'own', [(1232, 1280)]),                                  #             宙で膝を突き上げる
    'sokuto': ('N2', 'row', [(1328, 1390, {'nofx': True, 'y0': 394}), (1409, 1523, {'nofx': True, 'y0': 394})]),     # 足刀蹴り: 構え → 蹴り出す（飛ぶ刃は、ゲームの中で描く。見出しの文字は避ける）
}


def bg_mask(c):
    """紺色の背景（青だけが強く、赤が弱い）"""
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return (b - np.maximum(r, g) >= 14) & (r <= 46) & (b <= 110)


def fx_mask(c):
    """技の光（紫〜桃色、白い光）"""
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    purple = (b > 95) & (r > 70) & (b - g > 40) & (r - g > 18)
    return purple


def body_mask(c):
    """黒い服と髪（暗くて色味のない画素）"""
    mx = c.max(-1); mn = c.min(-1)
    return (mx >= 22) & (mx <= 84) & (mx - mn <= 26)


def cutout(a, xa, xb, y0, y1, o):
    """[xa, xb)×[y0, y1) からコマを 1 つ取り出す → (RGBA uint8, 左上 (x, y))"""
    c = a[y0:y1, xa:xb].astype(int)
    h, w = c.shape[:2]
    pad = np.zeros((h + 2, w + 2), bool); pad[1:-1, 1:-1] = bg_mask(c); pad[0, :] = pad[-1, :] = pad[:, 0] = pad[:, -1] = True
    lab, sizes = T.components(pad)
    outer = lab[0, 0]
    bg = lab[1:-1, 1:-1] == outer
    # 体に囲まれた背景（腕と胴のあいだなど）も抜く。背景の色そのもので、2 ドット以上あるものだけ
    for area, n in sizes:
        if n == outer or area < 2:
            continue
        sel = lab[1:-1, 1:-1] == n
        m = c[sel].mean(axis=0)
        if m[0] <= 16 and m[2] >= 30 and m[2] - m[0] >= 24:
            bg |= sel
    fg = ~bg
    if o.get('nofx'):
        fg &= ~fx_mask(c)
    # 小さなごみを捨て、体から離れた切れ端（となりのコマのはみ出し、見出しの光のかけら）も捨てる
    lab, sizes = T.components(fg)
    if not sizes:
        return None, (xa, y0)
    main = max(sizes)[1]
    if not o.get('fx'):
        bm = body_mask(c) & fg
        if bm.sum() >= 20:
            cnt = np.bincount(lab[bm], minlength=len(sizes) + 1); cnt[0] = 0
            main = int(np.argmax(cnt))
    touch = T.dilate(T.dilate(lab == main))      # 体のすぐそば（2 ドット以内）
    for area, n in sizes:
        if n == main:
            continue
        sel = lab == n
        xs = np.nonzero(sel.any(axis=0))[0]
        at_edge = xs[0] <= 1 or xs[-1] >= w - 2
        apart = not (touch & sel).any()
        if area < 5 or (at_edge and area < 40) or (apart and (area < 30 or o.get('solo') or o.get('nofx'))):
            fg[sel] = False
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(c, 0, 255); out[..., 3] = fg * 255
    return out, (xa, y0)


def shrink(rgba, k):
    """絵を k 倍に縮める（色は面積の平均、透明度は半分以上で不透明）。縮めるとふちどりが薄くなるので、暗いふちを引き直す"""
    h, w = rgba.shape[:2]
    nw, nh = max(1, int(round(w * k))), max(1, int(round(h * k)))
    f = rgba.astype(np.float32); al = f[..., 3:4] / 255.0
    pre = np.concatenate([f[..., :3] * al, al * 255.0], axis=-1)
    chans = [np.asarray(Image.fromarray(pre[..., i], 'F').resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    a2 = np.clip(chans[3], 0, 255) / 255.0
    out = np.zeros((nh, nw, 4), np.uint8)
    ok = a2 >= 0.5
    for i in range(3):
        v = np.where(ok, chans[i] / np.maximum(a2, 1e-3), 0)
        out[..., i] = np.clip(np.round(v), 0, 255)
    out[..., 3] = ok * 255
    # ふちの画素のうち、暗いものは輪郭の色に寄せる（縮小でぼけた輪郭を締める）
    edge = ok & T.dilate(~ok)
    lum = out[..., :3].astype(int).max(-1)
    dark = edge & (lum < 96)
    out[dark, :3] = (out[dark, :3].astype(int) * 0.45 + OUTLINE * 0.55).astype(np.uint8)
    return out


def torso_x(rgba):
    """上半身の中心の x（黒い服と髪の画素の中央）。見つからなければ絵の中央"""
    c = rgba[..., :3].astype(int)
    m = body_mask(c) & (rgba[..., 3] > 0)
    xs = np.nonzero(m)[1]
    if len(xs) < 12:
        xs = np.nonzero(rgba[..., 3] > 0)[1]
    return float(np.median(xs))


def extract():
    sheets = {1: T.load(os.path.join(SOURCE_ART, SHEET)), 2: T.load(os.path.join(SOURCE_ART, SHEET2))}
    frames = {}
    for name, cfg, sh in [(n, c, 1) for n, c in CFG.items()] + [(n, c, 2) for n, c in CFG2.items()]:
        a = sheets[sh]
        band, base, items = cfg[:3]
        spans = []
        for it in items:
            if it[0] == 'split':
                y0, y1 = BAND[band]
                m = (~bg_mask(a[y0:y1, it[1]:it[2]].astype(int))).sum(axis=0).astype(float)
                cuts = [it[1]]; wd = (it[2] - it[1]) / float(it[3])
                for i in range(1, it[3]):
                    cc = int(round(i * wd)); lo, hi = max(1, int(cc - wd * 0.3)), min(len(m) - 1, int(cc + wd * 0.3))
                    seg = m[lo:hi] + np.abs(np.arange(lo, hi) - cc) * 0.02
                    cuts.append(it[1] + lo + int(np.argmin(seg)))
                cuts.append(it[2])
                spans += [(cuts[i], cuts[i + 1], {}) for i in range(it[3])]
            else:
                spans.append((it[0], it[1], it[2] if len(it) > 2 else {}))
        got = []
        for (xa, xb, o) in spans:
            y0, y1 = o.get('y0', BAND[band][0]), o.get('y1', BAND[band][1])
            rgba, (ox, oy) = cutout(a, xa, xb, y0, y1, o)
            if rgba is None:
                raise SystemExit('空のコマ: %s %s' % (name, (xa, xb)))
            rgba, (dx, dy) = T.trim(rgba)
            if band == 'G':
                rgba = shrink(rgba, G_SCALE); rgba, _ = T.trim(rgba)
                top = (oy + dy) * G_SCALE
            else:
                top = oy + dy
            got.append({'img': rgba, 'top': top, 'bottom': top + rgba.shape[0], 'bx': torso_x(rgba), 'o': o})
        ground = int(round(np.median([f['bottom'] for f in got])))
        for f in got:
            f['oy'] = int(round((ground if base == 'row' else f['bottom']) - f['top'])) + f['o'].get('dy', 0)
            f['ox'] = int(round(f['bx'])) + f['o'].get('dx', 0)
            f['off'] = int(round(f['bottom'] - ground)) if base == 'row' else 0
        frames[name] = got
    return frames


def contact(frames, path, Z=4):
    """確認用: 基準点を共通の地面にそろえて、コマを名前つきで並べる"""
    rows = []
    for n, fs in frames.items():
        up = max(f['oy'] for f in fs); dn = max(f['img'].shape[0] - f['oy'] for f in fs)
        cells = [(f['ox'] + 3, f['img'].shape[1] - f['ox'] + 3) for f in fs]
        w = sum((l + r) * Z for l, r in cells) + 70; h = (up + dn + 4) * Z + 12
        im = Image.new('RGB', (w, h), (62, 52, 122)); dr = ImageDraw.Draw(im); dr.text((2, 2), n, fill=(255, 255, 0)); x = 70
        gy = 12 + (up + 2) * Z
        dr.line([(64, gy), (w, gy)], fill=(0, 200, 0))
        for i, f in enumerate(fs):
            l, r = cells[i]; ax = x + l * Z
            t = Image.fromarray(f['img'], 'RGBA').resize((f['img'].shape[1] * Z, f['img'].shape[0] * Z), Image.NEAREST)
            im.paste(t, (ax - f['ox'] * Z, gy - f['oy'] * Z), t)
            dr.line([(ax, gy - 5), (ax, gy + 5)], fill=(0, 255, 0))
            dr.text((x + 2, 0), '%d:%dx%d' % (i, f['img'].shape[1], f['img'].shape[0]), fill=(255, 255, 255)); x += (l + r) * Z
        rows.append(im)
    # 幅 1900 くらいの紙に、左から詰めていく
    sheets, cur, cw, ch, y = [], [], 0, 0, 0
    lines = []; line = []; lw = 0
    for r in rows:
        if lw + r.size[0] + 8 > 1900 and line:
            lines.append(line); line = []; lw = 0
        line.append(r); lw += r.size[0] + 8
    if line:
        lines.append(line)
    H = sum(max(r.size[1] for r in ln) + 6 for ln in lines)
    sheet = Image.new('RGB', (1900, H), (24, 22, 40)); y = 0
    for ln in lines:
        x = 0
        for r in ln:
            sheet.paste(r, (x, y)); x += r.size[0] + 8
        y += max(r.size[1] for r in ln) + 6
    sheet.save(path)


# 顔の絵。表情アイコン（HUD 用）と、左上の大きな絵（会話のカットイン用）
#   1 枚目のシートの 8 つ（48x53）と、2 枚目のシートの 7 つ（枠の中の顔の部分 60x66）を、同じ大きさ ICON_SIZE にそろえて 1 本に並べる
ICON_NAMES = ['normal', 'anger', 'smirk', 'rage', 'hurt', 'surprise', 'laugh', 'focus',      # 通常・怒り・嘲り・激昂・負傷・驚き・大笑い・真剣
              'n_normal', 'n_anger', 'n_taunt', 'n_calm', 'n_surprise', 'n_wounded', 'n_laugh']      # 2 枚目: 通常・怒り・挑発・余裕・驚き・負傷（血）・笑い
ICON_X = [30, 91, 153, 214, 275, 337, 398, 459]      # それぞれの枠の内側の左端
ICON_BOX = (530, 48, 53)                             # 上端・幅・高さ
ICON2_X = [21, 97, 170, 246, 318, 392, 464]          # 2 枚目: 枠の左端
ICON2_BOX = (834, 5, 60, 66)                         # 2 枚目: 上端・枠の中での左のずれ・幅・高さ
ICON_SIZE = (96, 106)
PORTRAIT = (12, 64, 326, 356)                        # 大きな絵の範囲（右上の「ドット立ち絵」の札にかからないところまで）
# 2 枚目のシートの、会話のカットインに使う絵（どれも 450x306 の枠に合わせた横長）
PICS = {'camera': (0, 58, 300, 262), 'grin': (580, 818, 795, 964), 'reach': (845, 822, 1090, 989)}
PIC_SIZE = (450, 306)


def data_uri(im, kind, **kw):
    b = io.BytesIO(); im.save(b, kind, **kw)
    return 'data:image/%s;base64,%s' % (kind.lower(), base64.b64encode(b.getvalue()).decode('ascii')), len(b.getvalue())


def faces(dev):
    src = Image.open(os.path.join(SOURCE_ART, SHEET)).convert('RGB')
    src2 = Image.open(os.path.join(SOURCE_ART, SHEET2)).convert('RGB')
    y, w, h = ICON_BOX
    W, H = ICON_SIZE
    strip = Image.new('RGB', (W * len(ICON_NAMES), H))
    for i, x in enumerate(ICON_X):
        strip.paste(src.crop((x, y, x + w, y + h)).resize((W, H), Image.LANCZOS), (i * W, 0))
    y2, dx2, w2, h2 = ICON2_BOX
    for j, x in enumerate(ICON2_X):
        strip.paste(src2.crop((x + dx2, y2, x + dx2 + w2, y2 + h2)).resize((W, H), Image.LANCZOS), ((len(ICON_X) + j) * W, 0))
    por = src.crop(PORTRAIT)
    pics = {k: src2.crop(b).resize(PIC_SIZE, Image.LANCZOS) for k, b in PICS.items()}
    q = (45, 40) if dev else (92, 88)
    if dev:      # アプリ内プレビュー用は軽く（半分の大きさ）
        por = por.resize((por.width // 2, por.height // 2), Image.LANCZOS)
        pics = {k: v.resize((v.width // 2, v.height // 2), Image.LANCZOS) for k, v in pics.items()}
    iu, isz = data_uri(strip, 'WEBP', quality=q[0], method=6); pu, psz = data_uri(por, 'WEBP', quality=q[0] if dev else 90, method=6)
    pd = {k: data_uri(v, 'WEBP', quality=q[1], method=6)[0] for k, v in pics.items()}
    return iu, pu, isz, psz, por.size, pd


def js(uri, table, icons, portrait, psize, pics):
    W, H = ICON_SIZE
    pl = ',\n    '.join('%s: "%s"' % (k, v) for k, v in pics.items())
    return ('// make_midboss.py が生成したファイル（手で編集しない）。中ボス「黒瀬 龍士」のシート（2 枚）から切り出したコマと顔の絵\n'
            '// 1 コマ = [x, y, 幅, 高さ, 基準点 x, 基準点 y]。絵の 1 ドットはゲームの 1 ドット\n'
            'window.REBELL_MIDBOSS = {\n  img: "%s",\n  frames: { %s },\n  icons: "%s",\n  iconSize: [%d, %d],\n  iconNames: %s,\n  portrait: "%s",\n  portraitSize: [%d, %d],\n  pics: {\n    %s\n  }\n};\n'
            % (uri, table, icons, W, H, repr(ICON_NAMES).replace("'", '"'), portrait, psize[0], psize[1], pl))


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    frames = extract()
    n = sum(len(v) for v in frames.values())
    atlas = MS.pack(frames, 512)
    table = ', '.join('%s: [%s]' % (k, ', '.join('[%d,%d,%d,%d,%d,%d]' % (f['x'], f['y'], f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs)) for k, fs in frames.items())
    for path, colors, rare, dev in ((os.path.join(HERE, 'js', '07_midboss.js'), 96, True, False), (os.path.join(HERE, 'midboss_dev.js'), 28, False, True)):
        uri, size, kind = MS.encode(atlas, colors, rare)
        iu, pu, isz, psz, psize, pd = faces(dev)
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(js(uri, table, iu, pu, psize, pd))
        if dbg and not dev:
            b = base64.b64decode(iu.split(',')[1]); Image.open(io.BytesIO(b)).save(os.path.join(dbg, 'icons_mid.png'))
        print('frames', n, 'atlas', atlas.size, colors, 'colors', kind, size // 1024, 'KB / icons', isz // 1024, 'KB / portrait', psz // 1024, 'KB ->', path, os.path.getsize(path) // 1024, 'KB')
    if dbg:
        contact(frames, os.path.join(dbg, 'contact_mid.png')); atlas.save(os.path.join(dbg, 'atlas_mid.png'))
        Image.open(io.BytesIO(base64.b64decode(MS.encode(atlas, 96, True)[0].split(',')[1]))).save(os.path.join(dbg, 'atlas_mid_q.png'))
        print('wrote contact sheet')


if __name__ == '__main__':
    main()

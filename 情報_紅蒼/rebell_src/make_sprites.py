# -*- coding: utf-8 -*-
"""フォルダにあるキャラクタースプライトシートから、ゲームで使うコマを切り出して js/06_sprites.js を作る。
使い方:  python rebell_src/make_sprites.py [確認用の一覧画像を出すフォルダ]

コマの位置（x の範囲）は、シートを拡大して目で読み取ったもの。y は行の帯の中で自動的に縮める。
1 コマ = [atlas の x, y, 幅, 高さ, 基準点 x, 基準点 y]。基準点は「体の中心・足元」。
"""
import base64, io, os, sys
import numpy as np
from PIL import Image, ImageDraw
import sprite_tools as T

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_ART = os.path.join(os.path.dirname(HERE), 'art', 'source')
SHEETS = {
    'kurenai': 'kurenai-sprites.png',
    'aoi': 'aoi-sprites.png',
}
# 行の帯（ラベルの文字より下、パネルの枠線より上）
ROW = {'A': (116, 198), 'B': (268, 350), 'C': (413, 489), 'D': (554, 629), 'E': (692, 780), 'F': (832, 946)}


def sp(x0, x1, n):
    return ('split', x0, x1, n)


# グループ名: (行, 基準線の取り方, [コマ…])
#   コマは (x0, x1) / (x0, x1, {オプション}) / sp(x0, x1, 分割数)
#   オプション: solo=体だけ残す, y0・y1=帯の上書き, dx・dy=基準点の手直し（dy は上へ持ち上げるドット数）
#              lean=(n, 首の高さ) … 足元を止めたまま体を前へ n ドット傾ける（直立した歩きの絵を、走りの前傾に合わせる）
#   基準線 'row' = その並びで共通の地面 / 'own' = コマごとの足元（空中のコマ）
#   4 つ目の {…} は並び全体の指定:
#     anchor='feet' … 基準点を両足の中央にする（立ちポーズ。コマが替わっても足が動かない）
#     anchor='face', ax=n … 基準点を「顔の中心から n ドット後ろ」にする（走り。コマが替わっても頭が揺れない）
#
# 走り（run）について: シートの「走行」4 コマはどれも同じ足の形なので、そのまま回すと足が入れ替わらず、
# 滑っているように見える。そこで同じ段の「歩行」「ダッシュ」のコマと組み合わせ、
# 着地 → 足をそろえる → 蹴り出し → 宙に浮く、の順に並べ直している。
CFG = {
    'kurenai': {
        'idle': ('A', 'row', [(264, 304), (327, 366), (388, 428), (450, 490)], {'anchor': 'feet'}),
        'stance': ('A', 'row', [(536, 580), (601, 644), (670, 715)], {'anchor': 'feet'}),
        # 走り: 歩行 2 コマ目（着地）→ 歩行 4 コマ目（足をそろえる）→ 走行 2 コマ目（蹴り出し）→ 走行 3 コマ目（宙に浮く）
        'run': ('A', 'own', [(834, 877), (958, 1000, {'dy': -1}), (1094, 1140, {'dy': 1}), (1155, 1202, {'dy': 2})], {'anchor': 'face', 'ax': 4}),
        'stop': ('A', 'own', [(958, 1000)], {'anchor': 'face', 'ax': 2}),      # 止まるときの 1 歩（歩行 4 コマ目）
        'dash': ('A', 'row', [(1290, 1362), sp(1368, 1508, 2)]),
        'jump': ('B', 'own', [(262, 316), (326, 386), (388, 441), (455, 501), (514, 558)]),
        'airatk': ('B', 'own', [(811, 890), (890, 968), (969, 1056)]),
        'djump': ('B', 'own', [(1096, 1144), (1162, 1208), (1224, 1267)]),
        'land': ('B', 'row', [(1305, 1372), (1372, 1440), (1448, 1512)]),
        'atk': ('C', 'row', [(256, 306), (318, 383), (386, 490), (495, 546), (553, 634)]),
        'combo': ('C', 'row', [(662, 714), (716, 793), (794, 863), (863, 948)]),
        'spin': ('C', 'row', [(966, 1079), (1082, 1154), (1154, 1241)]),
        'step': ('C', 'row', [(1259, 1362), (1374, 1524)]),
        'moon': ('D', 'row', [(258, 380), (380, 463), (466, 563)]),
        'senpu': ('D', 'row', [sp(585, 888, 4)]),
        'leap': ('D', 'own', [(912, 966), (968, 1027), (1035, 1086), (1089, 1227, {'y0': 541})]),
        'awaken': ('D', 'row', [(1251, 1314), (1318, 1382), (1384, 1454), (1454, 1524, {'y0': 541})]),
        'hurt': ('E', 'row', [(26, 74), (92, 152)]),
        'hurtbig': ('E', 'row', [(193, 247), (260, 314)]),
        'down': ('E', 'row', [(476, 554), (559, 609), (616, 657)]),
        'dodge': ('E', 'row', [(865, 941), (950, 1043)]),
        'slide': ('E', 'row', [(1065, 1147), (1149, 1218)]),
        'event': ('F', 'row', [(894, 960), (975, 1042)]),      # 1 コマ目は、左端にシートの仕切り線が入るので、その内側から
    },
    'aoi': {
        'idle': ('A', 'row', [(263, 304), (324, 365), (385, 426), (446, 487)], {'anchor': 'feet'}),
        'stance': ('A', 'row', [(533, 577), (599, 644), (673, 716)], {'anchor': 'feet'}),
        # 走り: 歩行 2 コマ目（着地）→ 歩行 4 コマ目（足をそろえる）→ 走行 2 コマ目（蹴り出し）→ 走行 3 コマ目（宙に浮く）
        # 蒼の歩行は直立、走行は深い前傾なので、歩行のコマは前へ傾けて使う
        'run': ('A', 'own', [(835, 878, {'lean': (11, 43)}), (959, 1002, {'lean': (11, 43), 'dy': -1}), (1096, 1141, {'dy': 2}), (1157, 1203, {'dy': 3})], {'anchor': 'face', 'ax': 17}),
        'stop': ('A', 'own', [(959, 1002)], {'anchor': 'face', 'ax': 7}),      # 止まるときの 1 歩（歩行 4 コマ目）
        'dash': ('A', 'row', [(1290, 1364), sp(1377, 1516, 2)]),
        'jump': ('B', 'own', [(260, 316), (325, 386), (387, 437), (451, 503), (511, 558)]),
        'airatk': ('B', 'own', [(810, 890), (890, 969), (969, 1062)]),
        'djump': ('B', 'own', [(1093, 1144), (1156, 1203), (1214, 1262)]),
        'land': ('B', 'row', [(1305, 1364), (1364, 1438), (1448, 1513)]),
        'atk': ('C', 'row', [(255, 312), (316, 391), (393, 499), (500, 548), (549, 628)]),
        'combo': ('C', 'row', [(632, 702), (704, 782), (783, 859), (859, 962)]),
        'thrust': ('C', 'row', [(975, 1073), (1073, 1155), (1155, 1236)]),
        'iai': ('C', 'row', [(1246, 1340), (1340, 1524)]),
        'flash': ('D', 'row', [(256, 320), (322, 400), (406, 549)]),
        'renjin': ('D', 'row', [sp(570, 858, 4)]),
        'moon': ('D', 'row', [(889, 950), (959, 1010), (1021, 1177)]),
        'ougi': ('D', 'row', [(1203, 1262), (1269, 1318), (1322, 1398, {'y0': 541}), (1400, 1524, {'y0': 541})], {'gnd': [0, 1]}),
        'hurt': ('E', 'row', [(26, 75), (91, 150)]),
        'hurtbig': ('E', 'row', [(191, 247), (261, 320)]),
        'down': ('E', 'row', [(476, 551), (552, 600), (608, 657)]),
        'dodge': ('E', 'row', [(863, 945), (948, 1050)]),
        'slide': ('E', 'row', [(1068, 1155), (1158, 1230)]),
        'event': ('F', 'row', [(895, 955), (975, 1042)]),
    },
}


def body_color(who):
    """体の色の画素を返す関数。紅は髪（橙）、蒼は服（紫）。どちらも斬撃の光とは色が違う"""
    def f(c):
        r, g, b = c[..., 0].astype(int), c[..., 1].astype(int), c[..., 2].astype(int)
        if who == 'kurenai':
            return (r > 180) & (g >= 60) & (g <= 175) & (b < 110) & (r - g > 55) & (g - b > 10)
        return (r >= 120) & (r <= 245) & (g < 175) & (b > 170) & (b > r + 10) & (r > g + 25)
    return f


def body_x(who, rgba):
    """体の中心の x（体の色の画素の中央）"""
    m = body_color(who)(rgba) & (rgba[..., 3] > 0)
    xs = np.nonzero(m)[1]
    if len(xs) < 12:
        xs = np.nonzero(rgba[..., 3] > 0)[1]
    return float(np.median(xs))


def face_x(rgba, rows=28):
    """顔（肌の色のいちばん大きなかたまり）の x 中心。頭の位置の目印にする"""
    r, g, b = rgba[..., 0].astype(int), rgba[..., 1].astype(int), rgba[..., 2].astype(int)
    m = ((r > 190) & (g > 140) & (b > 120) & (rgba[..., 3] > 0))[:rows]
    lab, sizes = T.components(m)
    if not sizes or max(sizes)[0] < 20:
        return None
    return float(np.nonzero(lab == max(sizes)[1])[1].mean())


def feet_x(rgba, rows=4):
    """両足の中央の x（いちばん下の数行で、絵のある範囲の真ん中）"""
    al = rgba[..., 3] > 0; h = al.shape[0]
    cols = np.nonzero(al[h - 1 - rows:h - 1].any(axis=0))[0]
    return (cols[0] + cols[-1]) / 2.0


def lean(rgba, n, neck):
    """足元を止めたまま、体を前（右）へ傾ける。足元からの高さに比例して行をずらし、首より上（頭）は形を変えずに n ドット動かす。
    ずらしたあと、ふちどりの切れ目をふさぐ"""
    h, w = rgba.shape[:2]
    out = np.zeros((h, w + n, 4), np.uint8)
    for r in range(h):
        y = h - 1 - r
        s = int(round(n * min(y, neck) / float(neck)))
        out[r, s:s + w] = rgba[r]
    al = out[..., 3] > 0
    ink = al & ~np.all(out[..., :3] == np.array(T.OUTLINE, np.uint8), axis=-1)      # ふちどり以外の絵
    gap = T.dilate(ink) & ~al
    out[gap, :3] = T.OUTLINE; out[gap, 3] = 255
    return out


def extract(who):
    a = T.load(os.path.join(SOURCE_ART, SHEETS[who]))
    frames = {}
    for name, cfg in CFG[who].items():
        row, base, items = cfg[:3]; gopt = cfg[3] if len(cfg) > 3 else {}
        spans = []
        for it in items:
            if it[0] == 'split':
                y0, y1 = ROW[row]
                spans += [(s[0], s[1], {}) for s in T.split_cols(a, it[1], it[2], y0, y1, it[3])]
            else:
                spans.append((it[0], it[1], it[2] if len(it) > 2 else {}))
        got = []
        for (xa, xb, o) in spans:
            y0, y1 = o.get('y0', ROW[row][0]), o.get('y1', ROW[row][1])
            box = T.tight_box(a, xa, xb, y0, y1)
            if box is None:
                raise SystemExit('空のコマ: %s %s %s' % (who, name, (xa, xb)))
            rgba, (ox, oy) = T.cutout(a, box, xlim=(xa, xb), ylim=(y0, y1), solo=o.get('solo', False), body_mask=body_color(who))
            rgba, (dx, dy) = T.trim(rgba)
            top = oy + dy
            if 'lean' in o:
                rgba = lean(rgba, *o['lean'])
                rgba, (dx2, dy2) = T.trim(rgba); top += dy2
            got.append({'img': rgba, 'top': top, 'bottom': top + rgba.shape[0], 'bx': body_x(who, rgba), 'o': o})
        ground = int(np.median([got[i]['bottom'] for i in gopt.get('gnd', range(len(got)))]))
        for f in got:
            f['oy'] = (ground if base == 'row' else f['bottom']) - f['top'] + f['o'].get('dy', 0)
            bx = f['bx']
            if gopt.get('anchor') == 'face':
                fx = face_x(f['img'])
                if fx is None:
                    raise SystemExit('顔が見つからないコマ: %s %s' % (who, name))
                bx = fx - gopt.get('ax', 0)
            elif gopt.get('anchor') == 'feet':
                bx = feet_x(f['img'])
            f['ox'] = int(round(bx)) + f['o'].get('dx', 0)
            f['off'] = f['bottom'] - ground if base == 'row' else 0
        frames[name] = got
    return frames


def pack(frames, width=1024):
    """高さの順に棚へ並べる"""
    flat = [(n, i, f) for n, fs in frames.items() for i, f in enumerate(fs)]
    flat.sort(key=lambda t: -t[2]['img'].shape[0])
    x = y = 1; rowh = 0
    for n, i, f in flat:
        h, w = f['img'].shape[:2]
        if x + w + 1 > width:
            x = 1; y += rowh + 1; rowh = 0
        f['x'], f['y'] = x, y; x += w + 1; rowh = max(rowh, h)
    atlas = np.zeros((y + rowh + 1, width, 4), np.uint8)
    for n, i, f in flat:
        h, w = f['img'].shape[:2]
        atlas[f['y']:f['y'] + h, f['x']:f['x'] + w] = f['img']
    return Image.fromarray(atlas, 'RGBA')


def nearest(px, pal):
    """各色（px）にいちばん近いパレットの番号と、その距離（2 乗）"""
    idx = np.zeros(len(px), np.int32); dist = np.zeros(len(px), np.int64)
    for s in range(0, len(px), 20000):
        d = px[s:s + 20000, None, :] - pal[None, :, :]
        d = (d * d).sum(-1)
        idx[s:s + 20000] = d.argmin(1); dist[s:s + 20000] = d.min(1)
    return idx, dist


def reduce_colors(im, colors):
    """色数を colors 色まで減らす。返すのは、色番号の画像（透明なところは 0）と、パレット（r, g, b を並べたリスト）。
    中央値分割だけだと、数は少ないが目立つ色（決めポーズの金色のきらきらなど）が近くの色に化ける（蒼では金色が薄いピンクになった）。
    そこで、3/4 を中央値分割で決めたあと、パレットからいちばん外れている色を順に足し、
    最後に、それぞれの色を受け持つ画素の平均でならす"""
    rgb = np.asarray(im.convert('RGB')).astype(np.int64)
    al = np.asarray(im.getchannel('A')) > 0
    px = rgb[al]
    uq, inv, cnt = np.unique(px, axis=0, return_inverse=True, return_counts=True)      # 同じ色はまとめて数える
    inv = inv.reshape(-1)
    base = colors - colors // 4
    q = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8), 'RGB').quantize(colors=base, method=Image.MEDIANCUT, dither=Image.NONE)
    pal = np.unique(np.array((q.getpalette() or [])[:base * 3], np.int64).reshape(-1, 3), axis=0)
    idx, dist = nearest(uq, pal)
    while len(pal) < colors:
        j = int(dist.argmax())
        if dist[j] == 0:
            break
        pal = np.vstack([pal, uq[j:j + 1]])
        d = ((uq - uq[j]) ** 2).sum(-1); upd = d < dist
        idx[upd] = len(pal) - 1; dist[upd] = d[upd]
    for _ in range(6):
        idx, dist = nearest(uq, pal)
        w = np.bincount(idx, weights=cnt, minlength=len(pal)); ok = w > 0
        for c in range(3):
            s = np.bincount(idx, weights=uq[:, c] * cnt, minlength=len(pal))
            pal[ok, c] = np.round(s[ok] / w[ok]).astype(np.int64)
    idx, dist = nearest(uq, pal)
    out = np.zeros(rgb.shape[:2], np.uint8); out[al] = idx[inv]
    return out, [int(v) for v in pal.reshape(-1)]


def encode(im, colors, rare=False):
    """色数を減らして PNG と WebP（可逆）にし、小さいほうを返す。colors=0 なら非可逆 WebP（確認用の軽い版）。
    rare=True なら、数の少ない色も残す減らし方（reduce_colors）を使う"""
    al = np.asarray(im.getchannel('A')) > 0
    if not colors:
        arr = np.asarray(im).copy(); arr[~al] = 0
        b = io.BytesIO(); Image.fromarray(arr, 'RGBA').save(b, 'WEBP', quality=58, alpha_quality=100, method=6)
        return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode('ascii'), len(b.getvalue()), 'webp-lossy'
    if rare:
        data, pal = reduce_colors(im, colors - 1)
    else:
        q = im.convert('RGB').quantize(colors=colors - 1, method=Image.MEDIANCUT, dither=Image.NONE)
        pal = q.getpalette()[:(colors - 1) * 3]; data = np.asarray(q).copy()
    pal += [0] * ((colors - 1) * 3 - len(pal)) + [0, 0, 0]
    data[~al] = colors - 1
    p = Image.fromarray(data, 'P'); p.putpalette(pal)
    b1 = io.BytesIO(); p.save(b1, 'PNG', optimize=True, transparency=colors - 1)
    rgba = p.convert('RGBA'); arr = np.asarray(rgba).copy(); arr[~al] = 0
    b2 = io.BytesIO(); Image.fromarray(arr, 'RGBA').save(b2, 'WEBP', lossless=True, quality=100, method=6)
    if len(b2.getvalue()) < len(b1.getvalue()):
        return 'data:image/webp;base64,' + base64.b64encode(b2.getvalue()).decode('ascii'), len(b2.getvalue()), 'webp'
    return 'data:image/png;base64,' + base64.b64encode(b1.getvalue()).decode('ascii'), len(b1.getvalue()), 'png'


def contact(frames, path):
    """確認用: 基準点を共通の地面にそろえて、コマを名前つきで並べる"""
    Z = 3; rows = []
    for n, fs in frames.items():
        up = max(f['oy'] for f in fs); dn = max(f['img'].shape[0] - f['oy'] for f in fs)
        cells = []
        for f in fs:
            cells.append((f['ox'] + 4, f['img'].shape[1] - f['ox'] + 4))
        w = sum((l + r) * Z for l, r in cells) + 64; h = (up + dn + 6) * Z + 12
        im = Image.new('RGB', (w, h), (104, 96, 176)); dr = ImageDraw.Draw(im); dr.text((2, 2), n, fill=(255, 255, 0)); x = 64
        gy = 12 + (up + 2) * Z
        dr.line([(60, gy), (w, gy)], fill=(0, 200, 0))
        for i, f in enumerate(fs):
            l, r = cells[i]; ax = x + l * Z
            t = Image.fromarray(f['img'], 'RGBA').resize((f['img'].shape[1] * Z, f['img'].shape[0] * Z), Image.NEAREST)
            im.paste(t, (ax - f['ox'] * Z, gy - f['oy'] * Z), t)
            dr.line([(ax, gy - 6), (ax, gy + 6)], fill=(0, 255, 0))
            dr.text((x + 2, 0), '%d%s' % (i, ('(%+d)' % f['off']) if f['off'] else ''), fill=(255, 255, 255)); x += (l + r) * Z
        rows.append(im)
    half = (len(rows) + 1) // 2; cols = [rows[:half], rows[half:]]
    W = sum(max(r.size[0] for r in c) + 8 for c in cols); H = max(sum(r.size[1] + 4 for r in c) for c in cols)
    sheet = Image.new('RGB', (W, H), (30, 30, 40)); x = 0
    for c in cols:
        y = 0
        for r in c:
            sheet.paste(r, (x, y)); y += r.size[1] + 4
        x += max(r.size[0] for r in c) + 8
    sheet.save(path)


def js(out):
    return ('// make_sprites.py が生成したファイル（手で編集しない）。用意されたスプライトシートから切り出したコマ\n'
            '// 1 コマ = [x, y, 幅, 高さ, 基準点 x, 基準点 y]。絵の 1 ドットはゲームの 0.5 ドット\n'
            'window.REBELL_SPRITES = {\n' + ',\n'.join(out) + '\n};\n')


def main():
    dbg = sys.argv[1] if len(sys.argv) > 1 else None
    out, dev = [], []
    for who in ('kurenai', 'aoi'):
        frames = extract(who)
        atlas = pack(frames)
        table = ', '.join('%s: [%s]' % (n, ', '.join('[%d,%d,%d,%d,%d,%d]' % (f['x'], f['y'], f['img'].shape[1], f['img'].shape[0], f['ox'], f['oy']) for f in fs)) for n, fs in frames.items())
        # dev = アプリ内プレビュー用（色数を落として軽くした版。大きさを抑えるため、減らし方は元のまま）
        for lst, colors, rare in ((out, 256, True), (dev, 40, False)):
            uri, size, kind = encode(atlas, colors, rare)
            lst.append('  %s: {\n    img: "%s",\n    frames: { %s }\n  }' % (who, uri, table))
            print(who, 'frames', sum(len(v) for v in frames.values()), 'atlas', atlas.size, colors, 'colors', kind, size // 1024, 'KB')
        if dbg:
            contact(frames, os.path.join(dbg, 'contact_%s.png' % who)); atlas.save(os.path.join(dbg, 'atlas_%s.png' % who))
    for path, lst in ((os.path.join(HERE, 'js', '06_sprites.js'), out), (os.path.join(HERE, 'sprites_dev.js'), dev)):
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(js(lst))
        print('wrote', path, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()

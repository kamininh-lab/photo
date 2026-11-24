# -*- coding: utf-8 -*-
"""スプライトシート（1 枚絵のシート）から、キャラのコマを切り出すための共通部品。

シートは暗い背景の上に、黒に近いふちどりのドット絵が並んでいる。背景の暗さは場所によって違うので、
背景の色には頼らず「はっきり色のついた画素」を体とみなし、そのまわり 1 ドットをふちどりとして取り出す。
"""
import numpy as np
from PIL import Image

OUTLINE = (22, 13, 42)


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)


def fg_mask(a):
    """はっきり前景とわかる画素（明るい、または色が濃い）"""
    mx = a.max(axis=-1); mn = a.min(axis=-1)
    return (mx > 84) | ((mx - mn > 46) & (mx > 62))


def dilate(m):
    o = m.copy()
    o[1:, :] |= m[:-1, :]; o[:-1, :] |= m[1:, :]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    return o


def erode(m):
    return ~dilate(~m)


def components(mask):
    """4 連結のかたまりに番号をつける。戻り値: (番号の配列, [(面積, 番号)…])"""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); sizes = []; n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if lab[y0, x0]:
            continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; area = 0
        while stack:
            y, x = stack.pop(); area += 1
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; stack.append((yy, xx))
        sizes.append((area, n))
    return lab, sizes


def runs(v, gap):
    """1 次元の真偽の列を、gap 個以上の空きで区切る → [(start, stop), …]"""
    out, s, last = [], None, None
    for i, on in enumerate(np.asarray(v).tolist()):
        if on:
            if s is None:
                s = i
            last = i
        elif s is not None and i - last >= gap:
            out.append((s, last + 1)); s = None
    if s is not None:
        out.append((s, last + 1))
    return out


def tight_box(a, x0, x1, y0, y1):
    """[x0,x1)×[y0,y1) の中で、前景のある範囲に箱を縮める"""
    m = fg_mask(a[y0:y1, x0:x1])
    cols = np.nonzero(m.sum(axis=0) >= 1)[0]; rows = np.nonzero(m.sum(axis=1) >= 1)[0]
    if not len(cols) or not len(rows):
        return None
    return [x0 + int(cols[0]), y0 + int(rows[0]), x0 + int(cols[-1]) + 1, y0 + int(rows[-1]) + 1]


def split_cols(a, x0, x1, y0, y1, n):
    """つながって見える n コマを、前景のいちばん薄い列で区切る → [(x0, x1), …]"""
    m = fg_mask(a[y0:y1, x0:x1]).sum(axis=0).astype(float)
    cuts = [x0]; w = (x1 - x0) / float(n)
    for i in range(1, n):
        c = int(round(i * w)); lo, hi = max(1, int(c - w * 0.3)), min(len(m) - 1, int(c + w * 0.3))
        seg = m[lo:hi] + np.abs(np.arange(lo, hi) - c) * 0.02
        cuts.append(x0 + lo + int(np.argmin(seg)))
    cuts.append(x1)
    return [(cuts[i], cuts[i + 1]) for i in range(n)]


def cutout(a, box, xlim=None, ylim=None, solo=False, pad=3, body_mask=None):
    """box=[x0,y0,x1,y1] のコマを、透明な背景つきで取り出す。
    xlim=(xa, xb)・ylim=(ya, yb) を渡すと、となりのコマや枠線にはみ出さない。
    となりのコマから入り込んだ切れ端（左右の端に接している、体とつながっていないかたまり）は捨てる。
    solo=True なら体と、そのすぐ近くのものだけ残す。
    体 = body_mask（体の色の画素を返す関数）がいちばん多く乗っているかたまり。無ければいちばん大きいかたまり。
    戻り値: (RGBA の配列 uint8, 切り出しの左上 (x, y))"""
    H, W = a.shape[:2]
    xa, xb = xlim if xlim else (0, W)
    ya, yb = ylim if ylim else (0, H)
    x0, y0 = max(xa, box[0] - pad, 0), max(ya, box[1] - pad, 0)
    x1, y1 = min(xb, box[2] + pad, W), min(yb, box[3] + pad, H)
    c = np.zeros((y1 - y0 + 4, x1 - x0 + 4, 3), np.int16); c[2:-2, 2:-2] = a[y0:y1, x0:x1]
    mx = c.max(axis=-1)
    core = fg_mask(c); core[:2, :] = core[-2:, :] = False; core[:, :2] = core[:, -2:] = False
    # 光のにじみ（暗めのふち）を外側から削る
    for _ in range(2):
        edge = core & dilate(~core) & (mx <= 100)
        if not edge.any():
            break
        core &= ~edge
    body = erode(dilate(core)) | core                     # 1 ドットのすきま（体の中の暗い線）を埋める
    # 囲まれた暗い部分（目や影）を埋める。大きくて背景色のものは抜けたままにする
    lab, sizes = components(~body)
    border = set(np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])).tolist())
    for area, n in sizes:
        if n in border:
            continue
        sel = lab == n
        mean = c[sel].mean(axis=0)
        bgish = mean[2] >= 26 and mean[0] <= 52 and mean[1] <= 30 and mean[2] <= 70
        if area <= 14 or not bgish:
            body |= sel
    lab, sizes = components(body)
    if sizes:
        main, main_area = max(sizes)[1], max(sizes)[0]
        if body_mask is not None:
            bm = body_mask(c) & body
            if bm.sum() >= 12:
                cnt = np.bincount(lab[bm], minlength=len(sizes) + 1)
                main = int(np.argmax(cnt)); main_area = [ar for ar, n in sizes if n == main][0]
        near = lab == main
        for _ in range(5):
            near = dilate(near)
        wcut = body.shape[1]
        for area, n in sizes:
            if n == main:
                continue
            sel = lab == n
            xs = np.nonzero(sel.any(axis=0))[0]
            at_edge = (xlim is not None) and ((xs[0] <= 2 and x0 == xa) or (xs[-1] >= wcut - 3 and x1 == xb))
            if area < 12 or (at_edge and area < 0.3 * main_area) or (solo and not (near & sel).any()):
                body[sel] = False
    ring = dilate(body) & ~body                           # ふちどり
    out = np.zeros(c.shape[:2] + (4,), np.uint8)
    out[..., :3] = np.clip(c, 0, 255); out[..., 3] = (body | ring) * 255
    out[ring, :3] = OUTLINE
    return out, (x0 - 2, y0 - 2)


def trim(rgba):
    """透明な余白を落とす。戻り値: (配列, (dx, dy))"""
    al = rgba[..., 3] > 0
    if not al.any():
        return rgba[:1, :1], (0, 0)
    ys = np.nonzero(al.any(axis=1))[0]; xs = np.nonzero(al.any(axis=0))[0]
    return rgba[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1], (int(xs[0]), int(ys[0]))

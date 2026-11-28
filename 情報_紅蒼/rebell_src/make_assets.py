# -*- coding: utf-8 -*-
"""フォルダにある絵（ポスター・原画・表情一覧・スプライトシート）から、ゲームに埋め込む素材を切り出して
js/05_assets.js（配布用）と assets_dev.js（アプリ内プレビュー用の軽い版）を作る。
使い方:  python rebell_src/make_assets.py
"""
import base64, io, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_ART = os.path.join(os.path.dirname(HERE), 'art', 'source')
SRC = {
    'original': 'original-art.jpg',      # このみさんの原画
    'poster': 'neon-city-poster.png',                         # ポスター
    'faces': 'character-expressions.png',                # 顔グラフィック（ダメージ・怒り・喜び）
    'sheet_k': 'kurenai-sprites.png',       # 左上の大きな顔を「通常」の顔に使う
    'sheet_a': 'aoi-sprites.png',
    'faces2': 'kurenai-aoi-expressions-sad-shy.png',   # 表情一覧の 2 枚目（悲しみ・おとぼけ・照れ）。並びは 1 枚目と同じ（もとの名前は 0F583E35-….png）
    'faces3': 'kurenai-aoi-expressions-smile-surprise.png',   # 3 枚目（愛想笑い・驚き・緩んだ笑顔）
    'faces4': '542008D5-3126-4EBC-AD5A-0A8C55DED06C.png',     # 4 枚目（紅: 真剣・悔しさ・覚悟 ／ 蒼: 困惑・安堵・覚醒）
}
# 顔: (元の絵, 絵の全体の範囲)。HUD ではこの中の一部（FACE_HUD）を、カットインでは横長の帯（FACE_BAND）を使う
FACES = {
    'k_normal': ('sheet_k', (14, 64, 226, 208)), 'a_normal': ('sheet_a', (20, 66, 230, 216)),
    'k_damage': ('faces', (228, 228, 600, 565)), 'k_anger': ('faces', (628, 228, 996, 565)), 'k_joy': ('faces', (1024, 228, 1406, 565)),
    'a_damage': ('faces', (228, 656, 600, 993)), 'a_anger': ('faces', (628, 656, 996, 993)), 'a_joy': ('faces', (1024, 656, 1406, 993)),
    # 2 枚目: sad = 悲しみ、silly = おとぼけ、shy = 照れ
    'k_sad': ('faces2', (228, 228, 600, 565)), 'k_silly': ('faces2', (628, 228, 996, 565)), 'k_shy': ('faces2', (1024, 228, 1406, 565)),
    'a_sad': ('faces2', (232, 658, 600, 990)), 'a_silly': ('faces2', (632, 658, 996, 990)), 'a_shy': ('faces2', (1028, 658, 1406, 990)),
    # 3 枚目: wry = 愛想笑い、surprise = 驚き、smile = 緩んだ笑顔
    'k_wry': ('faces3', (228, 228, 600, 565)), 'k_surprise': ('faces3', (628, 228, 996, 565)), 'k_smile': ('faces3', (1024, 228, 1406, 565)),
    'a_wry': ('faces3', (232, 658, 600, 990)), 'a_surprise': ('faces3', (632, 658, 996, 990)), 'a_smile': ('faces3', (1028, 658, 1406, 990)),
    # 4 枚目: 紅 serious = 真剣、regret = 悔しさ、resolve = 覚悟・決意 ／ 蒼 puzzled = 困惑、relief = 安堵、awaken = 覚醒
    'k_serious': ('faces4', (228, 228, 600, 565)), 'k_regret': ('faces4', (628, 228, 996, 565)), 'k_resolve': ('faces4', (1024, 228, 1406, 565)),
    'a_puzzled': ('faces4', (232, 658, 600, 990)), 'a_relief': ('faces4', (632, 658, 996, 990)), 'a_awaken': ('faces4', (1028, 658, 1406, 990)),
}
# HUD の顔枠（横 168 : 縦 114）に入れる範囲。元の絵の座標
FACE_HUD = {
    'k_normal': (22, 68, 222, 204), 'a_normal': (28, 80, 228, 216),
    'k_damage': (268, 238, 568, 442), 'k_anger': (662, 262, 962, 466), 'k_joy': (1046, 232, 1346, 436),
    'a_damage': (300, 700, 600, 904), 'a_anger': (696, 712, 996, 916), 'a_joy': (1066, 690, 1366, 894),
    'k_sad': (288, 288, 588, 492), 'k_silly': (668, 258, 968, 462), 'k_shy': (1094, 278, 1394, 482),
    'a_sad': (298, 726, 598, 930), 'a_silly': (688, 676, 988, 880), 'a_shy': (1094, 716, 1394, 920),
    'k_wry': (250, 278, 550, 482), 'k_surprise': (650, 278, 950, 482), 'k_smile': (1065, 268, 1365, 472),
    'a_wry': (290, 700, 590, 904), 'a_surprise': (696, 690, 996, 894), 'a_smile': (1100, 700, 1400, 904),
    'k_serious': (270, 300, 570, 504), 'k_regret': (628, 232, 928, 436), 'k_resolve': (1100, 230, 1400, 434),
    'a_puzzled': (290, 700, 590, 904), 'a_relief': (680, 680, 980, 884), 'a_awaken': (1090, 730, 1390, 934),
}
# カットインの帯（目のあたりを横長に）
FACE_BAND = {
    'k_anger': (628, 322, 996, 462), 'a_anger': (628, 768, 996, 908),
    'k_normal': (14, 96, 226, 176), 'a_normal': (20, 122, 230, 202),
}
ICONS = {'iconKurenai': (48, 332, 192, 428), 'iconAoi': (52, 760, 196, 856)}      # 表情一覧の左にある武器の絵


def uri(im, fmt, **kw):
    buf = io.BytesIO(); im.save(buf, fmt, **kw)
    mime = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}[fmt]
    return 'data:%s;base64,%s' % (mime, base64.b64encode(buf.getvalue()).decode('ascii'))


def main():
    imgs = {k: Image.open(os.path.join(SOURCE_ART, v)).convert('RGB') for k, v in SRC.items()}
    out, dev, meta = {}, {}, {}
    for k, (src, box) in FACES.items():
        im = imgs[src].crop(box)
        out['face_' + k] = uri(im, 'WEBP', quality=84, method=6)
        dev['face_' + k] = uri(im.resize((im.size[0] // 2, im.size[1] // 2), Image.LANCZOS), 'WEBP', quality=45, method=6)
        h, b = FACE_HUD[k], FACE_BAND.get(k)
        meta[k] = {'w': box[2] - box[0], 'h': box[3] - box[1],
                   'hud': [h[0] - box[0], h[1] - box[1], h[2] - h[0], h[3] - h[1]],
                   'band': [b[0] - box[0], b[1] - box[1], b[2] - b[0], b[3] - b[1]] if b else None}
    for k, box in ICONS.items():      # 武器の絵は、暗い背景を透明にして線だけ残す
        a = np.asarray(imgs['faces'].crop(box)).astype(int)
        alpha = np.clip((a.max(axis=-1) - 105) * 255 // 50, 0, 255).astype(np.uint8)
        im = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
        out[k] = uri(im, 'WEBP', lossless=True, quality=100, method=6); dev[k] = uri(im, 'WEBP', quality=60, alpha_quality=80, method=6)
    poster, orig = imgs['poster'], imgs['original']
    w, h = orig.size
    out['poster'] = uri(poster.resize((800, 1200), Image.LANCZOS), 'JPEG', quality=86)
    out['original'] = uri(orig.resize((760, round(760 * h / w)), Image.LANCZOS), 'JPEG', quality=86)
    dev['poster'] = uri(poster.resize((200, 300), Image.LANCZOS), 'WEBP', quality=40)
    dev['original'] = uri(orig.resize((190, round(190 * h / w)), Image.LANCZOS), 'WEBP', quality=40)
    write(os.path.join(HERE, 'js', '05_assets.js'), out, meta, 1)
    write(os.path.join(HERE, 'assets_dev.js'), dev, meta, 0.5)


def write(path, out, meta, scale):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// make_assets.py が生成したファイル（手で編集しない）\n')
        f.write('window.REBELL_ASSETS = {\n')
        for k, v in out.items():
            f.write('  %s: "%s",\n' % (k, v))
        f.write('};\n')
        f.write('// 顔の絵の中で使う範囲 [x, y, 幅, 高さ]（hud = 顔枠、band = カットインの帯）。scale = 埋め込んだ絵の縮尺\n')
        f.write('window.REBELL_FACES = { scale: %s,\n' % scale)
        for k, m in meta.items():
            f.write('  %s: { hud: %s, band: %s },\n' % (k, m['hud'], m['band'] if m['band'] else 'null'))
        f.write('};\n')
    print('wrote', path, os.path.getsize(path) // 1024, 'KB', {k: len(v) // 1024 for k, v in out.items()})


if __name__ == '__main__':
    main()

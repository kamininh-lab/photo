# -*- coding: utf-8 -*-
"""rebell_src/js/*.js を名前順に連結して、1 ファイルで動く HTML を作る。
使い方:  python rebell_src/build.py
出力:    （このフォルダの 1 つ上）REBELL_紅蒼交錯.html  … 配布用
         （このフォルダの 1 つ上）index.html           … 配布用と同じ中身の写し（ビルドのたびに上書きする）
         rebell_src/dev.html                           … 開発確認用（埋め込み画像を軽くした版）

確認用に、末尾へ追加のスクリプトを足した HTML も作れる（配布用には入らない）:
         python rebell_src/build.py --extra 追加.js 出力.html
"""
import glob, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'REBELL_紅蒼交錯.html')
INDEX = os.path.join(ROOT, 'index.html')      # 配布用と同じ中身を、この名前でも置く
DEV_SWAP = {'05_assets.js': 'assets_dev.js', '06_sprites.js': 'sprites_dev.js', '07_midboss.js': 'midboss_dev.js', '07_idachi_art.js': 'idachi_dev.js'}
# アプリ内プレビューは 500KB くらいまでしか開けないので、確認用からは音のモジュールを外す（無くても動く）
DEV_SKIP = ('10_codex_audio.js', '11_codex_sfx_slash.js')


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == '--extra':
        build(sys.argv[3], False, sys.argv[2])
        return
    build(OUT, False)
    shutil.copyfile(OUT, INDEX)
    print('copied to', INDEX)
    build(os.path.join(HERE, 'dev.html'), True)


def strip_tail_comment(ln):
    """行末のコメント（空白 2 つ以上のあとの // …）を落とす。文字列の中にある // は残す"""
    q, i, n = None, 0, len(ln)
    while i < n:
        c = ln[i]
        if q:
            if c == '\\':
                i += 2
                continue
            if c == q:
                q = None
        elif c in '\'"`':
            q = c
        elif c == '/' and ln.startswith('//', i) and i >= 2 and ln[i - 1] == ' ' and ln[i - 2] == ' ':
            return ln[:i].rstrip()
        i += 1
    return ln


def build(out, dev, extra=None):
    with open(os.path.join(HERE, 'template.html'), encoding='utf-8') as f:
        html = f.read()
    paths = sorted(glob.glob(os.path.join(HERE, 'js', '*.js')))
    if extra:
        paths.append(extra)
    parts = []
    for p in paths:
        name = os.path.basename(p)
        if dev and name in DEV_SKIP:
            continue
        if dev and name in DEV_SWAP:
            p = os.path.join(HERE, DEV_SWAP[name])
        with open(p, encoding='utf-8') as f:
            src = f.read()
        if dev:      # 確認用は軽くする: 行頭の空白・コメントだけの行・行末のコメントを落とす（複数行の文字列は使っていない）
            src = '\n'.join(strip_tail_comment(ln.strip()) for ln in src.split('\n') if ln.strip() and not ln.strip().startswith('//'))
        # </script> が文字列中にあっても HTML を壊さないようにする
        src = src.replace('</script', '<\\/script')
        parts.append('<script>\n// ==== %s ====\n%s\n</script>' % (name, src))
    html = html.replace('<!--SCRIPTS-->', '\n'.join(parts))
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('built', out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()

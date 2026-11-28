# REBELL のストーリー（あらすじ・全会話・ボス戦の台詞・エンディング）を Word に書き起こす。
# 会話は 65_talk.js の R.TALKS から、そのまま取り出す。
import re, io, sys
from docx import Document
from docx.shared import Pt, RGBColor, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SRC = sys.argv[1]
OUT = sys.argv[2]
talk_js = io.open(SRC + r'\js\65_talk.js', encoding='utf-8').read()

# ---- 会話を取り出す ----
body = talk_js[talk_js.index('R.TALKS = {'):talk_js.index('// 話し手ごとの見た目')]
TALKS = {}
for m in re.finditer(r'\n    (\w+): \[(.*?)\n    \]', body, re.S):
    items = []
    for it in re.finditer(r"\{ who: '(\w+)'.*?text: \[(.*?)\] \}", m.group(2)):
        items.append((it.group(1), re.findall(r"'([^']*)'", it.group(2))))
    TALKS[m.group(1)] = items

NAME = {'kurenai': '紅', 'aoi': '蒼', 'shikaku': '四角', 'kurose': '黒瀬', 'idachi': '井立', 'mako': '大森'}
COL = {'kurenai': RGBColor(0xD0, 0x2C, 0x86), 'aoi': RGBColor(0x1E, 0x6F, 0xC0), 'shikaku': RGBColor(0xB0, 0x7A, 0x00),
       'kurose': RGBColor(0x7A, 0x3C, 0xC0), 'idachi': RGBColor(0x14, 0x7A, 0x96)}
JP = 'Yu Mincho'; JPG = 'Yu Gothic'

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Mm(210), Mm(297)
for s in ('left_margin', 'right_margin'): setattr(sec, s, Mm(22))
sec.top_margin = sec.bottom_margin = Mm(20)

def set_font(style_or_run, name, east):
    style_or_run.font.name = name
    rpr = style_or_run.element.get_or_add_rPr() if hasattr(style_or_run.element, 'get_or_add_rPr') else style_or_run._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None: rf = OxmlElement('w:rFonts'); rpr.append(rf)
    rf.set(qn('w:eastAsia'), east); rf.set(qn('w:ascii'), name); rf.set(qn('w:hAnsi'), name)

st = doc.styles['Normal']; set_font(st, JP, JP); st.font.size = Pt(10.5)
st.paragraph_format.space_after = Pt(4); st.paragraph_format.line_spacing = 1.35
for lv, sz, col in (('Title', 26, RGBColor(0x3A, 0x14, 0x70)), ('Heading 1', 16, RGBColor(0x3A, 0x14, 0x70)), ('Heading 2', 12.5, RGBColor(0x55, 0x2A, 0x90))):
    s = doc.styles[lv]; set_font(s, JPG, JPG); s.font.size = Pt(sz); s.font.bold = True; s.font.color.rgb = col
    s.paragraph_format.keep_with_next = True
    s.paragraph_format.space_before = Pt(18 if lv == 'Heading 1' else 12 if lv == 'Heading 2' else 0)
    s.paragraph_format.space_after = Pt(6)

def para(text='', bold=False, size=None, color=None, align=None, italic=False, after=None):
    p = doc.add_paragraph()
    if text:
        r = p.add_run(text); r.bold = bold; r.italic = italic
        if size: r.font.size = Pt(size)
        if color: r.font.color.rgb = color
    if align: p.alignment = align
    if after is not None: p.paragraph_format.space_after = Pt(after)
    return p

def note(text):      # 場面の説明（ト書き）
    p = para(text, color=RGBColor(0x60, 0x60, 0x70), size=9.5)
    p.paragraph_format.left_indent = Mm(4)
    return p

def line(who, texts, tag=None):      # 台詞 1 つ: 話し手の名前 + 「台詞」（ゲームの 2 行は改行で）
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Mm(16); p.paragraph_format.first_line_indent = Mm(-16)
    r = p.add_run(NAME.get(who, who)); r.bold = True; set_font(r, JPG, JPG)
    if who in COL: r.font.color.rgb = COL[who]
    p.add_run('\t')
    p.paragraph_format.tab_stops.add_tab_stop(Mm(16))
    for i, t in enumerate(texts):
        if i: p.add_run().add_break()
        p.add_run(('「' if i == 0 else '　') + t + ('」' if i == len(texts) - 1 else ''))
    if tag:
        rr = p.add_run('　' + tag); rr.font.size = Pt(8.5); rr.font.color.rgb = RGBColor(0x80, 0x80, 0x90)
    return p

def talk(key):
    for who, texts in TALKS[key]: line(who, texts)

def rule():
    p = doc.add_paragraph(); pPr = p._p.get_or_add_pPr(); b = OxmlElement('w:pBdr'); bt = OxmlElement('w:bottom')
    for k, v in (('val', 'single'), ('sz', '6'), ('space', '1'), ('color', 'B8A8E0')): bt.set(qn('w:' + k), v)
    b.append(bt); pPr.append(b)

# ---- 表紙 ----
doc.add_paragraph('REBELL ― 紅蒼交錯', style='Title').alignment = WD_ALIGN_PARAGRAPH.CENTER
para('ストーリー台本', size=14, align=WD_ALIGN_PARAGRAPH.CENTER, color=RGBColor(0x55, 0x2A, 0x90))
para('交わる運命、ぶつかる色。', size=12, align=WD_ALIGN_PARAGRAPH.CENTER, italic=True)
para('サイバーパンク 2D ドットアクション　／　キャラクターデザイン・原案：このみ', size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=RGBColor(0x60, 0x60, 0x70))
para('※ ゲームの現在の版（2026 年 11 月 28 日）の台詞を、そのまま書き起こしたもの。', size=9, align=WD_ALIGN_PARAGRAPH.CENTER, color=RGBColor(0x80, 0x80, 0x90))
rule()

# ---- 登場人物 ----
doc.add_heading('登場人物', level=1)
CHARS = [
    ('紅（くれない）', '大鎌を振るう少女。明るく元気で、荒々しく踏み込む。蒼とともに姫を取り戻しに向かう。のちに帝国から「反逆者（REBELL）」と呼ばれる。'),
    ('蒼（あおい）', '刀を閃かせる少女。落ち着いていて、静かな微笑みのまま流れを読む。紅とは性格も戦い方も正反対。'),
    ('四角 明宏（よすみ あきひろ）', '二人の大鎌と刀を作ったメカニック。通信で二人を支え、道案内と解析を受け持つ。――その正体は、龍を学園に封じ、結界を張った本人。龍を倒させるために二人を導き、最後に裏切る。'),
    ('大森 茉子（おおもり まこ）', '玉龍高校のサポート／ヒーラー。紅と蒼のお姉さん役で、紅からは「茉子ねえ」、蒼からは「茉子さん」と呼ばれる。龍との戦いの途中で駆けつける。「無理はしないで。――ちゃんと、私が支えるから。」'),
    ('井立 快晴（いだち かいせい）', '鉄塔のてっぺんで立ちはだかる空手家。《龍》を守る者。「守るために、強くなる」。'),
    ('黒瀬 龍士（くろせ りゅうじ）', 'カメラを手にする異色の空手使い。正体と目的は謎。学園で二人の腕を試す。四角の嘘を見抜いていて、最後は二人を逃がすために、おとりとして一人残る。'),
    ('玉龍（ぎょくりゅう）', '紅い月の夜に目覚めた《龍》。玉龍の姫をさらい、学園のいちばん奥に囚えている。'),
]
t = doc.add_table(rows=0, cols=2); t.style = 'Table Grid'
for n, d in CHARS:
    c = t.add_row().cells; c[0].width = Mm(52); c[1].width = Mm(114)
    rr = c[0].paragraphs[0].add_run(n); rr.bold = True; set_font(rr, JPG, JPG)
    c[1].paragraphs[0].add_run(d)

# ---- 序章 ----
doc.add_heading('序章　あらすじ', level=1)
note('タイトル画面のあと、黒い画面に一行ずつ浮かび上がる。')
STORY = ['紅い月が昇る夜。', '目覚めた《龍》が、玉龍の姫をさらっていった。', '', 'その夜、立ち上がった二人の少女――', '大鎌を振るう 紅（くれない）。刀を閃かせる 蒼（あおい）。', '', '囚われの姫を、取り戻せ。', '二人は、龍の待つ玉龍学園へ走る。']
for s in STORY:
    if not s: para(after=0); continue
    p = para(s, align=WD_ALIGN_PARAGRAPH.CENTER, after=2, bold=(s == '囚われの姫を、取り戻せ。'), size=(13 if s == '囚われの姫を、取り戻せ。' else None),
             color=(RGBColor(0xD0, 0x2C, 0x86) if s == '囚われの姫を、取り戻せ。' else None))

# ---- 全体マップ ----
doc.add_heading('全体マップ　――第1章　KAGOSHIMA CITY', level=1)
note('第1章「KAGOSHIMA CITY」は、第1話〜第4話の 4 つのステージでできている。')
note('あらすじのあと、サイバーパンクの鹿児島市を上空から見た全体マップ「第1章　KAGOSHIMA CITY」が出る'
     '（北が上。左に市街地と甲突川・城山・天文館、中央に錦江湾、右に桜島。湾には紅い月が映っている）。四角が通信で送ってくる作戦図という見立て。')
note('道のりは、左下の台地から甲突川を越えて城山のふもとへ渡る水道橋 → 城山の上にそびえる鉄塔の足もと → 鉄塔のてっぺん → '
     '飛空艇の航路 → 北の玉龍学園（紅い結界のドーム）の真上、と続く。')
note('紅と蒼が道の入口から第1話のマスまで走ってくる。マスの上で決定を押すと、その話が「ステージの前」の会話から始まる。')
note('話をクリアするとマップへ戻り、「新しい道が開いた！」と出て、二人が次のマスまで走る。'
     'クリアした話は選び直して何度でも遊べ、マスには評価（S〜D）の印がつく。まだ行けないマスの名前は「？？？」。'
     '第4話をクリアしたときだけ、マップをはさまずに終章へ進む。')

# ---- 第1話 ----
doc.add_heading('第1話　ネオン廃都の水道橋', level=1)
para('STAGE 1  -  NEON RUINS AQUEDUCT', size=9, color=RGBColor(0x80, 0x80, 0x90))
doc.add_heading('ステージの前', level=2)
note('雨の降るネオンの廃都。水道橋の上に機械兵があふれている。四角から通信が入り、武器のおさらいをする。')
talk('stage1')
doc.add_heading('ボス戦　重機兵ガーディアン', level=2)
note('水道橋の終わり。重機兵ガーディアン（HEAVY GUARDIAN）が、地響きを立てて歩いてくる。')
talk('guard')
note('会話のあと「WARNING　重機兵ガーディアン」の帯が出て、戦いが始まる。')
doc.add_heading('重機兵を倒したあと', level=2)
talk('guard_end')
note('会話が終わると、ステージクリア。')

# ---- 第2話 ----
doc.add_heading('第2話　天を衝く鉄塔', level=1)
para('STAGE 2  -  SKYWARD TOWER', size=9, color=RGBColor(0x80, 0x80, 0x90))
doc.add_heading('ステージの前', level=2)
note('学園へ渡る橋は《龍》の結界で塞がれている。雲の上まで続く鉄塔を、てっぺんまで登るしかない。')
talk('tower')
doc.add_heading('ボス戦　井立 快晴', level=2)
note('鉄塔のてっぺん。風の中で、井立が待っている。')
talk('idachi')
note('戦いの途中、井立の顔が画面に割り込んで叫ぶ。')
line('idachi', ['――受けてばかりだと、思うなよ。'], '（突進のとき）')
line('idachi', ['受けてみろ。', '――蒼天破！'], '（大技のとき）')
line('idachi', ['守るために、強くなる。', '――ここから先は、本気だ！'], '（本気を出したとき。青い闘気をまとう）')
line('idachi', ['――また来たか。', '何度でも、受けて立つ。'], '（やられて、やり直したとき）')
doc.add_heading('井立を倒したあと', level=2)
talk('idachi_end')

# ---- 第3話 ----
doc.add_heading('第3話　紅月の空中回廊', level=1)
para('STAGE 3  -  SKY CORRIDOR', size=9, color=RGBColor(0x80, 0x80, 0x90))
doc.add_heading('ステージの前', level=2)
note('鉄塔のてっぺんから見下ろす、一面の雲海。結界の上を飛空艇の航路が通っている。')
talk('sky')
doc.add_heading('空中回廊', level=2)
note('画面は右上へ止まらずに流れていく。飛空艇・エアカー・浮き足場を乗り継いで進む。足を踏み外すと、四角のドローンが拾い上げてくれる（「四角のドローンが拾い上げた！」）。'
     '最後に大きな飛空艇の甲板に降り立つ。――「着艦！ ― 結界の上を越えた」')
doc.add_heading('着艦したあと', level=2)
note('飛空艇は、学園の真上に浮かんでいる。')
talk('sky_end')
note('会話が終わると、ステージクリア。全体マップに戻り、学園のマスへの道が開く。二人はデッキから飛び降りて、第4話へ。')

# ---- 第4話 ----
doc.add_heading('第4話　玉龍学園　紅い月の下で', level=1)
para('STAGE 4  -  GYOKURYU ACADEMY', size=9, color=RGBColor(0x80, 0x80, 0x90))
doc.add_heading('ステージの前', level=2)
note('結界を越えて、玉龍学園に降り立つ。月はさっきより紅い。')
talk('school')
doc.add_heading('中ボス戦　黒瀬 龍士', level=2)
note('学園の途中。カメラを手にした男が、二人の前に現れる。')
talk('kurose')
note('戦いの途中、黒瀬の顔が画面に割り込む。')
line('kurose', ['この拳、見切れるか！'], '（突進のとき）')
line('kurose', ['遊びは終わりだ。――本気で行くぞ！'], '（本気を出したとき）')
line('kurose', ['腕を上げたな、二人とも。', 'さて、もう少し本気で行くぞ！'], '（金色の闘気をまとい、動きが速くなるとき）')
note('このとき、操作している子が気力を満たして答える（画面下の一言）。')
line('kurenai', ['上等！　こっちも全力で行くよ！'], '（紅のとき）')
line('aoi', ['うん。……おかげで、目が覚めたよ'], '（蒼のとき）')
note('黒瀬を倒すと――')
line('kurose', ['……いい腕だ。二人で、ひとつか'], '（どちらかが倒れているときは「……いい腕だ。その覚悟、見せてもらった」）')
line('kurose', ['いい顔だ、撮らせてもらった。――行け。姫は、龍の足もとだ'], '（シャッターの光）')
doc.add_heading('黒瀬を退けたあと　――通信の向こう', level=2)
note('紅と蒼は先へ走り去る（黒瀬の最初の台詞から）。残った黒瀬が、通信の向こうの四角に話しかける。'
     '四角が黒幕であることを、ここでにおわせる（はっきりとは言わない）。')
talk('kurose_end')
note('会話が終わると暗転し、明けると二人は先へ進んでいる。黒瀬の姿はなく、薬と結晶が残されている。')

doc.add_heading('ボス戦　玉龍', level=2)
note('学園のいちばん奥、桜の並木の先。紅い月を背に、《龍》が姿を現す。戦いが始まると、桜吹雪が舞い散る。')
talk('dragon')
note('龍が岸に降りて羽を休めると――「玉龍が羽を休めている…今だ！」')
note('龍の体力が半分を切ると、真の力を解き放つ――「玉龍が真の力を解き放った…！　動きが速く、一撃が重くなる！」'
     '（紅い炎の気をまとう。風が強まり、桜吹雪に紅い花びらが混じる。空から火球の雨を降らせる技が加わる）')
talk('dragon_rage')
doc.add_heading('助っ人　大森 茉子', level=3)
note('押し切られそうになったところへ、大森 茉子が画面の左上から跳び込んでくる。')
talk('mako')
note('ここから大森は、自分で動いて二人を支える。体力が減るとリカバー（回復）、相棒が倒れるとリザレクション（起こす）、'
     '龍が大技に入るとプロテクション（光の膜で 1 回だけ防ぐ）、手が空くと光弾で龍の頭をねらう。そのたびに、ひとこと声をかける。')
line('mako', ['無理はしないで。……はい、これで大丈夫'], '（リカバーのとき。ほかに「もう、また無茶して。ほら、じっとして」など）')
line('mako', ['起きて。……まだ、終わってないよ'], '（リザレクションのとき）')
line('mako', ['守りは任せて。今のうちに！'], '（プロテクションのとき）')
doc.add_heading('玉龍を倒したあと　――四角の裏切り', level=2)
note('龍が倒れる。喜ぶ二人に、通信の向こうの四角が本当のことを明かす。'
     '龍は、もともと四角が学園に封じていたもの。封じた本人にはとどめが刺せないので、龍を斬れる武器を作り、わざと二人に倒させた。')
note('四角は二人の武器を止め、機械兵に始末を命じる。そこへ大森が割って入り、二人を連れて脱出する。'
     '塞がれた出口は、現れた黒瀬がこじ開ける。黒瀬はおとりとして一人残り、カメラを二人に託す。'
     '（大森の「行くよ」の台詞から、紅・蒼・大森が画面の右へ走り去る。最後は、残った黒瀬と四角の声だけ）')
talk('dragon_end')
note('黒瀬は、ここで倒れる。会話が終わると、ステージクリア。')

# ---- 終章 ----
doc.add_heading('終章　エンディング', level=1)
note('このみさんの原画とともに。')
for s in ['龍は倒れた。だが、姫はまだ結界の中。', '裏切りの夜が明け、街に朝の色が戻る。', '――ふたりの反逆は、ここから始まる。']:
    para(s, align=WD_ALIGN_PARAGRAPH.CENTER, size=12, after=4)
para()
para('第1章　KAGOSHIMA CITY', align=WD_ALIGN_PARAGRAPH.CENTER, size=12, after=0, color=RGBColor(0xB0, 0x80, 0x20))
para('完', align=WD_ALIGN_PARAGRAPH.CENTER, size=16, bold=True, color=RGBColor(0xB0, 0x80, 0x20))
para('THANK YOU FOR PLAYING', align=WD_ALIGN_PARAGRAPH.CENTER, bold=True, color=RGBColor(0x1E, 0x6F, 0xC0))

# ---- 第2章 ----
doc.add_heading('第2章　IBUSUKI・TANIYAMA', level=1)
doc.add_heading('プロローグ', level=2)
note('エンディングで決定を押すと、まがまがしい帝国の城と、不気味な月を背に、一行ずつ浮かび上がる。'
     '（血の色の空。月は縦に裂けた瞳のようで、ひびが走り、血がしたたる。とがった塔のならぶ城には紅い旗と明かり。探照灯が空をなめる）')
for s in ['龍が倒れた、あの夜から――', '玉龍学園は、その名を改めた。', '《玉龍帝国》。その玉座に座る者の名は、まだ誰も知らない。', '帝国は、鹿児島全土の征服を開始した。', '',
          '「龍を討った反逆者（REBELL）を、捕らえよ」――帝国の布告。', '紅と蒼は、反逆者として帝国のお尋ね者となった。', '',
          '信じていた人に、裏切られた。', '守ってくれた人を、置いてきた。', '',
          '――それでも、黒瀬の遺したカメラが、ここにある。', '真実を探しに、二人は南へ向かう。']:
    if not s: para(after=0); continue
    big = s.startswith('――それでも')
    para(s, align=WD_ALIGN_PARAGRAPH.CENTER, after=2, bold=big, size=(13 if big else None), color=(RGBColor(0xD0, 0x2C, 0x86) if big else None))
doc.add_heading('全体マップ', level=2)
note('プロローグが終わると（決定で飛ばせる）、第2章の全体マップが出る。舞台は、鹿児島市の南の谷山から、指宿・開聞岳まで'
     '（北が上。左に薩摩半島、中央に錦江湾、右に大隅半島、上の端に桜島の南側）。')
note('マスは 5 つ。鹿児島市街から、海ぞいに南へ下る道のり: '
     '谷山（海ぞいの工業地帯）→ 平川動物公園 → 喜入（石油の基地）→ 指宿（砂むし温泉と知林ヶ島）→ 開聞岳。')
note('いま遊べるのは第1話（谷山）だけ。ほかのマスは「準備中」で、見て回れるが始められない。Esc でタイトルへ戻る。')

doc.add_heading('第1話　谷山　白昼の臨海通り', level=2)
para('STAGE 1  -  TANIYAMA BAYSIDE', size=9, color=RGBColor(0x80, 0x80, 0x90))
doc.add_heading('ステージの前', level=3)
note('裏切りの夜が明けた、まぶしい昼の谷山。青空の下、港のクレーンとメガソーラー、ヤシの並木がつづく臨海通り。'
     '街のあちこちに、帝国の手配書（WANTED　反逆者 REBELL ― 紅・蒼）が立っている。四角からの通信は、もうない。')
talk('taniyama')
doc.add_heading('臨海通り', level=3)
note('第1章の第1話より長い道のりを、右へ走り抜ける。積まれたコンテナを登り、海ぞいの運河を跳び越える。帝国の機兵とドローンが見回っている。ボスはいない。'
     '通りの終わり、「平川・喜入・指宿」の道路標識の下に着くと――「臨海通りを抜けた！ ― 南へ」')
doc.add_heading('臨海通りを抜けたあと', level=3)
talk('taniyama_end')
note('会話が終わると、ステージクリア。第2章のマップへ戻る。')

doc.save(OUT)
print('saved', OUT, {k: len(v) for k, v in TALKS.items()})

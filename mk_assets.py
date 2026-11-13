# 公開する前に実行する：img/・snd/・index.html の指紋（中身のハッシュ）の一覧 assets.json を作る。
# スマホの中にしまった絵・曲は、この一覧の指紋が変わったものだけ取り寄せ直される（sw.js）。使い方：公開用のフォルダで python mk_assets.py
import os, json, hashlib, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
files = {}
for d in ('img', 'snd'):
    for f in sorted(os.listdir(os.path.join(root, d))):
        p = os.path.join(root, d, f)
        if os.path.isfile(p): files[f'{d}/{f}'] = hashlib.sha1(open(p, 'rb').read()).hexdigest()[:12]
files['index.html'] = hashlib.sha1(open(os.path.join(root, 'index.html'), 'rb').read()).hexdigest()[:12]
json.dump({'files': files}, open(os.path.join(root, 'assets.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print(len(files), 'files')

/* 放課後のわすれもの：絵と曲をスマホの中に取っておく（2026-11-13 作者の指示：Wi-Fiがないときの通信量を減らす）
   ・一度取り寄せた絵（img/）・曲（snd/）・フォントは、ブラウザが再起動しても、次からはスマホの中から読む
   ・公開のたびに作るファイルの一覧（assets.json：ファイルごとの指紋）と見比べて、変わったファイルだけ取り寄せ直す
   ・ページ（index.html）も、一覧の指紋が同じならスマホの中のものを使う。通信できないときもスマホの中のもので開く */
const CACHE = 'houkago-assets-v1';
const BASE = new URL('./', self.location).pathname;            // 例：/houkago-wasuremono/
const rel = url => { const p = new URL(url).pathname; return p.startsWith(BASE) ? decodeURIComponent(p.slice(BASE.length)) : null; };
const keyOf = path => new URL(BASE + path, self.location.origin).href;   // ?v=… をつけずにしまう

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ファイルの一覧を取り寄せて、前回の一覧と指紋が違うファイル（とページ）を、しまってあるものから消す
let syncing = null;
function sync() {
  if (!syncing) syncing = (async () => {
    const c = await caches.open(CACHE);
    let m;
    try { const r = await fetch(keyOf('assets.json'), { cache: 'no-store' }); if (!r.ok) throw 0; m = await r.json(); }
    catch (e) { return null; }                                   // 通信できない：しまってあるものをそのまま使う
    const oldRes = await c.match(keyOf('assets.json')), old = oldRes ? await oldRes.json() : { files: {} };
    for (const req of await c.keys()) {
      const p = rel(req.url);
      if (p == null || p === 'assets.json') continue;
      const name = p === '' ? 'index.html' : p;
      if (!(name in m.files) || m.files[name] !== old.files[name]) await c.delete(req);
    }
    await c.put(keyOf('assets.json'), new Response(JSON.stringify(m), { headers: { 'Content-Type': 'application/json' } }));
    return m;
  })();
  return syncing;
}
// 新しく開いたときは、一覧をもう一度見る（10分以上たっていれば）
let syncedAt = 0;
function freshSync() { if (Date.now() - syncedAt > 600000) { syncing = null; syncedAt = Date.now(); } return sync(); }
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

async function cacheFirst(req, key) {
  const c = await caches.open(CACHE);
  const hit = await c.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) c.put(key, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;            // 一部だけの取り寄せは、そのまま通す
  const url = new URL(req.url);
  // フォント（Google Fonts）：フォントの中身は変わらないのでしまう。指定の CSS は通信できればそちらを使う
  if (url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req, req.url)); return; }
  if (url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.open(CACHE).then(c => fetch(req).then(r => { if (r.ok) c.put(req.url, r.clone()); return r; }).catch(() => c.match(req.url))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const p = rel(req.url);
  if (p == null) return;
  // ページ：一覧の指紋が前と同じなら、しまってあるページ。違えば取り寄せ直す。通信できなければしまってあるページ
  if (req.mode === 'navigate' || p === '' || p === 'index.html') {
    e.respondWith((async () => {
      await withTimeout(freshSync(), 4000);
      const c = await caches.open(CACHE), key = keyOf('index.html');
      const hit = await c.match(key);
      if (hit) return hit;
      try { const r = await fetch(key, { cache: 'no-cache' }); if (r.ok) c.put(key, r.clone()); return r; }
      catch (err) { return hit || Response.error(); }
    })());
    return;
  }
  // 絵・曲：しまってあればそれを使う。なければ取り寄せてしまう
  if (/^(img|snd)\//.test(p)) {
    e.respondWith((async () => { await withTimeout(sync(), 3000); return cacheFirst(req, keyOf(p)); })());
  }
});

const CACHENAME_FILES = 'conbimer-files';
const CACHENAME_ITEMS = 'conbimer-items';

addEventListener('install', ev => {
    ev.waitUntil((async () => {
        await skipWaiting();
        const files = await caches.open(CACHENAME_FILES);
        await files.addAll(['favicon.png', 'index.html', 'script.js', 'style.css']);
        const items = await caches.open(CACHENAME_ITEMS);
        await items.addAll(['0', '1', '2', '3']);
    })());
});

addEventListener('activate', ev => ev.waitUntil(clients.claim()));

addEventListener('fetch', ev => {
    /** @type {Request} */ const req = ev.request;

    const url = new URL(req.url);
    const purpose = url.pathname.slice('/'.length, url.pathname.endsWith('/') ? -1 : undefined) || 'index.html';
    const nameas = url.search.slice('?i='.length);

    // POST /put?i=n
    //     <- X-Used-Colors: a-b-c
    //     <- X-Made-From: i-j-k
    // GET  /get?i=n
    //     -> Content-Type: image/png
    //     -> X-Used-Colors: a-b-c
    // GET  /has?u=i-j-k
    //     -> 'n' or ''
    // GET  /all
    //     -> [[n, a-b-c], [.., ..], ..]

    switch (purpose) {
    case 'put':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            await items.put(
                nameas,
                new Response(await req.blob(), {statusText: req.headers.get('X-Used-Colors')}));
            await items.put(
                req.headers.get('X-Made-From'),
                new Response(nameas))
            return new Response(nameas);
        })());

    case 'get':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            const res = await items.match(nameas, {ignoreSearch: true});
            return res
                ? new Response(await res.blob(), {headers: {
                    'Content-Type': 'image/png',
                    'X-Used-Colors': ['00ffff', 'ff00ff', 'ffff00', '000000'][nameas] || res.statusText,
                }})
                : new Response(null, {
                    status: 404,
                    statusText: "No item named '"+nameas+"' yet",
                });
        })());

    case 'has':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            return await items.match(nameas) || new Response();
        })());

    case 'all':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            const r = [];
            for (const key of await items.keys()) {
                const res = await items.match(key);
                if (!res.statusText) continue;
                const nameas = key.url.slice(key.url.lastIndexOf('/')+1);
                r.push([
                    nameas,
                    ['00ffff', 'ff00ff', 'ffff00', '000000'][nameas] || res.statusText,
                ]);
            }
            return new Response(JSON.stringify(r));
        })());

    case 'clr':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            for (const key of await items.keys()) {
                const nameas = key.url.slice(key.url.lastIndexOf('/')+1);
                if (3 < nameas) await items.delete(key);
            }
            return new Response('done');
        })());

    case 'upd':
        return ev.respondWith((async () => {
            await caches.delete(CACHENAME_FILES);
            const files = await caches.open(CACHENAME_FILES);
            await files.addAll(['favicon.png', 'index.html', 'script.js', 'style.css']);
            return new Response('done');
        })());
    }

    ev.respondWith((async () => {
        const files = await caches.open(CACHENAME_FILES);
        return await files.match(purpose) || new Response(null, {
            status: 404,
            statusText: "No resource at '/"+purpose+"'",
        });
    })());
});

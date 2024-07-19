const CACHENAME_FILES = 'conbimer-files';
const CACHENAME_ITEMS = 'conbimer-items';

addEventListener('install', ev => {
    ev.waitUntil((async () => {
        await skipWaiting();
        const files = await caches.open(CACHENAME_FILES);
        await files.addAll([
            'favicon.png',
            'index.html',
            'script.js',
            'style.css',
        ]);
        const items = await caches.open(CACHENAME_ITEMS);
        await items.addAll([
            '0?c=00ffff',
            '1?c=ff00ff',
            '2?c=ffff00',
            '3?c=000000',
        ]);
    })());
});

addEventListener('activate', ev => ev.waitUntil(clients.claim()));

addEventListener('fetch', ev => {
    /** @type {Request} */ const req = ev.request;

    const url = new URL(req.url);
    const purpose = url.pathname.slice('/'.length, url.pathname.endsWith('/') ? -1 : undefined) || 'index.html';
    const nameas = url.search.slice('?i='.length);

    switch (purpose) {
    case 'put':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            await items.put(
                nameas+'?c='+req.headers.get('X-Used-Colors'),
                new Response(await req.blob()));
            return new Response(nameas);
        })());

    case 'get':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            const res = await items.match(nameas, {ignoreSearch: true});
            const url = new URL(res.url);
            return res
                ? new Response(res.body, {headers: {
                    'Content-Type': 'image/png',
                    'X-Used-Colors': url.search.slice('?c='.length),
                }})
                : new Response(null, {
                    status: 404,
                    statusText: "No item named '"+nameas+"' yet",
                });
        })());

    case 'all':
        return ev.respondWith((async () => {
            const items = await caches.open(CACHENAME_ITEMS);
            const r = [];
            for (const key of await items.keys()) {
                const res = await items.match(key);
                const url = new URL(res.url);
                r.push([
                    url.pathname.slice('/'.length),
                    url.search.slice('?c='.length),
                ]);
            }
            return new Response(JSON.stringify(r));
        })());

    case 'clr':
        return ev.respondWith((async () => {
            const allkeys = await caches.keys();
            await Promise.all(allkeys.map(key => caches.delete(key)));
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

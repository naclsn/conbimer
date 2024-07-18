addEventListener('install', _ => void skipWaiting());
addEventListener('activate', _ => void clients.claim());

/** @type {?OffscreenCanvas} */
let offcanvas;

addEventListener('fetch', ev => {
    /** @type {Request} */ const req = ev.request;
    const key = 'conbimer_';//+ev.clientId;

    const url = new URL(req.url);
    const purpose = url.pathname.slice(1, url.pathname.endsWith('/') ? -1 : undefined);
    const nameas = url.search.slice(1+2);

    switch (purpose) {
    case 'put':
        return ev.respondWith((async () => {
            if (!offcanvas) offcanvas = new OffscreenCanvas(128, 128);
            offcanvas
                .getContext('2d')
                .putImageData(
                    new ImageData(
                        new Uint8ClampedArray(
                            await req.arrayBuffer()), 128),
                    0, 0);

            const cache = await caches.open(key);
            await cache.put(nameas, new Response(
                await offcanvas.convertToBlob(),
                {headers: {'Content-Type': 'image/png'}}));

            return new Response(nameas);
        })());

    case 'get':
        return ev.respondWith((async () => {
            const cache = await caches.open(key);
            return await cache.match(nameas) || new Response(null, {
                status: 404,
                statusText: "No item named '"+nameas+"' yet",
            });
        })());
    }

    ev.respondWith(new Response(null, {
        status: 400,
        statusText: "Should be '/put' or '/get', not '/"+purpose+"'",
    }));
});

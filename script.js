window.onload = async function() {
    const RESIZE = 128;

    if (!navigator.serviceWorker) return document.body.innerHTML = '<h2>no :c</h2>'
    const re = await navigator.serviceWorker.register('worker.js');
    await re.update(); // XXX: ?wip :(
    await navigator.serviceWorker.ready;

    /** @type {HTMLElement} */ const wrapper = window.wrapper;
    /** @type {HTMLElement} */ const arena = window.arena;
    /** @type {HTMLElement} */ const button_grp = window.button_grp;
    /** @type {HTMLButtonElement} */ const boop = window.boop;
    /** @type {HTMLButtonElement} */ const draw_undo = window.draw_undo;
    /** @type {HTMLButtonElement} */ const draw_redo = window.draw_redo;
    /** @type {HTMLButtonElement} */ const draw_done = window.draw_done;
    /** @type {HTMLElement} */ const known = window.known;
    /** @type {HTMLElement} */ const colors = window.colors;
    /** @type {HTMLCanvasElement} */ const drawing = window.drawing;

    drawing.width = drawing.height = innerWidth;
    const ctx = drawing.getContext('2d');

    scrollBy(0, -innerHeight);
    await goDone();

    /** @type {[string, string][]} */
    const load_known = await fetch('all').then(r => r.json());

    for (const data of load_known) {
        const it = known
            .appendChild(document.createElement('li'))
            .appendChild(document.createElement('img'));
        it.setAttribute('class', 'item');
        it.src = 'get?i='+data[0];
        it.setAttribute('data-colors', data[1]);
        it.onpointerdown = knownItemPointerDown;
    }

    boop.onclick = goDraw;
    draw_undo.onclick = drawUndo;
    draw_redo.onclick = drawRedo;
    draw_done.onclick = goDone;

    /** @type {(?HTMLElement)[]} */
    const draggingPointers = [];

    function knownItemPointerDown(/** @type {PointerEvent} */ ev) {
        ev.preventDefault();
        draggingPointers[ev.pointerId] = arena.appendChild(ev.target.cloneNode(true));
        const target = draggingPointers[ev.pointerId];
        target.onpointerdown = arenaItemPointerDown;
        moveAbsoluteItem(target, ev.x, ev.y);
    }

    function arenaItemPointerDown(/** @type {PointerEvent} */ ev) {
        ev.preventDefault();
        draggingPointers[ev.pointerId] = ev.target;
    }

    /** @type {Map<HTMLElement, HTMLElement[]>} */
    const itemColorMap = new Map();
    /** @type {Set<string>} */
    const availColorSet = new Set();

    document.body.onpointerup = (/** @type {PointerEvent} */ ev) => {
        const target = draggingPointers[ev.pointerId];
        if (!target) return;
        ev.preventDefault();

        const rect = arena.getBoundingClientRect();
        if (rect.top < ev.y && ev.y < rect.bottom) {
            const cols = target.getAttribute('data-colors').split('-');
            const linked = new Array(cols.length);
            for (let k = 0; k < cols.length; ++k) if (!availColorSet.has(cols[k])) {
                availColorSet.add(cols[k]);
                const it = linked[k] = colors
                    .appendChild(document.createElement('li'))
                    .appendChild(document.createElement('div'));
                it.setAttribute('style', '--color: #'+cols[k]+';');
                it.setAttribute('class', 'color');
                it.onclick = takePenPicker;
            }
            itemColorMap.set(target, linked);
            if (1 < arena.childElementCount) boop.removeAttribute('disabled');
        }

        else {
            for (const it of itemColorMap.get(target) || []) it.remove();
            itemColorMap.delete(target);
            target.remove();
            if (arena.childElementCount < 2) boop.setAttribute('disabled', 'oui');
        }

        delete draggingPointers[ev.pointerId];
    };

    document.body.onpointermove = (/** @type {PointerEvent} */ ev) => {
        const target = draggingPointers[ev.pointerId];
        if (!target) return;
        ev.preventDefault();
        moveAbsoluteItem(target, ev.x, ev.y);
    };

    function moveAbsoluteItem(/** @type {HTMLElement} */ it, x, y) {
        it.style.top = (y-it.offsetHeight/2) + 'px';
        it.style.left = (x-it.offsetWidth/2) + 'px';
    }

    /** the first index of each are the color (string) and the width
     *  then the positions as a flat list of x,y
     *  @type {[string, number...][]} */
    const drawn = [];
    let last_drawn = 0;

    const resizer = new OffscreenCanvas(RESIZE, RESIZE);

    const penpicker = document.createElement('div');
    penpicker.setAttribute('id', 'penpicker');
    for (const size of [innerWidth/18, innerWidth/24, innerWidth/36]) {
        const pen = penpicker.appendChild(document.createElement('div'));
        pen.setAttribute('style', '--size: '+size+';');
        pen.onclick = pickPen;
    }

    function takePenPicker(/** @type {PointerEvent} */ ev) {
        /** @type {HTMLElement} */ const col = ev.target;
        col.appendChild(penpicker);
    }

    function pickPen(/** @type {PointerEvent} */ ev) {
        /** @type {HTMLElement} */ const pen = ev.target;
        const col = penpicker.parentNode;
        ctx.strokeStyle = col.getAttribute('style').slice('--color: '.length, -1);
        ctx.lineWidth = pen.getAttribute('style').slice('--size: '.length, -1);
        col.removeChild(penpicker);
    }

    function goDraw() {
        arena.innerHTML = ''; // XXX: *poof* :(
        draggingPointers.length = 0;
        itemColorMap.clear();
        availColorSet.clear();

        known.setAttribute('class', 'locked');
        colors.removeAttribute('class');
        wrapper.scrollBy({top: innerWidth, behavior: 'smooth'});
        button_grp.scrollBy({left: innerWidth, behavior: 'smooth'});

        ctx.clearRect(0, 0, innerWidth, innerWidth);
        drawn.length = last_drawn = 0;
        ctx.lineCap = ctx.lineJoin = 'round';

        ctx.strokeStyle = colors.querySelector('.color').getAttribute('style').slice('--color: '.length, -1);
        ctx.lineWidth = innerWidth/24;
    }

    async function goDone(/** @type {boolean} */ done) {
        colors.innerHTML = '';
        for (const button of button_grp.children) button.setAttribute('disabled', 'oui');

        known.removeAttribute('class');
        colors.setAttribute('class', 'locked');
        wrapper.scrollBy(0, -innerWidth);
        button_grp.scrollBy(-innerWidth, 0);

        if (done) {
            const ctxx = resizer.getContext('2d');
            ctxx.clearRect(0, 0, RESIZE, RESIZE);
            ctxx.drawImage(drawing, 0, 0, RESIZE, RESIZE);
            // XXX: need to name it maybe
            const nameas = known.childElementCount.toString();
            const colset = new Set(drawn.map(one => one[0].slice(1)));
            const collst = []; colset.forEach(v => collst.push(v));
            const usedcolors = collst.join('-');
            fetch('put?i='+nameas, {
                method: 'POST',
                headers: {
                    'Content-Type': 'image/png',
                    'X-Used-Colors': usedcolors,
                },
                body: await resizer.convertToBlob(),
            }).then(_ => {
                const it = known
                    .appendChild(document.createElement('li'))
                    .appendChild(document.createElement('img'));
                it.setAttribute('class', 'item');
                it.src = 'get?i='+nameas;
                it.setAttribute('data-colors', usedcolors);
                it.onpointerdown = knownItemPointerDown;
            });
        }
    }

    function drawUndo() {
        if (!--last_drawn) draw_undo.setAttribute('disabled', 'oui');
        draw_redo.removeAttribute('disabled');

        ctx.clearRect(0, 0, innerWidth, innerWidth);

        for (const each of drawn.slice(0, last_drawn)) {
            ctx.strokeStyle = each[0];
            ctx.lineWidth = each[1];
            ctx.beginPath();
            ctx.moveTo(each[2], each[3]);
            for (let k = 4; k < each.length; k+= 2) ctx.lineTo(each[k], each[k+1]);
            ctx.stroke();
        }
    }

    function drawRedo() {
        if (drawn.length === ++last_drawn) draw_redo.setAttribute('disabled', 'oui');
        draw_undo.removeAttribute('disabled');

        const last = drawn[last_drawn-1];
        ctx.strokeStyle = last[0];
        ctx.lineWidth = last[1];
        ctx.beginPath();
        ctx.moveTo(last[2], last[3]);
        for (let k = 4; k < last.length; k+= 2) ctx.lineTo(last[k], last[k+1]);
        ctx.stroke();
    }

    drawing.onpointerdown = (/** @type {PointerEvent} */ ev) => {
        ctx.beginPath();
        ctx.moveTo(ev.offsetX, ev.offsetY);
        draw_redo.setAttribute('disabled', 'oui');
        drawn[last_drawn] = [ctx.strokeStyle, ctx.lineWidth, ev.offsetX, ev.offsetY];
    };

    drawing.onpointermove = (/** @type {PointerEvent} */ ev) => {
        if (ev.buttons) {
            ctx.lineTo(ev.offsetX, ev.offsetY);
            drawn[drawn.length-1].push(ev.offsetX, ev.offsetY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ev.offsetX, ev.offsetY);
            drawn[drawn.length-1].push(ev.offsetX, ev.offsetY);
        }
    };

    drawing.onpointerup = (/** @type {PointerEvent} */ ev) => {
        drawing.onpointermove(ev);
        ctx.stroke();
        ++last_drawn;
        draw_undo.removeAttribute('disabled');
        draw_done.removeAttribute('disabled');
    };
};

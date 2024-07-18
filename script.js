window.onload = async function() {
    if (!navigator.serviceWorker) return document.body.innerHTML = '<h2>no :c</h2>'
    const re = await navigator.serviceWorker.register('worker.js');
    await re.update(); // XXX: wip :(

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
    goDone();

    /**
     * @typedef {Object} Item
     * @property {string} face - name
     * @property {string} colors - NIY
     */

    /** @type {Item[]} */
    const load_known = [
        {face: 'cyan',    colors: '228888'},
        {face: 'magenta', colors: '882288'},
        {face: 'yellow',  colors: '888822'},
        {face: 'black',   colors: '222222'},
    ];

    let k = 0;
    const handle = setInterval(() => {
        if (load_known.length-1 === k) clearInterval(handle);
        const data = load_known[k++];
        const it = known
            .appendChild(document.createElement('li'))
            .appendChild(document.createElement('div'));
        it.setAttribute('class', 'item');
        it.textContent = data.face;
        it.setAttribute('data-colors', data.colors);
        it.onpointerdown = knownItemPointerDown;
    }, 120);

    boop.onclick = goDraw;
    draw_undo.onclick = drawUndo;
    draw_redo.onclick = drawRedo;
    draw_done.onclick = goDone;

    /** @type {(?HTMLElement)[]} */
    const draggingPointers = {};

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

    document.body.onpointerup = (/** @type {PointerEvent} */ ev) => {
        const target = draggingPointers[ev.pointerId];
        if (!target) return;
        ev.preventDefault();

        const rect = arena.getBoundingClientRect();
        if (rect.top < ev.y && ev.y < rect.bottom) {
            const cols = target.getAttribute('data-colors').split(',');
            const linked = new Array(cols.length);
            for (let k = 0; k < cols.length; ++k) {
                const it = linked[k] = colors
                    .appendChild(document.createElement('li'))
                    .appendChild(document.createElement('div'));
                it.setAttribute('style', '--color: #'+cols[k]+';');
                it.setAttribute('class', 'color');
            }
            itemColorMap.set(target, linked);
            if (1 < arena.childElementCount) boop.removeAttribute('disabled');
        }

        else {
            // WIP: colors
            for (const it of itemColorMap.get(target)) it.remove();
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
     *  @type {number[][]} */
    const drawn = [];
    let last_drawn = 0;

    function goDraw() {
        arena.innerHTML = ''; // XXX: *poof* :(
        //draggingPointers; // TODO: just in case-
        itemColorMap.clear();

        known.setAttribute('style', 'pointer-events: none;');
        wrapper.scrollBy({top: innerWidth, behavior: 'smooth'});
        button_grp.scrollBy({left: innerWidth, behavior: 'smooth'});

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, innerWidth, innerWidth);
        drawn.length = last_drawn = 0;
        ctx.lineCap = ctx.lineJoin = 'round';

        // XXX: TODO: ici
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 12;
    }

    function goDone(/** @type {boolean} */ done) {
        known.removeAttribute('style');
        wrapper.scrollBy(0, -innerWidth);
        button_grp.scrollBy(-innerWidth, 0);

        for (const button of button_grp.children) button.setAttribute('disabled', 'oui');

        if (done) {
            const resize = 128;
            ctx.drawImage(drawing, 0, 0, resize, resize);
            //console.dir(img);
            // XXX: need to name it maybe
            const nameas = known.childElementCount.toString();
            fetch('put?i='+nameas, {
                method: 'POST',
                headers: {'Content-Type': 'application/octet-stream'},
                body: ctx.getImageData(0, 0, resize, resize).data.buffer,
            }).then(_ => {
                const img = document.body.appendChild(document.createElement('img'));
                img.src = 'get?i='+nameas;
            });
        }
    }

    function drawUndo() {
        console.log("undo, %d, %d", last_drawn, drawn.length);
        if (!--last_drawn) draw_undo.setAttribute('disabled', 'oui');
        draw_redo.removeAttribute('disabled');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, innerWidth, innerWidth);

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
        console.log("redo, %d, %d", last_drawn, drawn.length);
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
    }

    drawing.onpointermove = (/** @type {PointerEvent} */ ev) => {
        if (ev.buttons) {
            ctx.lineTo(ev.offsetX, ev.offsetY);
            drawn[drawn.length-1].push(ev.offsetX, ev.offsetY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ev.offsetX, ev.offsetY);
            drawn[drawn.length-1].push(ev.offsetX, ev.offsetY);
        }
    }

    drawing.onpointerup = (/** @type {PointerEvent} */ ev) => {
        drawing.onpointermove(ev);
        ctx.stroke();
        ++last_drawn;
        draw_undo.removeAttribute('disabled');
        draw_done.removeAttribute('disabled');
    }
};

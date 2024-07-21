window.onload = async function() {
    const RESIZE = 128;

    if (!navigator.serviceWorker) return document.body.innerHTML = '<h2>no :c</h2>'
    await navigator.serviceWorker.register('worker.js');
    await navigator.serviceWorker.ready;

    /** @type {HTMLElement} */ const known_number = window.known_number;
    /** @type {HTMLButtonElement} */ const clear_items = window.clear_items;
    /** @type {HTMLButtonElement} */ const update_files = window.update_files;
    /** @type {HTMLButtonElement} */ const nuke_all = window.update_files;
    /** @type {HTMLElement} */ const wrapper = window.wrapper;
    /** @type {HTMLElement} */ const arena = window.arena;
    /** @type {HTMLElement} */ const button_grp = window.button_grp;
    /** @type {HTMLButtonElement} */ const boop = window.boop;
    /** @type {HTMLButtonElement} */ const draw_undo = window.draw_undo;
    /** @type {HTMLButtonElement} */ const draw_redo = window.draw_redo;
    /** @type {HTMLButtonElement} */ const draw_done = window.draw_done;
    /** @type {HTMLElement} */ const known = window.known;
    /** @type {HTMLElement} */ const colors = window.colors;
    /** @type {HTMLElement} */ const colmixer = window.colmixer;
    /** @type {HTMLInputElement} */ const mix_ratio = window.mix_ratio;
    /** @type {HTMLInputElement} */ const mix_white = window.mix_white;
    /** @type {HTMLButtonElement} */ const mix_done = window.mix_done;
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

    clear_items.onclick =  _ => fetch('clr').then(() => alert("c fai")).catch(() => alert("peu pa"));
    update_files.onclick = _ => fetch('upd').then(() => alert("c fai")).catch(() => alert("peu pa"));
    nuke_all.onclick =     _ => fetch('nuk').then(() => alert("c fai")).catch(() => alert("peu pa"));

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
            if (!itemColorMap.has(target)) {
                const cols = target.getAttribute('data-colors').split('-');
                const linked = [];
                for (let k = 0; k < cols.length; ++k) if (!availColorSet.has(cols[k])) {
                    availColorSet.add(cols[k]);
                    const it = colors
                        .appendChild(document.createElement('li'))
                        .appendChild(document.createElement('div'));
                    it.setAttribute('style', '--color: #'+cols[k]+';');
                    it.setAttribute('class', 'color');
                    it.onclick = takePenPicker;
                    linked.push(it);
                }
                itemColorMap.set(target, linked);
                if (1 < arena.childElementCount) boop.removeAttribute('disabled');
            }
        }

        else {
            target.remove();
            for (const it of itemColorMap.get(target) || []) {
                availColorSet.delete(it.getAttribute('style').slice('--color: #'.length, -';'.length));
                it.remove();
            }
            itemColorMap.delete(target);
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
    const pick_mixl = penpicker.appendChild(document.createElement('span'));
    pick_mixl.textContent = '<+';
    const pick_mixr = penpicker.appendChild(document.createElement('span'));
    pick_mixr.setAttribute('style', 'float: right;color: #000;');
    pick_mixr.textContent = '+>';
    for (const size of [innerWidth/40, innerWidth/12, innerWidth/7]) {
        const pen = penpicker.appendChild(document.createElement('div'));
        pen.setAttribute('class', 'pensize');
        pen.setAttribute('style', '--size: '+size+'px;');
        pen.onclick = pickPen;
    }

    function takePenPicker(/** @type {PointerEvent} */ ev) {
        ev.stopPropagation();
        /** @type {HTMLElement} */ const col = ev.target;
        col.appendChild(penpicker);
        if (col.parentElement.previousElementSibling) {
            pick_mixl.onclick = mixCols;
            pick_mixl.setAttribute('style', 'float: left;color: #000;');
        } else pick_mixl.setAttribute('style', 'float: left;color: #fff;');
        if (col.parentElement.nextElementSibling) {
            pick_mixr.onclick = mixCols;
            pick_mixr.setAttribute('style', 'float: right;color: #000;');
        } else pick_mixr.setAttribute('style', 'float: right;color: #fff;');
    }

    function pickPen(/** @type {PointerEvent} */ ev) {
        ev.stopPropagation();
        /** @type {HTMLElement} */ const pen = ev.target;
        const col = penpicker.parentElement;
        ctx.strokeStyle = col.getAttribute('style').slice('--color: '.length, -';'.length);
        ctx.lineWidth = parseInt(pen.getAttribute('style').slice('--size: '.length, -'px;'.length));
        col.removeChild(penpicker);
    }

    /** @type {[number, number, number, number]} */
    let mixed1;
    /** @type {[number, number, number, number]} */
    let mixed2;
    /** @type {HTMLElement} */
    let mixel1;
    /** @type {HTMLElement} */
    let mixel2;

    function mixCols(/** @type {PointerEvent} */ ev) {
        ev.stopPropagation();
        mix_ratio.value = 50;
        mix_white.value = 100;
        /** @type {HTMLElement} */ const dir = ev.target;
        const left = dir === penpicker.firstElementChild;
        if (left) {
            mixed1 = cmyk(mixel1 = penpicker.parentElement);
            mixed2 = cmyk(mixel2 = mixel1.parentElement.previousElementSibling.firstElementChild);
        } else {
            mixed2 = cmyk(mixel2 = penpicker.parentElement);
            mixed1 = cmyk(mixel1 = mixel2.parentElement.nextElementSibling.firstElementChild);
        }
        penpicker.remove();
        updateMix();
        function cmyk(/** @type {HTMLElement} */ node) {
            const txt = node.getAttribute('style').slice('--color: #'.length, -';'.length);
            const rgb = [0, 2, 4].map(k => parseInt(txt.slice(k, k+2), 16));
            const r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255, k = 1-Math.max(r, g, b);
            return [(1-r-k) / (1-k), (1-g-k) / (1-k), (1-b-k) / (1-k), k];
        }
    }

    mix_ratio.onchange = mix_white.onchange = updateMix;

    function updateMix() {
        const t = mix_ratio.value/100, w = mix_white.value/100;
        const cmyk = mixed1.map((_, k) => Math.max(0, Math.min(1,
            (t*mixed1[k] + (1-t)*mixed2[k]) / w
        )));
        const color = [
            255*(1-cmyk[0])*(1-cmyk[3]) |0,
            255*(1-cmyk[1])*(1-cmyk[3]) |0,
            255*(1-cmyk[2])*(1-cmyk[3]) |0,
        ].map(c => c.toString(16).padStart(2, '0')).join('');
        colmixer.setAttribute('style', '--color: #'+color+';');
    };

    mix_done.onclick = (/** @type {PointerEvent} */ ev) => {
        ev.stopPropagation();
        const color = colmixer.getAttribute('style');
        mixel1.setAttribute('style', color);
        mixel2.parentElement.remove();
        colmixer.setAttribute('style', 'visibility: hidden;');
        ctx.strokeStyle = color.slice('--color: '.length, -';'.length);
    };

    document.body.onpointerdown = (/** @type {PointerEvent} */ ev) => {
        if (ev.target.parentElement !== penpicker && penpicker.parentElement) {
            penpicker.parentElement.removeChild(penpicker);
            ev.stopPropagation();
        } else if (colmixer.getAttribute('style').startsWith('--color') && !colmixer.contains(ev.target)) {
            colmixer.setAttribute('style', 'visibility: hidden;');
            ev.stopPropagation();
        }
    };

    const arenachld = [];

    function goDraw() {
        arenachld.length = 0;
        for (const one of arena.children) arenachld.push(one.src.slice(one.src.indexOf('=')+1));
        arenachld.sort((a, b) => a-b);

        arena.innerHTML = '';
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

        ctx.strokeStyle = colors.querySelector('.color').getAttribute('style').slice('--color: '.length, -';'.length);
        ctx.lineWidth = innerWidth/24;
    }

    setTimeout(() => known_number.textContent = known.childElementCount.toString(), 1000);
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
            const nameas = known.childElementCount.toString();
            const colset = new Set(drawn.map(one => one[0].slice(1)));
            const collst = []; colset.forEach(v => collst.push(v));
            const usedcolors = collst.join('-');
            const madefrom = arenachld.join('-');
            await fetch('put?i='+nameas, {
                method: 'POST',
                headers: {
                    'Content-Type': 'image/png',
                    'X-Used-Colors': usedcolors,
                    'X-Made-From': madefrom,
                },
                body: await resizer.convertToBlob(),
            });
            const it = known
                .appendChild(document.createElement('li'))
                .appendChild(document.createElement('img'));
            it.setAttribute('class', 'item');
            it.src = 'get?i='+nameas;
            it.setAttribute('data-colors', usedcolors);
            it.onpointerdown = knownItemPointerDown;
            known_number.textContent = known.childElementCount.toString();

        }
    }

    function drawUndo() {
        if (!--last_drawn) {
            draw_undo.setAttribute('disabled', 'oui');
            draw_done.setAttribute('disabled', 'oui');
        }
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
        draw_done.removeAttribute('disabled');

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

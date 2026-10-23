/* ==========================================================================
   VITAFER-L · Original Colombiano
   Arquitectura:
   - Núcleo (siempre): WhatsApp, menú, FAQ, formulario, visor ampliado, anclas, spotlight.
   - Movimiento (GSAP + ScrollTrigger + Lenis): preloader, scroll suave, pines, scrubs, partículas.
   - Si GSAP no carga o el usuario pide menos movimiento, la página funciona en modo estático.
   No se usan listeners de "scroll": todo va por ScrollTrigger / IntersectionObserver.
   ========================================================================== */
(() => {
    'use strict';

    const WA_NUMBER = '526693260366';
    const root = document.documentElement;
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    const motionOn = hasGsap && !reduceMotion;

    let lenis = null;
    const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    const safe = (name, fn) => { try { fn(); } catch (err) { console.warn(`[vitafer] ${name}`, err); } };

    /* ======================================================================
       NÚCLEO
       ====================================================================== */

    /* Enlaces de WhatsApp con mensaje pre-escrito */
    function bindWhatsApp() {
        $$('[data-wa]').forEach((a) => { a.href = waUrl(a.dataset.wa); });
    }

    /* Bloqueo de scroll (menú / visor) */
    function lockScroll(lock) {
        if (lenis) { lock ? lenis.stop() : lenis.start(); }
        root.style.overflow = lock ? 'hidden' : '';
    }

    /* Menú móvil */
    const menu = $('#menu');
    const menuToggle = $('#menu-toggle');
    function setMenu(open) {
        if (!menu) return;
        menu.classList.toggle('is-open', open);
        root.classList.toggle('menu-open', open);
        menu.setAttribute('aria-hidden', String(!open));
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        lockScroll(open);
        if (open) { const first = $('a', menu); first && setTimeout(() => first.focus({ preventScroll: true }), 400); }
    }
    function setupMenu() {
        if (!menu || !menuToggle) return;
        menuToggle.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuToggle.focus(); } });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
    }

    /* Anclas con scroll suave */
    function scrollToTarget(target) {
        if (lenis) { lenis.scrollTo(target, { offset: 0, duration: 1.7, easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) }); }
        else { target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }
    }
    function setupAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (!id || id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            if (menu && menu.classList.contains('is-open')) setMenu(false);
            setTimeout(() => scrollToTarget(target), menu && menu.classList.contains('is-open') ? 350 : 0);
        });
    }

    /* Spotlight que sigue al cursor en tarjetas */
    function setupSpotlight() {
        if (!finePointer) return;
        $$('[data-spot]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                el.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });
    }

    /* FAQ (acordeón accesible) */
    function setupFaq() {
        let t;
        $$('[data-qa]').forEach((item) => {
            const btn = $('.qa__q', item);
            btn.addEventListener('click', () => {
                const open = !item.classList.contains('is-open');
                $$('[data-qa].is-open').forEach((o) => {
                    if (o !== item) { o.classList.remove('is-open'); $('.qa__q', o).setAttribute('aria-expanded', 'false'); }
                });
                item.classList.toggle('is-open', open);
                btn.setAttribute('aria-expanded', String(open));
                if (hasGsap) { clearTimeout(t); t = setTimeout(() => window.ScrollTrigger.refresh(), 700); }
            });
        });
    }

    /* Formulario: validación + redirección a WhatsApp */
    function setupForm() {
        const form = $('#order-form');
        if (!form) return;
        const f = {
            name: $('#f-name'), phone: $('#f-phone'), product: $('#f-product'), city: $('#f-city'), msg: $('#f-msg'),
        };
        const err = { name: $('#e-name'), phone: $('#e-phone'), product: $('#e-product'), city: $('#e-city') };

        const normalizePhone = (v) => {
            let d = v.replace(/\D/g, '');
            if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
            if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
            return d;
        };
        const setErr = (key, message) => {
            const field = f[key].closest('.field');
            err[key].textContent = message || '';
            field.classList.toggle('is-bad', Boolean(message));
            f[key].setAttribute('aria-invalid', message ? 'true' : 'false');
            if (message) f[key].setAttribute('aria-describedby', err[key].id); else f[key].removeAttribute('aria-describedby');
        };
        const rules = {
            name: () => (f.name.value.trim().length >= 2 ? '' : 'Escribe tu nombre para saber con quién hablamos.'),
            phone: () => (normalizePhone(f.phone.value).length === 10 ? '' : 'Escribe tu WhatsApp con 10 dígitos.'),
            product: () => (f.product.value ? '' : 'Elige la opción que te interesa.'),
            city: () => (f.city.value.trim().length >= 2 ? '' : 'Dinos tu ciudad para confirmar tu entrega.'),
        };
        Object.keys(rules).forEach((k) => {
            f[k].addEventListener('blur', () => setErr(k, rules[k]()));
            f[k].addEventListener('input', () => { if (f[k].closest('.field').classList.contains('is-bad')) setErr(k, rules[k]()); });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let firstBad = null;
            Object.keys(rules).forEach((k) => {
                const m = rules[k]();
                setErr(k, m);
                if (m && !firstBad) firstBad = f[k];
            });
            if (firstBad) { firstBad.focus(); return; }

            const lines = [
                `Hola, soy ${f.name.value.trim()}.`,
                `Quiero pedir: ${f.product.value}.`,
                `Mi ciudad: ${f.city.value.trim()}.`,
                `Mi WhatsApp: ${normalizePhone(f.phone.value)}.`,
            ];
            if (f.msg.value.trim()) lines.push(`Mensaje: ${f.msg.value.trim()}`);
            const url = waUrl(lines.join('\n'));

            const ok = $('#form-ok');
            $('#form-ok-link').href = url;
            ok.hidden = false;
            form.classList.add('is-sending');
            if (hasGsap && !reduceMotion) gsap.fromTo(ok, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out' });
            window.open(url, '_blank', 'noopener');
            setTimeout(() => form.classList.remove('is-sending'), 2500);
        });
    }

    /* Visor ampliado de flyers (la imagen "se abre" desde su origen) */
    function setupLightbox() {
        const box = $('#lightbox');
        if (!box) return;
        const img = $('#lightbox-img');
        const frame = $('.lightbox__frame', box);
        const closeBtn = $('.lightbox__close', box);
        const cta = $('.lightbox__cta', box);
        let lastFocus = null;
        let origin = null;

        const rectOf = (trigger) => {
            const card = trigger.closest('.deal, .mero__actions, .label__panel');
            const src = card && (card.querySelector('.deal__img, .mero__bottle, .label__top')) || trigger;
            return src.getBoundingClientRect();
        };

        function open(trigger) {
            lastFocus = trigger;
            origin = rectOf(trigger);
            img.src = trigger.dataset.lightbox;
            img.alt = trigger.dataset.alt || '';
            box.setAttribute('aria-hidden', 'false');
            box.classList.add('is-open');
            lockScroll(true);
            const play = () => {
                if (hasGsap && !reduceMotion) {
                    const r = frame.getBoundingClientRect();
                    const dx = origin.left + origin.width / 2 - (r.left + r.width / 2);
                    const dy = origin.top + origin.height / 2 - (r.top + r.height / 2);
                    const s = clamp(origin.width / r.width, .12, 1);
                    gsap.fromTo(frame, { x: dx, y: dy, scale: s, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: .95, ease: 'expo.out' });
                    gsap.fromTo([closeBtn, cta], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6, delay: .3, ease: 'expo.out' });
                }
            };
            (img.decode ? img.decode().catch(() => { }) : Promise.resolve()).then(play);
            closeBtn.focus({ preventScroll: true });
        }
        function close() {
            if (!box.classList.contains('is-open')) return;
            const done = () => {
                box.classList.remove('is-open');
                box.setAttribute('aria-hidden', 'true');
                lockScroll(false);
                if (hasGsap) gsap.set([frame, closeBtn, cta], { clearProps: 'all' });
                lastFocus && lastFocus.focus({ preventScroll: true });
            };
            if (hasGsap && !reduceMotion && origin) {
                const r = frame.getBoundingClientRect();
                const dx = origin.left + origin.width / 2 - (r.left + r.width / 2);
                const dy = origin.top + origin.height / 2 - (r.top + r.height / 2);
                gsap.to(frame, { x: dx, y: dy, scale: clamp(origin.width / r.width, .12, 1), opacity: 0, duration: .55, ease: 'expo.in', onComplete: done });
            } else done();
        }

        document.addEventListener('click', (e) => {
            const t = e.target.closest('[data-lightbox]');
            if (t) { e.preventDefault(); open(t); }
        });
        closeBtn.addEventListener('click', close);
        box.addEventListener('click', (e) => { if (e.target === box) close(); });
        document.addEventListener('keydown', (e) => {
            if (!box.classList.contains('is-open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                const items = [closeBtn, cta];
                const i = items.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
                else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
            }
        });
    }

    /* Anatomía: modo pestañas (también es la base del modo animado) */
    const anatomy = { setStep: () => { } };
    function setupAnatomyCore() {
        const nodes = $$('.node');
        const cards = $$('.nutri');
        if (!nodes.length) return;
        cards.forEach((c) => {
            const fg = $('.gauge__fg', c);
            c.style.setProperty('--p', (parseFloat(fg.dataset.vd) / 100).toString());
        });
        const nodeScroller = $('.nodes');
        let cur = -1;

        anatomy.setStep = (i) => {
            if (i === cur) return;
            cur = i;
            nodes.forEach((n, k) => { n.classList.toggle('is-active', k === i); n.setAttribute('aria-pressed', String(k === i)); });
            cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
            const num = $('[data-n]', cards[i]);
            if (num && motionOn) {
                const end = parseFloat(num.dataset.n);
                const dec = num.dataset.dec ? parseInt(num.dataset.dec, 10) : 0;
                const o = { v: 0 };
                gsap.to(o, { v: end, duration: 1.2, ease: 'power3.out', onUpdate: () => { num.textContent = o.v.toFixed(dec); } });
            }
            if (nodeScroller && nodeScroller.scrollWidth > nodeScroller.clientWidth && nodeScroller.scrollHeight <= nodeScroller.clientHeight + 4) {
                const n = nodes[i].parentElement;
                nodeScroller.scrollTo({ left: n.offsetLeft - (nodeScroller.clientWidth - n.offsetWidth) / 2, behavior: 'smooth' });
            }
            if (motionOn) {
                gsap.to('.anatomy__ring', { rotation: i * (360 / cards.length), duration: 1.4, ease: 'power3.out' });
                gsap.fromTo('.anatomy__halo', { scale: .92 }, { scale: 1.06, duration: 1.1, ease: 'power3.out', overwrite: 'auto' });
            }
        };
        nodes.forEach((n, i) => n.addEventListener('click', () => { if (!anatomy.pinned) anatomy.setStep(i); else anatomy.goTo(i); }));
        anatomy.setStep(0);
    }

    /* ======================================================================
       MODO ESTÁTICO (sin GSAP o con "reducir movimiento")
       ====================================================================== */
    function staticMode() {
        root.classList.remove('is-motion');
        const loader = $('#loader');
        if (loader) loader.remove();
        $$('.label__panel').forEach((p) => p.classList.add('is-in'));
        const marquee = $('.marquee__track');
        if (marquee && reduceMotion) marquee.style.animation = 'none';
    }

    /* ======================================================================
       MOVIMIENTO
       ====================================================================== */

    function initLenis() {
        if (typeof window.Lenis === 'undefined') return;
        lenis = new window.Lenis({
            duration: 1.25,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: .95,
            touchMultiplier: 1.2,
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        lenis.stop();
    }

    /* División de texto en palabras / letras.
       Accesibilidad: el título conserva su texto en aria-label y las partes visuales van aria-hidden. */
    function splitText(el, mode) {
        const label = el.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const shell = document.createElement('span');
        shell.setAttribute('aria-hidden', 'true');
        const walk = (node, parent) => {
            node.childNodes.forEach((child) => {
                if (child.nodeType === 3) {
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { parent.appendChild(document.createTextNode(' ')); return; }
                        const wd = document.createElement('span');
                        wd.className = 'wd';
                        if (mode === 'chars') {
                            Array.from(part).forEach((ch) => {
                                const c = document.createElement('span');
                                c.className = 'ch';
                                c.textContent = ch;
                                wd.appendChild(c);
                            });
                        } else {
                            const i = document.createElement('span');
                            i.className = 'wd__i';
                            i.textContent = part;
                            wd.appendChild(i);
                        }
                        parent.appendChild(wd);
                    });
                } else if (child.nodeType === 1) {
                    if (child.tagName === 'BR') { parent.appendChild(child.cloneNode()); return; }
                    const clone = child.cloneNode(false);
                    parent.appendChild(clone);
                    walk(child, clone);
                }
            });
        };
        walk(el, shell);
        el.textContent = '';
        if (/^H[1-6]$/.test(el.tagName)) el.setAttribute('aria-label', label);
        el.appendChild(shell);
        return mode === 'chars' ? $$('.ch', el) : $$('.wd__i', el);
    }

    /* ---------- Preloader ---------- */
    function runLoader() {
        return new Promise((resolve) => {
            const el = $('#loader');
            if (!el) { resolve(); return; }
            const pctEl = $('#loader-pct');
            const embers = $('.loader__embers');
            for (let i = 0; i < 24; i++) {
                const b = document.createElement('i');
                b.style.setProperty('--x', `${Math.random() * 100}%`);
                b.style.setProperty('--s', `${2 + Math.random() * 3}px`);
                b.style.setProperty('--d', `${4 + Math.random() * 5}s`);
                b.style.setProperty('--dl', `${-Math.random() * 8}s`);
                embers.appendChild(b);
            }

            const assets = ['img/cut/botella-500ml.webp', 'img/cut/logo-vitafer-l.webp', 'img/cut/logo-vitafer-leon.webp'];
            let loaded = 0;
            assets.forEach((src) => { const im = new Image(); im.onload = im.onerror = () => { loaded++; }; im.src = src; });
            let fontsDone = false;
            (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { fontsDone = true; });

            const MIN = 1900, MAX = 7000;
            const t0 = performance.now();
            let shown = 0, last = t0, finished = false;

            const paint = (p) => {
                el.style.setProperty('--p', p.toFixed(4));
                el.style.setProperty('--fill', `${((1 - p) * 100).toFixed(2)}%`);
                pctEl.textContent = String(Math.round(p * 100));
            };

            const finish = () => {
                if (finished) return;
                finished = true;
                el.style.setProperty('--lineo', '0');
                const tl = gsap.timeline();
                tl.to('.loader__bottle-fill', { filter: 'drop-shadow(0 0 46px rgba(255,200,80,1)) brightness(1.45)', duration: .32, yoyo: true, repeat: 1, ease: 'power2.out' })
                    .to('.loader__stage, .loader__info', { opacity: 0, scale: 1.1, duration: .55, ease: 'power2.in' }, '+=.05')
                    .to('.loader__embers', { opacity: 0, duration: .4 }, '<')
                    .to('.loader__half--t', { yPercent: -101, duration: 1.15, ease: 'expo.inOut' }, '<.1')
                    .to('.loader__half--b', { yPercent: 101, duration: 1.15, ease: 'expo.inOut' }, '<')
                    .add(() => resolve(), '<.45')
                    .add(() => { el.classList.add('is-done'); el.remove(); });
            };

            const tick = (now) => {
                const dt = Math.min(.05, (now - last) / 1000);
                last = now;
                const t = now - t0;
                const assetP = (loaded + (fontsDone ? 1 : 0)) / (assets.length + 1);
                let target = Math.min(assetP, clamp(t / MIN, 0, 1));
                if (t > MAX) target = 1;
                shown += (target - shown) * clamp(dt * 5, 0, 1);
                if (target >= 1 && shown > .985) shown = 1;
                paint(shown);
                if (shown >= 1) finish(); else requestAnimationFrame(tick);
            };
            paint(0);
            requestAnimationFrame(tick);
        });
    }

    /* ---------- Partículas (brasas doradas) ---------- */
    let emberBoost = 0;
    function initEmbers() {
        const c = $('#embers');
        if (!c) return;
        const ctx = c.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        let w = 0, h = 0;

        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = 64;
        const sc = sprite.getContext('2d');
        const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,238,175,1)');
        g.addColorStop(.22, 'rgba(255,196,64,.9)');
        g.addColorStop(.55, 'rgba(255,125,12,.28)');
        g.addColorStop(1, 'rgba(255,100,0,0)');
        sc.fillStyle = g;
        sc.fillRect(0, 0, 64, 64);

        const resize = () => {
            w = window.innerWidth; h = window.innerHeight;
            c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const N = window.innerWidth < 720 ? 34 : 72;
        const make = (init) => ({
            x: Math.random() * w, y: init ? Math.random() * h : h + 24,
            r: 3 + Math.random() * 9, vy: .22 + Math.random() * .85, vx: (Math.random() - .5) * .25,
            ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.4, a: .22 + Math.random() * .55,
        });
        const ps = Array.from({ length: N }, () => make(true));

        let running = true, last = performance.now();
        const frame = (now) => {
            if (!running) return;
            const dt = Math.min(40, now - last) / 16.67;
            last = now;
            emberBoost *= .94;
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            for (const p of ps) {
                p.y -= (p.vy + emberBoost * p.vy * 1.5) * dt;
                p.x += (p.vx + Math.sin(now * .001 * p.sp + p.ph) * .22) * dt;
                if (p.y < -24) Object.assign(p, make(false));
                const tw = .6 + .4 * Math.sin(now * .003 * p.sp + p.ph);
                ctx.globalAlpha = p.a * tw * clamp(p.y / (h * .3), 0, 1);
                ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
            }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        document.addEventListener('visibilitychange', () => {
            running = !document.hidden;
            if (running) { last = performance.now(); requestAnimationFrame(frame); }
        });
        ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { emberBoost = Math.min(7, Math.abs(self.getVelocity()) / 650); } });
    }

    /* ---------- Hero ---------- */
    function heroIntro() {
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        tl.fromTo('.hero__halo', { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: 2.2 }, 0)
            .fromTo('.orbit', { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: 1.8, stagger: .18 }, .05)
            .fromTo('.hero__bottle', { y: 90, scale: .8, opacity: 0, filter: 'blur(14px)' }, { y: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: 1.8 }, .1)
            .fromTo('.hero__lockup', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2 }, .25)
            .fromTo('.hero__line .ch', { yPercent: 115, rotateX: -70, opacity: 0 }, { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.15, stagger: .03 }, .35)
            .fromTo('.hero__sub', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, .9)
            .fromTo('.hero__cta .btn', { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .12 }, 1.05)
            .fromTo('.chip', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, stagger: .14, ease: 'back.out(2.2)' }, 1.1)
            .fromTo('.fab', { opacity: 0, scale: .4 }, { opacity: 1, scale: 1, duration: 1, ease: 'back.out(2.4)' }, 1.8);
        return tl;
    }

    function heroParallax() {
        gsap.to('.hero__stage', { yPercent: -9, scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero__copy', { yPercent: -12, opacity: .15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true } });
    }

    function heroTilt() {
        if (!finePointer) return;
        const stage = $('[data-hero-stage]');
        const bottle = $('[data-hero-bottle]');
        if (!stage || !bottle) return;
        const rx = gsap.quickTo(bottle, 'rotationX', { duration: .9, ease: 'power3' });
        const ry = gsap.quickTo(bottle, 'rotationY', { duration: .9, ease: 'power3' });
        const chips = $$('.chip').map((c, i) => ({
            x: gsap.quickTo(c, 'x', { duration: 1.1, ease: 'power3' }),
            y: gsap.quickTo(c, 'y', { duration: 1.1, ease: 'power3' }),
            k: (i % 2 ? -1 : 1) * (12 + i * 5),
        }));
        stage.addEventListener('pointermove', (e) => {
            const r = stage.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width - .5;
            const ny = (e.clientY - r.top) / r.height - .5;
            ry(nx * 20); rx(-ny * 14);
            chips.forEach((c) => { c.x(nx * c.k); c.y(ny * c.k * .7); });
        });
        stage.addEventListener('pointerleave', () => { ry(0); rx(0); chips.forEach((c) => { c.x(0); c.y(0); }); });
    }

    /* ---------- Textos ---------- */
    function titles() {
        $$('[data-split="words"]').forEach((el) => {
            const words = splitText(el, 'words');
            gsap.set(words, { yPercent: 118 });
            ScrollTrigger.create({
                trigger: el, start: 'top 88%', once: true,
                onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, stagger: .07, ease: 'expo.out' }),
            });
        });
    }

    function manifesto() {
        const el = $('[data-scrub-words]');
        if (!el) return;
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        el.textContent = '';
        const words = text.split(' ').map((t, i, a) => {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = t;
            el.appendChild(s);
            if (i < a.length - 1) el.appendChild(document.createTextNode(' '));
            return s;
        });
        gsap.to(words, {
            color: '#f7efdc', ease: 'none', stagger: .12,
            scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true },
        });
    }

    function reveals() {
        const items = $$('[data-reveal]');
        gsap.set(items, { y: 38 });
        ScrollTrigger.batch(items, {
            start: 'top 91%', once: true,
            onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.15, stagger: .12, ease: 'expo.out', overwrite: true }),
        });
    }

    /* Contadores: se activan cuando el número entra en pantalla (también dentro del carrusel horizontal) */
    function counters() {
        const els = $$('[data-count]');
        const fmt = (el, v) => (el.dataset.sep ? Math.round(v).toLocaleString('en-US') : String(Math.round(v)));
        els.forEach((el) => { el.textContent = fmt(el, 0); });
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                io.unobserve(en.target);
                const el = en.target;
                const end = parseFloat(el.dataset.count);
                const o = { v: 0 };
                gsap.to(o, { v: end, duration: 2.1, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(el, o.v); } });
            });
        }, { threshold: .55 });
        els.forEach((el) => io.observe(el));
    }

    /* ---------- Banda en movimiento ---------- */
    function marquee() {
        const track = $('.marquee__track');
        if (!track || !track.getAnimations) return;
        const anim = track.getAnimations()[0];
        if (!anim) return;
        let target = 1, rate = 1;
        const skew = gsap.quickTo(track, 'skewX', { duration: .6, ease: 'power3' });
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                const v = self.getVelocity();
                target = 1 + Math.min(6, Math.abs(v) / 420);
                skew(clamp(-v / 400, -10, 10));
            },
        });
        gsap.ticker.add(() => {
            target += (1 - target) * .04;
            rate += (target - rate) * .08;
            anim.playbackRate = rate;
        });
    }

    /* ---------- Anatomía (pin + scrub) ---------- */
    function anatomyScrub() {
        const pin = $('.anatomy__pin');
        if (!pin) return;
        const steps = $$('.nutri').length;
        const st = ScrollTrigger.create({
            trigger: pin, start: 'top top', end: () => `+=${Math.round(window.innerHeight * steps * .55)}`,
            pin: true, anticipatePin: 1, invalidateOnRefresh: true,
            onUpdate: (self) => anatomy.setStep(clamp(Math.floor(self.progress * steps), 0, steps - 1)),
        });
        anatomy.pinned = true;
        anatomy.goTo = (i) => {
            const y = st.start + ((i + .5) / steps) * (st.end - st.start);
            if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
        };
        gsap.from('.anatomy__bottle', { scale: .86, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: pin, start: 'top 80%', once: true } });
    }

    /* ---------- Beneficios ---------- */
    function bento() {
        $$('[data-cell]').forEach((cell, i) => {
            gsap.fromTo(cell, { opacity: 0, y: 70, scale: .94, rotateX: 10, transformPerspective: 900 },
                { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 1.3, ease: 'expo.out', delay: (i % 3) * .06, scrollTrigger: { trigger: cell, start: 'top 92%', once: true } });
        });
    }

    /* ---------- Escena: la imagen se abre con el scroll ---------- */
    function scene() {
        const pin = $('.scene__pin');
        if (!pin) return;
        const mm = gsap.matchMedia();
        mm.add({ small: '(max-width: 899px)', wide: '(min-width: 900px)' }, (ctx) => {
            const small = ctx.conditions.small;
            const from = small ? 'inset(12% 16% 12% 16%)' : 'inset(27% 35% 27% 35%)';
            const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: { trigger: pin, start: 'top top', end: '+=240%', pin: true, scrub: .7, anticipatePin: 1 },
            });
            tl.fromTo('.scene__media', { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1 }, 0)
                .fromTo('.scene__img', { scale: 1.4 }, { scale: 1, duration: 1 }, 0)
                .to('.scene__w--a', { yPercent: -220, opacity: 0, duration: .5, ease: 'power2.in' }, .04)
                .to('.scene__w--b', { yPercent: 260, opacity: 0, duration: .5, ease: 'power2.in' }, .04)
                .to({}, { duration: .35 });
            return () => { gsap.set(['.scene__media', '.scene__img', '.scene__w--a', '.scene__w--b'], { clearProps: 'all' }); };
        });
    }

    /* ---------- Catálogo: scroll horizontal ---------- */
    function deals() {
        const pin = $('.deals__pin');
        const track = $('[data-deals-track]');
        if (!pin || !track) return;
        const mm = gsap.matchMedia();
        mm.add('(min-width: 1024px)', () => {
            const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
            const bar = $('.deals__bar i');
            const tween = gsap.to(track, {
                x: () => -dist(), ease: 'none',
                scrollTrigger: {
                    trigger: pin, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
                    onUpdate: (self) => { if (bar) bar.style.transform = `scaleX(${self.progress})`; },
                },
            });
            $$('.deal', track).forEach((card) => {
                const img = $('.deal__img', card);
                gsap.fromTo(img, { xPercent: -10 }, { xPercent: 10, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
            });
            return () => { if (bar) bar.style.transform = ''; };
        });
        mm.add('(max-width: 1023px)', () => {
            gsap.fromTo($$('.deal', track), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: track, start: 'top 85%', once: true } });
        });
    }

    /* ---------- Mero Macho ---------- */
    function mero() {
        const sec = $('.mero');
        if (!sec) return;
        const st = { trigger: sec, start: 'top 75%', end: 'top 15%', scrub: 1 };
        gsap.fromTo('.mero__bottle', { y: 140, rotate: 5, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, ease: 'none', scrollTrigger: st });
        gsap.fromTo('.mero__pills', { x: 120, opacity: 0 }, { x: 0, opacity: 1, ease: 'none', scrollTrigger: st });
        gsap.fromTo('.mero__arrow', { scale: .5, opacity: 0, transformOrigin: '30% 100%' }, { scale: 1, opacity: .95, ease: 'none', scrollTrigger: st });
        gsap.fromTo('.mero__logo', { x: 80, opacity: 0, rotate: -4 }, { x: 0, opacity: 1, rotate: 0, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 60%', once: true } });
    }

    /* ---------- Etiqueta ---------- */
    function label() {
        const panel = $('.label__panel');
        if (!panel) return;
        ScrollTrigger.create({ trigger: panel, start: 'top 78%', once: true, onEnter: () => panel.classList.add('is-in') });
    }

    /* ---------- Garantía ---------- */
    function trust() {
        $$('[data-parallax]').forEach((el) => {
            const k = parseFloat(el.dataset.parallax) || 0;
            gsap.fromTo(el, { y: -k * 260 }, { y: k * 260, ease: 'none', scrollTrigger: { trigger: '.trust__badges', start: 'top bottom', end: 'bottom top', scrub: true } });
        });
    }

    /* ---------- Cómo pedir: recorrido que se dibuja ---------- */
    function flow() {
        const rail = $('[data-flow]');
        if (!rail) return;
        const marker = $('.flow__marker', rail);
        const mm = gsap.matchMedia();

        mm.add('(min-width: 900px)', () => {
            const path = $('.flow__path', rail);
            const svg = path.ownerSVGElement;
            const len = path.getTotalLength();
            gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
            ScrollTrigger.create({
                trigger: rail, start: 'top 72%', end: 'bottom 52%', scrub: true,
                onUpdate: (self) => {
                    const p = self.progress;
                    path.style.strokeDashoffset = String(len * (1 - p));
                    const pt = path.getPointAtLength(len * p);
                    const r = svg.getBoundingClientRect();
                    marker.style.transform = `translate(${(pt.x / 1000) * r.width}px, ${(pt.y / 120) * r.height}px)`;
                },
            });
            return () => { marker.style.transform = ''; path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; };
        });

        mm.add('(max-width: 899px)', () => {
            const fill = $('.flow__line i', rail);
            ScrollTrigger.create({
                trigger: rail, start: 'top 70%', end: 'bottom 55%', scrub: true,
                onUpdate: (self) => {
                    const h = rail.clientHeight - 16;
                    fill.style.transform = `scaleY(${self.progress})`;
                    marker.style.transform = `translate(0px, ${8 + h * self.progress}px)`;
                },
            });
            return () => { marker.style.transform = ''; fill.style.transform = ''; };
        });
    }

    /* ---------- Cierre y footer ---------- */
    function finale() {
        gsap.fromTo('.foot__mega img', { yPercent: 30, opacity: .2, scale: .94 }, { yPercent: 0, opacity: .92, scale: 1, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'top 35%', scrub: true } });
        const tl = gsap.timeline({ scrollTrigger: { trigger: '.final', start: 'top 70%', once: true } });
        tl.fromTo('.form', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out' });
    }

    /* ---------- Interacciones globales ---------- */
    function progressBar() {
        gsap.to('.progress i', { clipPath: 'inset(0 0% 0 0)', ease: 'none', scrollTrigger: { trigger: root, start: 0, end: 'max', scrub: .25 } });
    }

    function navBehaviour() {
        const nav = $('#nav');
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                const y = self.scroll();
                nav.classList.toggle('is-solid', y > 60);
                if (menu && menu.classList.contains('is-open')) return;
                if (self.direction === 1 && y > 520) nav.classList.add('is-hidden');
                else if (self.direction === -1) nav.classList.remove('is-hidden');
            },
        });
    }

    function magnetic() {
        if (!finePointer) return;
        $$('[data-magnetic]').forEach((btn) => {
            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                gsap.to(btn, { x: (e.clientX - (r.left + r.width / 2)) * .22, y: (e.clientY - (r.top + r.height / 2)) * .36, duration: .5, ease: 'power3.out' });
            });
            btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .4)' }));
        });
    }

    function fab() {
        const el = $('#fab');
        if (!el) return;
        setTimeout(() => {
            el.classList.add('is-tip');
            setTimeout(() => el.classList.remove('is-tip'), 5200);
        }, 9000);
    }

    /* ======================================================================
       ARRANQUE
       ====================================================================== */
    function boot() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);

        bindWhatsApp();
        setupMenu();
        setupAnchors();
        setupSpotlight();
        setupFaq();
        setupForm();
        setupLightbox();
        setupAnatomyCore();
        fab();

        if (!motionOn) { staticMode(); return; }

        root.classList.add('is-motion');
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
        initLenis();

        /* El arranque se reparte en tareas cortas (una por módulo) para no bloquear el hilo principal mientras corre el preloader.
           Los triggers se crean en el orden del documento para que los pines sumen bien su espacio. */
        const tick = () => new Promise((r) => setTimeout(r, 0));
        const steps = [
            ['split-hero', () => { $$('[data-split="chars"]').forEach((el) => splitText(el, 'chars')); }],
            ['titles', titles],
            ['progress', progressBar],
            ['nav', navBehaviour],
            ['embers', initEmbers],
            ['hero-parallax', heroParallax],
            ['marquee', marquee],
            ['manifesto', manifesto],
            ['reveals', reveals],
            ['counters', counters],
            ['anatomy', anatomyScrub],
            ['bento', bento],
            ['scene', scene],
            ['deals', deals],
            ['mero', mero],
            ['label', label],
            ['trust', trust],
            ['flow', flow],
            ['finale', finale],
            ['magnetic', magnetic],
            ['hero-tilt', heroTilt],
        ];

        const loaderDone = runLoader();
        const built = (async () => { for (const [name, fn] of steps) { safe(name, fn); await tick(); } })();

        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener('load', () => setTimeout(refresh, 200));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 100));

        /* Seguro: si algo impide terminar el preloader, se libera la página */
        const failsafe = setTimeout(() => {
            const l = $('#loader');
            if (l) { l.remove(); if (lenis) lenis.start(); heroIntro(); }
        }, 14000);

        Promise.all([loaderDone, built]).then(() => {
            clearTimeout(failsafe);
            if (lenis) lenis.start();
            ScrollTrigger.refresh();
            heroIntro();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

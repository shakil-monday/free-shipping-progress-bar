(function () {
    if (window.__fsbLoaded_Data) return;
    window.__fsbLoaded_Data = true;

    const configEl = document.querySelector("script[data-fsb-config]");

    if (!configEl) return;
    let data;

    try {
        data = configEl.textContent;
        data = JSON.parse(configEl.textContent);
    } catch (error) {
        console.log("Parsed Error: ", error)
        return;
    }

    var settings = data.settings || {};
    if (!settings.enabled) return;

    const messages = settings.messages;
    const style = settings.style;
    const placement = settings.placement;
    let cartCents = Number(data.cart && data.cart.totalCents) || 0;
    let currency = (window.Shopify && Shopify.currency && Shopify.currency.active) || data.cart.currency;
    const rate = Number(window.Shopify && Shopify.currency && Shopify.currency.rate) || 1;
    const locale = data.locale || document.documentElement.lang || "en";
    const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";

    const nativeFetch = window.fetch.bind(window);

    const DRAWER_SELECTORS = [
        "cart-drawer .drawer__inner", // Dawn & most Shopify themes
        "#CartDrawer .drawer__inner",
        "#CartDrawer",
        "#cart-drawer",
        ".cart-drawer",
        ".drawer--cart",
        "#sidebar-cart",
        ".mini-cart",
    ];
    const DRAWER_FOOTER = ".drawer__footer, .cart-drawer__footer, [class*='drawer__footer'], [class*='cart__footer']";

    function computeProgress(cents, thresholdCents, r) {
        var threshold = Math.round(thresholdCents * (r > 0 ? r : 1));
        if (threshold <= 0) return { state: "success", remainingCents: 0, percent: 100 };
        if (cents <= 0) return { state: "empty", remainingCents: threshold, percent: 0 };
        if (cents >= threshold) return { state: "success", remainingCents: 0, percent: 100 };
        return {
            state: "progress",
            remainingCents: threshold - cents,
            percent: Math.min(100, Math.max(0, (cents / threshold) * 100)),
        };
    }

    function formatMoney(cents) {
        try {
            return new Intl.NumberFormat(locale, { style: "currency", currency: currency }).format(cents / 100);
        } catch (e) {
            return (cents / 100).toFixed(2) + " " + currency;
        }
    }

    function fillMessage(template, values) {
        return String(template || "")
            .replace(/\{amount\}/g, values.amount)
            .replace(/\{threshold\}/g, values.threshold);
    }

    function build(el) {
        if (el.__fsBuilt_Data) return;
        el.__fsBuilt_Data = true;

        el.innerHTML =
            '<p class="fsb__msg" role="status" aria-live="polite"></p>' +
            '<div class="fsb__track"><div class="fsb__bar"></div></div>';

        var s = el.style;
        if (style.barColor) s.setProperty("--fsb-bar", style.barColor);
        if (style.trackColor) s.setProperty("--fsb-track", style.trackColor);
        if (style.backgroundColor) s.setProperty("--fsb-bg", style.backgroundColor);
        if (style.textColor) s.setProperty("--fsb-text", style.textColor);
        if (style.fontSize) s.setProperty("--fsb-size", style.fontSize + "px");
        if (style.borderRadius != null) s.setProperty("--fsb-radius", style.borderRadius + "px");
    }

    function render(el) {
        build(el);
        const p = computeProgress(cartCents, settings.thresholdCents, rate);
        const template = p.state === "empty" ? messages.empty : p.state === "success" ? messages.success : messages.progress;
        const text = fillMessage(template, {
            amount: formatMoney(p.remainingCents),
            threshold: formatMoney(Math.round(settings.thresholdCents * rate)),
        });
        const msg = el.querySelector(".fsb__msg");
        if (msg.textContent !== text) msg.textContent = text;
        el.querySelector(".fsb__bar").style.width = p.percent + "%";
        el.setAttribute("data-fsb-state", p.state);
        el.hidden = false;
    }

    function isAllowed(el) {
        return el.getAttribute("data-fsb-kh-root") !== "cart-page" || placement.cartPage;
    }

    function renderAll() {
        let roots = document.querySelectorAll("[data-fsb-kh-root]");
        for (let i = 0; i < roots.length; i++) {
            if (isAllowed(roots[i])) render(roots[i]);
        }
    }

    var refreshTimer;
    function refreshCart() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () {
            nativeFetch(root + "cart.js", { headers: { Accept: "application/json" } })
                .then(function (r) {
                    return r.json();
                })
                .then(function (cart) {
                    cartCents = Number(cart.total_price) || 0;
                    if (cart.currency) currency = cart.currency;
                    renderAll();
                })
                .catch(function (error) { console.log("refreshCart Error: ", error) });
        }, 50);
    }

    const CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/;
    function isCartMutation(url) {
        try {
            return CART_MUTATION.test(new URL(String(url), location.href).pathname);
        } catch (e) {
            return false;
        }
    }

    function findDrawer() {
        var selectors = placement.drawerSelector ? [placement.drawerSelector] : DRAWER_SELECTORS;
        for (var i = 0; i < selectors.length; i++) {
            try {
                var el = document.querySelector(selectors[i]);
                if (el) return el;
            } catch (e) {
                /* invalid custom selector */
            }
        }
        return null;
    }

    function ensureDrawerBar() {
        if (!placement.drawer) return;
        var drawer = findDrawer();
        if (!drawer || drawer.querySelector("[data-fsb-root='drawer']")) return;

        var el = document.createElement("div");
        el.className = "fsb fsb--drawer";
        el.setAttribute("data-fsb-root", "drawer");

        if (placement.drawerPosition === "bottom") {
            var footer = drawer.querySelector(DRAWER_FOOTER);
            if (footer) footer.parentNode.insertBefore(el, footer);
            else drawer.appendChild(el);
        } else {
            var header = drawer.querySelector(".drawer__header, [class*='drawer__header']");
            if (header && header.parentNode === drawer) header.insertAdjacentElement("afterend", el);
            else drawer.insertBefore(el, drawer.firstChild);
        }
        render(el);
    }

    // Watch AJAX cart calls made by the theme or other apps.
    window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : input && input.url;
        const promise = nativeFetch(input, init);
        if (isCartMutation(url)) {
            promise.then(refreshCart, function () { });
        }
        return promise;
    };

    // Themes that broadcast their own cart events.
    ["cart:updated", "cart:refresh", "cart:change", "theme:cart:change"].forEach(function (name) {
        document.addEventListener(name, refreshCart);
    });

    // Drawers are often re-rendered (or lazily created); re-inject when needed.
    var pending = false;
    new MutationObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
            pending = false;
            ensureDrawerBar();
            var roots = document.querySelectorAll("[data-fsb-root]");
            for (var i = 0; i < roots.length; i++) {
                if (!roots[i].__fsbBuilt && isAllowed(roots[i])) render(roots[i]);
            }
        });
    }).observe(document.body, { childList: true, subtree: true });

    function init() {
        ensureDrawerBar();
        renderAll();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})()
const api = globalThis.browser ?? globalThis.chrome;

// =========================
// STORAGE
// =========================
class StorageNamespace {
    constructor(namespace) {
        this.namespace = namespace;
    }

    _key(id) {
        return `${this.namespace}:${location.href}:${id}`;
    }

    set(id, value) {
        localStorage.setItem(this._key(id), JSON.stringify(value));
    }

    remove(id) {
        localStorage.removeItem(this._key(id));
    }

    clear() {
        const prefix = `${this.namespace}:${location.href}:`;

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
                localStorage.removeItem(k);
            }
        }
    }

    getAll() {
        const prefix = `${this.namespace}:${location.href}:`;
        const out = {};

        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(prefix)) continue;

            const key = k.replace(prefix, "");

            try {
                out[key] = JSON.parse(localStorage.getItem(k));
            } catch {
                out[key] = null;
            }
        }

        return out;
    }
}

// =========================
// MAIN APP
// =========================
class Kremy {
    constructor() {
        this.api = api;
        this.storage = new StorageNamespace("kremy");

        this.state = {
            enabled: true,
            holdDelay: 900
        };

        this.buffer = {};
        this.timer = null;

        this.toastEl = null;
        this.toastTimer = null;

        this.init();
    }

    isEnabled() {
        return this.state.enabled;
    }

    setEnabled(v) {
        this.state.enabled = v;
    }

    // =========================
    // KEY
    // =========================
    getKey(el) {
        if (el.id) return `id:${el.id}`;
        if (el.name) return `name:${el.name}`;
        return `tag:${el.tagName}`;
    }

    // =========================
    // SAVE
    // =========================
    save(el) {
        if (!this.isEnabled()) return;
        if (!(el instanceof HTMLElement)) return;

        const key = this.getKey(el);

        let value;

        if (el.type === "checkbox") {
            value = el.checked;
        } else if (el.type === "radio") {
            if (!el.checked) return;
            value = el.value;
        } else {
            value = el.value;
        }

        this.buffer[key] = {
            type: el.type,
            value,
            enabled: this.isEnabled()
        };

        this.highlight(el);
        this.scheduleSave();
    }

    scheduleSave() {
        clearTimeout(this.timer);

        this.timer = setTimeout(() => {
            const entries = Object.entries(this.buffer);

            for (let i = 0; i < entries.length; i++) {
                const [k, v] = entries[i];
                this.storage.set(k, v);
            }

            this.buffer = {};
        }, 250);
    }

    // =========================
    // RESTORE
    // =========================
    restore() {
        if (!this.isEnabled()) return;

        const data = this.storage.getAll();
        const els = document.querySelectorAll("input, textarea, select");

        for (let i = 0; i < els.length; i++) {
            const el = els[i];

            const key =
            el.id ? `id:${el.id}` :
            el.name ? `name:${el.name}` :
            `tag:${el.tagName}`;

            const saved = data[key];
            if (!saved || !saved.enabled) continue;

            if (document.activeElement === el) continue;

            this.highlight(el);

            if (el.type === "checkbox") {
                el.checked = !!saved.value;
            } else if (el.type === "radio") {
                if (el.value === saved.value) el.checked = true;
            } else {
                el.value = saved.value;
            }
        }
    }

    // =========================
    // TOAST
    // =========================
    showToast(msg) {
        if (!document.body) return;

        if (!this.toastEl) {
            this.toastEl = document.createElement("div");
            this.toastEl.style.cssText = `
            position: fixed;
            bottom: 12px;
            right: 12px;
            background: rgba(0,0,0,0.85);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 999999999;
            font-family: sans-serif;
            `;
            document.body.appendChild(this.toastEl);
        }

        this.toastEl.textContent = msg;

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.toastEl.remove();
            this.toastEl = null;
        }, 900);
    }

    highlight(el) {
        if (!this.isEnabled()) return;
        el.classList.add("borders");
    }

    // =========================
    // EVENTS
    // =========================
    bindEvents() {
        let holdTimer = null;
        let isHolding = false;
        let startX = 0;
        let startY = 0;

        document.addEventListener("pointerdown", (e) => {
            if (!this.isEnabled()) return;

            const el = e.target;
            if (!(el instanceof HTMLElement)) return;
            if (!el.matches("input, textarea, select")) return;

            isHolding = false;

            startX = e.clientX;
            startY = e.clientY;

            holdTimer = setTimeout(() => {
                isHolding = true;

                this.save(el);
                this.showToast("Saved ✔");

            }, this.state.holdDelay);

        }, true);

        document.addEventListener("pointerup", () => {
            clearTimeout(holdTimer);
        }, true);

        document.addEventListener("pointermove", (e) => {
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);

            if (dx > 6 || dy > 6) {
                clearTimeout(holdTimer);
            }
        }, true);

        document.addEventListener("click", (e) => {
            if (isHolding) {
                e.preventDefault();
                e.stopPropagation();
                isHolding = false;
            }
        }, true);
    }

    // =========================
    // MESSAGING
    // =========================
    bindMessaging() {
        this.api.runtime.onMessage.addListener((msg, sender, sendResponse) => {

            if (msg.action === "TOGGLE") {
                this.setEnabled(msg.value);

                if (!msg.value) {
                    const els = document.querySelectorAll(".borders");
                    for (let i = 0; i < els.length; i++) {
                        els[i].classList.remove("borders");
                    }
                } else {
                    this.restore();
                }

                this.showToast(msg.value ? "Enabled ✔" : "Disabled ✖");

                sendResponse({ ok: true });
                return true;
            }

            if (msg.action === "GET_DATA") {
                sendResponse({ data: this.storage.getAll() });
                return true;
            }

            if (msg.action === "DELETE_KEY") {
                this.storage.remove(msg.key);
                this.showToast("Deleted ✔");
                sendResponse({ ok: true });
                return true;
            }

            if (msg.action === "CLEAR") {
                this.storage.clear();
                this.showToast("Cleared ✔");
                sendResponse({ ok: true });
                return true;
            }
        });
    }

    // =========================
    // INIT
    // =========================
    init() {
        this.bindEvents();
        this.bindMessaging();

        api.storage.onChanged.addListener((changes, area) => {
            if (area !== "local") return;

            if (changes.kremy_holdDelay) {
                const v = changes.kremy_holdDelay.newValue;
                this.state.holdDelay = Math.max(200, Math.min(3000, v));
            }

            if (changes.kremy_enabled) {
                this.setEnabled(changes.kremy_enabled.newValue);
            }
        });

        api.storage.local.get(["kremy_enabled", "kremy_holdDelay"], (res) => {
            this.state.enabled = res.kremy_enabled !== false;

            if (typeof res.kremy_holdDelay === "number") {
                this.state.holdDelay = Math.max(200, Math.min(3000, res.kremy_holdDelay));
            }

            const run = () => {
                if (!this.isEnabled()) return;
                this.restore();
                this.showToast("Kremy loaded ✔");
            };

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", run);
            } else {
                run();
            }
        });
    }
}

new Kremy();

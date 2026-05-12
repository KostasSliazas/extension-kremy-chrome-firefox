const api = globalThis.browser ?? globalThis.chrome;

class KremyPopup {
    constructor() {
        this.list = document.getElementById("list");
        this.clearBtn = document.getElementById("clear");
        this.toggle = document.getElementById("toggle");
        this.delaySelect = document.getElementById("holdDelay");

        this.init();
    }

    loadToggle() {
        api.storage.local.get(["kremy_enabled"], (res) => {
            this.toggle.checked = res.kremy_enabled !== false;
            this.setBadge(this.toggle.checked);
        });
    }

    setState(v) {
        api.storage.local.set({ kremy_enabled: v });
    }

    bindToggle() {
        this.toggle.addEventListener("change", () => {
            const state = this.toggle.checked;

            this.setState(state);

            api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab?.id) return;

                api.tabs.sendMessage(tab.id, {
                    action: "TOGGLE",
                    value: state
                });
            });

            this.setBadge(state);
        });
    }

    bindDelay() {
        api.storage.local.get(["kremy_holdDelay"], (res) => {
            if (typeof res.kremy_holdDelay === "number") {
                this.delaySelect.value = res.kremy_holdDelay;
            }
        });

        this.delaySelect.addEventListener("change", () => {
            const value = Math.max(200, Math.min(3000, Number(this.delaySelect.value)));

            api.storage.local.set({
                kremy_holdDelay: value
            });
        });
    }

    setBadge(state) {
        api.action.setBadgeText({
            text: state ? "ON" : "OFF"
        });

        api.action.setBadgeBackgroundColor({
            color: state ? "#00c853" : "#b1b5b2"
        });
    }

    load() {
        api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return;

            api.tabs.sendMessage(tab.id, { action: "GET_DATA" }, (res) => {
                this.render(res?.data || {});
            });
        });
    }

    render(data) {
        this.list.innerHTML = "";

        const entries = Object.entries(data);

        if (!entries.length) {
            this.list.innerHTML = "<span>No saved fields</span>";
            return;
        }

        for (let i = 0; i < entries.length; i++) {
            const [key, item] = entries[i];

            const box = document.createElement("div");
            box.className = "item";

            const name = document.createElement("span");
            name.className = "name";
            name.textContent = key;

            const value = document.createElement("span");
            value.className = "value";

            value.textContent =
            item?.type === "checkbox"
            ? (item.value ? "✔" : "✖")
            : (item?.value ?? "");

            const del = document.createElement("button");
            del.textContent = "×";
            del.onclick = () => this.deleteKey(key);

            box.appendChild(name);
            box.appendChild(value);
            box.appendChild(del);

            this.list.appendChild(box);
        }
    }

    deleteKey(key) {
        api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return;

            api.tabs.sendMessage(tab.id, {
                action: "DELETE_KEY",
                key
            }, () => this.load());
        });
    }

    clear() {
        api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return;

            api.tabs.sendMessage(tab.id, { action: "CLEAR" }, () => {
                this.load();
            });
        });
    }

    init() {
        this.loadToggle();
        this.bindToggle();
        this.bindDelay();
        this.load();

        this.clearBtn.addEventListener("click", () => this.clear());
    }
}

new KremyPopup();

import store from "./store/store";
import { uiEnhancement } from "./features";
import { log, getRandomTimeoutMs, scheduleTimeout } from "./lib/utils";
import runEnhancements from "./lib/runEnhancements";
import getSiteAdapter from "./lib/getSiteAdapter";

(async function () {
    "use strict";

    log("Loaded.");

    GM.addStyle(`
        .pe-custom-btn {
            padding: 8px 24px;
            border-radius: 4px;
            font-size: 0.9em;
            background-color: #0a3c95;
            color: white;
            cursor: pointer;
            text-decoration: none;
        }
        .pe-custom-btn:hover {
            background-color: #0d4ebf;
            color: white !important;
        }
        .pe-btn-container {
            padding: 0 16px 8px 16px;
        }
        .pe-rate-highlight {
            padding: 3px 4px;
            border-radius: 4px;
            color: black;
        }
        .pe-settings-item {
            display: flex;
        }
        #pe-ui-container {
            position: fixed;
            bottom: auto;
            right: auto;
            min-width: 260px;
            background: rgba(30, 30, 30, 0.9);
            color: white;
            border-radius: 4px;
            padding: 3px 4px;
            z-index: 10000;
            cursor: grab;
            user-select: none;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        #pe-ui-container:active #pe-ui-title {
            cursor: grabbing;
        }
        #pe-settings-container {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            gap: 10px;
            min-height: 120px;
        }
        #pe-ui-title {
            font-weight: bold;
            text-align: center;
            font-size: 0.8em;
            letter-spacing: 0.3px;
            background: #0a3c95;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            cursor: grab;
            user-select: none;
        }
    `);

    function debounce<F extends (...args: any[]) => any>(
        fn: F,
        delay = 300,
    ): (...args: Parameters<F>) => void {
        let timeoutId: ReturnType<typeof setTimeout>;

        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                Promise.resolve(fn(...args)).catch(console.error);
            }, delay);
        };
    }

    let observer: MutationObserver;
    const observerConfig = { childList: true, subtree: true };

    async function safelyRunEnhancements() {
        observer.disconnect();
        try {
            await runEnhancements();
        } finally {
            observer.observe(document.body, observerConfig);
        }
    }

    const debounced = debounce(async () => {
        observer.disconnect();
        try {
            await runEnhancements();
        } finally {
            observer.observe(document.body, observerConfig);
        }
    }, 300);

    // Observe the DOM for changes and re-run the enhancements if necessary
    observer = new MutationObserver((mutations) => {
        const hasChanges = mutations.some(
            (m) => m.addedNodes.length > 0 || m.removedNodes.length > 0,
        );
        if (!hasChanges) return;

        debounced();
    });

    // Apply the enhancements initially
    await safelyRunEnhancements();

    const ms = getRandomTimeoutMs();
    const pageReloadTimeout = scheduleTimeout(() => {
        if (!document.hidden) {
            pageReloadTimeout.reset();
            return;
        }

        log("Refreshing page...");
        location.reload();
    }, ms);

    const adapter = getSiteAdapter();
    // Automatically refresh page after timeout if applicable
    if (adapter.settings.enableAutoReload) {
        log("Page refresh scheduled.");
        pageReloadTimeout.start();
    }

    function createMenuCommandRefresher() {
        const commandIds: ReturnType<typeof GM.registerMenuCommand>[] = [];

        return async function refreshMenuCommands() {
            for (const id of commandIds) {
                GM.unregisterMenuCommand(id);
            }
            commandIds.length = 0;

            const {
                ui: { visible },
            } = await store.get(["ui"]);

            const id = GM.registerMenuCommand(
                `${visible ? "Hide" : "Show"} Settings UI`,
                async () => {
                    await store.update({ ui: { visible: !visible } });
                },
            );
            commandIds.push(id);
        };
    }
    const refreshMenuCommands = createMenuCommandRefresher();
    // Initial menu command setup
    await refreshMenuCommands();
    const unsubscribe = store.subscribe(async (changed) => {
        // Ignore if only surveys changed
        const keys = Object.keys(changed);
        if (keys.length === 1 && keys[0] === "surveys") return;

        if (changed.ui) await refreshMenuCommands();
        debounced();
        uiEnhancement.update(changed);
    });
})();

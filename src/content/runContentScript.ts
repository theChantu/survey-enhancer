import "./style.css";
import log from "@/lib/log";
import { getRandomTimeoutMs, scheduleTimeout } from "../lib/utils";
import getSiteAdapter from "../lib/getSiteAdapter";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import debounce from "@/lib/debounce";
import deepMerge from "@/lib/deepMerge";
import { loadSettings } from "../lib/loadSettings";
import { EnhancementManager } from "../enhancements/EnhancementManager";

import type { ContentScriptContext } from "#imports";
import type { StoreChangedMessage } from "@/messages/types";

async function runContentScript(ctx: ContentScriptContext) {
    log("Loaded.");

    let observer: MutationObserver;
    const observerConfig = { childList: true, subtree: true };

    const adapter = getSiteAdapter();

    let { globals, site } = await loadSettings(adapter.config.name);
    const enhancementManager = new EnhancementManager(adapter, {
        ...globals,
        ...site,
    });

    async function safelyRunEnhancements() {
        observer.disconnect();
        try {
            await enhancementManager.run();
        } finally {
            observer.observe(document.body, observerConfig);
        }
    }

    const debounced = debounce(
        async (changed?: StoreChangedMessage["data"]) => {
            observer.disconnect();
            try {
                if (changed) {
                    enhancementManager.update(changed);
                }
                await enhancementManager.run();
            } finally {
                observer.observe(document.body, observerConfig);
            }
        },
        300,
    );

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

    const { minInterval, maxInterval } = site.autoReload;

    const ms = getRandomTimeoutMs(minInterval, maxInterval);
    const pageReloadTimeout = scheduleTimeout(() => {
        if (!document.hidden) {
            pageReloadTimeout.reset();
            return;
        }

        log("Refreshing page...");
        location.reload();
    }, ms);

    function handleAutoReloadSettingChange(enabled: boolean) {
        if (enabled) {
            log("Page refresh scheduled.");
            pageReloadTimeout.start();
        } else {
            log("Page refresh canceled.");
            pageReloadTimeout.clear();
        }
    }

    if (site.autoReload.enabled) {
        handleAutoReloadSettingChange(site.autoReload.enabled);
    }

    onExtensionMessage("store-changed", (payload) => {
        if (payload.namespace === "globals") {
            globals = deepMerge(globals, payload.data);
        } else {
            if (payload.entry !== adapter.config.name) return;
            site = deepMerge(site, payload.data);

            if (payload.data.autoReload) {
                const { minInterval, maxInterval, enabled } =
                    payload.data.autoReload;
                if (enabled !== undefined) {
                    handleAutoReloadSettingChange(enabled);
                }

                if (minInterval !== undefined || maxInterval !== undefined) {
                    const ms = getRandomTimeoutMs(
                        site.autoReload.minInterval,
                        site.autoReload.maxInterval,
                    );
                    log(
                        "Page refresh interval updated. New interval (ms):",
                        ms / (60 * 1000),
                    );
                    pageReloadTimeout.setDelay(ms);
                }
            }
        }

        debounced(payload.data);
    });

    const unsubscribeNetwork = adapter.observeNetwork();

    adapter.on("surveyCompletion", (data) => {
        sendExtensionMessage({
            type: "survey-completion",
            data: { siteName: adapter.config.name, url: data.url },
        });
    });
}

export { runContentScript };

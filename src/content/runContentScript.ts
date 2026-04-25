import "./style.css";
import log from "@/lib/log";
import { getRandomTimeoutMs, scheduleTimeout } from "../lib/utils";
import getSiteAdapter from "../lib/site/getSiteAdapter";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import debounce from "@/lib/debounce";
import deepMerge from "@/lib/deepMerge";
import { loadSettings } from "../lib/loadSettings";
import { getRuntimeSyncChannels } from "@/background/runtime/runtimeHelpers";
import { EnhancementHandler } from "./handlers/EnhancementHandler";

import type { ContentScriptContext } from "#imports";
import type { Settings, SiteSettings } from "@/store/types";
import type { RuntimeChannel, StoreChangedMessage } from "@/messages/types";

async function runContentScript(ctx: ContentScriptContext) {
    log("Loaded.");

    let observer: MutationObserver;
    const observerConfig = { childList: true, subtree: true };

    const adapter = getSiteAdapter();

    let { globals, site } = await loadSettings(adapter.config.name);
    const enhancementHandler = new EnhancementHandler(adapter, {
        ...globals,
        ...site,
    });

    async function syncRuntime(channels?: RuntimeChannel[]) {
        for (const channel of getRuntimeSyncChannels(channels)) {
            switch (channel) {
                case "opportunities":
                    if (!adapter.isListingsPage()) continue;

                    await sendExtensionMessage({
                        type: "runtime-sync",
                        data: {
                            channel,
                            siteName: adapter.config.name,
                            data: adapter.extractOpportunities(),
                        },
                    });
                    break;
            }
        }
    }

    async function runEnhancements() {
        observer.disconnect();
        try {
            await enhancementHandler.update({ ...globals, ...site });
            await enhancementHandler.run();
            await syncRuntime();
        } finally {
            observer.observe(document.body, observerConfig);
        }
    }

    const debounced = debounce(async () => {
        await runEnhancements();
    }, 300);

    // Observe the DOM for changes and re-run the enhancements if necessary
    observer = new MutationObserver((mutations) => {
        const hasChanges = mutations.some(
            (m) => m.addedNodes.length > 0 || m.removedNodes.length > 0,
        );
        if (!hasChanges) return;

        debounced();
    });

    const pageReloadTimeout = scheduleTimeout(() => {
        if (!document.hidden) {
            pageReloadTimeout.reset();
            return;
        }

        log("Refreshing page...");
        location.reload();
    });

    // Apply the enhancements initially
    await runEnhancements();

    function initializeAutoReload(autoReload: SiteSettings["autoReload"]) {
        if (!autoReload.enabled) return;

        const delay = getRandomTimeoutMs(
            autoReload.minInterval,
            autoReload.maxInterval,
        );

        log("Page refresh scheduled.");
        pageReloadTimeout.setDelay(delay);
        pageReloadTimeout.start();

        return pageReloadTimeout;
    }

    function updateAutoReload(
        previous: SiteSettings["autoReload"],
        next: SiteSettings["autoReload"],
    ) {
        const intervalsChanged =
            next.minInterval !== previous.minInterval ||
            next.maxInterval !== previous.maxInterval;

        if (!next.enabled) {
            if (previous.enabled) {
                log("Page refresh canceled.");
            }
            pageReloadTimeout.clear();
            return;
        }

        const delay = getRandomTimeoutMs(next.minInterval, next.maxInterval);

        if (!previous.enabled) {
            log("Page refresh scheduled.");
            pageReloadTimeout.setDelay(delay);
            pageReloadTimeout.start();
            return;
        }

        if (intervalsChanged) {
            log(
                "Page refresh interval updated. New interval (min):",
                delay / 60000,
            );
            pageReloadTimeout.setDelay(delay);
        }
    }

    initializeAutoReload(site.autoReload);

    const irrelevantKeys: Set<Partial<keyof Settings>> = new Set([
        "opportunityAlerts",
    ]);

    onExtensionMessage("store-changed", (payload) => {
        if (payload.namespace === "globals") {
            globals = deepMerge(globals, payload.data);
        } else {
            if (payload.entry !== adapter.config.name) return;

            const previousAutoReload = site.autoReload;
            site = deepMerge(site, payload.data);

            if (payload.data.autoReload) {
                updateAutoReload(previousAutoReload, site.autoReload);
            }

            const keys = Object.keys(
                payload.data,
            ) as (keyof StoreChangedMessage["data"])[];
            if (keys.every((key) => irrelevantKeys.has(key))) return;
        }

        debounced();
    });

    onExtensionMessage("runtime-sync-request", async (payload) => {
        await syncRuntime(payload?.channels);
    });

    const unsubscribe = adapter.observeNetwork();

    adapter.on("studyCompletion", (data) => {
        sendExtensionMessage({
            type: "study-completion",
            data: {
                siteName: adapter.config.name,
                url: data.url,
            },
        });
    });
}

export { runContentScript };

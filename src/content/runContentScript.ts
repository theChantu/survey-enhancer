import "./style.css";
import log from "@/lib/log";
import { getRandomTimeoutMs, scheduleTimeout } from "../lib/utils";
import runEnhancements from "../lib/runEnhancements";
import getSiteAdapter from "../lib/getSiteAdapter";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import { SettingsUpdate } from "@/store/createStore";
import { defaultSettings, defaultSettingsKeys } from "@/store/defaultSettings";

import type { ContentScriptContext } from "#imports";

async function runContentScript(ctx: ContentScriptContext) {
    log("Loaded.");

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

    const debounced = debounce(async (changed?: SettingsUpdate) => {
        observer.disconnect();
        try {
            await runEnhancements(changed);
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

    const adapter = getSiteAdapter();

    let siteSettings = (await sendExtensionMessage({
        type: "store-fetch",
        data: {
            url: `https://${adapter.url.host}`,
            settings: defaultSettingsKeys,
        },
    })) ?? { data: defaultSettings };

    const { minReloadInterval, maxReloadInterval, enableAutoReload } =
        siteSettings?.data;

    const ms = getRandomTimeoutMs(minReloadInterval, maxReloadInterval);
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

    if (enableAutoReload) {
        handleAutoReloadSettingChange(enableAutoReload);
    }

    onExtensionMessage("store-changed", (payload) => {
        if (siteSettings) {
            siteSettings.data = { ...siteSettings.data, ...payload };
        }

        const { minReloadInterval, maxReloadInterval, enableAutoReload } =
            payload;
        if (enableAutoReload !== undefined) {
            handleAutoReloadSettingChange(enableAutoReload);
        }

        if (
            minReloadInterval !== undefined ||
            maxReloadInterval !== undefined
        ) {
            const ms = getRandomTimeoutMs(
                siteSettings.data.minReloadInterval,
                siteSettings.data.maxReloadInterval,
            );
            log(
                "Page refresh interval updated. New interval (ms):",
                ms / (60 * 1000),
            );
            pageReloadTimeout.setDelay(ms);
        }

        // Ignore if only surveys changed
        const keys = Object.keys(payload) as (keyof typeof payload)[];
        if (keys.length === 1 && keys[0] === "surveys") return;

        debounced(payload);
    });
}

export { runContentScript };

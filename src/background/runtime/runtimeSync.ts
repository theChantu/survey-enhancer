import { browser } from "#imports";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { safeSendPageMessage } from "../utils/safeSendPageMessage";
import {
    clearRuntimeTab,
    createRuntimeCache,
    getListingsSiteName,
    readRuntimeCache,
    updateRuntimeCache,
} from "./runtimeCache";
import {
    clearRuntimeMeta,
    enrichRuntimeData,
    hasRuntimeStrategy,
    updateRuntimeMeta,
    type RuntimeMetaStore,
} from "./runtimeStrategies";
import {
    loadRuntimeMetaStore,
    pruneRuntimeMeta,
    saveRuntimeMetaStore,
} from "./runtimeMetaStore";

import type { SiteName } from "@/adapters/siteConfigs";
import type {
    RuntimeChannel,
    RuntimeInputDataMap,
    RuntimeOutputDataMap,
} from "@/messages/types";

async function broadcastRuntimeChanged<K extends RuntimeChannel>(
    channel: K,
    siteName: SiteName,
    data: RuntimeOutputDataMap[K] | null,
): Promise<void> {
    await safeSendPageMessage({
        type: "runtime-changed",
        data: {
            channel,
            siteName,
            data,
        },
    });
}

export function registerRuntimeSync(): void {
    const runtimeCache = createRuntimeCache();
    let runtimeMeta: RuntimeMetaStore = {};

    const runtimeMetaReady = (async () => {
        const stored = await loadRuntimeMetaStore();
        runtimeMeta = pruneRuntimeMeta(stored, Date.now());
        await saveRuntimeMetaStore(runtimeMeta);
    })();

    async function syncRuntimeMeta<K extends RuntimeChannel>(
        channel: K,
        siteName: SiteName,
        data: RuntimeInputDataMap[K],
    ): Promise<void> {
        await runtimeMetaReady;

        if (!hasRuntimeStrategy(channel)) return;

        updateRuntimeMeta(runtimeMeta, channel, siteName, data, Date.now());
        runtimeMeta = pruneRuntimeMeta(runtimeMeta, Date.now());
        await saveRuntimeMetaStore(runtimeMeta);
    }

    function getRuntimeOutput<K extends RuntimeChannel>(
        channel: K,
        siteName: SiteName,
        data: RuntimeInputDataMap[K],
    ): RuntimeOutputDataMap[K] {
        return hasRuntimeStrategy(channel)
            ? enrichRuntimeData(runtimeMeta, channel, siteName, data)
            : (data as RuntimeOutputDataMap[K]);
    }

    async function clearRuntimeForTab(
        tabId: number,
        retainSiteName: SiteName | null = null,
    ): Promise<void> {
        await runtimeMetaReady;

        const changes = clearRuntimeTab(runtimeCache, tabId, retainSiteName);
        let metaChanged = false;

        for (const change of changes) {
            if (change.data === null && hasRuntimeStrategy(change.channel)) {
                clearRuntimeMeta(runtimeMeta, change.channel, change.siteName);
                metaChanged = true;
            }

            await broadcastRuntimeChanged(
                change.channel,
                change.siteName,
                change.data === null
                    ? null
                    : getRuntimeOutput(
                          change.channel,
                          change.siteName,
                          change.data,
                ),
            );
        }

        if (metaChanged) {
            runtimeMeta = pruneRuntimeMeta(runtimeMeta, Date.now());
            await saveRuntimeMetaStore(runtimeMeta);
        }
    }

    browser.tabs.onRemoved.addListener((tabId) => {
        void clearRuntimeForTab(tabId);
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url === undefined) return;

        const retainSiteName = getListingsSiteName(changeInfo.url);
        void clearRuntimeForTab(tabId, retainSiteName);

        if (retainSiteName !== null) {
            void browser.tabs.update(tabId, { autoDiscardable: false });
        }
    });

    onExtensionMessage("runtime-sync", async (payload, sender) => {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return;

        void browser.tabs.update(tabId, { autoDiscardable: false });

        const result = updateRuntimeCache(
            runtimeCache,
            payload.channel,
            payload.siteName,
            tabId,
            payload.data,
        );

        await syncRuntimeMeta(payload.channel, payload.siteName, payload.data);

        if (!result.changed || result.data === null) return;

        await broadcastRuntimeChanged(
            payload.channel,
            payload.siteName,
            structuredClone(
                getRuntimeOutput(
                    payload.channel,
                    payload.siteName,
                    result.data,
                ),
            ),
        );
    });

    onExtensionMessage("runtime-fetch", async (payload) => {
        await runtimeMetaReady;

        const data = readRuntimeCache(
            runtimeCache,
            payload.channel,
            payload.siteName,
        );
        if (data === null) return null;

        return {
            ...payload,
            data: structuredClone(
                getRuntimeOutput(payload.channel, payload.siteName, data),
            ),
        };
    });
}

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
    const runtimeMeta: RuntimeMetaStore = {};

    function syncRuntimeMeta<K extends RuntimeChannel>(
        channel: K,
        siteName: SiteName,
        data: RuntimeInputDataMap[K],
    ): void {
        if (!hasRuntimeStrategy(channel)) return;

        updateRuntimeMeta(runtimeMeta, channel, siteName, data, Date.now());
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
        const changes = clearRuntimeTab(runtimeCache, tabId, retainSiteName);

        for (const change of changes) {
            if (change.data === null && hasRuntimeStrategy(change.channel)) {
                clearRuntimeMeta(runtimeMeta, change.channel, change.siteName);
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
    }

    browser.tabs.onRemoved.addListener((tabId) => {
        void clearRuntimeForTab(tabId);
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url === undefined) return;

        const retainSiteName = getListingsSiteName(changeInfo.url);
        void clearRuntimeForTab(tabId, retainSiteName);
    });

    onExtensionMessage("runtime-sync", async (payload, sender) => {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return;

        const result = updateRuntimeCache(
            runtimeCache,
            payload.channel,
            payload.siteName,
            tabId,
            payload.data,
        );

        syncRuntimeMeta(payload.channel, payload.siteName, payload.data);

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

    onExtensionMessage("runtime-fetch", (payload) => {
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

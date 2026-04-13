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
import { createBadgeSync } from "./badgeSync";

import type { SettingsStore } from "@/store/SettingsStore";
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

function isMissingTabError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.message.includes("Invalid tab ID") ||
            error.message.includes("No tab with id") ||
            error.message.includes("tab not found"))
    );
}

async function keepTabLoaded(tabId: number): Promise<void> {
    try {
        await browser.tabs.update(tabId, { autoDiscardable: false });
    } catch (error) {
        if (!isMissingTabError(error)) {
            console.error("Error disabling tab discarding:", error);
        }
    }
}

export function registerRuntimeSync(store: SettingsStore): void {
    const runtimeCache = createRuntimeCache();
    let runtimeMeta: RuntimeMetaStore = {};
    let runtimeMetaReady: Promise<void> | null = null;

    let pendingRuntimeTask = Promise.resolve();

    async function runSerializedTask<TResult>(
        task: () => Promise<TResult>,
    ): Promise<TResult> {
        const previous = pendingRuntimeTask;
        let release!: () => void;

        pendingRuntimeTask = new Promise<void>((resolve) => {
            release = resolve;
        });

        await previous;

        try {
            return await task();
        } finally {
            release();
        }
    }

    async function ensureRuntimeMeta() {
        runtimeMetaReady ??= (async () => {
            try {
                const stored = await loadRuntimeMetaStore();
                runtimeMeta = pruneRuntimeMeta(stored, Date.now());
                await saveRuntimeMetaStore(runtimeMeta);
            } catch (error) {
                runtimeMeta = {};
                console.error("Error initializing runtime metadata:", error);
            }
        })();

        return runtimeMetaReady;
    }

    const badgeSync = createBadgeSync(
        store,
        () => runtimeCache,
        () => runtimeMeta,
    );

    function queueRuntimeTask(task: () => Promise<void>): void {
        void runSerializedTask(task).catch((error) => {
            console.error("Error processing runtime task:", error);
        });
    }

    async function syncRuntimeMeta<K extends RuntimeChannel>(
        channel: K,
        siteName: SiteName,
        data: RuntimeInputDataMap[K],
    ): Promise<void> {
        await ensureRuntimeMeta();

        if (!hasRuntimeStrategy(channel)) return;

        const now = Date.now();

        updateRuntimeMeta(runtimeMeta, channel, siteName, data, now);
        runtimeMeta = pruneRuntimeMeta(runtimeMeta, now);

        try {
            await saveRuntimeMetaStore(runtimeMeta);
        } catch (error) {
            console.error("Error saving runtime metadata:", error);
        }
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
        await ensureRuntimeMeta();

        const changes = clearRuntimeTab(runtimeCache, tabId, retainSiteName);

        for (const change of changes) {
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

        void badgeSync.recompute();
    }

    browser.tabs.onRemoved.addListener((tabId) => {
        queueRuntimeTask(async () => {
            await clearRuntimeForTab(tabId);
        });
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url === undefined) return;

        const retainSiteName = getListingsSiteName(changeInfo.url);
        queueRuntimeTask(async () => {
            await clearRuntimeForTab(tabId, retainSiteName);
        });

        if (retainSiteName !== null) {
            void keepTabLoaded(tabId);
        }
    });

    onExtensionMessage("runtime-sync", async (payload, sender) => {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return;

        void keepTabLoaded(tabId);

        await runSerializedTask(async () => {
            const result = updateRuntimeCache(
                runtimeCache,
                payload.channel,
                payload.siteName,
                tabId,
                payload.data,
            );

            await syncRuntimeMeta(
                payload.channel,
                payload.siteName,
                payload.data,
            );

            void badgeSync.recompute();

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
    });

    onExtensionMessage(
        "runtime-fetch",
        async (payload) =>
            await runSerializedTask(async () => {
                await ensureRuntimeMeta();

                const data = readRuntimeCache(
                    runtimeCache,
                    payload.channel,
                    payload.siteName,
                );
                if (data === null) return null;

                return {
                    ...payload,
                    data: structuredClone(
                        getRuntimeOutput(
                            payload.channel,
                            payload.siteName,
                            data,
                        ),
                    ),
                };
            }),
    );
}

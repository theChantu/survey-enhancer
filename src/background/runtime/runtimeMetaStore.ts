import { storage } from "#imports";
import {
    runtimeChannelStrategies,
    strategyChannels,
} from "./runtimeStrategies";

import type { RuntimeMetaStore } from "./runtimeStrategies";

const RUNTIME_META_STORAGE_KEY = "local:runtime:meta";

export async function loadRuntimeMetaStore(): Promise<RuntimeMetaStore> {
    return (
        (await storage.getItem<RuntimeMetaStore>(RUNTIME_META_STORAGE_KEY)) ??
        {}
    );
}

export async function saveRuntimeMetaStore(
    runtimeMeta: RuntimeMetaStore,
): Promise<void> {
    await storage.setItem(RUNTIME_META_STORAGE_KEY, runtimeMeta);
}

export function pruneRuntimeMeta(
    runtimeMeta: RuntimeMetaStore,
    now: number,
): RuntimeMetaStore {
    const next: RuntimeMetaStore = {};

    for (const channel of strategyChannels) {
        const channelMeta = runtimeMeta[channel];
        if (!channelMeta) continue;

        const strategy = runtimeChannelStrategies[channel];
        const prunedEntries = Object.fromEntries(
            Object.entries(channelMeta)
                .map(([siteName, siteMeta]) => [
                    siteName,
                    siteMeta ? strategy.prune(siteMeta, now) : undefined,
                ])
                .filter(([, pruned]) => pruned !== undefined),
        );

        if (Object.keys(prunedEntries).length > 0) {
            next[channel] = prunedEntries as typeof channelMeta;
        }
    }

    return next;
}

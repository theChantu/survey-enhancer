import { storage } from "#imports";

import type { RuntimeMetaMap, RuntimeMetaStore } from "./runtimeStrategies";

const RUNTIME_META_STORAGE_KEY = "local:runtime:meta";
const RUNTIME_META_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

function pruneChannelMeta<T extends keyof RuntimeMetaMap>(
    channelMeta: Partial<RuntimeMetaStore[T]> | undefined,
    now: number,
): Partial<RuntimeMetaStore[T]> | undefined {
    if (!channelMeta) return undefined;

    const nextEntries = Object.fromEntries(
        Object.entries(channelMeta)
            .map(([siteName, siteMeta]) => {
                const prunedSiteMeta = Object.fromEntries(
                    Object.entries(siteMeta ?? {}).filter(
                        ([, meta]) =>
                            now - meta.lastSeenAt < RUNTIME_META_TTL_MS,
                    ),
                );

                return [siteName, prunedSiteMeta];
            })
            .filter(([, siteMeta]) => Object.keys(siteMeta).length > 0),
    );

    return Object.keys(nextEntries).length > 0
        ? (nextEntries as Partial<RuntimeMetaStore[T]>)
        : undefined;
}

export function pruneRuntimeMeta(
    runtimeMeta: RuntimeMetaStore,
    now: number,
): RuntimeMetaStore {
    const next: RuntimeMetaStore = {};

    const studiesMeta = pruneChannelMeta(runtimeMeta.studies, now);
    if (studiesMeta) {
        next.studies = studiesMeta;
    }

    return next;
}

import {
    sites,
    type SiteName,
    type SupportedHosts,
} from "@/adapters/siteConfigs";
import { getOpportunityKey } from "@/lib/opportunities";

import type { RuntimeChannel, RuntimeInputDataMap } from "@/messages/types";

type RuntimeTabEntries<K extends RuntimeChannel> = Partial<
    Record<number, RuntimeInputDataMap[K]>
>;

export type RuntimeCache = {
    [K in RuntimeChannel]: Partial<Record<SiteName, RuntimeTabEntries<K>>>;
};

export type RuntimeClearedChange = {
    [K in RuntimeChannel]: {
        channel: K;
        siteName: SiteName;
        data: RuntimeInputDataMap[K] | null;
    };
}[RuntimeChannel];

export function createRuntimeCache(): RuntimeCache {
    return {
        opportunities: {},
    };
}

function runtimeEquals<K extends RuntimeChannel>(
    current: RuntimeInputDataMap[K] | undefined,
    next: RuntimeInputDataMap[K],
): boolean {
    return JSON.stringify(current ?? null) === JSON.stringify(next);
}

function dedupeByKey<T, K>(items: T[], getKey: (item: T) => K): T[] {
    const map = new Map<K, T>();

    for (const item of items) {
        map.set(getKey(item), item);
    }

    return [...map.values()];
}

function aggregateRuntimeData<K extends RuntimeChannel>(
    channel: K,
    entries: RuntimeTabEntries<K> | undefined,
): RuntimeInputDataMap[K] | null {
    if (!entries || Object.keys(entries).length === 0) return null;

    switch (channel) {
        case "opportunities":
            return dedupeByKey(
                Object.values(entries).flatMap((items) => items ?? []),
                getOpportunityKey,
            );
    }
}

type UpdatedRuntimeData<K extends RuntimeChannel> = {
    changed: boolean;
    data: RuntimeInputDataMap[K] | null;
};

export function updateRuntimeCache<K extends RuntimeChannel>(
    cache: RuntimeCache,
    channel: K,
    siteName: SiteName,
    tabId: number,
    data: RuntimeInputDataMap[K],
): UpdatedRuntimeData<K> {
    const siteEntries = cache[channel][siteName] ?? {};
    const current = siteEntries[tabId];

    if (runtimeEquals(current, data)) {
        return {
            changed: false,
            data: aggregateRuntimeData(channel, siteEntries),
        };
    }

    siteEntries[tabId] = structuredClone(data);
    cache[channel][siteName] = siteEntries;

    return {
        changed: true,
        data: aggregateRuntimeData(channel, siteEntries),
    };
}

export function readRuntimeCache<K extends RuntimeChannel>(
    cache: RuntimeCache,
    channel: K,
    siteName: SiteName,
): RuntimeInputDataMap[K] | null {
    return aggregateRuntimeData(channel, cache[channel][siteName]);
}

export function clearRuntimeTab(
    cache: RuntimeCache,
    tabId: number,
    retainSiteName: SiteName | null = null,
): RuntimeClearedChange[] {
    const changes: RuntimeClearedChange[] = [];

    for (const channel of Object.keys(cache) as RuntimeChannel[]) {
        for (const siteName of Object.keys(cache[channel]) as SiteName[]) {
            if (siteName === retainSiteName) continue;

            const siteEntries = cache[channel][siteName];
            if (!siteEntries || !(tabId in siteEntries)) continue;

            delete siteEntries[tabId];

            const data = readRuntimeCache(cache, channel, siteName);
            if (data === null) {
                delete cache[channel][siteName];
            }

            changes.push({
                channel,
                siteName,
                data,
            });
        }
    }

    return changes;
}

export function getListingsSiteName(url: string): SiteName | null {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname as SupportedHosts;
        if (!(host in sites)) return null;

        return parsed.pathname === sites[host].studyPath
            ? sites[host].name
            : null;
    } catch {
        return null;
    }
}

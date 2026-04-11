import type { SiteName } from "@/adapters/siteConfigs";
import type {
    RuntimeChannel,
    RuntimeInputDataMap,
    RuntimeOutputDataMap,
    RuntimeSeenMeta,
} from "@/messages/types";

export type RuntimeMetaMap = {
    studies: Record<string, RuntimeSeenMeta>;
};

type StrategyChannel = keyof RuntimeMetaMap & RuntimeChannel;

type RuntimeStrategy<
    K extends StrategyChannel,
    TOutput = RuntimeOutputDataMap[K],
> = {
    updateMeta: (
        data: RuntimeInputDataMap[K],
        meta: RuntimeMetaMap[K] | undefined,
        now: number,
    ) => RuntimeMetaMap[K];
    enrich: (
        data: RuntimeInputDataMap[K],
        meta: RuntimeMetaMap[K] | undefined,
    ) => TOutput;
    prune: (
        meta: RuntimeMetaMap[K],
        now: number,
    ) => RuntimeMetaMap[K] | undefined;
};

type RuntimeStrategies = {
    [K in StrategyChannel]: RuntimeStrategy<K>;
};

export type RuntimeMetaStore = Partial<{
    [K in StrategyChannel]: Partial<Record<SiteName, RuntimeMetaMap[K]>>;
}>;

function defineRuntimeStrategies<T extends RuntimeStrategies>(strategies: T) {
    return strategies;
}

const STUDIES_META_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const runtimeChannelStrategies = defineRuntimeStrategies({
    studies: {
        updateMeta: (studies, meta, now) => {
            const next = { ...(meta ?? {}) };

            for (const study of studies) {
                const current = next[study.id];
                next[study.id] = current
                    ? { ...current, lastSeenAt: now }
                    : { firstSeenAt: now, lastSeenAt: now };
            }

            return next;
        },
        enrich: (studies, meta) =>
            studies.map((study) => {
                const seen = meta?.[study.id];

                return {
                    ...study,
                    firstSeenAt: seen?.firstSeenAt ?? 0,
                    lastSeenAt: seen?.lastSeenAt ?? 0,
                };
            }),
        prune: (meta, now) => {
            const pruned = Object.fromEntries(
                Object.entries(meta).filter(
                    ([, entry]) => now - entry.lastSeenAt < STUDIES_META_TTL_MS,
                ),
            );

            return Object.keys(pruned).length > 0 ? pruned : undefined;
        },
    },
});

export const strategyChannels = Object.keys(
    runtimeChannelStrategies,
) as StrategyChannel[];

export function hasRuntimeStrategy(
    channel: RuntimeChannel,
): channel is StrategyChannel {
    return channel in runtimeChannelStrategies;
}

export function updateRuntimeMeta<K extends StrategyChannel>(
    runtimeMeta: RuntimeMetaStore,
    channel: K,
    siteName: SiteName,
    data: RuntimeInputDataMap[K],
    now: number,
): RuntimeMetaMap[K] {
    const strategy = runtimeChannelStrategies[channel];
    const current = runtimeMeta[channel]?.[siteName];
    const next = strategy.updateMeta(data, current, now);

    runtimeMeta[channel] ??= {};
    runtimeMeta[channel][siteName] = next;

    return next;
}

export function enrichRuntimeData<K extends StrategyChannel>(
    runtimeMeta: RuntimeMetaStore,
    channel: K,
    siteName: SiteName,
    data: RuntimeInputDataMap[K],
): RuntimeOutputDataMap[K] {
    const strategy = runtimeChannelStrategies[channel];
    const meta = runtimeMeta[channel]?.[siteName];

    return strategy.enrich(data, meta);
}

export function clearRuntimeMeta<K extends StrategyChannel>(
    runtimeMeta: RuntimeMetaStore,
    channel: K,
    siteName: SiteName,
): void {
    const channelMeta = runtimeMeta[channel];
    if (!channelMeta) return;

    delete channelMeta[siteName];

    if (Object.keys(channelMeta).length === 0) {
        delete runtimeMeta[channel];
    }
}

import type { SiteName } from "@/adapters/siteConfigs";
import {
    getOpportunityFingerprint,
    getOpportunityKey,
    isOpportunityAlertable,
} from "@/lib/opportunities";
import type {
    RuntimeChannel,
    RuntimeInputDataMap,
    RuntimeOutputDataMap,
    RuntimeSeenMeta,
} from "@/messages/types";

export type RuntimeMetaMap = {
    opportunities: Record<string, RuntimeSeenMeta>;
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

const OPPORTUNITIES_META_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isAlertableOpportunityChange(
    opportunity: RuntimeInputDataMap["opportunities"][number],
    current: RuntimeSeenMeta | undefined,
): boolean {
    if (!current) return isOpportunityAlertable(opportunity);
    if (opportunity.kind !== "project") return false;

    const currentCount = opportunity.availableStudyCount;
    if (currentCount === null || currentCount <= 0) return false;

    const previousCount = Number(current.fingerprint);
    return !Number.isFinite(previousCount) || currentCount > previousCount;
}

export const runtimeChannelStrategies = defineRuntimeStrategies({
    opportunities: {
        updateMeta: (opportunities, meta, now) => {
            const next = { ...(meta ?? {}) };

            for (const opportunity of opportunities) {
                const key = getOpportunityKey(opportunity);
                const current = next[key];
                const fingerprint = getOpportunityFingerprint(opportunity);
                const changed = current?.fingerprint !== fingerprint;

                next[key] = current
                    ? {
                          ...current,
                          lastSeenAt: now,
                          lastChangedAt: changed
                              ? now
                              : current.lastChangedAt,
                          lastAlertableChangeAt:
                              changed &&
                              isAlertableOpportunityChange(opportunity, current)
                                  ? now
                                  : current.lastAlertableChangeAt,
                          fingerprint,
                      }
                    : {
                          firstSeenAt: now,
                          lastSeenAt: now,
                          lastChangedAt: now,
                          lastAlertableChangeAt: isOpportunityAlertable(
                              opportunity,
                          )
                              ? now
                              : 0,
                          fingerprint,
                      };
            }

            return next;
        },
        enrich: (opportunities, meta) =>
            opportunities.map((opportunity) => {
                const seen = meta?.[getOpportunityKey(opportunity)];

                return {
                    ...opportunity,
                    firstSeenAt: seen?.firstSeenAt ?? 0,
                    lastSeenAt: seen?.lastSeenAt ?? 0,
                    lastChangedAt: seen?.lastChangedAt ?? 0,
                    lastAlertableChangeAt: seen?.lastAlertableChangeAt ?? 0,
                    fingerprint: seen?.fingerprint ?? "",
                };
            }),
        prune: (meta, now) => {
            const pruned = Object.fromEntries(
                Object.entries(meta).filter(
                    ([, entry]) =>
                        now - entry.lastSeenAt < OPPORTUNITIES_META_TTL_MS,
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

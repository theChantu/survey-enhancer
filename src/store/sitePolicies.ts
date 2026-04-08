import deepMerge from "@/lib/deepMerge";
import { defaultSiteSettings } from "./defaultSiteSettings";
import { supportedSites } from "@/adapters/siteConfigs";

import type { SiteSettings, DeepPartial } from "./types";
import type { SitesState } from "./SettingsStore";

export type SiteNormalizationResult = {
    current: SiteSettings;
    persistedPatch?: DeepPartial<SiteSettings>;
};

type SiteNormalizationRule = (current: SiteSettings) => SiteNormalizationResult;

function mergePersistedPatch<T extends object>(
    current: DeepPartial<T> | undefined,
    next: DeepPartial<T> | undefined,
): DeepPartial<T> | undefined {
    if (!next) return current;
    return current ? (deepMerge(current, next) as DeepPartial<T>) : next;
}

function normalizeDailySurveyCompletions(
    current: SiteSettings,
): SiteNormalizationResult {
    const analytics = current.analytics;
    const stale =
        Date.now() - analytics.dailySurveyCompletions.timestamp >
        24 * 60 * 60 * 1000;
    if (!stale) return { current };

    const resetDaily = structuredClone(defaultSiteSettings.analytics);

    const previousDailySurveyCompletions =
        analytics.dailySurveyCompletions.count > 0
            ? analytics.dailySurveyCompletions.count
            : analytics.previousDailySurveyCompletions;

    return {
        current: {
            ...current,
            analytics: {
                ...current.analytics,
                dailySurveyCompletions: resetDaily.dailySurveyCompletions,
                previousDailySurveyCompletions,
            },
        },
        persistedPatch: {
            analytics: {
                dailySurveyCompletions: resetDaily.dailySurveyCompletions,
                previousDailySurveyCompletions,
            },
        },
    };
}

const siteNormalizationRules: SiteNormalizationRule[] = [
    normalizeDailySurveyCompletions,
];

function normalizeSiteState(current: SiteSettings): SiteNormalizationResult {
    let next = current;
    let persistedPatch: DeepPartial<SiteSettings> | undefined;

    for (const normalize of siteNormalizationRules) {
        const result = normalize(next);
        next = result.current;
        persistedPatch = mergePersistedPatch(
            persistedPatch,
            result.persistedPatch,
        );
    }

    return persistedPatch
        ? { current: next, persistedPatch }
        : { current: next };
}

export function normalizeSitesState(current: SitesState): {
    current: SitesState;
    persistedPatch?: DeepPartial<SitesState>;
} {
    let next = current;
    let persistedPatch: DeepPartial<SitesState> | undefined;

    for (const siteName of supportedSites) {
        const result = normalizeSiteState(next[siteName]);
        next = { ...next, [siteName]: result.current };
        persistedPatch = mergePersistedPatch(persistedPatch, {
            [siteName]: result.persistedPatch,
        });
    }

    return persistedPatch
        ? { current: next, persistedPatch }
        : { current: next };
}

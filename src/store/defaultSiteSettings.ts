import type { SiteSettings } from "./types";

const defaultSiteSettings = Object.freeze({
    currencyConversion: {
        enabled: true,
        selectedCurrency: "USD",
    },
    highlightRates: {
        enabled: true,
    },
    surveyLinks: {
        enabled: true,
    },
    newSurveyNotifications: {
        enabled: true,
        surveys: {},
        cachedResearchers: {},
        excludedResearchers: [],
        includedResearchers: [],
    },
    autoReload: {
        enabled: false,
        minInterval: 5,
        maxInterval: 7,
    },
    analytics: {
        totalSurveyCompletions: 0,
        dailySurveyCompletions: {
            timestamp: Date.now(),
            urls: [],
        },
    },
} as const satisfies SiteSettings);

const defaultSiteSettingsKeys = Object.keys(
    defaultSiteSettings,
) as (keyof typeof defaultSiteSettings)[];

export { defaultSiteSettings, defaultSiteSettingsKeys };

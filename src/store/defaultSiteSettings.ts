import { currencyKeys } from "./types";

import type { SiteSettings, Currency } from "./types";

const conversionRates: SiteSettings["currencyConversion"]["conversionRates"] = {
    ...(Object.fromEntries(
        currencyKeys.map((baseCurrency) => [
            baseCurrency,
            {
                timestamp: 0,
                rates: Object.fromEntries(
                    currencyKeys.map((targetCurrency) => [targetCurrency, 1]),
                ) as Record<Currency, number>,
            },
        ]),
    ) as Record<
        Currency,
        { timestamp: number; rates: Record<Currency, number> }
    >),
};

const defaultSiteSettings = Object.freeze({
    currencyConversion: {
        enabled: true,
        conversionRates,
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

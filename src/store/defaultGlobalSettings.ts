import { currencyKeys } from "./types";

import type { Currency, GlobalSettings } from "./types";

const conversionRates: GlobalSettings["conversionRates"] = {
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

const defaultGlobalSettings = Object.freeze({
    conversionRates,
    currency: {
        target: "USD",
        enabled: false,
    },
    debug: {
        enabled: false,
    },
    highlightRates: {
        enabled: true,
    },
    idleThreshold: 15 * 60,
    lastPopupOpenedAt: 0,
    providers: {},
    notifications: {
        enabled: true,
        delivery: {
            browser: true,
            sound: {
                enabled: false,
                type: "chime",
                volume: 0.5,
            },
        },
    },
    studySort: "page-order",
} as const) satisfies GlobalSettings;

const defaultGlobalSettingsKeys = Object.keys(
    defaultGlobalSettings,
) as (keyof typeof defaultGlobalSettings)[];

export { defaultGlobalSettings, defaultGlobalSettingsKeys };

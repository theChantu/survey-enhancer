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
    enableDebug: false,
    idleThreshold: 15 * 60,
    providers: {},
}) satisfies GlobalSettings;

const defaultGlobalSettingsKeys = Object.keys(
    defaultGlobalSettings,
) as (keyof typeof defaultGlobalSettings)[];

export { defaultGlobalSettings, defaultGlobalSettingsKeys };

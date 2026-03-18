import store from "../store/store";
import log from "./log";
import {
    convertCurrencyEnhancement,
    highlightRatesEnhancement,
    newSurveyNotificationsEnhancement,
    surveyLinksEnhancement,
} from "../features";
import getSiteAdapter from "./getSiteAdapter";
import { moduleToEnableKey } from "@/adapters/sites";

import type { ModuleName } from "../adapters/modules/BaseModule";
import type Enhancement from "../features/BaseEnhancement";
import type { Settings, SettingsUpdate } from "@/store/createStore";

type EnhancementSettingKeys = (typeof moduleToEnableKey)[ModuleName];

type EnhancementConfig = {
    enableKey: EnhancementSettingKeys;
    triggers?: (keyof Settings)[];
    module: ModuleName;
    enhancement: Enhancement;
    priority?: boolean;
};

const ENHANCEMENTS: EnhancementConfig[] = [
    {
        enableKey: moduleToEnableKey["CurrencyConversion"],
        triggers: ["selectedCurrency"],
        module: "CurrencyConversion",
        enhancement: convertCurrencyEnhancement,
        priority: true,
    },
    {
        enableKey: moduleToEnableKey["HighlightRates"],
        module: "HighlightRates",
        enhancement: highlightRatesEnhancement,
    },
    {
        enableKey: moduleToEnableKey["SurveyLinks"],
        module: "SurveyLinks",
        enhancement: surveyLinksEnhancement,
    },
    {
        enableKey: moduleToEnableKey["NewSurveyNotifications"],
        module: "NewSurveyNotifications",
        enhancement: newSurveyNotificationsEnhancement,
    },
];

const SORTED = [...ENHANCEMENTS].sort((a, b) => +!!b.priority - +!!a.priority);
const ENABLE_KEYS = ENHANCEMENTS.map((e) => e.enableKey);

const adapter = getSiteAdapter();

async function runEnhancements(changed?: SettingsUpdate) {
    log("Running enhancements...");

    if (changed) {
        for (const config of SORTED) {
            if (!adapter.hasModule(config.module)) continue;

            const keyChanged = config.enableKey in changed;
            const keyEnabled = changed[config.enableKey];
            if (keyEnabled === undefined) {
                const settings = await store.get(adapter.url.name, [
                    config.enableKey,
                ]);
                if (!settings[config.enableKey]) continue;
            }

            const triggerChanged = config.triggers?.some((k) => k in changed);

            if (!keyChanged && !triggerChanged) continue;

            if (keyChanged && !keyEnabled) {
                await config.enhancement.revert();
            } else {
                await config.enhancement.run();
            }
        }
        return;
    }

    const settings = await store.get(adapter.url.name, [...ENABLE_KEYS]);

    for (const config of SORTED) {
        if (!adapter.hasModule(config.module) || !settings[config.enableKey])
            continue;

        await config.enhancement.run();
    }
}

export default runEnhancements;

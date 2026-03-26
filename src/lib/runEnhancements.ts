import log from "./log";
import {
    convertCurrencyEnhancement,
    highlightRatesEnhancement,
    newSurveyNotificationsEnhancement,
    surveyLinksEnhancement,
} from "../enhancements";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import getSiteAdapter from "./getSiteAdapter";
import { moduleToEnableKey } from "@/adapters/sites";

import type { ModuleName } from "../adapters/modules/BaseModule";
import type Enhancement from "../enhancements/BaseEnhancement";
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

    const response = await sendExtensionMessage({
        type: "store-fetch",
        data: {
            siteName: adapter.config.name,
            settings: ENABLE_KEYS,
        },
    });
    if (!response) return;
    const settings = response.data;

    if (changed) {
        for (const config of SORTED) {
            if (!adapter.hasModule(config.module)) continue;

            const keyChanged = config.enableKey in changed;
            const enabled = settings[config.enableKey];

            const triggerChanged = config.triggers?.some((k) => k in changed);

            if (!keyChanged && !triggerChanged) continue;

            adapter.prepareElements();
            if (keyChanged && !enabled) {
                await config.enhancement.revert();
            } else {
                await config.enhancement.run();
            }
        }
        return;
    }

    for (const config of SORTED) {
        if (!adapter.hasModule(config.module)) continue;
        const enabled = settings[config.enableKey];

        adapter.prepareElements();
        if (enabled) {
            await config.enhancement.apply();
        } else {
            await config.enhancement.revert();
        }
    }
}

export default runEnhancements;

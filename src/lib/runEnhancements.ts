import store from "../store/store";
import { log } from "./utils";
import {
    convertCurrencyEnhancement,
    highlightRatesEnhancement,
    newSurveyNotificationsEnhancement,
    surveyLinksEnhancement,
    uiEnhancement,
    updateRates,
} from "../features";
import getSiteAdapter from "./getSiteAdapter";

import type { SiteSettings } from "./types";
import type { ModuleName } from "../adapters/modules/BaseModule";
import type Enhancement from "../features/BaseEnhancement";

type ModuleSettingKey = Exclude<
    Extract<keyof SiteSettings, `enable${string}`>,
    "enableDebug"
>;

const ENHANCEMENT_CONFIG = {
    enableCurrencyConversion: {
        module: "CurrencyConversion",
        enhancement: convertCurrencyEnhancement,
    },
    enableHighlightRates: {
        module: "HighlightRates",
        enhancement: highlightRatesEnhancement,
    },
    enableSurveyLinks: {
        module: "SurveyLinks",
        enhancement: surveyLinksEnhancement,
    },
    enableNewSurveyNotifications: {
        module: "NewSurveyNotifications",
        enhancement: newSurveyNotificationsEnhancement,
    },
} as const satisfies Record<
    ModuleSettingKey,
    {
        module: ModuleName;
        enhancement: Enhancement;
    }
>;

const ENHANCEMENT_SETTING_KEYS = Object.keys(
    ENHANCEMENT_CONFIG,
) as (keyof typeof ENHANCEMENT_CONFIG)[];

const adapter = getSiteAdapter();
const excluded = new Set<(typeof ENHANCEMENT_SETTING_KEYS)[number]>([
    "enableCurrencyConversion",
]);

async function runEnhancements() {
    log("Running enhancements...");

    const settings = await store.get([...ENHANCEMENT_SETTING_KEYS, "ui"]);
    const { ui: uiSetting, enableCurrencyConversion } = settings;

    const cleanup: Enhancement[] = [];
    const tasks: Enhancement[] = [];

    for (const key of ENHANCEMENT_SETTING_KEYS) {
        if (excluded.has(key)) continue;

        const { module, enhancement } = ENHANCEMENT_CONFIG[key];

        if (!adapter.hasModule(module)) continue;
        cleanup.push(enhancement);

        if (settings[key]) tasks.push(enhancement);
    }

    if (adapter.hasModule("UI")) {
        cleanup.push(uiEnhancement);
        if (uiSetting.visible) tasks.push(uiEnhancement);
    }

    await Promise.all(cleanup.map((task) => task.revert()));

    // Currency must resolve before other enhancements
    if (adapter.hasModule("CurrencyConversion")) {
        await convertCurrencyEnhancement.revert();
        if (enableCurrencyConversion) {
            // Fetch the latest currency rates before conversion
            await updateRates();
            await convertCurrencyEnhancement.apply();
        }
    }

    await Promise.all(tasks.map((task) => task.apply()));
}

export default runEnhancements;

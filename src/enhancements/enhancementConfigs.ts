import {
    ConvertCurrencyEnhancement,
    HighlightRatesEnhancement,
    NewSurveyNotificationsEnhancement,
} from "../enhancements";
import BaseEnhancement from "./BaseEnhancement";

type EnhancementClass = new (...args: any[]) => BaseEnhancement;

type EnhancementConfig = {
    enhancement: EnhancementClass;
    priority: boolean;
};

const enhancementKeys = [
    "currencyConversion",
    "highlightRates",
    "newSurveyNotifications",
] as const;

export type EnhancementKey = (typeof enhancementKeys)[number];

export const enhancementConfigs = {
    currencyConversion: {
        enhancement: ConvertCurrencyEnhancement,
        priority: true,
    },
    highlightRates: {
        enhancement: HighlightRatesEnhancement,
        priority: false,
    },

    newSurveyNotifications: {
        enhancement: NewSurveyNotificationsEnhancement,
        priority: false,
    },
} as const satisfies Record<EnhancementKey, EnhancementConfig>;

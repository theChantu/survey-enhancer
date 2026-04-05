import {
    ConvertCurrencyEnhancement,
    HighlightRatesEnhancement,
    NewSurveyNotificationsEnhancement,
    SurveyLinksEnhancement,
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
    "surveyLinks",
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
    surveyLinks: {
        enhancement: SurveyLinksEnhancement,
        priority: false,
    },
    newSurveyNotifications: {
        enhancement: NewSurveyNotificationsEnhancement,
        priority: false,
    },
} as const satisfies Record<EnhancementKey, EnhancementConfig>;

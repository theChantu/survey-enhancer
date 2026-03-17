import type { Settings } from "@/store/createStore";
import type { ModuleName } from "./modules/BaseModule";

type EnableKeys = Extract<keyof Settings, `enable${string}`>;

export const moduleToEnableKey = {
    CurrencyConversion: "enableCurrencyConversion",
    HighlightRates: "enableHighlightRates",
    NewSurveyNotifications: "enableNewSurveyNotifications",
    SurveyLinks: "enableSurveyLinks",
} as const satisfies Record<ModuleName, EnableKeys>;

export interface SiteInfo {
    name: string;
    surveyPath: string;
    iconPath: string;
    modules: ModuleName[];
}

export const sites = {
    "app.prolific.com": {
        name: "prolific",
        surveyPath: "/studies",
        iconPath: "/apple-touch-icon.png",
        modules: [
            "CurrencyConversion",
            "HighlightRates",
            "NewSurveyNotifications",
            "SurveyLinks",
        ],
    },
    "connect.cloudresearch.com": {
        name: "cloudresearch",
        surveyPath: "/participant/dashboard",
        iconPath: "/participant/favicon.ico",
        modules: [
            "CurrencyConversion",
            "HighlightRates",
            "NewSurveyNotifications",
        ],
    },
} as const satisfies Record<string, SiteInfo>;

export type SupportedSites = keyof typeof sites;
export type SiteName = (typeof sites)[SupportedSites]["name"];

export const supportedSites = Object.keys(sites) as SupportedSites[];

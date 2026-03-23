import type { Settings } from "@/store/createStore";
import type { ModuleName } from "./modules/BaseModule";
import type { EventResponseMap } from "./BaseAdapter";

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
    suffix?: string;
    query?: Record<string, string | number | boolean>;
    modules: ModuleName[];
    networkPatterns: Partial<Record<keyof EventResponseMap, string>>;
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
        networkPatterns: {
            surveyCompletion: "/transition",
        },
    },
    "connect.cloudresearch.com": {
        name: "cloudresearch",
        surveyPath: "/participant/dashboard",
        iconPath: "/participant/favicon.ico",
        suffix: "details",
        query: {
            page: 1,
            size: 100,
        },
        modules: [
            "CurrencyConversion",
            "HighlightRates",
            "NewSurveyNotifications",
        ],
        networkPatterns: {
            surveyCompletion: "/submitRedirect",
        },
    },
} as const satisfies Record<string, SiteInfo>;

export type SupportedSites = keyof typeof sites;
export type SiteName = (typeof sites)[SupportedSites]["name"];

export const supportedSites = Object.keys(sites) as SupportedSites[];

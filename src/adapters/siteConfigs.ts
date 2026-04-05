import type { EnhancementKey } from "@/enhancements/enhancementConfigs";
import type { EventResponseMap } from "./BaseAdapter";

export interface SiteInfo {
    name: string;
    surveyPath: string;
    iconPath: string;
    suffix?: string;
    query?: Record<string, string | number | boolean>;
    modules: EnhancementKey[];
    networkPatterns: Partial<Record<keyof EventResponseMap, string>>;
}

export const sites = {
    "app.prolific.com": {
        name: "prolific",
        surveyPath: "/studies",
        iconPath: "/apple-touch-icon.png",
        modules: [
            "currencyConversion",
            "highlightRates",
            "newSurveyNotifications",
            "surveyLinks",
        ],
        networkPatterns: {
            surveyCompletion: "/complete",
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
            "currencyConversion",
            "highlightRates",
            "newSurveyNotifications",
        ],
        networkPatterns: {
            surveyCompletion: "/submitRedirect",
        },
    },
} as const satisfies Record<string, SiteInfo>;

export type SupportedSites = keyof typeof sites;
export type SiteName = (typeof sites)[SupportedSites]["name"];

export const supportedSites = Object.keys(sites) as SupportedSites[];

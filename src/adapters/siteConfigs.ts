import type { EnhancementKey } from "@/enhancements/enhancementConfigs";
import type { AdapterEventType, NetworkEventMatcher } from "./events";

export interface SiteInfo {
    name: string;
    surveyPath: string;
    iconPath: string;
    suffix?: string;
    query?: Record<string, string | number | boolean>;
    enhancements: EnhancementKey[];
    watchedRequestTargets: string[];
    networkPatterns: Partial<Record<AdapterEventType, NetworkEventMatcher[]>>;
}

export const sites = {
    "app.prolific.com": {
        name: "prolific",
        surveyPath: "/studies",
        iconPath: "/apple-touch-icon.png",
        enhancements: [
            "currencyConversion",
            "highlightRates",
            "newSurveyNotifications",
        ],
        watchedRequestTargets: ["internal-api.prolific.com/api/v1"],
        networkPatterns: {
            surveyCompletion: [
                {
                    path: "/submissions/complete",
                    method: "POST",
                },
            ],
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
        enhancements: [
            "currencyConversion",
            "highlightRates",
            "newSurveyNotifications",
        ],
        watchedRequestTargets: ["connect.cloudresearch.com/participant-api"],
        networkPatterns: {
            surveyCompletion: [
                {
                    path: "/submit",
                    method: "POST",
                },
            ],
        },
    },
} as const satisfies Record<string, SiteInfo>;

export type SupportedHosts = keyof typeof sites;
export type SiteName = (typeof sites)[SupportedHosts]["name"];

export const supportedHosts = Object.keys(sites) as SupportedHosts[];
export const supportedSites = supportedHosts.map((host) => sites[host].name);

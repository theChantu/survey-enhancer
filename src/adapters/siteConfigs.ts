import type { EnhancementKey } from "@/enhancements/enhancementConfigs";
import type { AdapterEventType, NetworkEventMatcher } from "./events";

export type SiteFeature = "autoReload";

export interface SiteInfo {
    name: string;
    studyPath: string;
    iconPath: string;
    suffix?: string;
    query?: Record<string, string | number | boolean>;
    enhancements: EnhancementKey[];
    features: SiteFeature[];
    watchedRequestTargets: string[];
    networkPatterns: Partial<Record<AdapterEventType, NetworkEventMatcher[]>>;
}

export const sites = {
    "app.prolific.com": {
        name: "prolific",
        studyPath: "/studies",
        iconPath: "/apple-touch-icon.png",
        enhancements: ["currency", "highlightRates", "opportunityAlerts"],
        features: [],
        watchedRequestTargets: ["internal-api.prolific.com/api/v1"],
        networkPatterns: {
            studyCompletion: [
                {
                    path: "/transition",
                    method: "POST",
                    requestBody: {
                        field: "action",
                        in: ["COMPLETE"],
                    },
                },
                {
                    path: "/submissions/complete",
                    method: "POST",
                },
            ],
        },
    },
    "connect.cloudresearch.com": {
        name: "cloudresearch",
        studyPath: "/participant/dashboard",
        iconPath: "/participant/favicon.ico",
        suffix: "details",
        query: {
            page: 1,
            size: 100,
        },
        enhancements: ["currency", "highlightRates", "opportunityAlerts"],
        features: ["autoReload"],
        watchedRequestTargets: ["connect.cloudresearch.com/participant-api"],
        networkPatterns: {
            studyCompletion: [
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

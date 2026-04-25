import { defaultAlertRules } from "@/lib/notifications/defaultAlertRules";

import type { SiteSettings } from "./types";

const defaultSiteSettings = Object.freeze({
    opportunityAlerts: {
        cache: {
            opportunities: {},
            researchers: {},
            titles: {},
        },
        enabled: true,
        rules: defaultAlertRules,
    },
    autoReload: {
        enabled: false,
        minInterval: 5,
        maxInterval: 7,
    },
    analytics: {
        totalStudyCompletions: 0,
        bestDailyStudyCompletions: 0,
        previousDailyStudyCompletions: 0,
        dailyStudyCompletions: {
            timestamp: Date.now(),
            count: 0,
        },
    },
} as const satisfies SiteSettings);

const defaultSiteSettingsKeys = Object.keys(
    defaultSiteSettings,
) as (keyof typeof defaultSiteSettings)[];

export { defaultSiteSettings, defaultSiteSettingsKeys };

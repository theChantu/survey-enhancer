import { sites, type SupportedHosts } from "@/adapters/siteConfigs";
import { capitalize } from "@/lib/utils";

import type {
    OpportunityInfo,
    OpportunityKind,
    StudyInfo,
} from "@/adapters/BaseAdapter";
import type { SiteSettings } from "@/store/types";
import type { NotificationData } from "./types";

export type OpportunityCacheEntry =
    SiteSettings["opportunityAlerts"]["cache"]["opportunities"][string];

type OpportunityNotificationContext = {
    siteName: string;
    siteLabel: string;
    previous: OpportunityCacheEntry | undefined;
};

type OpportunityNotificationConfig<T extends OpportunityInfo> = {
    fallbackTitle: (
        opportunity: OpportunityInfo,
        context: OpportunityNotificationContext,
    ) => string;
    messageParts: (
        opportunity: T,
        context: OpportunityNotificationContext,
    ) => string[];
};

type OpportunityNotificationConfigMap = {
    [K in OpportunityKind]: OpportunityNotificationConfig<
        Extract<OpportunityInfo, { kind: K }>
    >;
};

const siteHostByName = Object.fromEntries(
    Object.entries(sites).map(([host, config]) => [config.name, host]),
) as Record<string, SupportedHosts>;

function getSiteIconUrl(siteName: string): string | undefined {
    const host = siteHostByName[siteName];
    if (!host) return undefined;
    const config = sites[host];
    return `https://${host}${config.iconPath}`;
}

function formatReward(study: StudyInfo): string {
    return study.reward !== null
        ? `${study.symbol ?? ""}${study.reward.toFixed(2)}`
        : "Unknown reward";
}

function formatRate(study: StudyInfo): string {
    return study.rate !== null
        ? `${study.symbol ?? ""}${study.rate.toFixed(2)}/hr`
        : "Unknown rate";
}

function formatAvailableStudyCount(
    opportunity: Extract<OpportunityInfo, { kind: "project" }>,
    previous: OpportunityCacheEntry | undefined,
): string {
    const count = opportunity.availableStudyCount;
    const previousCount = previous?.availableStudyCount ?? null;

    if (previousCount !== null && count !== null) {
        return `${previousCount} -> ${count} studies available`;
    }

    if (count === null) return "Unknown studies available";

    return `${count} ${count === 1 ? "study" : "studies"} available`;
}

const opportunityNotificationConfig = {
    study: {
        fallbackTitle: (_study, context) => context.siteLabel,
        messageParts: (study, _context) => [
            formatReward(study),
            formatRate(study),
        ],
    },
    project: {
        fallbackTitle: (_project, context) => `${context.siteLabel} project`,
        messageParts: (project, context) => [
            formatAvailableStudyCount(project, context.previous),
        ],
    },
} as const satisfies OpportunityNotificationConfigMap;

function getNotificationMessageParts(
    opportunity: OpportunityInfo,
    context: OpportunityNotificationContext,
): string[] {
    switch (opportunity.kind) {
        case "study":
            return opportunityNotificationConfig.study.messageParts(
                opportunity,
                context,
            );
        case "project":
            return opportunityNotificationConfig.project.messageParts(
                opportunity,
                context,
            );
    }
}

export function buildNotification(
    opportunity: OpportunityInfo,
    siteName: string,
    previous: OpportunityCacheEntry | undefined,
): NotificationData {
    const siteLabel = capitalize(siteName);
    const context = { siteName, siteLabel, previous };
    const config = opportunityNotificationConfig[opportunity.kind];
    const title =
        opportunity.title ?? config.fallbackTitle(opportunity, context);
    const message = [
        siteLabel,
        ...getNotificationMessageParts(opportunity, context),
    ].join(" • ");

    return {
        title,
        message,
        iconUrl: getSiteIconUrl(siteName),
        link: opportunity.link ?? undefined,
    };
}

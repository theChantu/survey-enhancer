import { SettingsStore } from "@/store/SettingsStore";
import { NOTIFY_TTL_MS, NAME_CACHE_TTL_MS } from "@/constants";
import {
    matchesAlertRules,
    type AlertRules,
} from "@/lib/notifications/alertRules";
import {
    getOpportunityFingerprint,
    getOpportunityKey,
    isOpportunityAlertable,
} from "@/lib/opportunities/opportunities";
import {
    buildNotification,
    type OpportunityCacheEntry,
} from "./notifications/buildOpportunityNotification";
import { deliverNotifications } from "./notifications/delivery";
export {
    deliverNotifications,
    handleNotificationClicked,
    handleNotificationClosed,
} from "./notifications/delivery";

import type { OpportunityInfo, StudyInfo } from "@/adapters/BaseAdapter";
import type { MessageMap } from "@/messages/types";
import type { SiteSettings } from "@/store/types";
import type { NotificationData } from "./notifications/types";
export type { NotificationData } from "./notifications/types";

function pruneOpportunityCache(
    cache: SiteSettings["opportunityAlerts"]["cache"],
) {
    const now = Date.now();

    const opportunities = { ...cache.opportunities };
    for (const [key, entry] of Object.entries(opportunities)) {
        if (now - entry.notifiedAt >= NOTIFY_TTL_MS) delete opportunities[key];
    }

    const researchers = { ...cache.researchers };
    for (const [name, timestamp] of Object.entries(researchers)) {
        if (now - timestamp >= NAME_CACHE_TTL_MS) delete researchers[name];
    }

    const titles = { ...cache.titles };
    for (const [title, timestamp] of Object.entries(titles)) {
        if (now - timestamp >= NAME_CACHE_TTL_MS) delete titles[title];
    }

    return { opportunities, researchers, titles };
}

function getCachedOpportunity(
    opportunity: OpportunityInfo,
    cache: SiteSettings["opportunityAlerts"]["cache"],
): OpportunityInfo | undefined {
    const cached = cache.opportunities[getOpportunityKey(opportunity)];
    if (!cached) return undefined;

    return opportunity.kind === "project"
        ? {
              ...opportunity,
              availableStudyCount: cached.availableStudyCount,
          }
        : opportunity;
}

function buildOpportunityCacheEntry(
    opportunity: OpportunityInfo,
    timestamp: number,
): OpportunityCacheEntry {
    return {
        notifiedAt: timestamp,
        fingerprint: getOpportunityFingerprint(opportunity),
        availableStudyCount:
            opportunity.kind === "project"
                ? opportunity.availableStudyCount
                : null,
    };
}

function shouldUpdateProjectBaseline(
    opportunity: OpportunityInfo,
    previousEntry: OpportunityCacheEntry | undefined,
): boolean {
    return (
        opportunity.kind === "project" &&
        previousEntry !== undefined &&
        previousEntry.availableStudyCount !== opportunity.availableStudyCount
    );
}

export async function handleOpportunitiesDetected(
    store: SettingsStore,
    payload: MessageMap["opportunities-detected"],
): Promise<void> {
    const { siteName, opportunities, hidden } = payload;
    if (opportunities.length === 0) return;

    const siteStore = store.sites.entry(siteName);
    const now = Date.now();

    const previousCacheEntries = new Map<string, OpportunityCacheEntry>();
    let alertableOpportunities: OpportunityInfo[] = [];
    let suppressVisibleAlerts = false;
    let rules!: AlertRules;

    await siteStore.update((current) => {
        suppressVisibleAlerts =
            !hidden && current.opportunityAlerts.suppressWhenVisible;
        rules = current.opportunityAlerts.rules;
        const nextOpportunityCache = pruneOpportunityCache(
            current.opportunityAlerts.cache,
        );

        const cacheableOpportunities: OpportunityInfo[] = [];
        alertableOpportunities = [];

        for (const opportunity of opportunities) {
            const key = getOpportunityKey(opportunity);
            const previousEntry = nextOpportunityCache.opportunities[key];
            if (previousEntry) previousCacheEntries.set(key, previousEntry);

            const alertable = isOpportunityAlertable(
                opportunity,
                getCachedOpportunity(opportunity, nextOpportunityCache),
            );

            if (alertable) {
                alertableOpportunities.push(opportunity);
            }

            if (
                alertable ||
                shouldUpdateProjectBaseline(opportunity, previousEntry)
            ) {
                cacheableOpportunities.push(opportunity);
            }
        }

        if (cacheableOpportunities.length === 0) return {};

        for (const opportunity of cacheableOpportunities) {
            nextOpportunityCache.opportunities[getOpportunityKey(opportunity)] =
                buildOpportunityCacheEntry(opportunity, now);
        }

        for (const study of alertableOpportunities.filter(
            (opportunity): opportunity is StudyInfo =>
                opportunity.kind === "study",
        )) {
            if (!study.researcher) continue;
            const name = study.researcher.trim();
            if (!(name in nextOpportunityCache.researchers))
                nextOpportunityCache.researchers[name] = now;
        }

        for (const opportunity of alertableOpportunities) {
            if (!opportunity.title) continue;
            const title = opportunity.title.trim();
            if (title && !(title in nextOpportunityCache.titles))
                nextOpportunityCache.titles[title] = now;
        }

        return {
            opportunityAlerts: {
                cache: nextOpportunityCache,
            },
        };
    });

    if (alertableOpportunities.length === 0) return;
    if (suppressVisibleAlerts) return;

    const notifications: NotificationData[] = [];
    for (const opportunity of alertableOpportunities) {
        if (!matchesAlertRules(opportunity, rules)) continue;

        notifications.push(
            buildNotification(
                opportunity,
                siteName,
                previousCacheEntries.get(getOpportunityKey(opportunity)),
            ),
        );
    }

    if (notifications.length === 0) return;

    await deliverNotifications(store, {
        siteName,
        notifications,
    });
}

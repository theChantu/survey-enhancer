import { capitalize, cleanResearcherName } from "../lib/utils";
import { NOTIFY_TTL_MS, NAME_CACHE_TTL_MS } from "../constants";
import BaseEnhancement from "./BaseEnhancement";
import getSiteResources from "../lib/getSiteResources";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

import type { StudyInfo } from "../adapters/BaseAdapter";

export interface NotificationData {
    title: string;
    message: string;
    iconUrl?: string;
    link?: string;
}

export class NotificationsEnhancement extends BaseEnhancement {
    async apply() {
        const studies = this.adapter.extractStudies();
        if (studies.length === 0) return;

        const { studyAlerts } = this.settings;
        const {
            cache: {
                researchers: previousCachedResearchers,
                studies: previousStudies,
            },
            included,
            excluded,
        } = studyAlerts;

        const newStudies = this.extractNewStudies(previousStudies, studies);
        if (newStudies.length === 0) return;

        const now = Date.now();
        const assets = await getSiteResources();

        const newResearchers = this.extractNewResearchers(
            previousCachedResearchers,
            newStudies,
        );

        await sendExtensionMessage({
            type: "store-patch",
            data: {
                namespace: "sites",
                entry: this.adapter.config.name,
                data: {
                    studyAlerts: {
                        cache: {
                            studies: this.buildStudyCache(
                                previousStudies,
                                newStudies,
                                now,
                            ),
                            researchers: this.buildResearcherCache(
                                previousCachedResearchers,
                                newResearchers,
                                now,
                            ),
                        },
                    },
                },
            },
        });

        const includedSet = new Set(included);
        const excludedSet = new Set(excluded);

        const notifications: NotificationData[] = [];
        for (const study of newStudies) {
            const { researcher } = study;
            if (!researcher) continue;
            const cleanedResearcherName = cleanResearcherName(researcher);

            if (excludedSet.has(cleanedResearcherName) || !document.hidden)
                continue;

            if (includedSet.size > 0 && !includedSet.has(cleanedResearcherName))
                continue;

            notifications.push(this.buildNotification(study, assets));
        }

        if (notifications.length === 0) return;

        await sendExtensionMessage({
            type: "study-alert",
            data: {
                siteName: this.adapter.config.name,
                notifications,
            },
        });
    }

    private buildResearcherCache(
        previous: Record<string, ReturnType<typeof Date.now>>,
        names: Set<string>,
        now: ReturnType<typeof Date.now>,
    ) {
        const cachedResearchers = structuredClone(previous);

        for (const [name, timestamp] of Object.entries(cachedResearchers)) {
            if (now - timestamp >= NAME_CACHE_TTL_MS) {
                delete cachedResearchers[name];
            }
        }

        for (const name of names) {
            cachedResearchers[name] = now;
        }

        return cachedResearchers;
    }

    private extractNewResearchers(
        previous: Record<string, ReturnType<typeof Date.now>>,
        studies: StudyInfo[],
    ) {
        const researchers = new Set<string>();
        for (const study of studies) {
            if (!study.researcher) continue;

            const researcher = cleanResearcherName(study.researcher);
            if (researcher in previous) continue;
            researchers.add(researcher);
        }
        return researchers;
    }

    private buildStudyCache(
        previous: Record<string, ReturnType<typeof Date.now>>,
        studies: StudyInfo[],
        now: ReturnType<typeof Date.now>,
    ) {
        const previousClone = structuredClone(previous);

        // Study fingerprint cleanup
        for (const [key, timestamp] of Object.entries(previousClone)) {
            if (now - timestamp >= NOTIFY_TTL_MS) {
                delete previousClone[key];
            }
        }

        for (const study of studies) {
            previousClone[study.id] = now;
        }

        return previousClone;
    }

    private extractNewStudies(
        previous: Record<string, ReturnType<typeof Date.now>>,
        current: StudyInfo[],
    ) {
        return Array.from(current).filter((study) => !(study.id in previous));
    }

    private buildNotification(
        study: StudyInfo,
        assets: Awaited<ReturnType<typeof getSiteResources>>,
    ) {
        const { title, reward, rate, symbol, link } = study;

        const rewardText =
            reward !== null
                ? `${symbol ?? ""}${reward.toFixed(2)}`
                : "Unknown reward";
        const rateText =
            rate !== null
                ? `${symbol ?? ""}${rate.toFixed(2)}/hr`
                : "Unknown rate";

        const siteLabel = capitalize(this.adapter.config.name);

        const notificationData = {
            title: title ?? siteLabel,
            message: `${siteLabel} • ${rewardText} • ${rateText}`,
            iconUrl: assets[this.adapter.iconUrl],
            link: link ?? undefined,
        };
        return notificationData;
    }

    async revert() {
        // No cleanup necessary for notifications
    }
}

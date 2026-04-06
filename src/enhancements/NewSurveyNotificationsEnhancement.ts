import { capitalize, cleanResearcherName } from "../lib/utils";
import { NOTIFY_TTL_MS, NAME_CACHE_TTL_MS } from "../constants";
import BaseEnhancement from "./BaseEnhancement";
import getSiteResources from "../lib/getSiteResources";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

import type { SurveyInfo } from "../adapters/BaseAdapter";

export interface NotificationData {
    title: string;
    message: string;
    iconUrl?: string;
    link?: string;
}

class NewSurveyNotificationsEnhancement extends BaseEnhancement {
    async apply() {
        const surveys = this.adapter.extractSurveys();
        if (surveys.length === 0) return;

        const { newSurveyNotifications } = this.settings;
        const {
            surveys: previousSurveys,
            cachedResearchers: previousCachedResearchers,
            includedResearchers,
            excludedResearchers,
        } = newSurveyNotifications;

        const newSurveys = this.extractNewSurveys(previousSurveys, surveys);
        if (newSurveys.length === 0) return;

        const assets = await getSiteResources();

        await this.saveNewSurveys(previousSurveys, newSurveys);

        const newResearchers = this.extractNewSurveyResearchers(
            previousCachedResearchers,
            newSurveys,
        );
        if (newResearchers.size > 0)
            await this.saveResearcherNames(
                previousCachedResearchers,
                newResearchers,
            );

        const includedResearchersSet = new Set(includedResearchers);
        const excludedResearchersSet = new Set(excludedResearchers);

        const notifications: NotificationData[] = [];
        for (const survey of newSurveys) {
            const { researcher } = survey;
            if (!researcher) continue;
            const cleanedResearcherName = cleanResearcherName(researcher);

            if (
                excludedResearchersSet.has(cleanedResearcherName) ||
                !document.hidden
            )
                continue;

            if (
                includedResearchersSet.size > 0 &&
                !includedResearchersSet.has(cleanedResearcherName)
            )
                continue;

            notifications.push(this.buildNotification(survey, assets));
        }
        await sendExtensionMessage({
            type: "notification",
            data: {
                siteName: this.adapter.config.name,
                notifications: notifications,
            },
        });
    }

    private async saveResearcherNames(
        previous: Record<string, ReturnType<typeof Date.now>>,
        names: Set<string>,
    ) {
        const now = Date.now();

        const cachedResearchers = structuredClone(previous);

        for (const [name, timestamp] of Object.entries(cachedResearchers)) {
            if (now - timestamp >= NAME_CACHE_TTL_MS) {
                delete cachedResearchers[name];
            }
        }

        for (const name of names) {
            cachedResearchers[name] = now;
        }

        await sendExtensionMessage({
            type: "store-patch",
            data: {
                namespace: "sites",
                entry: this.adapter.config.name,
                data: {
                    newSurveyNotifications: {
                        cachedResearchers,
                    },
                },
            },
        });
    }

    private extractNewSurveyResearchers(
        previous: Record<string, ReturnType<typeof Date.now>>,
        surveys: SurveyInfo[],
    ) {
        const researchers = new Set<string>();
        for (const survey of surveys) {
            if (!survey.researcher) continue;

            const researcher = cleanResearcherName(survey.researcher);
            if (researcher in previous) continue;
            researchers.add(researcher);
        }
        return researchers;
    }

    private async saveNewSurveys(
        previous: Record<string, ReturnType<typeof Date.now>>,
        surveys: SurveyInfo[],
    ) {
        const now = Date.now();

        const previousClone = structuredClone(previous);

        // Survey fingerprint cleanup
        for (const [key, timestamp] of Object.entries(previousClone)) {
            if (now - timestamp >= NOTIFY_TTL_MS) {
                delete previousClone[key];
            }
        }

        for (const survey of surveys) {
            previousClone[survey.id] = now;
        }

        await sendExtensionMessage({
            type: "store-patch",
            data: {
                namespace: "sites",
                entry: this.adapter.config.name,
                data: {
                    newSurveyNotifications: {
                        surveys: previousClone,
                    },
                },
            },
        });
    }

    private extractNewSurveys(
        previous: Record<string, ReturnType<typeof Date.now>>,
        current: SurveyInfo[],
    ) {
        return Array.from(current).filter((survey) => !(survey.id in previous));
    }

    private extractNumber(rate: string) {
        return rate?.match(/\d+(\.\d+)?/)?.[0];
    }

    private buildNotification(
        survey: SurveyInfo,
        assets: Awaited<ReturnType<typeof getSiteResources>>,
    ) {
        const { title, reward, rate, displaySymbol, link } = survey;

        const rewardText =
            (reward && this.extractNumber(reward)) || "Unknown reward";
        const hourlyRateText =
            (rate && this.extractNumber(rate)) || "Unknown rate";

        const siteLabel = capitalize(this.adapter.config.name);

        const notificationData = {
            title: title ?? siteLabel,
            message: `${siteLabel} • ${displaySymbol}${rewardText} • ${displaySymbol}${hourlyRateText}/hr`,
            iconUrl: assets[this.adapter.iconUrl],
            link: link ?? undefined,
        };
        return notificationData;
    }

    async revert() {
        // No cleanup necessary for notifications
    }
}

export { NewSurveyNotificationsEnhancement };

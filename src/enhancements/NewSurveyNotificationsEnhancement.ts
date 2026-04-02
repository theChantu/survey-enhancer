import store from "../store/store";
import { capitalize, cleanResearcherName } from "../lib/utils";
import { NOTIFY_TTL_MS, NAME_CACHE_TTL_MS } from "../constants";
import BaseEnhancement from "./BaseEnhancement";
import getSiteResources from "../lib/getSiteResources";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

export interface NotificationData {
    title: string;
    message: string;
    iconUrl?: string;
    surveyLink: string;
}

class NewSurveyNotificationsEnhancement extends BaseEnhancement {
    async apply() {
        const surveys = this.adapter.getSurveyElements();
        if (surveys.length === 0) return;

        const {
            surveys: previousSurveys,
            cachedResearchers: previousCachedResearchers,
        } = await store.get(this.adapter.config.name, [
            "surveys",
            "cachedResearchers",
        ]);

        const newSurveys = this.extractNewSurveys(previousSurveys, surveys);
        if (newSurveys.length === 0) return;

        const assets = await getSiteResources();

        await this.saveNewSurveys(
            previousSurveys,
            this.extractSurveyFingerprints(newSurveys),
        );

        const newResearchers = this.extractNewSurveyResearchers(
            previousCachedResearchers,
            newSurveys,
        );
        if (newResearchers.size > 0)
            await this.saveResearcherNames(
                previousCachedResearchers,
                newResearchers,
            );

        const { includedResearchers, excludedResearchers } = await store.get(
            this.adapter.config.name,
            ["includedResearchers", "excludedResearchers"],
        );
        const includedResearchersSet = new Set(includedResearchers);
        const excludedResearchersSet = new Set(excludedResearchers);

        const notifications: NotificationData[] = [];
        for (const survey of newSurveys) {
            const surveyId = this.adapter.getSurveyId(survey);
            const rawName = this.adapter.getSurveyResearcher(survey);
            if (!surveyId || !rawName) continue;
            const researcher = cleanResearcherName(rawName);

            if (excludedResearchersSet.has(researcher) || !document.hidden)
                continue;

            if (
                includedResearchersSet.size > 0 &&
                !includedResearchersSet.has(researcher)
            )
                continue;

            notifications.push(
                this.buildNotification(survey, surveyId, assets),
            );
        }
        await sendExtensionMessage({
            type: "survey-notification",
            data: notifications,
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

        await store.set(this.adapter.config.name, {
            cachedResearchers,
        });
    }

    private extractNewSurveyResearchers(
        previous: Record<string, ReturnType<typeof Date.now>>,
        surveys: HTMLElement[],
    ) {
        const researchers = new Set<string>();
        for (const survey of surveys) {
            const rawName = this.adapter.getSurveyResearcher(survey);
            if (!rawName) continue;

            const researcher = cleanResearcherName(rawName);
            if (researcher in previous) continue;
            researchers.add(researcher);
        }
        return researchers;
    }

    private async saveNewSurveys(
        previous: Record<string, ReturnType<typeof Date.now>>,
        fingerprints: string[],
    ) {
        const now = Date.now();

        const previousClone = structuredClone(previous);

        // Survey fingerprint cleanup
        for (const [key, timestamp] of Object.entries(previousClone)) {
            if (now - timestamp >= NOTIFY_TTL_MS) {
                delete previousClone[key];
            }
        }

        for (const fingerprint of fingerprints) {
            previousClone[fingerprint] = now;
        }

        await store.set(this.adapter.config.name, {
            surveys: previousClone,
        });
    }

    private extractNewSurveys(
        previous: Record<string, ReturnType<typeof Date.now>>,
        current: NodeListOf<HTMLElement>,
    ) {
        return Array.from(current).filter((survey) => {
            const id = this.adapter.getSurveyId(survey);
            return id !== null && !(id in previous);
        });
    }

    private extractSurveyFingerprints(surveys: HTMLElement[]) {
        return Array.from(surveys)
            .map((survey) => this.adapter.getSurveyId(survey))
            .filter((id): id is string => id !== null);
    }

    private extractSurveyRate(survey: HTMLElement) {
        return survey.textContent?.match(/\d+(\.\d+)?/)?.[0];
    }

    private buildNotification(
        survey: HTMLElement,
        surveyId: string,
        assets: Awaited<ReturnType<typeof getSiteResources>>,
    ) {
        const surveyTitle = this.adapter.getSurveyTitle(survey);
        const rewardElement = this.adapter.getRewardElement(survey);
        const hourlyRateElement = this.adapter.getHourlyRateElement(survey);
        const displaySymbol = rewardElement
            ? this.adapter.getCurrencyInfo(rewardElement).displaySymbol
            : "";

        const rewardText =
            (rewardElement && this.extractSurveyRate(rewardElement)) ||
            "Unknown reward";
        const hourlyRateText =
            (hourlyRateElement && this.extractSurveyRate(hourlyRateElement)) ||
            "Unknown rate";

        const { surveyPath, suffix } = this.adapter.config;
        const surveyLink = this.adapter.buildUrl([
            surveyPath,
            surveyId,
            ...(suffix ? [suffix] : []),
        ]);

        const siteLabel = capitalize(this.adapter.config.name);

        const notificationData = {
            title: surveyTitle ?? siteLabel,
            message: `${siteLabel} • ${displaySymbol}${rewardText} • ${displaySymbol}${hourlyRateText}/hr`,
            iconUrl: assets[this.adapter.iconUrl],
            surveyLink,
        };
        return notificationData;
    }

    async revert() {
        // No cleanup necessary for notifications
    }
}

const newSurveyNotificationsEnhancement =
    new NewSurveyNotificationsEnhancement();

export { newSurveyNotificationsEnhancement };

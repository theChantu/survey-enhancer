import store from "../store/store";
import { getSharedResources, capitalize } from "../utils";
import { NOTIFY_TTL_MS } from "../constants";
import Enhancement from "./enhancement";

async function saveSurveyFingerprints(fingerprints: string[]) {
    const now = Date.now();

    const { surveys: immutableSurveys } = await store.get(["surveys"]);
    const prevSurveys = structuredClone(immutableSurveys);

    let changed = false;
    // TTL removals
    for (const [key, timestamp] of Object.entries(prevSurveys)) {
        if (now - timestamp >= NOTIFY_TTL_MS) {
            delete prevSurveys[key];
            changed = true;
        }
    }

    const newSurveys = [];
    for (const fingerprint of fingerprints) {
        if (!(fingerprint in prevSurveys)) {
            newSurveys.push(fingerprint);
        }
        prevSurveys[fingerprint] = now;
        changed = true;
    }

    if (changed) await store.set({ surveys: prevSurveys });

    return newSurveys;
}

class NewSurveyNotificationsEnhancement extends Enhancement {
    async apply() {
        const surveys = this.siteAdapter.getSurveyElements();
        if (surveys.length === 0) return;
        const assets = await getSharedResources();

        const surveyFingerprints = Array.from(surveys)
            .map((survey) => this.siteAdapter.getSurveyId(survey))
            .filter((id): id is string => id !== undefined);
        const newSurveys = await saveSurveyFingerprints(surveyFingerprints);

        for (const survey of surveys) {
            const surveyId = this.siteAdapter.getSurveyId(survey);
            if (!surveyId) continue;
            const isNewFingerprint = newSurveys.includes(surveyId);
            if (!isNewFingerprint || !document.hidden) continue;

            const surveyTitle =
                this.siteAdapter.getStudyTitle(survey)?.textContent;
            const rewardElement = this.siteAdapter.getRewardElement(survey);
            const rewardText =
                rewardElement?.textContent.match(/\d+(\.\d+)?/)?.[0] ||
                "Unknown reward";

            if (!surveyId) continue;
            const surveyLink = `https://app.prolific.com/studies/${surveyId}`;
            const siteLabel = capitalize(this.siteName);

            GM.notification({
                title: surveyTitle || siteLabel,
                text: `${siteLabel} • ${rewardText}`,
                image: assets[this.siteName],
                // TODO: Update survey links
                // onclick: () =>
                //     GM.openInTab(surveyLink, {
                //         active: true,
                //     }),
            });
        }
    }

    revert() {
        // No cleanup necessary for notifications
    }
}

const newSurveyNotificationsEnhancement =
    new NewSurveyNotificationsEnhancement();

export { newSurveyNotificationsEnhancement };

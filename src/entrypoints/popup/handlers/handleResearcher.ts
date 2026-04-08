import { patch } from "../popupMutations";

import type { ActiveSiteState } from "../types";
import type { NewSurveyNotificationsSettings } from "@/store/types";

type ResearcherKey = Exclude<
    keyof NewSurveyNotificationsSettings,
    "surveys" | "cachedResearchers"
>;

export function handleAddResearcher(
    activeSite: ActiveSiteState,
    key: ResearcherKey,
    name: string,
) {
    if (
        !activeSite.settings ||
        activeSite.settings.newSurveyNotifications?.[key].includes(name)
    )
        return;
    void patch({
        namespace: "sites",
        entry: activeSite.name,
        data: {
            newSurveyNotifications: {
                [key]: [
                    ...activeSite.settings.newSurveyNotifications[key],
                    name,
                ],
            },
        },
    });
}

export function handleRemoveResearcher(
    activeSite: ActiveSiteState,
    key: ResearcherKey,
    name: string,
) {
    if (!activeSite.settings) return;
    void patch({
        namespace: "sites",
        entry: activeSite.name,
        data: {
            newSurveyNotifications: {
                [key]: activeSite.settings.newSurveyNotifications[key].filter(
                    (n) => n !== name,
                ),
            },
        },
    });
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "#imports";
import { SettingsStore } from "@/store/SettingsStore";
import { getOpportunityKey } from "@/lib/opportunities";
import { handleOpportunitiesDetected } from "./handleNotifications";
import { deliverNotifications } from "./notifications/delivery";

import type { StudyInfo } from "@/adapters/BaseAdapter";

vi.mock("./notifications/delivery", () => ({
    deliverNotifications: vi.fn(async () => true),
    handleNotificationClicked: vi.fn(),
    handleNotificationClosed: vi.fn(),
}));

const mockStorage = storage as typeof storage & { _clear(): void };
const deliverNotificationsMock = vi.mocked(deliverNotifications);

const siteName = "prolific" as const;

const study: StudyInfo = {
    id: "study-1",
    kind: "study",
    title: "Visible first study",
    link: "https://app.prolific.com/studies/study-1",
    researcher: "Researcher",
    reward: 1,
    rate: 12,
    symbol: "$",
    devices: [],
    peripherals: [],
    averageCompletionMinutes: 5,
    slots: 10,
};

beforeEach(() => {
    mockStorage._clear();
    deliverNotificationsMock.mockReset();
    deliverNotificationsMock.mockResolvedValue(true);
});

describe("handleOpportunitiesDetected", () => {
    it("delivers alerts while the page is visible by default", async () => {
        const store = new SettingsStore();
        const key = getOpportunityKey(study);

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [study],
            hidden: false,
        });

        expect(deliverNotificationsMock).toHaveBeenCalledTimes(1);
        expect(deliverNotificationsMock).toHaveBeenCalledWith(store, {
            siteName,
            notifications: [
                expect.objectContaining({
                    title: study.title,
                    link: study.link,
                }),
            ],
        });

        const state = await store.sites
            .entry(siteName)
            .get(["opportunityAlerts"]);
        expect(state.opportunityAlerts.cache.opportunities).toHaveProperty(key);
    });

    it("marks visible alerts handled when visible-page suppression is enabled", async () => {
        const store = new SettingsStore();
        const key = getOpportunityKey(study);

        await store.sites.entry(siteName).patch({
            opportunityAlerts: {
                suppressWhenVisible: true,
            },
        });

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [study],
            hidden: false,
        });

        expect(deliverNotificationsMock).not.toHaveBeenCalled();

        const visibleState = await store.sites
            .entry(siteName)
            .get(["opportunityAlerts"]);
        expect(visibleState.opportunityAlerts.cache.opportunities).toHaveProperty(
            key,
        );

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [study],
            hidden: true,
        });

        expect(deliverNotificationsMock).not.toHaveBeenCalled();
    });
});

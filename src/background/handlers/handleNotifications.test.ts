import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "#imports";
import { SettingsStore } from "@/store/SettingsStore";
import { getOpportunityKey } from "@/lib/opportunities/opportunities";
import { createProject, createStudy } from "@/tests/utils/opportunities";
import { handleOpportunitiesDetected } from "./handleNotifications";
import { deliverNotifications } from "./notifications/delivery";

import type { ProjectInfo } from "@/adapters/BaseAdapter";

vi.mock("./notifications/delivery", () => ({
    deliverNotifications: vi.fn(async () => true),
    handleNotificationClicked: vi.fn(),
    handleNotificationClosed: vi.fn(),
}));

const mockStorage = storage as typeof storage & { _clear(): void };
const deliverNotificationsMock = vi.mocked(deliverNotifications);

const siteName = "prolific" as const;

const study = createStudy("study-1", {
    title: "Visible first study",
    researcher: "Researcher",
    averageCompletionMinutes: 5,
});

const project = createProject("project-1", {
    title: "Project one",
    link: null,
});

function withProjectCount(availableStudyCount: number): ProjectInfo {
    return { ...project, availableStudyCount };
}

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
        expect(
            visibleState.opportunityAlerts.cache.opportunities,
        ).toHaveProperty(key);

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [study],
            hidden: true,
        });

        expect(deliverNotificationsMock).not.toHaveBeenCalled();
    });

    it("updates project baselines when availability drops to zero", async () => {
        const store = new SettingsStore();
        const key = getOpportunityKey(project);

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [withProjectCount(1)],
            hidden: true,
        });

        expect(deliverNotificationsMock).toHaveBeenCalledTimes(1);

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [withProjectCount(0)],
            hidden: true,
        });

        expect(deliverNotificationsMock).toHaveBeenCalledTimes(1);

        const zeroState = await store.sites
            .entry(siteName)
            .get(["opportunityAlerts"]);
        expect(
            zeroState.opportunityAlerts.cache.opportunities[key]
                ?.availableStudyCount,
        ).toBe(0);

        await handleOpportunitiesDetected(store, {
            siteName,
            opportunities: [withProjectCount(1)],
            hidden: true,
        });

        expect(deliverNotificationsMock).toHaveBeenCalledTimes(2);
        expect(deliverNotificationsMock).toHaveBeenLastCalledWith(store, {
            siteName,
            notifications: [
                expect.objectContaining({
                    title: project.title,
                    message: expect.stringContaining(
                        "0 -> 1 studies available",
                    ),
                }),
            ],
        });
    });
});

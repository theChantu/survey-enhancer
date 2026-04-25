import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "#imports";
import { defaultGlobalSettings } from "./defaultGlobalSettings";
import { defaultSiteSettings } from "./defaultSiteSettings";
import { SettingsStore } from "./SettingsStore";

const mockStorage = storage as typeof storage & { _clear(): void };
const siteName = "prolific" as const;

beforeEach(() => {
    mockStorage._clear();
});

describe("globals", () => {
    it("returns defaults when nothing is stored", async () => {
        const store = new SettingsStore();
        const { debug } = await store.globals.get(["debug"]);

        expect(debug.enabled).toBe(defaultGlobalSettings.debug.enabled);
    });

    it("persists and reads global values", async () => {
        const store = new SettingsStore();

        await store.globals.set({ debug: { enabled: true } });
        const { debug } = await store.globals.get(["debug"]);

        expect(debug.enabled).toBe(true);
    });

    it("deep merges global patches", async () => {
        const store = new SettingsStore();

        await store.globals.patch({
            providers: {
                telegram: { enabled: true, botToken: "token-a" } as any,
            },
        });
        await store.globals.patch({
            providers: {
                telegram: { chatId: 12345 } as any,
            },
        });

        const { providers } = await store.globals.get(["providers"]);
        expect(providers.telegram?.enabled).toBe(true);
        expect((providers.telegram as any)?.botToken).toBe("token-a");
        expect((providers.telegram as any)?.chatId).toBe(12345);
    });

    it("deep merges global conversion rate patches", async () => {
        const store = new SettingsStore();

        await store.globals.patch({
            conversionRates: {
                USD: { timestamp: 100, rates: { GBP: 0.8, USD: 1 } },
                GBP: { timestamp: 100, rates: { USD: 1.2, GBP: 1 } },
            },
        });

        await store.globals.patch({
            conversionRates: {
                USD: { timestamp: 200, rates: { GBP: 0.2, USD: 1.4 } },
            },
        });

        const { conversionRates } = await store.globals.get([
            "conversionRates",
        ]);

        expect(conversionRates.USD.timestamp).toBe(200);
        expect(conversionRates.USD.rates.GBP).toBe(0.2);
        expect(conversionRates.GBP.timestamp).toBe(100);
    });

    it("notifies subscribers on global set and patch", async () => {
        const store = new SettingsStore();
        const listener = vi.fn();
        store.globals.subscribe(listener);

        await store.globals.set({ debug: { enabled: true } });
        await store.globals.patch({ idleThreshold: 120 });

        expect(listener).toHaveBeenNthCalledWith(1, {
            debug: { enabled: true },
        });
        expect(listener).toHaveBeenNthCalledWith(2, { idleThreshold: 120 });
    });

    it("updates globals from current state", async () => {
        const store = new SettingsStore();

        await store.globals.update((current) => ({
            idleThreshold: current.idleThreshold + 60,
        }));

        const { idleThreshold } = await store.globals.get(["idleThreshold"]);
        expect(idleThreshold).toBe(defaultGlobalSettings.idleThreshold + 60);
    });
});

describe("site", () => {
    it("returns defaults when nothing is stored", async () => {
        const store = new SettingsStore();
        const { autoReload } = await store.sites
            .entry(siteName)
            .get(["autoReload"]);

        expect(autoReload.enabled).toBe(defaultSiteSettings.autoReload.enabled);
        expect(autoReload.minInterval).toBe(
            defaultSiteSettings.autoReload.minInterval,
        );
    });

    it("persists and reads site values", async () => {
        const store = new SettingsStore();

        await store.sites.entry(siteName).set({
            autoReload: { enabled: true, minInterval: 3, maxInterval: 5 },
        });

        const { autoReload } = await store.sites
            .entry(siteName)
            .get(["autoReload"]);
        expect(autoReload.enabled).toBe(true);
        expect(autoReload.minInterval).toBe(3);
    });

    it("replaces only the targeted top-level site keys on set", async () => {
        const store = new SettingsStore();

        await store.sites.entry(siteName).patch({
            autoReload: { enabled: true },
            opportunityAlerts: {
                cache: {
                    opportunities: {
                        "study:studyA": {
                            notifiedAt: 100,
                            fingerprint: "present",
                            availableStudyCount: null,
                        },
                    },
                },
            },
        });

        await store.sites.entry(siteName).set({
            opportunityAlerts: defaultSiteSettings.opportunityAlerts,
        });

        const { autoReload, opportunityAlerts } = await store.sites
            .entry(siteName)
            .get(["autoReload", "opportunityAlerts"]);

        expect(autoReload.enabled).toBe(true);
        expect(opportunityAlerts).toEqual(defaultSiteSettings.opportunityAlerts);
    });

    it("isolates sites from each other", async () => {
        const store = new SettingsStore();

        await store.sites.entry(siteName).set({
            autoReload: { enabled: true, minInterval: 3, maxInterval: 5 },
        });

        const { autoReload } = await store.sites
            .entry("cloudresearch")
            .get(["autoReload"]);
        expect(autoReload.enabled).toBe(false);
    });

    it("persists site entries under separate keys in settings:sites", async () => {
        const store = new SettingsStore();

        await store.sites.entry("prolific").patch({
            autoReload: { enabled: true },
        });
        await store.sites.entry("cloudresearch").patch({
            autoReload: { enabled: false },
        });

        const stored = await mockStorage.getItem<any>("local:settings:sites");

        expect(stored.prolific).toEqual({
            autoReload: { enabled: true },
        });
        expect(stored.cloudresearch).toEqual({
            autoReload: { enabled: false },
        });
    });

    it("does not leak same-key site values between entries", async () => {
        const store = new SettingsStore();

        await store.sites.entry("prolific").patch({
            autoReload: { enabled: true },
        });

        const stored = await mockStorage.getItem<any>("local:settings:sites");

        expect(stored.prolific.autoReload.enabled).toBe(true);
        expect(stored.cloudresearch?.autoReload).toBeUndefined();

        const { autoReload } = await store.sites
            .entry("cloudresearch")
            .get(["autoReload"]);
        expect(autoReload.enabled).toBe(false);
    });

    it("deep merges site patches", async () => {
        const store = new SettingsStore();

        await store.sites.entry(siteName).patch({
            opportunityAlerts: {
                cache: {
                    opportunities: {
                        "study:studyA": {
                            notifiedAt: 100,
                            fingerprint: "present",
                            availableStudyCount: null,
                        },
                    },
                    researchers: {
                        researcherA: 100,
                    },
                },
            },
        });

        await store.sites.entry(siteName).patch({
            opportunityAlerts: {
                cache: {
                    opportunities: {
                        "study:studyB": {
                            notifiedAt: 200,
                            fingerprint: "present",
                            availableStudyCount: null,
                        },
                    },
                    researchers: {
                        researcherB: 200,
                    },
                },
            },
        });

        const { opportunityAlerts } = await store.sites
            .entry(siteName)
            .get(["opportunityAlerts"]);

        expect(
            opportunityAlerts.cache.opportunities["study:studyA"].notifiedAt,
        ).toBe(100);
        expect(
            opportunityAlerts.cache.opportunities["study:studyB"].notifiedAt,
        ).toBe(200);
        expect(opportunityAlerts.cache.researchers.researcherA).toBe(100);
        expect(opportunityAlerts.cache.researchers.researcherB).toBe(200);
    });

    it("notifies subscribers on site set and patch", async () => {
        const store = new SettingsStore();
        const listener = vi.fn();
        store.sites.entry(siteName).subscribe(listener);

        await store.sites.entry(siteName).set({
            autoReload: { enabled: true, minInterval: 3, maxInterval: 5 },
        });
        await store.sites.entry(siteName).patch({
            autoReload: { enabled: false },
        });

        expect(listener).toHaveBeenNthCalledWith(1, {
            autoReload: { enabled: true, minInterval: 3, maxInterval: 5 },
        });
        expect(listener).toHaveBeenNthCalledWith(2, {
            autoReload: { enabled: false },
        });
    });

    it("stops notifying after unsubscribe", async () => {
        const store = new SettingsStore();
        const listener = vi.fn();
        const unsubscribe = store.sites.entry(siteName).subscribe(listener);

        unsubscribe();
        await store.sites.entry(siteName).patch({
            autoReload: { enabled: true },
        });

        expect(listener).not.toHaveBeenCalled();
    });

    it("serializes concurrent site updates", async () => {
        const store = new SettingsStore();

        await Promise.all(
            Array.from({ length: 5 }, () =>
                store.sites.entry(siteName).update((current) => ({
                    analytics: {
                        totalStudyCompletions:
                            current.analytics.totalStudyCompletions + 1,
                        dailyStudyCompletions: {
                            count:
                                current.analytics.dailyStudyCompletions.count +
                                1,
                        },
                    },
                })),
            ),
        );

        const { analytics } = await store.sites
            .entry(siteName)
            .get(["analytics"]);

        expect(analytics.totalStudyCompletions).toBe(5);
        expect(analytics.dailyStudyCompletions.count).toBe(5);
    });
});

describe("normalization", () => {
    it("resets stale daily completions on read and persists reset", async () => {
        const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000;
        await mockStorage.setItem("local:settings:sites", {
            [siteName]: {
                analytics: {
                    totalStudyCompletions: 5,
                    dailyStudyCompletions: {
                        timestamp: staleTimestamp,
                        count: 1,
                    },
                },
            },
        });

        const store = new SettingsStore();
        const { analytics } = await store.sites
            .entry(siteName)
            .get(["analytics"]);

        expect(analytics.totalStudyCompletions).toBe(5);
        expect(analytics.dailyStudyCompletions.count).toEqual(0);
        expect(analytics.dailyStudyCompletions.timestamp).not.toBe(
            staleTimestamp,
        );

        const stored = await mockStorage.getItem<any>("local:settings:sites");
        expect(stored[siteName].analytics.dailyStudyCompletions.count).toEqual(
            0,
        );
        expect(stored[siteName].analytics.totalStudyCompletions).toBe(5);
    });
});

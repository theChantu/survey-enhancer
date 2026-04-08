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
        const { enableDebug } = await store.globals.get(["enableDebug"]);

        expect(enableDebug).toBe(defaultGlobalSettings.enableDebug);
    });

    it("persists and reads global values", async () => {
        const store = new SettingsStore();

        await store.globals.set({ enableDebug: true });
        const { enableDebug } = await store.globals.get(["enableDebug"]);

        expect(enableDebug).toBe(true);
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

        await store.globals.set({ enableDebug: true });
        await store.globals.patch({ idleThreshold: 120 });

        expect(listener).toHaveBeenNthCalledWith(1, { enableDebug: true });
        expect(listener).toHaveBeenNthCalledWith(2, { idleThreshold: 120 });
    });
});

describe("site", () => {
    it("returns defaults when nothing is stored", async () => {
        const store = new SettingsStore();
        const { currencyConversion } = await store.sites
            .entry(siteName)
            .get(["currencyConversion"]);

        expect(currencyConversion.enabled).toBe(
            defaultSiteSettings.currencyConversion.enabled,
        );
        expect(currencyConversion.selectedCurrency).toBe(
            defaultSiteSettings.currencyConversion.selectedCurrency,
        );
    });

    it("persists and reads site values", async () => {
        const store = new SettingsStore();

        await store.sites.entry(siteName).set({
            currencyConversion: { selectedCurrency: "GBP" } as any,
        });

        const { currencyConversion } = await store.sites
            .entry(siteName)
            .get(["currencyConversion"]);
        expect(currencyConversion.selectedCurrency).toBe("GBP");
    });

    it("isolates sites from each other", async () => {
        const store = new SettingsStore();

        await store.sites.entry(siteName).set({
            currencyConversion: { selectedCurrency: "GBP" } as any,
        });

        const { currencyConversion } = await store.sites
            .entry("cloudresearch")
            .get(["currencyConversion"]);
        expect(currencyConversion.selectedCurrency).toBe("USD");
    });

    it("persists site entries under separate keys in settings:sites", async () => {
        const store = new SettingsStore();

        await store.sites.entry("prolific").patch({
            autoReload: { enabled: true },
        });
        await store.sites.entry("cloudresearch").patch({
            highlightRates: { enabled: false },
        });

        const stored = await mockStorage.getItem<any>("local:settings:sites");

        expect(stored.prolific).toEqual({
            autoReload: { enabled: true },
        });
        expect(stored.cloudresearch).toEqual({
            highlightRates: { enabled: false },
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
            newSurveyNotifications: {
                surveys: {
                    surveyA: 100,
                },
                cachedResearchers: {
                    researcherA: 100,
                },
            },
        });

        await store.sites.entry(siteName).patch({
            newSurveyNotifications: {
                surveys: {
                    surveyB: 200,
                },
                cachedResearchers: {
                    researcherB: 200,
                },
            },
        });

        const { newSurveyNotifications } = await store.sites
            .entry(siteName)
            .get(["newSurveyNotifications"]);

        expect(newSurveyNotifications.surveys.surveyA).toBe(100);
        expect(newSurveyNotifications.surveys.surveyB).toBe(200);
        expect(newSurveyNotifications.cachedResearchers.researcherA).toBe(100);
        expect(newSurveyNotifications.cachedResearchers.researcherB).toBe(200);
    });

    it("notifies subscribers on site set and patch", async () => {
        const store = new SettingsStore();
        const listener = vi.fn();
        store.sites.entry(siteName).subscribe(listener);

        await store.sites.entry(siteName).set({
            currencyConversion: { selectedCurrency: "GBP" } as any,
        });
        await store.sites.entry(siteName).patch({
            autoReload: { enabled: true },
        });

        expect(listener).toHaveBeenNthCalledWith(1, {
            currencyConversion: { selectedCurrency: "GBP" },
        });
        expect(listener).toHaveBeenNthCalledWith(2, {
            autoReload: { enabled: true },
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
});

describe("normalization", () => {
    it("resets stale daily completions on read and persists reset", async () => {
        const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000;
        await mockStorage.setItem("local:settings:sites", {
            [siteName]: {
                analytics: {
                    totalSurveyCompletions: 5,
                    dailySurveyCompletions: {
                        timestamp: staleTimestamp,
                        urls: ["https://example.com/survey1"],
                    },
                },
            },
        });

        const store = new SettingsStore();
        const { analytics } = await store.sites
            .entry(siteName)
            .get(["analytics"]);

        expect(analytics.totalSurveyCompletions).toBe(5);
        expect(analytics.dailySurveyCompletions.urls).toEqual([]);
        expect(analytics.dailySurveyCompletions.timestamp).not.toBe(
            staleTimestamp,
        );

        const stored = await mockStorage.getItem<any>("local:settings:sites");
        expect(stored[siteName].analytics.dailySurveyCompletions.urls).toEqual(
            [],
        );
        expect(stored[siteName].analytics.totalSurveyCompletions).toBe(5);
    });
});

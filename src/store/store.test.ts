import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore } from "./createStore";
import { storage } from "#imports";
import { defaultSiteSettings } from "./defaultSiteSettings";
import { defaultGlobalSettings } from "./defaultGlobalSettings";

const mockStorage = storage as typeof storage & { _clear(): void };
const siteName = "prolific";

beforeEach(() => {
    mockStorage._clear();
});

describe("get", () => {
    it("returns defaults when nothing is stored", async () => {
        const store = createStore();
        const result = await store.get(siteName, ["currencyConversion"]);

        expect(result.currencyConversion.enabled).toBe(
            defaultSiteSettings.currencyConversion.enabled,
        );
        expect(result.currencyConversion.selectedCurrency).toBe(
            defaultSiteSettings.currencyConversion.selectedCurrency,
        );
    });

    it("returns stored site values merged over defaults", async () => {
        await mockStorage.setItem("local:prolific", {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        const store = createStore();
        const result = await store.get(siteName, ["currencyConversion"]);

        expect(result.currencyConversion.selectedCurrency).toBe("GBP");
    });

    it("deep merges nested objects with defaults", async () => {
        await mockStorage.setItem("local:prolific", {
            currencyConversion: {
                conversionRates: { USD: { timestamp: 999 } },
            },
        });

        const store = createStore();
        const result = await store.get(siteName, ["currencyConversion"]);

        expect(result.currencyConversion.conversionRates.USD.timestamp).toBe(
            999,
        );
        expect(result.currencyConversion.conversionRates.USD.rates).toEqual(
            defaultSiteSettings.currencyConversion.conversionRates.USD.rates,
        );
        expect(result.currencyConversion.conversionRates.GBP).toEqual(
            defaultSiteSettings.currencyConversion.conversionRates.GBP,
        );
    });

    it("routes global keys to global storage", async () => {
        await mockStorage.setItem("local:globals", { enableDebug: true });

        const store = createStore();
        const result = await store.get(siteName, ["enableDebug"]);

        expect(result.enableDebug).toBe(true);
    });

    it("returns global defaults when nothing is stored", async () => {
        const store = createStore();
        const result = await store.get(siteName, ["enableDebug"]);

        expect(result.enableDebug).toBe(defaultGlobalSettings.enableDebug);
    });

    it("reads from both storages when mixing site and global keys", async () => {
        await mockStorage.setItem("local:prolific", {
            currencyConversion: { selectedCurrency: "GBP" },
        });
        await mockStorage.setItem("local:globals", { enableDebug: true });

        const store = createStore();
        const result = await store.get(siteName, [
            "currencyConversion",
            "enableDebug",
        ]);

        expect(result.currencyConversion.selectedCurrency).toBe("GBP");
        expect(result.enableDebug).toBe(true);
    });

    it("isolates sites from each other", async () => {
        await mockStorage.setItem("local:prolific", {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        const store = createStore();
        const result = await store.get("cloudresearch", [
            "currencyConversion",
        ]);

        expect(result.currencyConversion.selectedCurrency).toBe("USD");
    });

    it("gets globals without siteName", async () => {
        await mockStorage.setItem("local:globals", { enableDebug: true });

        const store = createStore();
        const result = await store.get(["enableDebug"]);

        expect(result.enableDebug).toBe(true);
    });

    it("returns global defaults without siteName", async () => {
        const store = createStore();
        const result = await store.get(["enableDebug"]);

        expect(result.enableDebug).toBe(defaultGlobalSettings.enableDebug);
    });
});

describe("set", () => {
    it("persists site values", async () => {
        const store = createStore();
        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        const result = await store.get(siteName, ["currencyConversion"]);
        expect(result.currencyConversion.selectedCurrency).toBe("GBP");
    });

    it("preserves existing keys when setting new ones", async () => {
        const store = createStore();
        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });
        await store.set(siteName, {
            highlightRates: { enabled: false },
        });

        const result = await store.get(siteName, [
            "currencyConversion",
            "highlightRates",
        ]);
        expect(result.currencyConversion.selectedCurrency).toBe("GBP");
        expect(result.highlightRates.enabled).toBe(false);
    });

    it("filters out undefined values", async () => {
        const store = createStore();
        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });
        await store.set(siteName, {
            currencyConversion: undefined as any,
        });

        const result = await store.get(siteName, ["currencyConversion"]);
        expect(result.currencyConversion.selectedCurrency).toBe("GBP");
    });

    it("sets globals without siteName", async () => {
        const store = createStore();
        await store.set({ enableDebug: true });

        const result = await store.get(["enableDebug"]);
        expect(result.enableDebug).toBe(true);
    });

    it("does not affect site storage when setting globals without siteName", async () => {
        const store = createStore();
        await store.set({ enableDebug: true });

        const siteData = await mockStorage.getItem("local:prolific");
        expect(siteData).toBeNull();
    });

    it("routes global keys to global storage even with siteName", async () => {
        const store = createStore();
        await store.set(siteName, {
            enableDebug: true,
            currencyConversion: { selectedCurrency: "GBP" },
        });

        const globalData = await mockStorage.getItem<any>("local:globals");
        const siteData = await mockStorage.getItem<any>("local:prolific");

        expect(globalData.enableDebug).toBe(true);
        expect(globalData.currencyConversion).toBeUndefined();
        expect(siteData.currencyConversion.selectedCurrency).toBe("GBP");
        expect(siteData.enableDebug).toBeUndefined();
    });

    it("returns persisted values for changed keys", async () => {
        const store = createStore();
        const result = await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        expect(result.currencyConversion?.selectedCurrency).toBe("GBP");
    });
});

describe("update", () => {
    it("deep merges nested objects", async () => {
        const store = createStore();
        await store.update(siteName, {
            currencyConversion: {
                conversionRates: {
                    USD: { timestamp: 100, rates: { GBP: 0.8, USD: 1 } },
                    GBP: { timestamp: 100, rates: { USD: 1.2, GBP: 1 } },
                },
            },
        });

        await store.update(siteName, {
            currencyConversion: {
                conversionRates: {
                    USD: { timestamp: 200, rates: { GBP: 0.2, USD: 1.4 } },
                },
            },
        });

        const result = await store.get(siteName, ["currencyConversion"]);
        expect(
            result.currencyConversion.conversionRates.USD.timestamp,
        ).toBe(200);
        expect(
            result.currencyConversion.conversionRates.USD.rates.GBP,
        ).toBe(0.2);
        expect(
            result.currencyConversion.conversionRates.USD.rates.USD,
        ).toBe(1.4);
        expect(
            result.currencyConversion.conversionRates.GBP.timestamp,
        ).toBe(100);
        expect(
            result.currencyConversion.conversionRates.GBP.rates.USD,
        ).toBe(1.2);
        expect(
            result.currencyConversion.conversionRates.GBP.rates.GBP,
        ).toBe(1);
    });

    it("replaces primitive values", async () => {
        const store = createStore();
        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "USD" },
        });
        await store.update(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        const result = await store.get(siteName, ["currencyConversion"]);
        expect(result.currencyConversion.selectedCurrency).toBe("GBP");
    });

    it("returns deeply merged updated values", async () => {
        const store = createStore();
        await store.update(siteName, {
            currencyConversion: {
                conversionRates: {
                    USD: { timestamp: 100, rates: { GBP: 0.8, USD: 1 } },
                    GBP: { timestamp: 100, rates: { USD: 1.2, GBP: 1 } },
                },
            },
        });

        const result = await store.update(siteName, {
            currencyConversion: {
                conversionRates: {
                    USD: { timestamp: 200, rates: { GBP: 0.2, USD: 1.4 } },
                },
            },
        });

        expect(result.currencyConversion).toBeDefined();
        expect(
            result.currencyConversion?.conversionRates?.USD?.timestamp,
        ).toBe(200);
        expect(
            result.currencyConversion?.conversionRates?.GBP?.timestamp,
        ).toBe(100);
    });
});

describe("subscribe", () => {
    it("notifies site listeners on site set", async () => {
        const store = createStore();
        const listener = vi.fn();
        store.subscribe("site", listener);

        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        expect(listener).toHaveBeenCalledWith(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });
    });

    it("notifies global listeners on global set", async () => {
        const store = createStore();
        const listener = vi.fn();
        store.subscribe("globals", listener);

        await store.set({ enableDebug: true });

        expect(listener).toHaveBeenCalledWith({ enableDebug: true });
    });

    it("notifies both listeners when set has mixed keys", async () => {
        const store = createStore();
        const globalListener = vi.fn();
        const siteListener = vi.fn();
        store.subscribe("globals", globalListener);
        store.subscribe("site", siteListener);

        await store.set(siteName, {
            enableDebug: true,
            currencyConversion: { selectedCurrency: "GBP" },
        });

        expect(globalListener).toHaveBeenCalledWith({ enableDebug: true });
        expect(siteListener).toHaveBeenCalledWith(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });
    });

    it("does not notify site listeners for global-only set", async () => {
        const store = createStore();
        const siteListener = vi.fn();
        store.subscribe("site", siteListener);

        await store.set({ enableDebug: true });

        expect(siteListener).not.toHaveBeenCalled();
    });

    it("does not notify global listeners for site-only set", async () => {
        const store = createStore();
        const globalListener = vi.fn();
        store.subscribe("globals", globalListener);

        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        expect(globalListener).not.toHaveBeenCalled();
    });

    it("stops notifying after unsubscribe", async () => {
        const store = createStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe("site", listener);

        unsubscribe();
        await store.set(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        expect(listener).not.toHaveBeenCalled();
    });

    it("notifies only once per update (not double from set)", async () => {
        const store = createStore();
        const listener = vi.fn();
        store.subscribe("site", listener);

        await store.update(siteName, {
            currencyConversion: { selectedCurrency: "GBP" },
        });

        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("push", () => {
    it("appends items to an array", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "includedResearchers",
            "alice",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.includedResearchers).toEqual([
            "alice",
        ]);
    });

    it("appends multiple items", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "includedResearchers",
            "alice",
            "bob",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.includedResearchers).toEqual([
            "alice",
            "bob",
        ]);
    });

    it("does not add duplicates", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "includedResearchers",
            "alice",
        );
        await store.push(
            siteName,
            "newSurveyNotifications",
            "includedResearchers",
            "alice",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.includedResearchers).toEqual([
            "alice",
        ]);
    });

    it("preserves existing items when pushing new ones", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "includedResearchers",
            "alice",
        );
        await store.push(
            siteName,
            "newSurveyNotifications",
            "includedResearchers",
            "bob",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.includedResearchers).toEqual([
            "alice",
            "bob",
        ]);
    });
});

describe("field policies", () => {
    it("resets dailySurveyCompletions when older than 24 hours", async () => {
        const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000;
        await mockStorage.setItem("local:prolific", {
            analytics: {
                totalSurveyCompletions: 5,
                dailySurveyCompletions: {
                    timestamp: staleTimestamp,
                    urls: ["https://example.com/survey1"],
                },
            },
        });

        const store = createStore();
        const result = await store.get(siteName, ["analytics"]);

        expect(result.analytics.dailySurveyCompletions.urls).toEqual([]);
        expect(result.analytics.dailySurveyCompletions.timestamp).not.toBe(
            staleTimestamp,
        );
    });

    it("preserves totalSurveyCompletions when resetting daily", async () => {
        const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000;
        await mockStorage.setItem("local:prolific", {
            analytics: {
                totalSurveyCompletions: 42,
                dailySurveyCompletions: {
                    timestamp: staleTimestamp,
                    urls: ["https://example.com/survey1"],
                },
            },
        });

        const store = createStore();
        const result = await store.get(siteName, ["analytics"]);

        expect(result.analytics.totalSurveyCompletions).toBe(42);
    });

    it("does not reset dailySurveyCompletions when within 24 hours", async () => {
        const recentTimestamp = Date.now() - 1 * 60 * 60 * 1000;
        await mockStorage.setItem("local:prolific", {
            analytics: {
                totalSurveyCompletions: 3,
                dailySurveyCompletions: {
                    timestamp: recentTimestamp,
                    urls: ["https://example.com/survey1"],
                },
            },
        });

        const store = createStore();
        const result = await store.get(siteName, ["analytics"]);

        expect(result.analytics.dailySurveyCompletions.timestamp).toBe(
            recentTimestamp,
        );
        expect(result.analytics.dailySurveyCompletions.urls).toEqual([
            "https://example.com/survey1",
        ]);
    });

    it("persists the reset to storage", async () => {
        const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000;
        await mockStorage.setItem("local:prolific", {
            analytics: {
                totalSurveyCompletions: 5,
                dailySurveyCompletions: {
                    timestamp: staleTimestamp,
                    urls: ["https://example.com/survey1"],
                },
            },
        });

        const store = createStore();
        await store.get(siteName, ["analytics"]);

        const stored = await mockStorage.getItem<any>("local:prolific");
        expect(stored.analytics.dailySurveyCompletions.urls).toEqual([]);
        expect(stored.analytics.totalSurveyCompletions).toBe(5);
    });
});

describe("remove", () => {
    it("removes an item from an array", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "excludedResearchers",
            "alice",
            "bob",
        );
        await store.remove(
            siteName,
            "newSurveyNotifications",
            "excludedResearchers",
            "alice",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.excludedResearchers).toEqual([
            "bob",
        ]);
    });

    it("does nothing if item is not in the array", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "excludedResearchers",
            "alice",
        );
        await store.remove(
            siteName,
            "newSurveyNotifications",
            "excludedResearchers",
            "bob",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.excludedResearchers).toEqual([
            "alice",
        ]);
    });

    it("removes multiple items at once", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "newSurveyNotifications",
            "excludedResearchers",
            "alice",
            "bob",
            "charlie",
        );
        await store.remove(
            siteName,
            "newSurveyNotifications",
            "excludedResearchers",
            "alice",
            "charlie",
        );

        const result = await store.get(siteName, [
            "newSurveyNotifications",
        ]);
        expect(result.newSurveyNotifications.excludedResearchers).toEqual([
            "bob",
        ]);
    });
});

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
        const result = await store.get(siteName, [
            "enableCurrencyConversion",
            "selectedCurrency",
        ]);

        expect(result.enableCurrencyConversion).toBe(
            defaultSiteSettings.enableCurrencyConversion,
        );
        expect(result.selectedCurrency).toBe(
            defaultSiteSettings.selectedCurrency,
        );
    });

    it("returns stored site values merged over defaults", async () => {
        await mockStorage.setItem("local:prolific", {
            selectedCurrency: "GBP",
        });

        const store = createStore();
        const result = await store.get(siteName, ["selectedCurrency"]);

        expect(result.selectedCurrency).toBe("GBP");
    });

    it("deep merges nested objects with defaults", async () => {
        await mockStorage.setItem("local:prolific", {
            conversionRates: { USD: { timestamp: 999 } },
        });

        const store = createStore();
        const result = await store.get(siteName, ["conversionRates"]);

        expect(result.conversionRates.USD.timestamp).toBe(999);
        expect(result.conversionRates.USD.rates).toEqual(
            defaultSiteSettings.conversionRates.USD.rates,
        );
        expect(result.conversionRates.GBP).toEqual(
            defaultSiteSettings.conversionRates.GBP,
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
            selectedCurrency: "GBP",
        });
        await mockStorage.setItem("local:globals", { enableDebug: true });

        const store = createStore();
        const result = await store.get(siteName, [
            "selectedCurrency",
            "enableDebug",
        ]);

        expect(result.selectedCurrency).toBe("GBP");
        expect(result.enableDebug).toBe(true);
    });

    it("isolates sites from each other", async () => {
        await mockStorage.setItem("local:prolific", {
            selectedCurrency: "GBP",
        });

        const store = createStore();
        const result = await store.get("cloudresearch", ["selectedCurrency"]);

        expect(result.selectedCurrency).toBe("USD");
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
        await store.set(siteName, { selectedCurrency: "GBP" });

        const result = await store.get(siteName, ["selectedCurrency"]);
        expect(result.selectedCurrency).toBe("GBP");
    });

    it("preserves existing keys when setting new ones", async () => {
        const store = createStore();
        await store.set(siteName, { selectedCurrency: "GBP" });
        await store.set(siteName, { enableCurrencyConversion: false });

        const result = await store.get(siteName, [
            "selectedCurrency",
            "enableCurrencyConversion",
        ]);
        expect(result.selectedCurrency).toBe("GBP");
        expect(result.enableCurrencyConversion).toBe(false);
    });

    it("filters out undefined values", async () => {
        const store = createStore();
        await store.set(siteName, { selectedCurrency: "GBP" });
        await store.set(siteName, { selectedCurrency: undefined as any });

        const result = await store.get(siteName, ["selectedCurrency"]);
        expect(result.selectedCurrency).toBe("GBP");
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
            selectedCurrency: "GBP",
        });

        const globalData = await mockStorage.getItem<any>("local:globals");
        const siteData = await mockStorage.getItem<any>("local:prolific");

        expect(globalData.enableDebug).toBe(true);
        expect(globalData.selectedCurrency).toBeUndefined();
        expect(siteData.selectedCurrency).toBe("GBP");
        expect(siteData.enableDebug).toBeUndefined();
    });

    it("returns persisted values for changed keys", async () => {
        const store = createStore();
        const result = await store.set(siteName, { selectedCurrency: "GBP" });

        expect(result.selectedCurrency).toBe("GBP");
    });
});

describe("update", () => {
    it("deep merges nested objects", async () => {
        const store = createStore();
        await store.update(siteName, {
            conversionRates: {
                USD: { timestamp: 100, rates: { GBP: 0.8, USD: 1 } },
                GBP: { timestamp: 100, rates: { USD: 1.2, GBP: 1 } },
            },
        });

        await store.update(siteName, {
            conversionRates: {
                USD: { timestamp: 200, rates: { GBP: 0.2, USD: 1.4 } },
            },
        });

        const result = await store.get(siteName, ["conversionRates"]);
        expect(result.conversionRates.USD.timestamp).toBe(200);
        expect(result.conversionRates.USD.rates.GBP).toBe(0.2);
        expect(result.conversionRates.USD.rates.USD).toBe(1.4);
        expect(result.conversionRates.GBP.timestamp).toBe(100);
        expect(result.conversionRates.GBP.rates.USD).toBe(1.2);
        expect(result.conversionRates.GBP.rates.GBP).toBe(1);
    });

    it("replaces primitive values", async () => {
        const store = createStore();
        await store.set(siteName, { selectedCurrency: "USD" });
        await store.update(siteName, { selectedCurrency: "GBP" });

        const result = await store.get(siteName, ["selectedCurrency"]);
        expect(result.selectedCurrency).toBe("GBP");
    });

    it("returns deeply merged updated values", async () => {
        const store = createStore();
        await store.update(siteName, {
            conversionRates: {
                USD: { timestamp: 100, rates: { GBP: 0.8, USD: 1 } },
                GBP: { timestamp: 100, rates: { USD: 1.2, GBP: 1 } },
            },
        });

        const result = await store.update(siteName, {
            conversionRates: {
                USD: { timestamp: 200, rates: { GBP: 0.2, USD: 1.4 } },
            },
        });

        expect(result.conversionRates).toBeDefined();
        expect(result.conversionRates?.USD.timestamp).toBe(200);
        expect(result.conversionRates?.GBP.timestamp).toBe(100);
    });
});

describe("subscribe", () => {
    it("notifies site listeners on site set", async () => {
        const store = createStore();
        const listener = vi.fn();
        store.subscribe("site", listener);

        await store.set(siteName, { selectedCurrency: "GBP" });

        expect(listener).toHaveBeenCalledWith(siteName, {
            selectedCurrency: "GBP",
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
            selectedCurrency: "GBP",
        });

        expect(globalListener).toHaveBeenCalledWith({ enableDebug: true });
        expect(siteListener).toHaveBeenCalledWith(siteName, {
            selectedCurrency: "GBP",
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

        await store.set(siteName, { selectedCurrency: "GBP" });

        expect(globalListener).not.toHaveBeenCalled();
    });

    it("stops notifying after unsubscribe", async () => {
        const store = createStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe("site", listener);

        unsubscribe();
        await store.set(siteName, { selectedCurrency: "GBP" });

        expect(listener).not.toHaveBeenCalled();
    });

    it("notifies only once per update (not double from set)", async () => {
        const store = createStore();
        const listener = vi.fn();
        store.subscribe("site", listener);

        await store.update(siteName, { selectedCurrency: "GBP" });

        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("push", () => {
    it("appends items to an array", async () => {
        const store = createStore();
        await store.push(siteName, "includedResearchers", "alice");

        const result = await store.get(siteName, ["includedResearchers"]);
        expect(result.includedResearchers).toEqual(["alice"]);
    });

    it("appends multiple items", async () => {
        const store = createStore();
        await store.push(siteName, "includedResearchers", "alice", "bob");

        const result = await store.get(siteName, ["includedResearchers"]);
        expect(result.includedResearchers).toEqual(["alice", "bob"]);
    });

    it("does not add duplicates", async () => {
        const store = createStore();
        await store.push(siteName, "includedResearchers", "alice");
        await store.push(siteName, "includedResearchers", "alice");

        const result = await store.get(siteName, ["includedResearchers"]);
        expect(result.includedResearchers).toEqual(["alice"]);
    });

    it("preserves existing items when pushing new ones", async () => {
        const store = createStore();
        await store.push(siteName, "includedResearchers", "alice");
        await store.push(siteName, "includedResearchers", "bob");

        const result = await store.get(siteName, ["includedResearchers"]);
        expect(result.includedResearchers).toEqual(["alice", "bob"]);
    });
});

describe("remove", () => {
    it("removes an item from an array", async () => {
        const store = createStore();
        await store.push(siteName, "excludedResearchers", "alice", "bob");
        await store.remove(siteName, "excludedResearchers", "alice");

        const result = await store.get(siteName, ["excludedResearchers"]);
        expect(result.excludedResearchers).toEqual(["bob"]);
    });

    it("does nothing if item is not in the array", async () => {
        const store = createStore();
        await store.push(siteName, "excludedResearchers", "alice");
        await store.remove(siteName, "excludedResearchers", "bob");

        const result = await store.get(siteName, ["excludedResearchers"]);
        expect(result.excludedResearchers).toEqual(["alice"]);
    });

    it("removes multiple items at once", async () => {
        const store = createStore();
        await store.push(
            siteName,
            "excludedResearchers",
            "alice",
            "bob",
            "charlie",
        );
        await store.remove(siteName, "excludedResearchers", "alice", "charlie");

        const result = await store.get(siteName, ["excludedResearchers"]);
        expect(result.excludedResearchers).toEqual(["bob"]);
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsStore } from "@/store/SettingsStore";
import { createProject } from "@/tests/utils/opportunities";
import { createBadgeSync } from "../badgeSync";
import { createRuntimeCache, updateRuntimeCache } from "../runtimeCache";
import { updateRuntimeMeta, type RuntimeMetaStore } from "../runtimeStrategies";

import type { RuntimeCache } from "../runtimeCache";

const mocks = vi.hoisted(() => ({
    onConnectAddListener: vi.fn(),
    setBadgeCount: vi.fn(),
    storage: new Map<string, unknown>(),
}));

vi.mock("#imports", () => ({
    browser: {
        runtime: {
            onConnect: {
                addListener: mocks.onConnectAddListener,
            },
        },
    },
    storage: {
        async getItem<T>(key: string): Promise<T | null> {
            return (mocks.storage.get(key) as T) ?? null;
        },
        async setItem(key: string, value: unknown): Promise<void> {
            mocks.storage.set(key, value);
        },
    },
}));

vi.mock("../badge", () => ({
    setBadgeCount: mocks.setBadgeCount,
}));

beforeEach(() => {
    mocks.onConnectAddListener.mockClear();
    mocks.setBadgeCount.mockClear();
    mocks.storage.clear();
});

describe("badgeSync", () => {
    it("clears project badge count when availability drops to zero before popup opens", async () => {
        const store = new SettingsStore();
        const runtimeCache = createRuntimeCache();
        const runtimeMeta: RuntimeMetaStore = {};
        const badgeSync = createBadgeSync(
            store,
            () => runtimeCache,
            () => runtimeMeta,
        );

        syncProjectAvailability(runtimeCache, runtimeMeta, 1, 100);

        await badgeSync.recompute();

        expect(mocks.setBadgeCount).toHaveBeenLastCalledWith(1);

        syncProjectAvailability(runtimeCache, runtimeMeta, 0, 200);

        await badgeSync.recompute();

        expect(mocks.setBadgeCount).toHaveBeenLastCalledWith(0);
    });
});

function syncProjectAvailability(
    runtimeCache: RuntimeCache,
    runtimeMeta: RuntimeMetaStore,
    availableStudyCount: number,
    now: number,
): void {
    const project = createProject("project-a", { availableStudyCount });

    updateRuntimeCache(runtimeCache, "opportunities", "prolific", 1, [project]);

    updateRuntimeMeta(runtimeMeta, "opportunities", "prolific", [project], now);
}

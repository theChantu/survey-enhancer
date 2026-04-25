import { beforeEach, describe, expect, it } from "vitest";
import { storage } from "#imports";
import {
    loadRuntimeMetaStore,
    pruneRuntimeMeta,
    saveRuntimeMetaStore,
} from "../runtimeMetaStore";

const mockStorage = storage as typeof storage & { _clear(): void };

describe("runtimeMetaStore", () => {
    beforeEach(() => {
        mockStorage._clear();
    });

    it("returns an empty store when nothing is persisted", async () => {
        await expect(loadRuntimeMetaStore()).resolves.toEqual({});
    });

    it("persists and loads runtime meta", async () => {
        const runtimeMeta = {
            opportunities: {
                prolific: {
                    "study:study-a": {
                        firstSeenAt: 100,
                        lastSeenAt: 200,
                        lastChangedAt: 100,
                        lastAlertableChangeAt: 100,
                        fingerprint: "present",
                    },
                },
            },
        } as const;

        await saveRuntimeMetaStore(runtimeMeta);

        await expect(loadRuntimeMetaStore()).resolves.toEqual(runtimeMeta);
    });

    it("prunes entries older than the ttl by lastSeenAt", () => {
        const runtimeMeta = {
            opportunities: {
                prolific: {
                    stale: {
                        firstSeenAt: 100,
                        lastSeenAt: 100,
                        lastChangedAt: 100,
                        lastAlertableChangeAt: 100,
                        fingerprint: "present",
                    },
                    fresh: {
                        firstSeenAt: 200,
                        lastSeenAt: 2_592_000_001,
                        lastChangedAt: 200,
                        lastAlertableChangeAt: 200,
                        fingerprint: "present",
                    },
                },
            },
        };

        expect(pruneRuntimeMeta(runtimeMeta, 2_592_000_101)).toEqual({
            opportunities: {
                prolific: {
                    fresh: {
                        firstSeenAt: 200,
                        lastSeenAt: 2_592_000_001,
                        lastChangedAt: 200,
                        lastAlertableChangeAt: 200,
                        fingerprint: "present",
                    },
                },
            },
        });
    });
});

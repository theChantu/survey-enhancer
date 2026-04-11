import { describe, expect, it } from "vitest";

import {
    clearRuntimeMeta,
    enrichRuntimeData,
    hasRuntimeStrategy,
    updateRuntimeMeta,
} from "./runtimeStrategies";

describe("runtimeStrategies", () => {
    it("reports which channels have runtime strategies", () => {
        expect(hasRuntimeStrategy("studies")).toBe(true);
    });

    it("creates and updates seen metadata without resetting firstSeenAt", () => {
        const runtimeMeta = {};

        const initial = updateRuntimeMeta(
            runtimeMeta,
            "studies",
            "prolific",
            [
                {
                    id: "study-a",
                    title: "Study A",
                    researcher: "Researcher A",
                    reward: 1,
                    rate: 12,
                    link: "https://app.prolific.com/studies/a",
                    symbol: "$",
                },
            ],
            100,
        );

        expect(initial).toEqual({
            "study-a": {
                firstSeenAt: 100,
                lastSeenAt: 100,
            },
        });

        const updated = updateRuntimeMeta(
            runtimeMeta,
            "studies",
            "prolific",
            [
                {
                    id: "study-a",
                    title: "Study A",
                    researcher: "Researcher A",
                    reward: 1,
                    rate: 12,
                    link: "https://app.prolific.com/studies/a",
                    symbol: "$",
                },
                {
                    id: "study-b",
                    title: "Study B",
                    researcher: "Researcher B",
                    reward: 2,
                    rate: 14,
                    link: "https://app.prolific.com/studies/b",
                    symbol: "$",
                },
            ],
            250,
        );

        expect(updated).toEqual({
            "study-a": {
                firstSeenAt: 100,
                lastSeenAt: 250,
            },
            "study-b": {
                firstSeenAt: 250,
                lastSeenAt: 250,
            },
        });
    });

    it("enriches studies with seen metadata for a site", () => {
        const runtimeMeta = {};

        updateRuntimeMeta(
            runtimeMeta,
            "studies",
            "prolific",
            [
                {
                    id: "study-a",
                    title: "Study A",
                    researcher: "Researcher A",
                    reward: 1,
                    rate: 12,
                    link: "https://app.prolific.com/studies/a",
                    symbol: "$",
                },
            ],
            100,
        );

        const enriched = enrichRuntimeData(
            runtimeMeta,
            "studies",
            "prolific",
            [
                {
                    id: "study-a",
                    title: "Study A",
                    researcher: "Researcher A",
                    reward: 1,
                    rate: 12,
                    link: "https://app.prolific.com/studies/a",
                    symbol: "$",
                },
            ],
        );

        expect(enriched).toEqual([
            {
                id: "study-a",
                title: "Study A",
                researcher: "Researcher A",
                reward: 1,
                rate: 12,
                link: "https://app.prolific.com/studies/a",
                symbol: "$",
                firstSeenAt: 100,
                lastSeenAt: 100,
            },
        ]);
    });

    it("clears per-site metadata and removes the channel bucket when empty", () => {
        const runtimeMeta = {};

        updateRuntimeMeta(
            runtimeMeta,
            "studies",
            "prolific",
            [
                {
                    id: "study-a",
                    title: "Study A",
                    researcher: "Researcher A",
                    reward: 1,
                    rate: 12,
                    link: "https://app.prolific.com/studies/a",
                    symbol: "$",
                },
            ],
            100,
        );
        updateRuntimeMeta(
            runtimeMeta,
            "studies",
            "cloudresearch",
            [
                {
                    id: "study-b",
                    title: "Study B",
                    researcher: "Researcher B",
                    reward: 2,
                    rate: 14,
                    link: "https://connect.cloudresearch.com/participant/dashboard/b",
                    symbol: "$",
                },
            ],
            200,
        );

        clearRuntimeMeta(runtimeMeta, "studies", "prolific");
        expect(runtimeMeta).toEqual({
            studies: {
                cloudresearch: {
                    "study-b": {
                        firstSeenAt: 200,
                        lastSeenAt: 200,
                    },
                },
            },
        });

        clearRuntimeMeta(runtimeMeta, "studies", "cloudresearch");
        expect(runtimeMeta).toEqual({});
    });
});

import { describe, expect, it } from "vitest";

import {
    clearRuntimeMeta,
    enrichRuntimeData,
    hasRuntimeStrategy,
    updateRuntimeMeta,
} from "../runtimeStrategies";
import { createProject, createStudy } from "./utils";

describe("runtimeStrategies", () => {
    it("reports which channels have runtime strategies", () => {
        expect(hasRuntimeStrategy("opportunities")).toBe(true);
    });

    it("creates and updates seen metadata without resetting firstSeenAt", () => {
        const runtimeMeta = {};

        const initial = updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [
                createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                }),
            ],
            100,
        );

        expect(initial).toEqual({
            "study:study-a": {
                firstSeenAt: 100,
                lastSeenAt: 100,
                lastChangedAt: 100,
                lastAlertableChangeAt: 100,
                fingerprint: "present",
            },
        });

        const updated = updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [
                createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                    link: "https://app.prolific.com/studies/a",
                }),
                createStudy("study-b", {
                    title: "Study B",
                    researcher: "Researcher B",
                    reward: 2,
                    rate: 14,
                    link: "https://app.prolific.com/studies/b",
                }),
            ],
            250,
        );

        expect(updated).toEqual({
            "study:study-a": {
                firstSeenAt: 100,
                lastSeenAt: 250,
                lastChangedAt: 100,
                lastAlertableChangeAt: 100,
                fingerprint: "present",
            },
            "study:study-b": {
                firstSeenAt: 250,
                lastSeenAt: 250,
                lastChangedAt: 250,
                lastAlertableChangeAt: 250,
                fingerprint: "present",
            },
        });
    });

    it("enriches studies with seen metadata for a site", () => {
        const runtimeMeta = {};

        updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [
                createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                }),
            ],
            100,
        );

        const enriched = enrichRuntimeData(
            runtimeMeta,
            "opportunities",
            "prolific",
            [
                createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                }),
            ],
        );

        expect(enriched).toEqual([
            {
                ...createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                }),
                firstSeenAt: 100,
                lastSeenAt: 100,
                lastChangedAt: 100,
                lastAlertableChangeAt: 100,
                fingerprint: "present",
            },
        ]);
    });

    it("reuses persisted firstSeenAt when runtime meta is reloaded after a restart", () => {
        const persistedRuntimeMeta = {
            opportunities: {
                prolific: {
                    "study:study-a": {
                        firstSeenAt: 100,
                        lastSeenAt: 100,
                        lastChangedAt: 100,
                        lastAlertableChangeAt: 100,
                        fingerprint: "present",
                    },
                },
            },
        };

        const enriched = enrichRuntimeData(
            persistedRuntimeMeta,
            "opportunities",
            "prolific",
            [
                createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                }),
            ],
        );

        expect(enriched[0]).toMatchObject({
            id: "study-a",
            firstSeenAt: 100,
            lastSeenAt: 100,
        });
    });

    it("clears per-site metadata and removes the channel bucket when empty", () => {
        const runtimeMeta = {};

        updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [
                createStudy("study-a", {
                    title: "Study A",
                    researcher: "Researcher A",
                }),
            ],
            100,
        );
        updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "cloudresearch",
            [
                createStudy("study-b", {
                    title: "Study B",
                    researcher: "Researcher B",
                    reward: 2,
                    rate: 14,
                    link: "https://connect.cloudresearch.com/participant/dashboard/b",
                }),
            ],
            200,
        );

        clearRuntimeMeta(runtimeMeta, "opportunities", "prolific");
        expect(runtimeMeta).toEqual({
            opportunities: {
                cloudresearch: {
                    "study:study-b": {
                        firstSeenAt: 200,
                        lastSeenAt: 200,
                        lastChangedAt: 200,
                        lastAlertableChangeAt: 200,
                        fingerprint: "present",
                    },
                },
            },
        });

        clearRuntimeMeta(runtimeMeta, "opportunities", "cloudresearch");
        expect(runtimeMeta).toEqual({});
    });

    it("marks project count increases as alertable changes", () => {
        const runtimeMeta = {};

        updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [createProject("project-a", { availableStudyCount: 1 })],
            100,
        );

        const increased = updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [createProject("project-a", { availableStudyCount: 2 })],
            200,
        );

        expect(increased["project:project-a"]).toMatchObject({
            firstSeenAt: 100,
            lastSeenAt: 200,
            lastChangedAt: 200,
            lastAlertableChangeAt: 200,
            fingerprint: "2",
        });
    });

    it("does not mark project count decreases as alertable changes", () => {
        const runtimeMeta = {};

        updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [createProject("project-a", { availableStudyCount: 2 })],
            100,
        );

        const decreased = updateRuntimeMeta(
            runtimeMeta,
            "opportunities",
            "prolific",
            [createProject("project-a", { availableStudyCount: 1 })],
            200,
        );

        expect(decreased["project:project-a"]).toMatchObject({
            firstSeenAt: 100,
            lastSeenAt: 200,
            lastChangedAt: 200,
            lastAlertableChangeAt: 100,
            fingerprint: "1",
        });
    });
});

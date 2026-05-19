import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudResearchAdapter } from "../CloudResearchAdapter";
import { ProlificAdapter } from "../ProlificAdapter";
import { createCapabilityElement, createQueryElement } from "./utils";

import type { NetworkRequestEvent } from "@/events/network";

class TestProlificAdapter extends ProlificAdapter {
    match(event: NetworkRequestEvent) {
        return this.matchNetworkEvent(event);
    }

    capabilityHints(el: HTMLElement) {
        return this.getCapabilityHints(el);
    }
}

class TestCloudResearchAdapter extends CloudResearchAdapter {
    match(event: NetworkRequestEvent) {
        return this.matchNetworkEvent(event);
    }

    capabilityHints(el: HTMLElement) {
        return this.getCapabilityHints(el);
    }
}

afterEach(() => {
    vi.unstubAllGlobals();
});

function createTextElement(text: string): HTMLElement {
    return { textContent: text } as HTMLElement;
}

function createProjectItem(title: string, count?: string): HTMLElement {
    return {
        querySelector(selector: string) {
            if (selector === "span.nav-item__text") {
                return createTextElement(title);
            }

            if (selector === "sup.indicator") {
                return count === undefined ? null : createTextElement(count);
            }

            return null;
        },
    } as unknown as HTMLElement;
}

function stubProlificProjects(projects: HTMLElement[]): void {
    const projectSection = {
        querySelector(selector: string) {
            return selector === "h2" ? createTextElement("Projects") : null;
        },
        querySelectorAll(selector: string) {
            return selector === "li" ? projects : [];
        },
    } as unknown as HTMLElement;

    vi.stubGlobal("document", {
        querySelectorAll(selector: string) {
            if (selector === "nav.projects-sidebar section") {
                return [projectSection];
            }

            return [];
        },
    });
}

describe("BaseAdapter network matching", () => {
    it("matches Prolific completions only when the request body action matches", () => {
        const adapter = new TestProlificAdapter();

        expect(
            adapter.match({
                url: "https://internal-api.prolific.com/api/v1/submissions/123/transition",
                method: "POST",
                statusCode: 200,
                requestBody: { action: "COMPLETE" },
            }),
        ).toBe("studyCompletion");

        expect(
            adapter.match({
                url: "https://internal-api.prolific.com/api/v1/submissions/123/transition",
                method: "POST",
                statusCode: 200,
                requestBody: { action: "RETURN" },
            }),
        ).toBeNull();
    });

    it("supports request body field membership matching", () => {
        const adapter = new TestProlificAdapter();

        (adapter.config.networkPatterns as any).studyCompletion = [
            {
                path: "/transition",
                method: "POST",
                requestBody: {
                    field: "action",
                    in: ["COMPLETE", "SCREENED_OUT"],
                },
            },
        ];

        expect(
            adapter.match({
                url: "https://internal-api.prolific.com/api/v1/submissions/123/transition",
                method: "POST",
                statusCode: 200,
                requestBody: { action: "SCREENED_OUT" },
            }),
        ).toBe("studyCompletion");
    });

    it("keeps path and method matching unchanged when no request body matcher is present", () => {
        const adapter = new TestCloudResearchAdapter();

        expect(
            adapter.match({
                url: "https://connect.cloudresearch.com/participant-api/studies/123/submit",
                method: "POST",
                statusCode: 200,
            }),
        ).toBe("studyCompletion");
    });
});

describe("Site capability hint collection", () => {
    it("collects Prolific hints from device badge test ids", () => {
        const adapter = new TestProlificAdapter();
        const hints = adapter.capabilityHints(
            createQueryElement({
                "span.device-icon[data-testid]": [
                    createCapabilityElement({
                        attrs: { "data-testid": "device-desktop" },
                    }),
                    createCapabilityElement({
                        attrs: { "data-testid": "device-mobile" },
                    }),
                    createCapabilityElement({
                        attrs: { "data-testid": "peripheral-microphone" },
                    }),
                ],
            }),
        );

        expect(hints).toEqual(
            expect.arrayContaining([
                "device-desktop",
                "device-mobile",
                "peripheral-microphone",
            ]),
        );
    });

    it("collects CloudResearch supported devices and peripheral icons", () => {
        const adapter = new TestCloudResearchAdapter();
        const hints = adapter.capabilityHints(
            createQueryElement({
                '[class*="fa-"]': [
                    createCapabilityElement({
                        classes: ["fa-desktop"],
                        supported: true,
                    }),
                    createCapabilityElement({ classes: ["fa-tablet"] }),
                ],
                '[class*="fas"].cr-text-secondary': [
                    createCapabilityElement({
                        classes: ["fas", "fa-microphone"],
                    }),
                    createCapabilityElement({
                        classes: ["fas", "fa-download"],
                    }),
                ],
            }),
        );

        expect(hints).toEqual(
            expect.arrayContaining([
                "fa-desktop",
                "fa-microphone",
                "fa-download",
            ]),
        );
        expect(hints).not.toContain("fa-tablet");
    });
});

describe("Prolific project extraction", () => {
    it("keeps projects without a count badge as zero-count opportunities", () => {
        stubProlificProjects([
            createProjectItem("Empty project"),
            createProjectItem("Active project", "2"),
        ]);

        const opportunities = new ProlificAdapter().extractOpportunities();

        expect(opportunities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "project",
                    title: "Empty project",
                    availableStudyCount: 0,
                }),
                expect.objectContaining({
                    kind: "project",
                    title: "Active project",
                    availableStudyCount: 2,
                }),
            ]),
        );
    });
});

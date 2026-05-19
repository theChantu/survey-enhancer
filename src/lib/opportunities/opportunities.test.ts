import { describe, expect, it } from "vitest";
import { createProject, createStudy } from "@/tests/utils/opportunities";
import { isOpportunityAlertable } from "./opportunities";

describe("isOpportunityAlertable", () => {
    it("alerts for studies only when first seen", () => {
        expect(isOpportunityAlertable(createStudy())).toBe(true);
        expect(isOpportunityAlertable(createStudy(), createStudy())).toBe(
            false,
        );
    });

    it("does not alert for zero-count projects", () => {
        expect(
            isOpportunityAlertable(
                createProject("project-a", { availableStudyCount: 0 }),
            ),
        ).toBe(false);
    });

    it("alerts when a project has availability and no previous project baseline", () => {
        expect(
            isOpportunityAlertable(
                createProject("project-a", { availableStudyCount: 1 }),
            ),
        ).toBe(true);
    });

    it("alerts when a project count increases from the previous baseline", () => {
        expect(
            isOpportunityAlertable(
                createProject("project-a", { availableStudyCount: 2 }),
                createProject("project-a", { availableStudyCount: 1 }),
            ),
        ).toBe(true);
    });

    it("does not alert when a project count is unchanged or lower", () => {
        expect(
            isOpportunityAlertable(
                createProject("project-a", { availableStudyCount: 1 }),
                createProject("project-a", { availableStudyCount: 1 }),
            ),
        ).toBe(false);
        expect(
            isOpportunityAlertable(
                createProject("project-a", { availableStudyCount: 1 }),
                createProject("project-a", { availableStudyCount: 2 }),
            ),
        ).toBe(false);
    });
});

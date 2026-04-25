import type { OpportunityInfo } from "@/adapters/BaseAdapter";

export function getOpportunityKey(opportunity: OpportunityInfo): string {
    return `${opportunity.kind}:${opportunity.id}`;
}

export function getOpportunityFingerprint(opportunity: OpportunityInfo): string {
    switch (opportunity.kind) {
        case "project":
            return String(opportunity.availableStudyCount ?? "");
        case "study":
            return "present";
    }
}

export function isOpportunityAlertable(
    opportunity: OpportunityInfo,
    previous?: OpportunityInfo,
): boolean {
    if (opportunity.kind === "study") return previous === undefined;

    const currentCount = opportunity.availableStudyCount;
    if (currentCount === null || currentCount <= 0) return false;

    if (!previous || previous.kind !== "project") return true;

    const previousCount = previous.availableStudyCount;
    return previousCount === null || currentCount > previousCount;
}

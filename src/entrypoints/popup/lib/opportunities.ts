import type { RuntimeOutputDataMap } from "@/messages/types";

type RuntimeOpportunity = RuntimeOutputDataMap["opportunities"][number];

export function isDisplayableOpportunity(
    opportunity: RuntimeOpportunity,
): boolean {
    return (
        opportunity.kind !== "project" ||
        opportunity.availableStudyCount === null ||
        opportunity.availableStudyCount > 0
    );
}

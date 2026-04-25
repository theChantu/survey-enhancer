import type { OpportunityInfo } from "@/adapters/BaseAdapter";
import type { AlertRuleFieldType } from "./alertRules";

type AlertRuleValue = string | number | null;

type AlertRuleFieldConfig = {
    label: string;
    type: AlertRuleFieldType;
    placeholder: string;
    getValue: (opportunity: OpportunityInfo) => AlertRuleValue;
};

export const alertRuleFieldConfig = {
    kind: {
        label: "Opportunity type",
        type: "text",
        placeholder: "e.g. study",
        getValue: (opportunity) => opportunity.kind,
    },
    title: {
        label: "Title",
        type: "text",
        placeholder: "e.g. Study",
        getValue: (opportunity) => opportunity.title,
    },
    researcher: {
        label: "Researcher",
        type: "text",
        placeholder: "e.g. University of Oxford",
        getValue: (opportunity) =>
            opportunity.kind === "study" ? opportunity.researcher : null,
    },
    reward: {
        label: "Reward",
        type: "number",
        placeholder: "e.g. 2.50",
        getValue: (opportunity) =>
            opportunity.kind === "study" ? opportunity.reward : null,
    },
    rate: {
        label: "Hourly rate",
        type: "number",
        placeholder: "e.g. 12.00",
        getValue: (opportunity) =>
            opportunity.kind === "study" ? opportunity.rate : null,
    },
    slots: {
        label: "Slots",
        type: "number",
        placeholder: "e.g. 10",
        getValue: (opportunity) =>
            opportunity.kind === "study" ? opportunity.slots : null,
    },
    averageCompletionMinutes: {
        label: "Avg completion (mins)",
        type: "number",
        placeholder: "e.g. 5",
        getValue: (opportunity) =>
            opportunity.kind === "study"
                ? opportunity.averageCompletionMinutes
                : null,
    },
    availableStudyCount: {
        label: "Available studies",
        type: "number",
        placeholder: "e.g. 2",
        getValue: (opportunity) =>
            opportunity.kind === "project"
                ? opportunity.availableStudyCount
                : null,
    },
} as const satisfies Record<string, AlertRuleFieldConfig>;

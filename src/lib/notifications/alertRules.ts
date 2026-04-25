import { alertRuleFieldConfig } from "./alertRuleFieldConfig";

import type { OpportunityInfo } from "@/adapters/BaseAdapter";

export type AlertRuleFieldType = "text" | "number";

export type AlertRuleField = keyof typeof alertRuleFieldConfig;

export const alertRuleFields = Object.keys(
    alertRuleFieldConfig,
) as AlertRuleField[];

export const alertRuleFieldLabels = Object.fromEntries(
    alertRuleFields.map((field) => [field, alertRuleFieldConfig[field].label]),
) as Record<AlertRuleField, string>;

export const alertRuleFieldPlaceholders = Object.fromEntries(
    alertRuleFields.map((field) => [
        field,
        alertRuleFieldConfig[field].placeholder,
    ]),
) as Record<AlertRuleField, string>;

export const textAlertRuleOperators = [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
] as const;

export const numberAlertRuleOperators = [
    "gt",
    "gte",
    "lt",
    "lte",
    "equals",
    "not_equals",
] as const;

export type TextAlertRuleOperator = (typeof textAlertRuleOperators)[number];
export type NumberAlertRuleOperator = (typeof numberAlertRuleOperators)[number];
export type AlertRuleOperator = TextAlertRuleOperator | NumberAlertRuleOperator;

export const alertRuleOperatorLabels = {
    contains: "contains",
    not_contains: "excludes",
    equals: "=",
    not_equals: "≠",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
} as const satisfies Record<AlertRuleOperator, string>;

export type AlertRuleGroupMode = "all" | "any";

export type AlertCondition = {
    id: string;
    field: AlertRuleField;
    operator: AlertRuleOperator;
    value?: string;
};

export type AlertRuleGroup = {
    mode: AlertRuleGroupMode;
    conditions: AlertCondition[];
};

export type AlertRules = {
    include: AlertRuleGroup;
    exclude: AlertRuleGroup;
};

function isAlertRuleField(field: string): field is AlertRuleField {
    return (alertRuleFields as readonly string[]).includes(field);
}

export function getAlertRuleFieldType(
    field: AlertRuleField,
): AlertRuleFieldType {
    return alertRuleFieldConfig[field].type;
}

export function getAlertRuleOperators(
    field: AlertRuleField,
): readonly AlertRuleOperator[] {
    return getAlertRuleFieldType(field) === "number"
        ? numberAlertRuleOperators
        : textAlertRuleOperators;
}

export function getDefaultAlertRuleOperator(
    field: AlertRuleField,
): AlertRuleOperator {
    return getAlertRuleOperators(field)[0];
}

function normalizeText(value: string): string {
    return value.trim().toLowerCase();
}

const completeNumberPattern = /^[+-]?(?:\d+|\d+\.\d+|\.\d+)(?:[eE][+-]?\d+)?$/;

function coerceText(value: AlertCondition["value"]): string | null {
    if (!value) return null;

    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
}

function isCompleteNumberInput(
    value: AlertCondition["value"],
): value is string {
    if (!value) return false;

    return completeNumberPattern.test(value.trim());
}

function coerceNumber(value: AlertCondition["value"]): number | null {
    if (!isCompleteNumberInput(value)) {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function isCompatibleOperator(
    field: AlertRuleField,
    operator: AlertRuleOperator,
): boolean {
    return getAlertRuleOperators(field).includes(operator);
}

export function isAlertConditionComplete(condition: AlertCondition): boolean {
    if (!isAlertRuleField(condition.field)) return false;
    if (!isCompatibleOperator(condition.field, condition.operator))
        return false;

    return getAlertRuleFieldType(condition.field) === "number"
        ? coerceNumber(condition.value) !== null
        : coerceText(condition.value) !== null;
}

function matchesTextCondition(
    actualValue: string | null,
    condition: AlertCondition,
): boolean {
    const expectedValue = coerceText(condition.value);

    switch (condition.operator) {
        case "contains":
            return (
                actualValue !== null &&
                expectedValue !== null &&
                actualValue.includes(expectedValue)
            );
        case "not_contains":
            if (expectedValue === null) return false;
            if (actualValue === null) return true;
            return !actualValue.includes(expectedValue);
        case "equals":
            return actualValue !== null && actualValue === expectedValue;
        case "not_equals":
            if (expectedValue === null) return false;
            if (actualValue === null) return true;
            return actualValue !== expectedValue;
        default:
            return false;
    }
}

function matchesNumberCondition(
    actualValue: number | null,
    condition: AlertCondition,
): boolean {
    const expectedValue = coerceNumber(condition.value);

    switch (condition.operator) {
        case "gt":
            return (
                actualValue !== null &&
                expectedValue !== null &&
                actualValue > expectedValue
            );
        case "gte":
            return (
                actualValue !== null &&
                expectedValue !== null &&
                actualValue >= expectedValue
            );
        case "lt":
            return (
                actualValue !== null &&
                expectedValue !== null &&
                actualValue < expectedValue
            );
        case "lte":
            return (
                actualValue !== null &&
                expectedValue !== null &&
                actualValue <= expectedValue
            );
        case "equals":
            return actualValue !== null && actualValue === expectedValue;
        case "not_equals":
            if (expectedValue === null) return false;
            if (actualValue === null) return true;
            return actualValue !== expectedValue;
        default:
            return false;
    }
}

export function matchesAlertCondition(
    opportunity: OpportunityInfo,
    condition: AlertCondition,
): boolean {
    if (!isAlertConditionComplete(condition)) return false;

    const value = alertRuleFieldConfig[condition.field].getValue(opportunity);

    if (getAlertRuleFieldType(condition.field) === "number") {
        return matchesNumberCondition(
            typeof value === "number" ? value : null,
            condition,
        );
    }

    return matchesTextCondition(
        typeof value === "string" ? coerceText(value) : null,
        condition,
    );
}

export function getCompleteAlertConditions(
    group: AlertRuleGroup,
): AlertCondition[] {
    return group.conditions.filter(isAlertConditionComplete);
}

export function matchesAlertRuleGroup(
    opportunity: OpportunityInfo,
    group: AlertRuleGroup,
): boolean {
    const conditions = getCompleteAlertConditions(group);
    if (conditions.length === 0) return false;

    return group.mode === "all"
        ? conditions.every((condition) =>
              matchesAlertCondition(opportunity, condition),
          )
        : conditions.some((condition) =>
              matchesAlertCondition(opportunity, condition),
          );
}

export function matchesAlertRules(
    opportunity: OpportunityInfo,
    rules: AlertRules,
): boolean {
    if (matchesAlertRuleGroup(opportunity, rules.exclude)) return false;

    const includeConditions = getCompleteAlertConditions(rules.include);
    if (includeConditions.length === 0) return true;

    return matchesAlertRuleGroup(opportunity, rules.include);
}

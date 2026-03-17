import { BaseAdapter } from "./BaseAdapter";
import { sites } from "./sites";

import type { AdapterSettings } from "./BaseAdapter";
import type CurrencyConversion from "./modules/CurrencyConversion";

const CLOUD_RESEARCH_SETTINGS: AdapterSettings = {
    enableAutoReload: true,
};

const HOST = "connect.cloudresearch.com";
const CLOUD_RESEARCH_URL = {
    ...sites[HOST],
    host: HOST,
    suffix: "details",
    query: {
        page: 1,
        size: 100,
    },
} as const;

export class CloudResearchAdapter
    extends BaseAdapter<typeof HOST>
    implements CurrencyConversion
{
    constructor(overrides: Partial<AdapterSettings> = {}) {
        super(CLOUD_RESEARCH_URL, CLOUD_RESEARCH_SETTINGS, overrides);
    }

    override modules = sites[HOST].modules;

    getSurveyElements() {
        return document.querySelectorAll<HTMLElement>("div.project-card");
    }

    getSurveyId(el: Element) {
        const surveyId = Array.from(el.classList).find((className) =>
            className.includes("project-card-"),
        );
        if (surveyId) return surveyId.replace("project-card-", "");
        return null;
    }

    getSurveyContainer(el: HTMLElement) {
        return el.querySelector<HTMLElement>("div.project-card");
    }

    getSurveyTitle(el: HTMLElement) {
        return el.querySelector<HTMLElement>("p") ?? null;
    }

    getSurveyResearcher(el: HTMLElement): string | null {
        return (
            el.querySelector<HTMLElement>("label div div:last-child")
                ?.textContent ?? null
        );
    }

    getInitCurrencyInfo(el: HTMLElement) {
        return "$";
    }

    getCurrencyInfo(el: HTMLElement) {
        let displayClass = Array.from(el.classList).find((className) =>
            className.startsWith("display-"),
        );

        const displaySymbol = displayClass?.replace("display-", "");

        return {
            // CloudResearch uses USD by default
            displaySymbol:
                displaySymbol ?? this.getInitCurrencyInfo(el) ?? null,
            sourceSymbol: this.getInitCurrencyInfo(el) ?? null,
        };
    }

    getRewardElements() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                '[class*="project-pay-per-hour-"] > *',
            ),
        );
    }

    getRewardElement(el: HTMLElement) {
        return (
            el.querySelector<HTMLElement>(
                '[class*="project-pay-per-hour-"] > *',
            ) ?? null
        );
    }

    getHourlyRateElements() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                '[class*="project-pay-per-hour-"] > *:last-child',
            ),
        );
    }

    getHourlyRateElement(el: HTMLElement) {
        return (
            el.querySelector<HTMLElement>(
                '[class*="project-pay-per-hour-"] > *:last-child',
            ) ?? null
        );
    }

    setHourlyRate(element: HTMLElement): void {}

    getCssSettings(): string {
        return "";
    }
}

import { BaseAdapter } from "./BaseAdapter";
import { extractSymbol } from "../lib/utils";

import type { AdapterSettings } from "./BaseAdapter";

const PROLIFIC_SETTINGS: AdapterSettings = {
    enableAutoReload: false,
};

export class ProlificAdapter extends BaseAdapter {
    constructor(overrides: Partial<AdapterSettings> = {}) {
        super(
            {
                host: "app.prolific.com",
                path: "/studies",
            },
            PROLIFIC_SETTINGS,
            overrides,
        );
    }

    getSurveyElements() {
        return document.querySelectorAll<HTMLElement>(
            'li[data-testid^="study-"]',
        );
    }

    getSurveyId(el: HTMLElement) {
        return el.getAttribute("data-testid")?.replace("study-", "") ?? null;
    }

    getSurveyContainer(el: HTMLElement) {
        return el.querySelector<HTMLElement>("div.study-content");
    }

    getStudyTitle(el: HTMLElement) {
        return el.querySelector<HTMLElement>("h2") ?? null;
    }

    getInitCurrencyInfo(el: HTMLElement) {
        return extractSymbol(el.textContent) ?? null;
    }

    getCurrencyInfo(el: HTMLElement) {
        let displaySymbol = Array.from(el.classList).find((className) =>
            className.startsWith("display-"),
        );
        if (displaySymbol)
            displaySymbol = displaySymbol.replace("display-", "");
        let sourceSymbol = Array.from(el.classList).find((className) =>
            className.startsWith("source-"),
        );
        if (sourceSymbol) sourceSymbol = sourceSymbol.replace("source-", "");

        return {
            displaySymbol: displaySymbol ?? null,
            sourceSymbol: sourceSymbol ?? null,
        };
    }

    getRewardElements() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                "[data-testid='study-tag-reward-per-hour'], [data-testid='study-tag-reward']",
            ),
        );
    }

    getRewardElement(el: HTMLElement) {
        return (
            el.querySelector<HTMLElement>("[data-testid='study-tag-reward']") ??
            null
        );
    }

    getHourlyRateElements() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                "[data-testid='study-tag-reward-per-hour']",
            ),
        );
    }

    getHourlyRateElement(el: HTMLElement) {
        return (
            el.querySelector<HTMLElement>(
                "[data-testid='study-tag-reward-per-hour']",
            ) ?? null
        );
    }

    setHourlyRate(el: HTMLElement) {}
}

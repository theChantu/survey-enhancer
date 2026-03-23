import { BaseAdapter } from "./BaseAdapter";
import { extractSymbol } from "../lib/utils";
import { sites } from "./sites";

const HOST = "app.prolific.com";

export class ProlificAdapter extends BaseAdapter<typeof HOST> {
    constructor() {
        super({ ...sites[HOST], host: HOST });
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

    getSurveyTitle(el: HTMLElement) {
        return el.querySelector<HTMLElement>("h2")?.textContent ?? null;
    }

    getSurveyResearcher(el: HTMLElement): string | null {
        return (
            el.querySelector<HTMLElement>('[aria-labelledby*="host-name-"]')
                ?.textContent ?? null
        );
    }

    getInitCurrencyInfo(el: HTMLElement) {
        return extractSymbol(el.textContent) ?? null;
    }

    getCurrencyInfo(el: HTMLElement) {
        const displaySymbol = el.getAttribute("display");
        const sourceSymbol = el.getAttribute("data-original-currency");

        return {
            displaySymbol: displaySymbol ?? this.getInitCurrencyInfo(el),
            sourceSymbol: sourceSymbol ?? this.getInitCurrencyInfo(el),
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

    setHourlyRate(element: HTMLElement): void {}
}

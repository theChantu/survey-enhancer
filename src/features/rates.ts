import store from "../store/store.ts";
import {
    CONVERSION_RATES_FETCH_INTERVAL_MS,
    MIN_AMOUNT_PER_HOUR,
    MAX_AMOUNT_PER_HOUR,
} from "../constants.ts";
import BaseEnhancement from "./BaseEnhancement.ts";
import { defaultSiteSettings } from "../store/defaults.ts";

import type { SiteSettings } from "../lib/types.ts";

type ConversionRates = SiteSettings["conversionRates"];

async function fetchRates() {
    const { timestamp, ...conversionRates } = structuredClone(
        defaultSiteSettings.conversionRates,
    );
    const currencies = Object.keys(
        conversionRates,
    ) as (keyof typeof conversionRates)[];
    const responses = await Promise.all(
        currencies.map(async (currency) => {
            try {
                const res = await fetch(
                    `https://open.er-api.com/v6/latest/${currency}`,
                );
                const data = await res.json();
                return { currency, data };
            } catch {
                return null;
            }
        }),
    );
    for (const resp of responses) {
        if (!resp) continue;
        const { currency, data } = resp;
        for (const c of currencies) {
            if (c === currency) continue;
            conversionRates[currency].rates[c] = data.rates[c];
        }
    }

    return conversionRates as ConversionRates;
}

async function updateRates() {
    const { conversionRates } = await store.get(["conversionRates"]);

    const now = Date.now();
    if (now - conversionRates.timestamp < CONVERSION_RATES_FETCH_INTERVAL_MS)
        return;

    const newConversionRates = await fetchRates();
    newConversionRates.timestamp = now;

    await store.set({
        conversionRates: newConversionRates,
    });
}

function extractHourlyRate(text: string) {
    const m = text.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : NaN;
}

function rateToColor(rate: number, min = 7, max = 15) {
    const clamped = Math.min(Math.max(rate, min), max);

    const logMin = Math.log(min);
    const logMax = Math.log(max);
    const logRate = Math.log(clamped);

    const ratio = (logRate - logMin) / (logMax - logMin);
    const bias = Math.pow(ratio, 0.6); // Adjust bias for better color distribution

    const r = Math.round(255 * (1 - bias));
    const g = Math.round(255 * bias);

    return `rgba(${r}, ${g}, 0, 0.63)`;
}

function extractSymbol(text: string) {
    const m = text.match(/[£$€]/);
    return m ? m[0] : null;
}

function getSymbol(currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value;
}

class ConvertCurrencyEnhancement extends BaseEnhancement {
    async apply() {
        const elements = this.adapter.getRewardElements();
        const { selectedCurrency, conversionRates } = await store.get([
            "selectedCurrency",
            "conversionRates",
        ]);

        const selectedSymbol = getSymbol(selectedCurrency);
        const rate =
            selectedCurrency === "USD"
                ? conversionRates.GBP.rates.USD
                : conversionRates.USD.rates.GBP;

        for (const element of elements) {
            let sourceText = element.getAttribute("data-original-text");

            if (!sourceText) {
                element.setAttribute(
                    "data-original-text",
                    element.textContent || "",
                );
                sourceText = element.textContent || "";
                const sourceSymbol = this.adapter.getInitCurrencyInfo(element);

                element.classList.add(`source-${sourceSymbol}`);
                // TODO: Replace classes with attributes for easier access
                element.setAttribute("source", sourceSymbol ?? "");
            }

            const { sourceSymbol, displaySymbol } =
                this.adapter.getCurrencyInfo(element);

            if (sourceSymbol === selectedSymbol) {
                // Selected symbol matches source, so revert element text
                if (element.textContent !== sourceText) {
                    element.textContent = sourceText;
                }

                this.updateDisplay(element, `display-${sourceSymbol}`);
                continue;
            }

            this.updateDisplay(element, `display-${selectedSymbol}`);

            // Continue if currency is already converted
            if (displaySymbol === selectedSymbol) continue;

            const elementRate = extractHourlyRate(sourceText);
            const converted = `${selectedSymbol}${(elementRate * rate).toFixed(2)}`;

            element.textContent = sourceText.replace(
                /[$£€]?\s*\d+(?:\.\d+)?/,
                converted,
            );
        }
    }

    private updateDisplay(element: HTMLElement, display: string) {
        const previousClassName = Array.from(element.classList).find(
            (className) => className.startsWith("display-"),
        );
        if (previousClassName) {
            element.classList.remove(previousClassName);
        }
        element.classList.add(display);
    }

    async revert() {
        document.querySelectorAll("[data-original-text]").forEach((el) => {
            el.textContent = el.getAttribute("data-original-text") || "";
            el.removeAttribute("data-original-text");

            const displayClass = Array.from(el.classList).find((className) =>
                className.startsWith("display-"),
            );
            const sourceClass = Array.from(el.classList).find((className) =>
                className.startsWith("source-"),
            );

            if (displayClass) el.classList.remove(displayClass);
            if (sourceClass) el.classList.remove(sourceClass);
        });
    }
}

class HighlightRatesEnhancement extends BaseEnhancement {
    async apply() {
        const elements = this.adapter.getHourlyRateElements();
        for (const element of elements) {
            // Check if the element should be ignored
            if (element.classList.contains("pe-rate-highlight")) {
                continue;
            }

            const rate = extractHourlyRate(element.textContent);
            const { displaySymbol, sourceSymbol } =
                this.adapter.getCurrencyInfo(element);
            if (isNaN(rate)) return;

            const { conversionRates } = await store.get(["conversionRates"]);

            // TODO: Always convert to USD before highlighting to get proper color coding
            // This will help when multiple currencies are supported
            // Can fetch conversion rate if needed

            const min =
                displaySymbol === "$"
                    ? MIN_AMOUNT_PER_HOUR
                    : MIN_AMOUNT_PER_HOUR * conversionRates.USD.rates.GBP;
            const max =
                displaySymbol === "$"
                    ? MAX_AMOUNT_PER_HOUR
                    : MAX_AMOUNT_PER_HOUR * conversionRates.USD.rates.GBP;

            element.style.backgroundColor = rateToColor(rate, min, max);

            if (!element.classList.contains("pe-rate-highlight"))
                element.classList.add("pe-rate-highlight");
        }
    }
    async revert() {
        const elements =
            document.querySelectorAll<HTMLElement>(".pe-rate-highlight");
        for (const el of elements) {
            if (!el) continue;
            el.style.backgroundColor = "";
            el.classList.remove("pe-rate-highlight");
        }
    }
}

const highlightRatesEnhancement = new HighlightRatesEnhancement();
const convertCurrencyEnhancement = new ConvertCurrencyEnhancement();

export { updateRates, convertCurrencyEnhancement, highlightRatesEnhancement };

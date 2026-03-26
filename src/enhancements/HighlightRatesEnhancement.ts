import BaseEnhancement from "./BaseEnhancement";
import store from "@/store/store";
import { MIN_AMOUNT_PER_HOUR, MAX_AMOUNT_PER_HOUR } from "@/constants";
import extractHourlyRate from "@/lib/extractHourlyRate";
import { getCurrency } from "@/lib/utils";

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

class HighlightRatesEnhancement extends BaseEnhancement {
    async apply() {
        const { conversionRates } = await store.get(this.adapter.config.name, [
            "conversionRates",
        ]);

        const elements = this.adapter.getHourlyRateElements();
        for (const element of elements) {
            // Check if the element should be ignored
            if (element.classList.contains("se-rate-highlight")) {
                continue;
            }

            const originalText =
                element.getAttribute("data-original-text") ??
                element.textContent;
            const originalSymbol = element.getAttribute(
                "data-original-currency",
            );

            const rate = extractHourlyRate(originalText);
            if (isNaN(rate) || !originalSymbol) return;

            const originalCurrency = getCurrency(originalSymbol);
            if (!originalCurrency) continue;

            const currencyToUsd = conversionRates[originalCurrency].rates.USD;

            element.style.backgroundColor = rateToColor(
                rate * currencyToUsd,
                MIN_AMOUNT_PER_HOUR,
                MAX_AMOUNT_PER_HOUR,
            );

            if (!element.classList.contains("se-rate-highlight"))
                element.classList.add("se-rate-highlight");
        }
    }
    async revert() {
        const elements =
            document.querySelectorAll<HTMLElement>(".se-rate-highlight");
        for (const el of elements) {
            if (!el) continue;
            el.style.backgroundColor = "";
            el.classList.remove("se-rate-highlight");
        }
    }
}

const highlightRatesEnhancement = new HighlightRatesEnhancement();
export { highlightRatesEnhancement };

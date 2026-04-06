import BaseEnhancement from "./BaseEnhancement";
import { MIN_AMOUNT_PER_HOUR, MAX_AMOUNT_PER_HOUR } from "@/constants";
import extractNumericValue from "@/lib/extractNumericValue";
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
        const { conversionRates } = this.settings;

        const rateElements = this.adapter.getHourlyRateElements();
        for (const rateEl of rateElements) {
            // Check if the element should be ignored
            if (rateEl.classList.contains("se-rate-highlight")) {
                continue;
            }

            const { originalText, originalSymbol } =
                this.adapter.getRewardState(rateEl);

            const rate = extractNumericValue(originalText);
            if (isNaN(rate) || !originalSymbol) continue;

            const originalCurrency = getCurrency(originalSymbol);
            if (!originalCurrency) continue;

            const currencyToUsd = conversionRates[originalCurrency].rates.USD;

            rateEl.style.backgroundColor = rateToColor(
                rate * currencyToUsd,
                MIN_AMOUNT_PER_HOUR,
                MAX_AMOUNT_PER_HOUR,
            );

            if (!rateEl.classList.contains("se-rate-highlight"))
                rateEl.classList.add("se-rate-highlight");
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

export { HighlightRatesEnhancement };

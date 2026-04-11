import BaseEnhancement from "./BaseEnhancement";
import { MIN_AMOUNT_PER_HOUR, MAX_AMOUNT_PER_HOUR } from "@/constants";
import extractNumericValue from "@/lib/extractNumericValue";
import { getCurrency, rateToColor } from "@/lib/utils";
import { ensureConversionRates } from "@/lib/ensureConversionRates";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import { HIGHLIGHT_BASE_CURRENCY } from "@/constants";

import type { Currency } from "@/store/types";

class HighlightRatesEnhancement extends BaseEnhancement {
    async apply() {
        const { conversionRates } = this.settings;

        const rateElements = this.adapter.getHourlyRateElements();
        const sourceCurrencies = new Set<Currency>();

        for (const rateEl of rateElements) {
            const { originalSymbol } = this.adapter.getRewardState(rateEl);
            if (!originalSymbol) continue;

            const currency = getCurrency(originalSymbol);
            if (currency && currency !== HIGHLIGHT_BASE_CURRENCY) {
                sourceCurrencies.add(currency);
            }
        }

        const { conversionRates: updatedConversionRates, updated } =
            await ensureConversionRates(conversionRates, [...sourceCurrencies]);

        if (updated) {
            await sendExtensionMessage({
                type: "store-patch",
                data: {
                    namespace: "globals",
                    data: {
                        conversionRates: updatedConversionRates,
                    },
                },
            });
        }

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

            const currencyToUsd =
                updatedConversionRates[originalCurrency].rates.USD;

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

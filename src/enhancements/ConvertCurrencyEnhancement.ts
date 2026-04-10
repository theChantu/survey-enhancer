import { ensureConversionRates } from "@/lib/ensureConversionRates";
import { getCurrencySymbol, getCurrency } from "@/lib/utils";
import BaseEnhancement from "./BaseEnhancement";
import extractNumericValue from "@/lib/extractNumericValue";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

import type { Currency, GlobalSettings } from "../store/types";

class ConvertCurrencyEnhancement extends BaseEnhancement {
    async apply() {
        const { currency, conversionRates } = this.settings;

        const rewardElements = this.adapter.getRewardElements();
        const selectedSymbol = getCurrencySymbol(currency.target);

        // Update conversion rates for all source currencies found in the elements.
        const sourceCurrencies = new Set<Currency>();
        for (const rewardEl of rewardElements) {
            const { originalSymbol } = this.adapter.getRewardState(rewardEl);

            if (!originalSymbol) continue;
            const currency = getCurrency(originalSymbol);
            if (currency) sourceCurrencies.add(currency);
        }

        const { conversionRates: updatedConversionRates, updated } =
            await ensureConversionRates(conversionRates, [
                currency.target,
                ...sourceCurrencies,
            ]);

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

        for (const rewardEl of rewardElements) {
            const {
                originalHtml,
                originalText,
                displaySymbol,
                originalSymbol,
            } = this.adapter.getRewardState(rewardEl);

            if (!originalText || !originalHtml || !originalSymbol) continue;

            const sourceCurrency = getCurrency(originalSymbol);
            if (!sourceCurrency) continue;

            if (sourceCurrency === currency.target) {
                // Selected currency matches source, so revert element text.
                if (rewardEl.innerHTML !== originalHtml) {
                    this.adapter.restoreRewardState(rewardEl);
                }

                continue;
            }

            // Continue if currency is already converted.
            if (displaySymbol === selectedSymbol) continue;

            this.adapter.setRewardState(rewardEl, {
                displaySymbol: selectedSymbol,
            });

            const rate =
                updatedConversionRates[sourceCurrency].rates[currency.target];
            const elementRate = extractNumericValue(originalText);
            const converted = `${selectedSymbol}${(elementRate * rate).toFixed(2)}`;

            this.adapter.setRewardText(rewardEl, converted);
        }
    }

    async revert() {
        document
            .querySelectorAll<HTMLElement>("[data-original-html]")
            .forEach((el) => {
                this.adapter.restoreRewardState(el);
            });
    }
}

export { ConvertCurrencyEnhancement };

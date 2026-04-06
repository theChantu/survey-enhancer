import { CONVERSION_RATES_FETCH_INTERVAL_MS } from "../constants";
import BaseEnhancement from "./BaseEnhancement";
import extractNumericValue from "@/lib/extractNumericValue";
import { getCurrency } from "@/lib/utils";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import {
    currencyKeysSet,
    type Currency,
    type ExchangeRatesResponse,
    GlobalSettings,
} from "../store/types";

type ConversionRates = GlobalSettings["conversionRates"];
function isExchangeRatesResponse(
    value: unknown,
): value is ExchangeRatesResponse {
    if (!value || typeof value !== "object") return false;

    const data = value as Record<string, unknown>;

    if (data.result !== "success" && data.result !== "error") return false;
    if (typeof data.base_code !== "string") return false;
    if (!currencyKeysSet.has(data.base_code as Currency)) return false;

    if (!data.rates || typeof data.rates !== "object") return false;

    const rates = data.rates as Record<string, unknown>;

    for (const code of currencyKeysSet) {
        if (typeof rates[code] !== "number") {
            return false;
        }
    }

    return true;
}

async function fetchRates(
    conversionRates: ConversionRates,
    currency: Currency,
) {
    const clonedConversionRates = structuredClone(conversionRates);

    try {
        const data = await sendExtensionMessage({
            type: "fetch",
            data: { url: `https://open.er-api.com/v6/latest/${currency}` },
        });
        if (!isExchangeRatesResponse(data)) {
            throw new Error("Invalid exchange rates response");
        }

        const { base_code, rates } = data;

        for (const [k, v] of Object.entries(rates) as [Currency, number][]) {
            clonedConversionRates[base_code].rates[k] = v;
        }
    } catch (error) {
        console.error(error);
    }

    return clonedConversionRates as ConversionRates;
}

function getSymbol(currency: Currency) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value;
}

class ConvertCurrencyEnhancement extends BaseEnhancement {
    async apply() {
        const { currencyConversion, conversionRates } = this.settings;
        const { selectedCurrency } = currencyConversion;

        const rewardElements = this.adapter.getRewardElements();
        const selectedSymbol = getSymbol(selectedCurrency);

        // Update conversion rates for all source currencies found in the elements
        const sourceCurrencies = new Set<Currency>();
        for (const rewardEl of rewardElements) {
            const { originalSymbol } = this.adapter.getRewardState(rewardEl);

            if (!originalSymbol) continue;
            const currency = getCurrency(originalSymbol);
            if (currency) sourceCurrencies.add(currency);
        }

        const updatedConversionRates = await this.updateRates(conversionRates, [
            selectedCurrency,
            ...sourceCurrencies,
        ]);

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

            if (sourceCurrency === selectedCurrency) {
                // Selected currency matches source, so revert element text
                if (rewardEl.innerHTML !== originalHtml) {
                    this.adapter.restoreRewardState(rewardEl);
                }

                continue;
            }

            // Continue if currency is already converted
            if (displaySymbol === selectedSymbol) continue;

            this.adapter.setRewardState(rewardEl, {
                displaySymbol: selectedSymbol,
            });

            const rate =
                updatedConversionRates[sourceCurrency].rates[selectedCurrency];
            const elementRate = extractNumericValue(originalText);
            const converted = `${selectedSymbol}${(elementRate * rate).toFixed(2)}`;

            this.adapter.setRewardText(rewardEl, converted);
        }
    }

    private async updateRates(
        conversionRates: ConversionRates,
        currencies: Currency[],
    ) {
        const now = Date.now();
        let updated = false;
        let rates = conversionRates;

        for (const currency of new Set(currencies)) {
            if (
                now - rates[currency].timestamp <
                CONVERSION_RATES_FETCH_INTERVAL_MS
            )
                continue;

            rates = await fetchRates(rates, currency);
            rates[currency].timestamp = now;
            updated = true;
        }

        if (updated) {
            await sendExtensionMessage({
                type: "store-patch",
                data: {
                    namespace: "globals",
                    data: {
                        conversionRates: rates,
                    },
                },
            });
        }

        return rates;
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

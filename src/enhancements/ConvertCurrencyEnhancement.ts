import store from "../store/store";
import { CONVERSION_RATES_FETCH_INTERVAL_MS } from "../constants";
import BaseEnhancement from "./BaseEnhancement";
import extractHourlyRate from "@/lib/extractHourlyRate";
import { getCurrency } from "@/lib/utils";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import {
    currencyKeysSet,
    type SiteSettings,
    type Currency,
    type ExchangeRatesResponse,
} from "../store/types";

type ConversionRates = SiteSettings["conversionRates"];
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
        const { selectedCurrency, conversionRates } = await store.get(
            this.adapter.config.name,
            ["selectedCurrency", "conversionRates"],
        );

        const elements = this.adapter.getRewardElements();
        const selectedSymbol = getSymbol(selectedCurrency);

        // Update conversion rates for all source currencies found in the elements
        const sourceCurrencies = new Set<Currency>();
        for (const element of elements) {
            const sourceSymbol = element.getAttribute("data-original-currency");
            if (!sourceSymbol) continue;
            const currency = getCurrency(sourceSymbol);
            if (currency) sourceCurrencies.add(currency);
        }

        const updatedConversionRates = await this.updateRates(conversionRates, [
            selectedCurrency,
            ...sourceCurrencies,
        ]);

        for (const element of elements) {
            const sourceText = element.getAttribute("data-original-text");
            const sourceHtml = element.getAttribute("data-original-html");
            const sourceSymbol = element.getAttribute("data-original-currency");

            if (!sourceText || !sourceHtml || !sourceSymbol) continue;

            if (sourceSymbol === selectedSymbol) {
                // Selected symbol matches source, so revert element text
                if (element.innerHTML !== sourceHtml) {
                    element.innerHTML = sourceHtml;
                }

                element.setAttribute("display", sourceSymbol);
                continue;
            }

            const { displaySymbol } = this.adapter.getCurrencyInfo(element);
            element.setAttribute("display", selectedSymbol ?? "");

            // Continue if currency is already converted
            if (displaySymbol === selectedSymbol) continue;

            const sourceCurrency = getCurrency(sourceSymbol);
            if (!sourceCurrency) continue;

            const rate =
                updatedConversionRates[sourceCurrency].rates[selectedCurrency];
            const elementRate = extractHourlyRate(sourceText);
            const converted = `${selectedSymbol}${(elementRate * rate).toFixed(2)}`;

            element.textContent = sourceText.replace(
                /[$£€]?\s*\d+(?:\.\d+)?/,
                converted,
            );
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
            await store.set(this.adapter.config.name, {
                conversionRates: rates,
            });
        }

        return rates;
    }

    async revert() {
        document.querySelectorAll("[data-original-html]").forEach((el) => {
            el.innerHTML = el.getAttribute("data-original-html") || "";
            el.removeAttribute("display");
        });
    }
}

const convertCurrencyEnhancement = new ConvertCurrencyEnhancement();

export { convertCurrencyEnhancement };

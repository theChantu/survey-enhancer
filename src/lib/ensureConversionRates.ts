import { CONVERSION_RATES_FETCH_INTERVAL_MS } from "@/constants";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

import type {
    Currency,
    ExchangeRatesResponse,
    GlobalSettings,
} from "@/store/types";
import { currencyKeysSet } from "@/store/types";

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
): Promise<{ conversionRates: ConversionRates; success: boolean }> {
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

        for (const [key, value] of Object.entries(rates) as [Currency, number][]) {
            clonedConversionRates[base_code].rates[key] = value;
        }

        return { conversionRates: clonedConversionRates, success: true };
    } catch (error) {
        console.error(error);
        return { conversionRates, success: false };
    }
}

export async function ensureConversionRates(
    conversionRates: ConversionRates,
    currencies: Currency[],
): Promise<{ conversionRates: ConversionRates; updated: boolean }> {
    const now = Date.now();
    let updated = false;
    let rates = conversionRates;

    for (const currency of new Set(currencies)) {
        if (
            now - rates[currency].timestamp < CONVERSION_RATES_FETCH_INTERVAL_MS
        ) {
            continue;
        }

        const result = await fetchRates(rates, currency);
        if (!result.success) {
            continue;
        }

        rates = result.conversionRates;
        rates[currency].timestamp = now;
        updated = true;
    }

    return { conversionRates: rates, updated };
}

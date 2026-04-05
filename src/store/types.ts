import { ProviderConfigMap } from "@/providers/providers";

type Enhancement = {
    apply(): void;
    revert(): void;
};

interface CurrencyConversionSettings {
    conversionRates: Record<
        Currency,
        { timestamp: number; rates: Record<Currency, number> }
    >;
    selectedCurrency: Currency;
}

interface HighlightRatesSettings {}

interface SurveyLinksSettings {}

type researcherName = string;

interface NewSurveyNotificationsSettings {
    surveys: Record<string, ReturnType<typeof Date.now>>;
    cachedResearchers: Record<researcherName, ReturnType<typeof Date.now>>;
    excludedResearchers: researcherName[];
    includedResearchers: researcherName[];
}

interface Analytics {
    analytics: {
        totalSurveyCompletions: number;
        dailySurveyCompletions: {
            timestamp: ReturnType<typeof Date.now>;
            urls: string[];
        };
    };
}

interface ReloadSettings {
    autoReload: {
        enabled: boolean;
        minInterval: number;
        maxInterval: number;
    };
}

type EnhancementSetting<T> = { enabled: boolean } & T;

export interface EnhancementSettings {
    newSurveyNotifications: EnhancementSetting<NewSurveyNotificationsSettings>;
    currencyConversion: EnhancementSetting<CurrencyConversionSettings>;
    highlightRates: EnhancementSetting<HighlightRatesSettings>;
    surveyLinks: EnhancementSetting<SurveyLinksSettings>;
}

type SiteSettings = EnhancementSettings & ReloadSettings & Analytics;

interface GlobalSettings {
    enableDebug: boolean;
    idleThreshold: number;
    providers: Partial<ProviderConfigMap>;
}

type Settings = SiteSettings & GlobalSettings;

// prettier-ignore
export const currencyKeys = ["USD", "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLF", "CLP", "CNH", "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "FOK", "GBP", "GEL", "GGP", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "IMP", "INR", "IQD", "IRR", "ISK", "JEP", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KID", "KMF", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TVD", "TWD", "TZS", "UAH", "UGX", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XDR", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWG", "ZWL"] as const;

export const currencyKeysSet = new Set<Currency>(currencyKeys);

export type Currency = (typeof currencyKeys)[number];

export interface ExchangeRatesResponse {
    result: "success" | "error";
    time_last_update_unix: number;
    time_last_update_utc: string;
    time_next_update_unix: number;
    time_next_update_utc: string;
    time_eol_unix: number;
    base_code: Currency;
    rates: Partial<Record<Currency, number>>;
}

export type {
    Enhancement,
    Settings,
    GlobalSettings,
    SiteSettings,
    NewSurveyNotificationsSettings,
};

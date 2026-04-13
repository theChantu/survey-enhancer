import type { ProviderConfigMap } from "@/providers/providers";

export type Enhancement = {
    apply(): void;
    revert(): void;
};

export const studySortOptions = [
    "first-seen",
    "last-seen",
    "highest-reward",
    "lowest-reward",
    "highest-hourly-rate",
    "lowest-hourly-rate",
    "quickest",
    "longest",
    "page-order",
] as const;

export type StudySort = (typeof studySortOptions)[number];

export type NotificationSound = "alert" | "bloop" | "chime";

type Date = ReturnType<typeof Date.now>;

interface StudyAlerts {
    studyAlerts: {
        cache: {
            studies: Record<string, number>;
            researchers: Record<string, number>;
        };
        enabled: boolean;
        included: string[];
        excluded: string[];
    };
}

interface Analytics {
    analytics: {
        totalStudyCompletions: number;
        bestDailyStudyCompletions: number;
        previousDailyStudyCompletions: number;
        dailyStudyCompletions: {
            timestamp: Date;
            count: number;
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

type SharedEnhancementSettings<T> = { enabled: boolean } & T;

export type SiteSettings = StudyAlerts & ReloadSettings & Analytics;

export interface EnhancementSettings {
    notifications: Omit<
        SharedEnhancementSettings<{
            delivery: {
                browser: boolean;
                sound: {
                    enabled: boolean;
                    type: NotificationSound;
                    volume: number;
                };
            };
        }>,
        "enabled"
    >;
    currency: SharedEnhancementSettings<{
        target: Currency;
    }>;
    highlightRates: SharedEnhancementSettings<{}>;
}

export interface GlobalSettings extends EnhancementSettings {
    conversionRates: Record<
        Currency,
        { timestamp: number; rates: Record<Currency, number> }
    >;
    debug: {
        enabled: boolean;
    };
    idleThreshold: number;
    lastPopupOpenedAt: number;
    providers: Partial<ProviderConfigMap>;
    studySort: StudySort;
}

export type Settings = SiteSettings & GlobalSettings;

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

export type DeepPartial<T> = T extends readonly (infer U)[]
    ? readonly U[]
    : T extends (infer U)[]
      ? U[]
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

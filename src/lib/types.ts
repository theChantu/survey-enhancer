type Enhancement = {
    apply(): void;
    revert(): void;
};

type Currencies = "USD" | "GBP";

// TODO: Implement global settings
// e.g., global: { conversionRates: {} }

// TODO: Each site will have its unique namespace
// e.g., prolific: { enableCurrencyConversion: true }, cloudresearch: { enableCurrencyConversion: false }
// namespace key will be set to siteName from the adapter

type SiteSettings = {
    conversionRates: {
        timestamp: number;
        USD: { rates: Record<Currencies, number> };
        GBP: { rates: Record<Currencies, number> };
    };
    selectedCurrency: Currencies;
    enableCurrencyConversion: boolean;
    enableHighlightRates: boolean;
    enableSurveyLinks: boolean;
    enableNewSurveyNotifications: boolean;
    enableDebug: boolean;
    surveys: Record<string, ReturnType<typeof Date.now>>;
    ui: {
        initialized?: boolean;
        visible?: boolean;
        position?: { left: number; top: number };
    };
};

export type { Enhancement, SiteSettings, Currencies };

export type AdapterSettings = {
    enableInterval: boolean;
};

type CurrencyInfo = {
    displaySymbol: string | null;
    sourceSymbol: string | null;
};

export abstract class BaseAdapter {
    readonly settings: Readonly<AdapterSettings>;

    constructor(
        defaults: AdapterSettings,
        overrides: Partial<AdapterSettings> = {},
    ) {
        this.settings = { ...defaults, ...overrides };
    }

    abstract getSurveyElements(): NodeListOf<HTMLElement>;
    abstract getSurveyId(el: HTMLElement): string | null;
    abstract getSurveyContainer(el: HTMLElement): HTMLElement | null;
    abstract getStudyTitle(el: HTMLElement): HTMLElement | null;

    abstract getRewardElements(): HTMLElement[];
    abstract getRewardElement(el: HTMLElement): HTMLElement | null;
    abstract getHourlyRateElements(): HTMLElement[];
    // abstract getHourlyRateElement(el: HTMLElement): HTMLElement | null;
    abstract setHourlyRate(el: HTMLElement): void;

    abstract getInitCurrencyInfo(el: HTMLElement): string | null;
    abstract getCurrencyInfo(el: HTMLElement): CurrencyInfo;

    // abstract setCurrencySymbol(): void;
    // abstract setSourceCurrencySymbol(): void;

    // abstract prepareNextScan?(): Promise<void>;
    // TODO: Used to add to survey URL
    // For instance, cloud research, show 100 surveys, "https://connect.cloudresearch.com/participant/dashboard" + "?page=1&size=100"
    // abstract overrideUrl(url: string): string;
}

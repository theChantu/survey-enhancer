import { getDomainWithoutSuffix } from "tldts";
import { joinURL } from "ufo";

type UrlSettings = {
    host: string;
    path: string;
    suffix?: string;
    query?: Record<string, string | number | boolean>;
};

export type AdapterSettings = {
    enableAutoReload: boolean;
};

type CurrencyInfo = {
    displaySymbol: string | null;
    sourceSymbol: string | null;
};

export abstract class BaseAdapter {
    readonly url: Readonly<UrlSettings>;
    readonly siteName: string;
    readonly settings: Readonly<AdapterSettings>;

    constructor(
        url: UrlSettings,
        defaults: AdapterSettings,
        overrides: Partial<AdapterSettings> = {},
    ) {
        this.url = url;
        this.siteName = getDomainWithoutSuffix(url.host) ?? url.host;
        this.settings = { ...defaults, ...overrides };
    }

    get origin(): string {
        return `https://${this.url.host}`;
    }

    buildUrl(segments: string[]) {
        return joinURL(this.origin, ...segments);
    }

    abstract getSurveyElements(): NodeListOf<HTMLElement>;
    abstract getSurveyId(el: HTMLElement): string | null;
    abstract getSurveyContainer(el: HTMLElement): HTMLElement | null;
    abstract getStudyTitle(el: HTMLElement): HTMLElement | null;

    abstract getRewardElements(): HTMLElement[];
    abstract getRewardElement(el: HTMLElement): HTMLElement | null;
    abstract getHourlyRateElements(): HTMLElement[];
    abstract getHourlyRateElement(el: HTMLElement): HTMLElement | null;
    abstract setHourlyRate(el: HTMLElement): void;

    abstract getInitCurrencyInfo(el: HTMLElement): string | null;
    abstract getCurrencyInfo(el: HTMLElement): CurrencyInfo;
}

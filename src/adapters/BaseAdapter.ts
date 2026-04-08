import { joinURL } from "ufo";
import debounce from "@/lib/debounce";
import { onExtensionMessage } from "@/messages/onExtensionMessage";

import type { SiteInfo, SupportedHosts, sites } from "./siteConfigs";
import { EnhancementKey } from "@/enhancements/enhancementConfigs";
import type { NetworkRequestEvent } from "@/events/network";
import type { AdapterEventMap, AdapterEventType } from "./events";

export type AdapterConfig<H extends SupportedHosts = SupportedHosts> =
    (typeof sites)[H] &
        SiteInfo & {
            host: H;
        };

export interface CurrencyInfo {}

export interface SurveyInfo {
    id: string;
    title: string | null;
    researcher: string | null;
    reward: string | null;
    rate: string | null;
    link: string | null;
    displaySymbol: string | null;
    originalSymbol: string | null;
}

interface RewardState {
    element: HTMLElement;
    originalText: string;
    originalHtml: string;
    displaySymbol: string | null;
    originalSymbol: string | null;
}

export const DataAttr = {
    ORIGINAL_TEXT: "data-original-text",
    ORIGINAL_HTML: "data-original-html",
    DISPLAY_SYMBOL: "data-display-symbol",
    ORIGINAL_SYMBOL: "data-original-symbol",
} as const;

export abstract class BaseAdapter<H extends SupportedHosts = SupportedHosts> {
    readonly config: Readonly<AdapterConfig<H>>;

    constructor(config: AdapterConfig<H>) {
        this.config = config;
    }

    private enhancements?: ReadonlySet<EnhancementKey>;

    hasModule(enhancements: EnhancementKey): boolean {
        this.enhancements ??= new Set(this.config.enhancements);
        return this.enhancements.has(enhancements);
    }

    get origin(): string {
        return `https://${this.config.host}`;
    }

    buildUrl(segments: string[]) {
        return joinURL(this.origin, ...segments);
    }

    get iconUrl(): string {
        return this.buildUrl([this.config.iconPath]);
    }

    protected queryText(el: HTMLElement, selector: string): string | null {
        return el.querySelector<HTMLElement>(selector)?.textContent ?? null;
    }

    prepareRewardElement(el: HTMLElement) {
        if (el.hasAttribute(DataAttr.ORIGINAL_TEXT)) return;
        el.setAttribute(DataAttr.ORIGINAL_TEXT, el.textContent ?? "");
        el.setAttribute(DataAttr.ORIGINAL_HTML, el.innerHTML);

        const sourceSymbol = this.getSourceSymbol(el);
        el.setAttribute(
            DataAttr.DISPLAY_SYMBOL,
            el.getAttribute(DataAttr.DISPLAY_SYMBOL) ?? sourceSymbol ?? "",
        );
        el.setAttribute(DataAttr.ORIGINAL_SYMBOL, sourceSymbol ?? "");
    }

    getRewardState(el: HTMLElement): RewardState {
        this.prepareRewardElement(el);
        return {
            element: el,
            originalText: el.getAttribute(DataAttr.ORIGINAL_TEXT) ?? "",
            originalHtml: el.getAttribute(DataAttr.ORIGINAL_HTML) ?? "",
            displaySymbol: el.getAttribute(DataAttr.DISPLAY_SYMBOL),
            originalSymbol: el.getAttribute(DataAttr.ORIGINAL_SYMBOL),
        };
    }

    setRewardState(
        el: HTMLElement,
        state: Partial<Omit<RewardState, "element">>,
    ) {
        this.prepareRewardElement(el);

        const attrMap = {
            originalText: DataAttr.ORIGINAL_TEXT,
            originalHtml: DataAttr.ORIGINAL_HTML,
            displaySymbol: DataAttr.DISPLAY_SYMBOL,
            originalSymbol: DataAttr.ORIGINAL_SYMBOL,
        } as const;

        for (const [key, attr] of Object.entries(attrMap) as [
            keyof typeof attrMap,
            string,
        ][]) {
            const value = state[key];
            if (value !== undefined) {
                el.setAttribute(attr, value ?? "");
            }
        }
    }

    restoreRewardState(el: HTMLElement) {
        const { originalHtml, originalSymbol } = this.getRewardState(el);
        el.innerHTML = originalHtml;
        this.setRewardState(el, {
            displaySymbol: originalSymbol,
        });
    }

    setRewardText(el: HTMLElement, text: string) {
        const { originalText } = this.getRewardState(el);
        el.textContent = originalText.replace(/[$£€]?\s*\d+(?:\.\d+)?/, text);
    }

    abstract getSurveyElements(): NodeListOf<HTMLElement>;
    abstract getSurveyContainer(el: HTMLElement): HTMLElement | null;
    abstract getSurveyTitle(el: HTMLElement): string | null;
    abstract getSurveyId(el: HTMLElement): string | null;
    abstract getSurveyResearcher(el: HTMLElement): string | null;

    abstract getRewardElements(): HTMLElement[];
    abstract getRewardElement(el: HTMLElement): HTMLElement | null;
    abstract getHourlyRateElements(): HTMLElement[];
    abstract getHourlyRateElement(el: HTMLElement): HTMLElement | null;

    abstract getSourceSymbol(el: HTMLElement): string | null;

    protected getSurveyLink(el: HTMLElement): string | null {
        const surveyId = this.getSurveyId(el);
        if (!surveyId) return null;

        const { surveyPath, suffix } = this.config;
        return this.buildUrl([
            surveyPath,
            surveyId,
            ...(suffix ? [suffix] : []),
        ]);
    }

    protected getSurveyReward(el: HTMLElement): string | null {
        const rewardEl = this.getRewardElement(el);
        if (!rewardEl) return null;
        const { originalText } = this.getRewardState(rewardEl);
        return originalText ?? rewardEl.textContent ?? null;
    }

    protected getSurveyHourlyRate(el: HTMLElement): string | null {
        const rateEl = this.getHourlyRateElement(el);
        if (!rateEl) return null;
        const { originalText } = this.getRewardState(rateEl);
        return originalText ?? rateEl.textContent ?? null;
    }

    extractSurvey(el: HTMLElement): SurveyInfo | null {
        const id = this.getSurveyId(el);
        if (!id) return null;

        const { displaySymbol, originalSymbol } = this.getRewardState(
            this.getRewardElement(el) ?? this.getHourlyRateElement(el) ?? el,
        );

        return {
            id,
            title: this.getSurveyTitle(el),
            researcher: this.getSurveyResearcher(el),
            reward: this.getSurveyReward(el),
            rate: this.getSurveyHourlyRate(el),
            link: this.getSurveyLink(el),
            displaySymbol,
            originalSymbol,
        };
    }

    extractSurveys(): SurveyInfo[] {
        const elements = this.getSurveyElements();
        const surveys: SurveyInfo[] = [];

        for (const el of elements) {
            const surveyInfo = this.extractSurvey(el);
            if (!surveyInfo) continue;

            surveys.push(surveyInfo);
        }

        return surveys;
    }

    protected handleDomMutation(mutations: MutationRecord[]) {}

    protected matchNetworkEvent(
        event: NetworkRequestEvent,
    ): AdapterEventType | null {
        for (const [eventType, pattern] of Object.entries(
            this.config.networkPatterns,
        ) as [AdapterEventType, string][]) {
            if (event.url.includes(pattern)) {
                return eventType;
            }
        }
        return null;
    }

    protected buildAdapterEvent<E extends AdapterEventType>(
        eventType: E,
        event: NetworkRequestEvent,
    ): AdapterEventMap[E] {
        switch (eventType) {
            case "surveyCompletion":
                return {
                    url: event.url,
                } as AdapterEventMap[E];
        }
    }

    protected handleNetworkEvent(event: NetworkRequestEvent) {}

    private listeners = new Map<
        AdapterEventType,
        Array<(data: AdapterEventMap[keyof AdapterEventMap]) => void>
    >();
    private observerConfig: MutationObserverInit = {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
    };
    private observer?: MutationObserver;
    private pendingMutations: MutationRecord[] = [];
    private resetMutations = debounce(() => {
        if (this.pendingMutations.length > 0) {
            this.observer?.disconnect();
            this.handleDomMutation(this.pendingMutations);
            this.pendingMutations = [];
            this.observer?.observe(document.body, this.observerConfig);
        }
    }, 100);

    on<E extends AdapterEventType>(
        event: E,
        callback: (data: AdapterEventMap[E]) => void,
    ) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners
            .get(event)
            ?.push(
                callback as (
                    data: AdapterEventMap[keyof AdapterEventMap],
                ) => void,
            );
    }

    emit<E extends AdapterEventType>(event: E, data: AdapterEventMap[E]): void {
        const callbacks = this.listeners.get(event) ?? [];
        for (const callback of callbacks) {
            callback(data);
        }
    }

    observeDom() {
        this.observer = new MutationObserver((mutations) => {
            this.pendingMutations.push(...mutations);
            this.resetMutations();
        });
        this.observer.observe(document.body, this.observerConfig);

        return () => this.observer?.disconnect();
    }

    observeNetwork() {
        const unsubscribe = onExtensionMessage("network", (payload) => {
            const matchedEvent = this.matchNetworkEvent(payload);
            if (matchedEvent) {
                this.emit(
                    matchedEvent,
                    this.buildAdapterEvent(matchedEvent, payload),
                );
            }

            this.handleNetworkEvent(payload);
        });

        return unsubscribe;
    }
}

import { joinURL } from "ufo";
import debounce from "@/lib/debounce";
import { onExtensionMessage } from "@/messages/onExtensionMessage";

import type { SiteInfo, SupportedSites, sites } from "./siteConfigs";
import { EnhancementKey } from "@/enhancements/enhancementConfigs";

export type AdapterConfig<H extends SupportedSites = SupportedSites> =
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

export interface EventResponseMap {
    surveyCompletion: NetworkEvent;
    newSurvey: NetworkEvent;
}

type EventType = keyof EventResponseMap;

type NetworkEvent = {
    url: string;
    method?: string;
    status?: number;
};

export abstract class BaseAdapter<H extends SupportedSites = SupportedSites> {
    readonly config: Readonly<AdapterConfig<H>>;

    constructor(config: AdapterConfig<H>) {
        this.config = config;
    }

    private _moduleSet?: ReadonlySet<EnhancementKey>;

    hasModule(module: EnhancementKey): boolean {
        this._moduleSet ??= new Set(this.config.modules);
        return this._moduleSet.has(module);
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

    protected matchNetworkEvent(event: NetworkEvent): EventType | null {
        for (const [eventType, pattern] of Object.entries(
            this.config.networkPatterns,
        ) as [EventType, string][]) {
            if (event.url.includes(pattern)) {
                return eventType;
            }
        }
        return null;
    }

    protected handleNetworkEvent(event: NetworkEvent) {}

    private listeners = new Map<EventType, Array<(data: any) => void>>();
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

    on<E extends EventType>(
        event: E,
        callback: (data: EventResponseMap[E]) => void,
    ) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }

    emit<E extends EventType>(event: E, data: EventResponseMap[E]): void {
        const callbacks = this.listeners.get(event) ?? [];
        for (const callback of callbacks) {
            callback(data);
        }
    }

    // TODO: Replace current mutation observer implementation in content script with the adapter observeDom method
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
            this.handleNetworkEvent({
                url: payload.url,
                method: payload.method,
                status: payload.statusCode,
            });
        });

        return unsubscribe;
    }
}

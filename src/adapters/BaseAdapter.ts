import { joinURL } from "ufo";
import debounce from "@/lib/debounce";
import { onExtensionMessage } from "@/messages/onExtensionMessage";

import type { ModuleName } from "./modules/BaseModule";
import type { SupportedSites, sites } from "./sites";

export type UrlSettings<H extends SupportedSites = SupportedSites> =
    (typeof sites)[H] & {
        host: H;
        suffix?: string;
        query?: Record<string, string | number | boolean>;
    };

// TODO: Allow AdapterSettings to inherit these settings based on whatever Module is extended
// e.g., CurrencyConversion would pass enableCurrencyConversion
// enableCurrencyConversion: boolean;
// enableHighlightRates: boolean;
// enableSurveyLinks: boolean;
// enableNewSurveyNotifications: boolean;

type CurrencyInfo = {
    displaySymbol: string | null;
    sourceSymbol: string | null;
};

interface EventResponseMap {
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
    readonly url: Readonly<UrlSettings<H>>;
    abstract readonly modules: readonly ModuleName[];

    constructor(url: UrlSettings<H>) {
        this.url = url;
    }

    private _moduleSet?: ReadonlySet<ModuleName>;

    hasModule(module: ModuleName): boolean {
        this._moduleSet ??= new Set(this.modules);
        return this._moduleSet.has(module);
    }

    get origin(): string {
        return `https://${this.url.host}`;
    }

    buildUrl(segments: string[]) {
        return joinURL(this.origin, ...segments);
    }

    get iconUrl(): string {
        return this.buildUrl([this.url.iconPath]);
    }

    protected queryText(el: HTMLElement, selector: string): string | null {
        return el.querySelector<HTMLElement>(selector)?.textContent ?? null;
    }

    abstract getSurveyElements(): NodeListOf<HTMLElement>;
    abstract getSurveyContainer(el: HTMLElement): HTMLElement | null;
    abstract getSurveyTitle(el: HTMLElement): string | null;
    abstract getSurveyId(el: HTMLElement): string | null;
    abstract getSurveyResearcher(el: HTMLElement): string | null;

    abstract getInitCurrencyInfo(el: HTMLElement): string | null;
    abstract getCurrencyInfo(el: HTMLElement): CurrencyInfo;

    abstract getRewardElements(): HTMLElement[];
    abstract getHourlyRateElements(): HTMLElement[];

    abstract setHourlyRate(element: HTMLElement): void;

    prepareElements() {
        const elements = this.getRewardElements();
        for (const el of elements) {
            if (el.hasAttribute("data-original-text")) continue;
            el.setAttribute("data-original-text", el.textContent ?? "");
            el.setAttribute("data-original-html", el.innerHTML);
            el.setAttribute(
                "data-original-currency",
                this.getInitCurrencyInfo(el) ?? "",
            );
        }
    }

    protected networkPatterns: Partial<Record<EventType, string>> = {};

    protected handleDomMutation(mutations: MutationRecord[]) {}

    protected matchNetworkEvent(event: NetworkEvent): EventType | null {
        for (const [eventType, pattern] of Object.entries(
            this.networkPatterns,
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

    observeDom() {
        this.observer = new MutationObserver((mutations) => {
            this.pendingMutations.push(...mutations);
            this.resetMutations();
        });
        this.observer.observe(document.body, this.observerConfig);

        return () => this.observer?.disconnect();
    }

    observeNetwork() {
        const unsubscribe = onExtensionMessage("network-event", (payload) => {
            this.handleNetworkEvent({
                url: payload.url,
                method: payload.method,
                status: payload.statusCode,
            });
        });

        return unsubscribe;
    }
}

import { joinURL } from "ufo";
import debounce from "@/lib/debounce";
import { parseNumericValue } from "@/lib/parse/parseNumericValue";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { EnhancementKey } from "@/enhancements/enhancementConfigs";
import {
    type StudyDevice,
    type StudyPeripheral,
    DEVICE_PATTERNS,
    PERIPHERAL_PATTERNS,
    matchCapabilities,
} from "./capabilities";
import { parseDurationSeconds } from "@/lib/parse/parseDurationSeconds";

import type {
    SiteFeature,
    SiteInfo,
    SupportedHosts,
    sites,
} from "./siteConfigs";
import type { NetworkRequestEvent } from "@/events/network";
import type {
    AdapterEventMap,
    AdapterEventType,
    NetworkEventMatcher,
    NetworkRequestBodyMatcher,
} from "./events";

export type AdapterConfig<H extends SupportedHosts = SupportedHosts> =
    (typeof sites)[H] &
        SiteInfo & {
            host: H;
        };

export interface CurrencyInfo {}

export type OpportunityKind = "study" | "project";

export interface BaseOpportunityInfo {
    id: string;
    kind: OpportunityKind;
    title: string | null;
    link: string | null;
}

export interface StudyInfo extends BaseOpportunityInfo {
    kind: "study";
    researcher: string | null;
    reward: number | null;
    rate: number | null;
    symbol: string | null;
    devices: StudyDevice[];
    peripherals: StudyPeripheral[];
    averageCompletionMinutes: number | null;
    slots: number | null;
}

export interface ProjectInfo extends BaseOpportunityInfo {
    kind: "project";
    availableStudyCount: number | null;
}

export type OpportunityInfo = StudyInfo | ProjectInfo;

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

export type Source = "original" | "display";

function matchesRequestBody(
    matcher: NetworkRequestBodyMatcher | undefined,
    requestBody: unknown,
): boolean {
    if (!matcher) return true;
    if (
        typeof requestBody !== "object" ||
        requestBody === null ||
        Array.isArray(requestBody)
    ) {
        return false;
    }

    const actual = requestBody as Record<string, unknown>;

    if ("equals" in matcher) {
        return Object.entries(matcher.equals).every(([key, value]) =>
            Object.is(actual[key], value),
        );
    }

    return matcher.in.some((value) => Object.is(actual[matcher.field], value));
}

export abstract class BaseAdapter<H extends SupportedHosts = SupportedHosts> {
    readonly config: Readonly<AdapterConfig<H>>;

    constructor(config: AdapterConfig<H>) {
        this.config = config;
    }

    private enhancements?: ReadonlySet<EnhancementKey>;

    hasFeature(feature: SiteFeature): boolean {
        return this.config.features.includes(feature);
    }

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

    isListingsPage(): boolean {
        return window.location.pathname === this.config.studyPath;
    }

    protected getText(el: HTMLElement, selector?: string): string | null {
        const text = selector
            ? el.querySelector<HTMLElement>(selector)?.textContent
            : el.textContent;
        return text?.trim() ?? null;
    }

    collectHints(
        elements: Iterable<Element>,
        read: (el: Element) => string[],
    ): string[] {
        const hints = new Set<string>();

        for (const el of elements) {
            for (const hint of read(el)) {
                if (hint) hints.add(hint.trim());
            }
        }

        return [...hints];
    }

    protected getCapabilityHints(el: HTMLElement): string[] {
        return [];
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

    abstract getStudyElements(): NodeListOf<HTMLElement>;
    abstract getStudyContainer(el: HTMLElement): HTMLElement | null;
    abstract getStudyTitle(el: HTMLElement): string | null;
    abstract getStudyId(el: HTMLElement): string | null;
    abstract getStudyResearcher(el: HTMLElement): string | null;

    abstract getRewardElements(): HTMLElement[];
    abstract getRewardElement(el: HTMLElement): HTMLElement | null;
    abstract getHourlyRateElements(): HTMLElement[];
    abstract getHourlyRateElement(el: HTMLElement): HTMLElement | null;

    abstract getSourceSymbol(el: HTMLElement): string | null;

    protected getStudyLink(el: HTMLElement): string | null {
        const studyId = this.getStudyId(el);
        if (!studyId) return null;

        const { studyPath, suffix } = this.config;
        return this.buildUrl([studyPath, studyId, ...(suffix ? [suffix] : [])]);
    }

    private getRewardText(el: HTMLElement, source: Source): string | null {
        const { originalText } = this.getRewardState(el);

        return source === "original" ? originalText : el.textContent;
    }

    private getRewardSymbol(el: HTMLElement, source: Source): string | null {
        const { originalSymbol, displaySymbol } = this.getRewardState(el);

        return source === "original" ? originalSymbol : displaySymbol;
    }

    private getValue(el: HTMLElement, source: Source): number | null {
        const text = this.getRewardText(el, source);
        return text ? parseNumericValue(text) : null;
    }

    protected getStudyReward(el: HTMLElement, source: Source): number | null {
        const rewardEl = this.getRewardElement(el);
        if (!rewardEl) return null;

        return this.getValue(rewardEl, source);
    }

    protected getStudyHourlyRate(
        el: HTMLElement,
        source: Source,
    ): number | null {
        const rateEl = this.getHourlyRateElement(el);
        if (!rateEl) return null;

        return this.getValue(rateEl, source);
    }

    protected getStudyAverageCompletionText(el: HTMLElement): string | null {
        return null;
    }

    protected getStudyAverageCompletionMinutes(el: HTMLElement): number | null {
        const seconds = parseDurationSeconds(
            this.getStudyAverageCompletionText(el) ?? "",
        );
        return seconds !== null ? seconds / 60 : null;
    }

    protected getStudySlotsText(el: HTMLElement): string | null {
        return null;
    }

    protected getStudySlots(el: HTMLElement): number | null {
        const text = this.getStudySlotsText(el);
        return text ? parseNumericValue(text) : null;
    }

    extractStudy(
        el: HTMLElement,
        source: Source = "original",
    ): StudyInfo | null {
        const id = this.getStudyId(el);
        if (!id) return null;

        const rewardEl = this.getRewardElement(el);
        const rateEl = this.getHourlyRateElement(el);
        const symbolEl = rewardEl ?? rateEl ?? el;
        const capabilityHints = this.getCapabilityHints(el);

        return {
            id,
            kind: "study",
            title: this.getStudyTitle(el),
            researcher: this.getStudyResearcher(el),
            reward: rewardEl ? this.getValue(rewardEl, source) : null,
            rate: rateEl ? this.getValue(rateEl, source) : null,
            link: this.getStudyLink(el),
            symbol: this.getRewardSymbol(symbolEl, source),
            devices: matchCapabilities(capabilityHints, DEVICE_PATTERNS),
            peripherals: matchCapabilities(
                capabilityHints,
                PERIPHERAL_PATTERNS,
            ),
            averageCompletionMinutes: this.getStudyAverageCompletionMinutes(el),
            slots: this.getStudySlots(el),
        };
    }

    extractStudies(source: Source = "original"): StudyInfo[] {
        const elements = this.getStudyElements();
        const studies: StudyInfo[] = [];

        for (const el of elements) {
            const studyInfo = this.extractStudy(el, source);
            if (!studyInfo) continue;

            studies.push(studyInfo);
        }

        return studies;
    }

    extractOpportunities(source: Source = "original"): OpportunityInfo[] {
        return this.extractStudies(source);
    }

    protected handleDomMutation(mutations: MutationRecord[]) {}

    protected matchNetworkEvent(
        event: NetworkRequestEvent,
    ): AdapterEventType | null {
        for (const [eventType, matchers] of Object.entries(
            this.config.networkPatterns,
        ) as [AdapterEventType, NetworkEventMatcher[]][]) {
            const matched = matchers.some(
                (matcher) =>
                    event.url.includes(matcher.path) &&
                    (!matcher.method || event.method === matcher.method) &&
                    matchesRequestBody(matcher.requestBody, event.requestBody),
            );

            if (matched) {
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
            case "studyCompletion":
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

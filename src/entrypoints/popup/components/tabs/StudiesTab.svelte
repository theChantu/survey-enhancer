<script lang="ts">
    import { ChevronDown, ExternalLink, LoaderCircle } from "@lucide/svelte";
    import Analytics from "../Analytics.svelte";
    import StudyCard from "../StudyCard.svelte";
    import { sites, supportedHosts } from "@/adapters/siteConfigs";
    import { runtimeState, settingsState, uiState } from "../../state.svelte";
    import { queueMutation } from "../../popupModel.svelte";
    import { getCurrency, getCurrencySymbol } from "@/lib/currency/";
    import { ensureConversionRates } from "@/lib/currency/rates";
    import { capitalize, rateToColor } from "@/lib/utils";
    import {
        studySortOptions,
        type StudySort,
        type Currency,
        type GlobalSettings,
    } from "@/store/types";
    import { HIGHLIGHT_BASE_CURRENCY } from "@/constants";

    import type { StudyItem, StudiesTabModel } from "../../types";
    import type { StudyInfo } from "@/adapters/BaseAdapter";

    let { model }: { model: StudiesTabModel } = $props();

    type SortOption = {
        value: StudySort;
        label: string;
    };

    const options: SortOption[] = studySortOptions.map((value) => ({
        value,
        label: capitalize(value.replaceAll("-", " ")),
    }));

    function compareNullableNumbers(
        left: number | null,
        right: number | null,
        direction: "asc" | "desc",
    ): number {
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;

        return direction === "asc" ? left - right : right - left;
    }

    function sortStudies(items: StudyItem[], sort: StudySort): StudyItem[] {
        const sorted = [...items];

        const sorters: Record<
            StudySort,
            (left: StudyItem, right: StudyItem) => number
        > = {
            "first-seen": (left, right) => right.firstSeenAt - left.firstSeenAt,
            "last-seen": (left, right) => right.lastSeenAt - left.lastSeenAt,
            "highest-reward": (left, right) =>
                compareNullableNumbers(
                    left.normalizedReward,
                    right.normalizedReward,
                    "desc",
                ),
            "lowest-reward": (left, right) =>
                compareNullableNumbers(
                    left.normalizedReward,
                    right.normalizedReward,
                    "asc",
                ),
            "highest-hourly-rate": (left, right) =>
                compareNullableNumbers(
                    left.normalizedRate,
                    right.normalizedRate,
                    "desc",
                ),
            "lowest-hourly-rate": (left, right) =>
                compareNullableNumbers(
                    left.normalizedRate,
                    right.normalizedRate,
                    "asc",
                ),
            quickest: (left, right) =>
                compareNullableNumbers(
                    left.averageCompletionSeconds,
                    right.averageCompletionSeconds,
                    "asc",
                ),
            longest: (left, right) =>
                compareNullableNumbers(
                    left.averageCompletionSeconds,
                    right.averageCompletionSeconds,
                    "desc",
                ),
            "page-order": (left, right) => left.order - right.order,
        };

        return sorted.sort(sorters[sort] ?? sorters["page-order"]);
    }

    function convertStudyDisplayValues(
        study: StudyInfo,
    ): Pick<StudyInfo, "reward" | "rate" | "symbol"> {
        const fallback = {
            reward: study.reward,
            rate: study.rate,
            symbol: study.symbol,
        };

        if (!settingsState.globals.currency.enabled || !study.symbol) {
            return fallback;
        }

        const targetCurrency = settingsState.globals.currency.target;
        const sourceCurrency = getCurrency(study.symbol);
        if (!sourceCurrency) return fallback;

        const targetSymbol = getCurrencySymbol(targetCurrency) ?? study.symbol;
        if (sourceCurrency === targetCurrency) {
            return {
                reward: study.reward,
                rate: study.rate,
                symbol: targetSymbol,
            };
        }

        const sourceRates =
            settingsState.globals.conversionRates[sourceCurrency];
        if (!sourceRates || sourceRates.timestamp === 0) return fallback;

        const conversionRate = sourceRates.rates[targetCurrency];
        if (!conversionRate) return fallback;

        return {
            reward:
                study.reward === null ? null : study.reward * conversionRate,
            rate: study.rate === null ? null : study.rate * conversionRate,
            symbol: targetSymbol,
        };
    }

    function getNormalizedRateColor(
        rate: number | null,
        symbol: string | null,
    ): string | null {
        const normalizedRate = getNormalizedValue(
            rate,
            symbol,
            HIGHLIGHT_BASE_CURRENCY,
        );

        return normalizedRate === null ? null : rateToColor(normalizedRate);
    }

    function getNormalizedValue(
        value: number | null,
        symbol: string | null,
        targetCurrency: Currency,
    ): number | null {
        if (value === null || !symbol) return null;

        const sourceCurrency = getCurrency(symbol);
        if (!sourceCurrency) return null;
        if (sourceCurrency === targetCurrency) return value;

        const sourceRates =
            settingsState.globals.conversionRates[sourceCurrency];
        if (!sourceRates || sourceRates.timestamp === 0) return null;

        const conversionRate = sourceRates.rates[targetCurrency];
        return conversionRate ? value * conversionRate : null;
    }

    const runtimeCurrencies = $derived.by(() => {
        const currencies = new Set<Currency>();

        for (const host of supportedHosts) {
            const hostStudies = runtimeState.studies[host];
            if (!hostStudies) continue;

            for (const study of hostStudies) {
                if (!study.symbol) continue;

                const currency = getCurrency(study.symbol);
                if (currency) {
                    currencies.add(currency);
                }
            }
        }

        return [...currencies];
    });

    async function updateConversionRates(
        currencies: Currency[],
        conversionRates: GlobalSettings["conversionRates"],
    ): Promise<void> {
        if (currencies.length === 0) return;

        const { patch: conversionRatesPatch, updated } =
            await ensureConversionRates(conversionRates, currencies);

        if (!updated) return;

        await queueMutation("store-patch", {
            namespace: "globals",
            data: {
                conversionRates: conversionRatesPatch,
            },
        });
    }

    const currenciesNeedingRates = $derived.by(() => {
        const currencyEnabled = settingsState.globals.currency.enabled;
        const highlightEnabled = settingsState.globals.highlightRates.enabled;

        if (!currencyEnabled && !highlightEnabled) {
            return [];
        }

        const currencies = new Set<Currency>();
        const targetCurrency = settingsState.globals.currency.target;

        if (currencyEnabled) {
            currencies.add(targetCurrency);
        }

        for (const currency of runtimeCurrencies) {
            if (currencyEnabled && currency !== targetCurrency) {
                currencies.add(currency);
            }

            if (highlightEnabled && currency !== HIGHLIGHT_BASE_CURRENCY) {
                currencies.add(currency);
            }
        }

        return [...currencies];
    });

    $effect(() => {
        if (currenciesNeedingRates.length === 0) return;

        const snapshot = $state.snapshot(settingsState.globals.conversionRates);
        void updateConversionRates(currenciesNeedingRates, snapshot);
    });

    const studies: StudyItem[] = $derived.by(() => {
        const items: StudyItem[] = [];
        let order = 0;

        for (const host of supportedHosts) {
            const hostStudies = runtimeState.studies[host];
            if (!Array.isArray(hostStudies)) continue;

            for (const study of hostStudies) {
                const display = convertStudyDisplayValues(study);

                items.push({
                    ...study,
                    ...display,
                    host,
                    siteName: sites[host].name,
                    siteLabel: capitalize(sites[host].name),
                    order,
                    color: getNormalizedRateColor(display.rate, display.symbol),
                    normalizedReward: getNormalizedValue(
                        study.reward,
                        study.symbol,
                        HIGHLIGHT_BASE_CURRENCY,
                    ),
                    normalizedRate: getNormalizedValue(
                        study.rate,
                        study.symbol,
                        HIGHLIGHT_BASE_CURRENCY,
                    ),
                });

                order += 1;
            }
        }

        return items;
    });

    function patchStudySort(sort: StudySort) {
        void queueMutation("store-patch", {
            namespace: "globals",
            data: {
                studySort: sort,
            },
        });
    }

    let studySort = $derived(settingsState.globals.studySort);

    const loading = $derived(
        supportedHosts.some((host) => runtimeState.studies[host] === undefined),
    );
    const hasLiveSnapshot = $derived(
        supportedHosts.some((host) =>
            Array.isArray(runtimeState.studies[host]),
        ),
    );

    const sortedStudies = $derived(sortStudies(studies, studySort));
    const emptyMessage = $derived.by(() => {
        if (loading) {
            return "Looking for live studies across your synced tabs.";
        }

        if (!hasLiveSnapshot) {
            return "Open a study listings page to start syncing.";
        }

        return "No studies are currently available in the synced tabs.";
    });
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
    {#if uiState.detectedHost === model.activeSite.url && model.activeSite.settings?.analytics}
        <div class="px-4">
            <Analytics model={model.activeSite.settings?.analytics} />
        </div>
    {/if}

    {#if sortedStudies.length > 0}
        <div class="shrink-0 px-4">
            <div class="relative">
                <select
                    class="popup-select-control"
                    value={studySort}
                    onchange={(e) =>
                        patchStudySort(e.currentTarget.value as StudySort)}
                >
                    {#each options as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
                <div class="popup-control-chevron">
                    <ChevronDown size={12} strokeWidth={2.4} />
                </div>
            </div>
        </div>
    {/if}

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {#if sortedStudies.length > 0}
            {#if loading}
                <div
                    class="flex items-center gap-2 px-4 pt-3 text-xs text-popup-text-faint"
                >
                    <LoaderCircle
                        size={14}
                        class="animate-spin text-popup-accent-indicator"
                    />
                    <span>Syncing remaining sites...</span>
                </div>
            {/if}

            <div class="popup-studies-list flex flex-col gap-3 pl-4 pb-4">
                {#each sortedStudies as study (study.siteName + ":" + study.id)}
                    <StudyCard item={study} />
                {/each}
            </div>
        {:else}
            <div
                class="flex min-h-44 flex-col items-center justify-center gap-2 px-6 py-8 text-center"
            >
                {#if loading}
                    <LoaderCircle
                        size={18}
                        class="animate-spin text-popup-accent-indicator"
                    />
                {/if}
                <p class="text-sm font-medium text-popup-text">
                    No studies yet
                </p>
                <p
                    class="max-w-[18rem] text-xs leading-5 text-popup-text-faint"
                >
                    {emptyMessage}
                </p>
                {#if !loading && !hasLiveSnapshot}
                    <div class="mt-2 flex flex-wrap justify-center gap-2">
                        {#each supportedHosts as host}
                            <a
                                href={`https://${host}${sites[host].studyPath}`}
                                target="_blank"
                                rel="noreferrer"
                                class="popup-compact-button inline-flex items-center gap-1.5"
                            >
                                {capitalize(sites[host].name)}
                                <ExternalLink size={11} strokeWidth={2.2} />
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

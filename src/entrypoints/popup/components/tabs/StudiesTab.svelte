<script lang="ts">
    import { ChevronDown, LoaderCircle } from "@lucide/svelte";
    import Analytics from "../Analytics.svelte";
    import StudyCard from "../StudyCard.svelte";
    import { sites, supportedHosts } from "@/adapters/siteConfigs";
    import { runtimeState, settingsState, uiState } from "../../state.svelte";
    import { queueMutation } from "../../popupModel.svelte";
    import {
        capitalize,
        getCurrency,
        getCurrencySymbol,
        rateToColor,
    } from "@/lib/utils";
    import { ensureConversionRates } from "@/lib/ensureConversionRates";

    import type { StudyItem, StudiesTabModel } from "../../types";
    import type { StudySort, Currency, GlobalSettings } from "@/store/types";
    import type { StudyInfo } from "@/adapters/BaseAdapter";

    let { model }: { model: StudiesTabModel } = $props();

    type SortOption = {
        value: StudySort;
        label: string;
    };

    const sortOptions: SortOption[] = [
        { value: "page-order", label: "Page order" },
        { value: "highest-reward", label: "Highest reward" },
        { value: "lowest-reward", label: "Lowest reward" },
        { value: "highest-rate", label: "Highest hourly rate" },
        { value: "lowest-rate", label: "Lowest hourly rate" },
    ];

    function sortStudies(items: StudyItem[], sort: StudySort): StudyItem[] {
        const sorted = [...items];
        const compareNullable = (
            left: number | null,
            right: number | null,
            direction: "asc" | "desc",
        ) => {
            if (left === null && right === null) return 0;
            if (left === null) return 1;
            if (right === null) return -1;

            return direction === "asc" ? left - right : right - left;
        };

        switch (sort) {
            case "highest-reward":
                return sorted.sort((left, right) =>
                    compareNullable(left.reward, right.reward, "desc"),
                );
            case "lowest-reward":
                return sorted.sort((left, right) =>
                    compareNullable(left.reward, right.reward, "asc"),
                );
            case "highest-rate":
                return sorted.sort((left, right) =>
                    compareNullable(left.rate, right.rate, "desc"),
                );
            case "lowest-rate":
                return sorted.sort((left, right) =>
                    compareNullable(left.rate, right.rate, "asc"),
                );
            case "page-order":
            default:
                return sorted.sort((left, right) => left.order - right.order);
        }
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
        if (!sourceCurrency) {
            return fallback;
        }

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
        if (!sourceRates || sourceRates.timestamp === 0) {
            return fallback;
        }

        const conversionRate = sourceRates.rates[targetCurrency];
        return {
            reward:
                study.reward === null ? null : study.reward * conversionRate,
            rate: study.rate === null ? null : study.rate * conversionRate,
            symbol: targetSymbol,
        };
    }

    function updateConversionRates(
        currencies: Currency[],
        conversionRates: GlobalSettings["conversionRates"],
    ) {
        if (currencies.length === 0) return;

        void (async () => {
            const { conversionRates: newConversionRates, updated } =
                await ensureConversionRates(conversionRates, currencies);
            if (!updated) return;

            await queueMutation("store-patch", {
                namespace: "globals",
                data: {
                    conversionRates: newConversionRates,
                },
            });
        })();
    }

    function getNormalizedRateColor(
        rate: number | null,
        symbol: string | null,
    ): string | null {
        if (rate === null || !symbol) return null;
        const currency = getCurrency(symbol);
        if (!currency) return null;
        if (currency === "USD") return rateToColor(rate);

        const sourceRates = settingsState.globals.conversionRates[currency];
        if (!sourceRates || sourceRates.timestamp === 0) return null;

        const conversionRate = sourceRates.rates.USD;
        return conversionRate ? rateToColor(rate * conversionRate) : null;
    }

    const runtimeCurrencies = $derived.by(() => {
        const currencies = new Set<Currency>();

        for (const host of supportedHosts) {
            const studies = runtimeState.studies[host];
            if (!studies) continue;

            for (const study of studies) {
                if (!study.symbol) continue;
                const currency = getCurrency(study.symbol);
                if (currency) {
                    currencies.add(currency);
                }
            }
        }

        return [...currencies];
    });

    const currenciesNeedingRates = $derived.by(() => {
        if (!settingsState.globals.currency.enabled) return [];

        return [
            ...new Set([
                settingsState.globals.currency.target,
                ...runtimeCurrencies,
            ]),
        ];
    });

    $effect(() => {
        if (
            settingsState.globals.currency.enabled &&
            currenciesNeedingRates.length > 0
        ) {
            const snapshot = $state.snapshot(
                settingsState.globals.conversionRates,
            );
            updateConversionRates(currenciesNeedingRates, snapshot);
        }
    });

    const studies: StudyItem[] = $derived.by(() => {
        const items: StudyItem[] = [];
        let order = 0;

        for (const host of supportedHosts) {
            const studies = runtimeState.studies[host];
            if (!Array.isArray(studies)) continue;

            for (const study of studies) {
                const display = convertStudyDisplayValues(study);

                items.push({
                    ...study,
                    ...display,
                    host,
                    siteName: sites[host].name,
                    siteLabel: capitalize(sites[host].name),
                    order,
                    color: getNormalizedRateColor(display.rate, display.symbol),
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
            return "Open a supported host on its study listings page in a tab to sync live studies here.";
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
                    class="popup-select-control [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                    value={studySort}
                    onchange={(e) =>
                        patchStudySort(e.currentTarget.value as StudySort)}
                >
                    {#each sortOptions as option}
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
                    class="flex items-center gap-2 px-4 pt-3 text-xs text-gray-500"
                >
                    <LoaderCircle
                        size={14}
                        class="animate-spin text-indigo-400/60"
                    />
                    <span>Syncing remaining sites...</span>
                </div>
            {/if}

            <div class="flex flex-col gap-3 pl-4 pr-2">
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
                        class="animate-spin text-indigo-400/60"
                    />
                {/if}
                <p class="text-sm font-medium text-gray-200">No studies yet</p>
                <p class="max-w-[18rem] text-xs leading-5 text-gray-500">
                    {emptyMessage}
                </p>
            </div>
        {/if}
    </div>
</div>

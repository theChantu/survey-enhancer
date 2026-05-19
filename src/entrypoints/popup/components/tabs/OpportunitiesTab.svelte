<script lang="ts">
    import { onMount } from "svelte";
    import { ExternalLink, LoaderCircle, Search } from "@lucide/svelte";
    import FilterBar from "../FilterBar.svelte";
    import ProjectCard from "../ProjectCard.svelte";
    import StudyCard from "../StudyCard.svelte";
    import { sites, supportedHosts } from "@/adapters/siteConfigs";
    import { runtimeState, settingsState, uiState } from "../../state.svelte";
    import { queueMutation } from "../../popupModel.svelte";
    import { getCurrency, getCurrencySymbol } from "@/lib/currency/";
    import { ensureConversionRates } from "@/lib/currency/rates";
    import { capitalize, rateToColor } from "@/lib/utils";
    import { matchesAlertRules } from "@/lib/notifications/alertRules";
    import { getOpportunityKey as getBaseOpportunityKey } from "@/lib/opportunities/opportunities";
    import { isDisplayableOpportunity } from "../../lib/opportunities";
    import {
        type OpportunitySort,
        type Currency,
        type GlobalSettings,
    } from "@/store/types";
    import { HIGHLIGHT_BASE_CURRENCY } from "@/constants";

    import type { OpportunityItem, OpportunitiesTabModel } from "../../types";
    import type { RuntimeOutputDataMap } from "@/messages/types";
    import type { StudyInfo } from "@/adapters/BaseAdapter";

    let { model }: { model: OpportunitiesTabModel } = $props();

    let prefersDark = $state(false);

    onMount(() => {
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const updatePreference = () => (prefersDark = query.matches);

        updatePreference();
        query.addEventListener("change", updatePreference);

        return () => query.removeEventListener("change", updatePreference);
    });

    import type { FilterChip } from "../../types";

    type RuntimeOpportunity = RuntimeOutputDataMap["opportunities"][number];

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

    type OpportunitySorter = (
        left: OpportunityItem,
        right: OpportunityItem,
    ) => number;

    const opportunitySorters: Record<OpportunitySort, OpportunitySorter> = {
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
                left.sortCompletionMinutes,
                right.sortCompletionMinutes,
                "asc",
            ),
        longest: (left, right) =>
            compareNullableNumbers(
                left.sortCompletionMinutes,
                right.sortCompletionMinutes,
                "desc",
            ),
        "page-order": (left, right) => left.order - right.order,
    };

    function sortOpportunities(
        items: OpportunityItem[],
        sort: OpportunitySort,
    ): OpportunityItem[] {
        return [...items].sort(opportunitySorters[sort]);
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

        return normalizedRate === null
            ? null
            : rateToColor(
                  normalizedRate,
                  settingsState.globals.highlightRates.min,
                  settingsState.globals.highlightRates.max,
                  prefersDark,
              );
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
            const hostOpportunities = runtimeState.opportunities[host];
            if (!hostOpportunities) continue;

            for (const study of hostOpportunities) {
                if (study.kind !== "study") continue;
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

    function buildOpportunityBase(
        opportunity: RuntimeOpportunity,
        host: (typeof supportedHosts)[number],
        order: number,
    ) {
        const rules = settingsState.sites[host]?.opportunityAlerts.rules;

        return {
            host,
            siteName: sites[host].name,
            siteLabel: capitalize(sites[host].name),
            order,
            matchesAlertRules: !rules || matchesAlertRules(opportunity, rules),
        };
    }

    function buildProjectItem(
        project: Extract<RuntimeOpportunity, { kind: "project" }>,
        host: (typeof supportedHosts)[number],
        order: number,
    ): OpportunityItem {
        return {
            ...project,
            ...buildOpportunityBase(project, host, order),
            color: null,
            normalizedReward: null,
            normalizedRate: null,
            sortCompletionMinutes: null,
        };
    }

    function buildStudyItem(
        study: Extract<RuntimeOpportunity, { kind: "study" }>,
        host: (typeof supportedHosts)[number],
        order: number,
    ): OpportunityItem {
        const display = convertStudyDisplayValues(study);

        return {
            ...study,
            ...display,
            ...buildOpportunityBase(study, host, order),
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
            sortCompletionMinutes: study.averageCompletionMinutes,
        };
    }

    const opportunities: OpportunityItem[] = $derived.by(() => {
        const items: OpportunityItem[] = [];
        let order = 0;

        for (const host of supportedHosts) {
            const hostOpportunities = runtimeState.opportunities[host];
            if (!Array.isArray(hostOpportunities)) continue;

            for (const opportunity of hostOpportunities) {
                if (!isDisplayableOpportunity(opportunity)) continue;

                items.push(
                    opportunity.kind === "study"
                        ? buildStudyItem(opportunity, host, order)
                        : buildProjectItem(opportunity, host, order),
                );

                order += 1;
            }
        }

        return items;
    });

    let opportunitySort = $derived(settingsState.globals.opportunitySort);

    function getOpportunityKey(opportunity: OpportunityItem): string {
        return `${opportunity.siteName}:${getBaseOpportunityKey(opportunity)}`;
    }

    const QUICK_THRESHOLD_MINUTES = 15;
    const RECENT_THRESHOLD_MS = 10 * 60_000;

    function applyFilters(
        items: OpportunityItem[],
        filters: FilterChip[],
        platform: typeof uiState.platformFilter,
    ): OpportunityItem[] {
        let filtered = items;

        if (platform !== "all") {
            filtered = filtered.filter((item) => item.host === platform);
        }

        for (const filter of filters) {
            switch (filter) {
                case "highRate":
                    filtered = filtered.filter(
                        (item) =>
                            item.normalizedRate !== null &&
                            item.normalizedRate >=
                                settingsState.globals.highlightRates.max,
                    );
                    break;
                case "quick":
                    filtered = filtered.filter(
                        (item) =>
                            item.sortCompletionMinutes !== null &&
                            item.sortCompletionMinutes <=
                                QUICK_THRESHOLD_MINUTES,
                    );
                    break;
                case "recent":
                    filtered = filtered.filter(
                        (item) =>
                            Date.now() - item.firstSeenAt < RECENT_THRESHOLD_MS ||
                            Date.now() - item.lastAlertableChangeAt <
                                RECENT_THRESHOLD_MS,
                    );
                    break;
            }
        }

        return filtered;
    }

    const loading = $derived(
        supportedHosts.some(
            (host) => runtimeState.opportunities[host] === undefined,
        ),
    );
    const hasLiveSnapshot = $derived(
        supportedHosts.some((host) =>
            Array.isArray(runtimeState.opportunities[host]),
        ),
    );

    const filteredOpportunities = $derived(
        applyFilters(
            opportunities,
            uiState.activeFilters,
            uiState.platformFilter,
        ),
    );

    const sortedOpportunities = $derived(
        sortOpportunities(filteredOpportunities, opportunitySort),
    );
    const hasActiveFilters = $derived(
        uiState.activeFilters.length > 0 || uiState.platformFilter !== "all",
    );

    const emptyMessage = $derived.by(() => {
        if (loading) {
            return "Looking for live opportunities across your synced tabs.";
        }

        if (!hasLiveSnapshot) {
            return "Open a study listings page to start syncing.";
        }

        if (hasActiveFilters && opportunities.length > 0) {
            return "Try adjusting your filters or check back soon.";
        }

        return "No opportunities are currently available in the synced tabs.";
    });

    const emptyTitle = $derived(
        hasActiveFilters && opportunities.length > 0
            ? "No studies match"
            : "No opportunities yet",
    );
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="shrink-0 px-5">
        <FilterBar />
    </div>

    <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]"
    >
        {#if sortedOpportunities.length > 0}
            {#if loading}
                <div
                    class="flex items-center gap-2 pl-5 pt-3 text-xs text-popup-text-faint"
                >
                    <LoaderCircle
                        size={14}
                        class="animate-spin text-popup-accent-indicator"
                    />
                    <span>Syncing remaining sites...</span>
                </div>
            {/if}

            <div
                class="popup-opportunities-list flex flex-col gap-2 pl-5 pr-1 pb-4"
            >
                {#each sortedOpportunities as opportunity (getOpportunityKey(opportunity))}
                    {#if opportunity.kind === "study"}
                        <StudyCard item={opportunity} />
                    {:else}
                        <ProjectCard item={opportunity} />
                    {/if}
                {/each}
            </div>
        {:else}
            <div
                class="flex min-h-44 flex-col items-center justify-center gap-2 px-8 py-8 text-center"
            >
                {#if loading}
                    <LoaderCircle
                        size={18}
                        class="animate-spin text-popup-accent-indicator"
                    />
                {:else}
                    <div
                        class="mb-1 flex h-12 w-12 items-center justify-center rounded-[14px] bg-popup-accent-surface-strong text-popup-accent-text"
                    >
                        <Search size={24} strokeWidth={2} />
                    </div>
                {/if}
                <p class="text-sm font-medium text-popup-text">
                    {emptyTitle}
                </p>
                <p
                    class="max-w-[18rem] text-xs leading-5 text-popup-text-faint"
                >
                    {emptyMessage}
                </p>
                {#if !loading && !hasLiveSnapshot}
                    <div
                        class="mt-2 grid w-full max-w-[18rem] grid-cols-2 gap-1.5"
                    >
                        {#each supportedHosts as host}
                            <a
                                href={`https://${host}${sites[host].studyPath}`}
                                target="_blank"
                                rel="noreferrer"
                                class="popup-compact-button inline-flex items-center justify-center gap-1.5 no-underline"
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

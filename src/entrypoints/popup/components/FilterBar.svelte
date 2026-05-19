<script lang="ts">
    import { ArrowUpDown, ChevronDown } from "@lucide/svelte";
    import { sites, supportedHosts } from "@/adapters/siteConfigs";
    import { capitalize } from "@/lib/utils";
    import { settingsState, uiState } from "../state.svelte";
    import { queueMutation } from "../popupModel.svelte";
    import { filterChips, type FilterChip } from "../types";

    import type { SupportedHosts } from "@/adapters/siteConfigs";
    import type { OpportunitySort } from "@/store/types";
    import { opportunitySortOptions } from "@/store/types";

    const visibleChips = $derived(
        filterChips.filter((chip) => {
            if (chip === "highRate") {
                return settingsState.globals.highlightRates.enabled;
            }
            return true;
        }),
    );

    const sortOptions: { value: OpportunitySort; label: string }[] =
        opportunitySortOptions.map((value) => ({
            value,
            label: capitalize(value.replaceAll("-", " ")),
        }));

    const platformOptions: { value: SupportedHosts | "all"; label: string }[] =
        [
            { value: "all", label: "All platforms" },
            ...supportedHosts.map((host) => ({
                value: host,
                label: capitalize(sites[host].name),
            })),
        ];

    const chipLabels: Record<FilterChip, string> = {
        highRate: "Strong rate",
        quick: "< 15min",
        recent: "Recent",
    };

    let opportunitySort = $derived(settingsState.globals.opportunitySort);

    let platformOpen = $state(false);
    let sortOpen = $state(false);

    const platformLabel = $derived(
        platformOptions.find((o) => o.value === uiState.platformFilter)
            ?.label ?? "All platforms",
    );
    const sortLabel = $derived(
        sortOptions.find((o) => o.value === opportunitySort)?.label ??
            "Page order",
    );

    function selectPlatform(value: SupportedHosts | "all") {
        uiState.platformFilter = value;
        platformOpen = false;
    }

    function selectSort(value: OpportunitySort) {
        void queueMutation("store-patch", {
            namespace: "globals",
            data: { opportunitySort: value },
        });
        sortOpen = false;
    }

    function toggleChip(chip: FilterChip) {
        const idx = uiState.activeFilters.indexOf(chip);
        if (idx === -1) {
            uiState.activeFilters = [...uiState.activeFilters, chip];
        } else {
            uiState.activeFilters = uiState.activeFilters.filter(
                (c) => c !== chip,
            );
        }
    }

    function isActive(chip: FilterChip): boolean {
        return uiState.activeFilters.includes(chip);
    }

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest(".filter-dropdown")) {
            platformOpen = false;
            sortOpen = false;
        }
    }
</script>

<svelte:document onclick={handleClickOutside} />

<div class="flex flex-col gap-2.5">
    <div class="flex items-center justify-between">
        <div class="filter-dropdown relative">
            <button
                type="button"
                class="flex cursor-pointer items-center gap-1 border-none bg-transparent text-[11px] font-medium text-popup-text-muted transition-opacity hover:opacity-70"
                onclick={() => {
                    platformOpen = !platformOpen;
                    sortOpen = false;
                }}
            >
                {platformLabel}
                <ChevronDown
                    size={11}
                    strokeWidth={2.5}
                    class="text-popup-text-faint"
                />
            </button>
            {#if platformOpen}
                <div
                    class="absolute top-full left-0 z-10 mt-1 min-w-30 rounded-lg border border-popup-border bg-popup-surface p-1 shadow-lg"
                >
                    {#each platformOptions as option}
                        <button
                            type="button"
                            class={`block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                                option.value === uiState.platformFilter
                                    ? "font-semibold text-popup-accent-text bg-popup-accent-surface"
                                    : "font-normal text-popup-text hover:bg-[rgba(0,0,0,0.05)]"
                            }`}
                            onclick={() => selectPlatform(option.value)}
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="filter-dropdown relative">
            <button
                type="button"
                class="flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-[12px] font-medium text-popup-text-muted transition-opacity hover:opacity-70"
                onclick={() => {
                    sortOpen = !sortOpen;
                    platformOpen = false;
                }}
            >
                <ArrowUpDown
                    size={12}
                    strokeWidth={2}
                    class="text-popup-text-faint"
                />
                {sortLabel}
                <ChevronDown
                    size={11}
                    strokeWidth={2.5}
                    class="text-popup-text-faint"
                />
            </button>
            {#if sortOpen}
                <div
                    class="absolute top-full right-0 z-10 mt-1 min-w-35 rounded-[10px] border border-popup-border bg-popup-surface p-1 shadow-lg"
                >
                    {#each sortOptions as option}
                        <button
                            type="button"
                            class={`block w-full cursor-pointer rounded-[7px] px-2.5 py-1.75 text-left text-[12px] transition-colors ${
                                option.value === opportunitySort
                                    ? "font-semibold text-popup-accent-text bg-popup-accent-surface"
                                    : "font-normal text-popup-text hover:bg-[rgba(0,0,0,0.05)]"
                            }`}
                            onclick={() => selectSort(option.value)}
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="flex gap-1.5 overflow-x-auto">
        {#each visibleChips as chip}
            <button
                type="button"
                class={`shrink-0 cursor-pointer rounded-[20px] border px-2.5 py-1 text-[11px] font-semibold transition-all duration-120 ${
                    isActive(chip)
                        ? "border-popup-accent-text bg-popup-accent-surface-strong text-popup-accent-text"
                        : "border-popup-border bg-transparent text-popup-text-muted hover:bg-[rgba(0,0,0,0.05)]"
                }`}
                onclick={() => toggleChip(chip)}
            >
                {chipLabels[chip]}
            </button>
        {/each}
    </div>
</div>

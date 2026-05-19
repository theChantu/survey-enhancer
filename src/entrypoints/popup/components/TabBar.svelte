<script lang="ts">
    import { supportedHosts } from "@/adapters/siteConfigs";
    import { Activity, Settings } from "@lucide/svelte";
    import { capitalize } from "@/lib/utils";
    import { runtimeState, uiState } from "../state.svelte";
    import { tabs } from "../types";
    import { isDisplayableOpportunity } from "../lib/opportunities";

    const opportunityCount = $derived(
        supportedHosts.reduce((sum, host) => {
            const opportunities = runtimeState.opportunities[host];
            return (
                sum +
                (Array.isArray(opportunities)
                    ? opportunities.filter(isDisplayableOpportunity).length
                    : 0)
            );
        }, 0),
    );
</script>

<div class="flex rounded-[10px] bg-popup-tab-bg p-0.75 gap-0.5">
    {#each tabs as tab}
        <button
            type="button"
            class={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-all duration-150 ${
                uiState.selectedTab === tab
                    ? "bg-popup-accent-text text-white shadow-sm"
                    : "text-popup-text-muted hover:text-popup-text"
            }`}
            onclick={() => (uiState.selectedTab = tab)}
        >
            {#if tab === "analytics"}
                <Activity size={13} strokeWidth={2.2} />
            {/if}
            {#if tab === "settings"}
                <Settings size={13} strokeWidth={2.2} />
            {/if}
            {capitalize(tab)}
            {#if tab === "opportunities" && opportunityCount > 0}
                <span
                    class={`ml-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                        uiState.selectedTab === tab
                            ? "bg-white/20 text-white"
                            : "bg-popup-accent-surface-strong text-popup-accent-text"
                    }`}
                >
                    {opportunityCount}
                </span>
            {/if}
        </button>
    {/each}
</div>

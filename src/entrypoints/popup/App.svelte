<script lang="ts">
    import { onMount } from "svelte";
    import { sites } from "@/adapters/siteConfigs";
    import ToastHost from "@/components/ToastHost.svelte";
    import { settingsState, uiState } from "./state.svelte";
    import { initPopup } from "./popupModel.svelte";
    import SettingsTab from "./components/tabs/SettingsTab.svelte";
    import OpportunitiesTab from "./components/tabs/OpportunitiesTab.svelte";
    import TabBar from "./components/TabBar.svelte";

    import type { ActiveSiteState } from "./types";

    onMount(initPopup);

    const activeSite: ActiveSiteState = $derived({
        url: uiState.selectedHost,
        name: sites[uiState.selectedHost].name,
        settings: settingsState.sites[uiState.selectedHost],
    });
</script>

<div class="flex h-full flex-col gap-4 pt-4">
    <div class="px-4">
        <TabBar />
    </div>

    {#if uiState.selectedTab === "opportunities"}
        <OpportunitiesTab
            model={{
                activeSite,
            }}
        />
    {:else}
        <SettingsTab
            model={{
                activeSite,
            }}
        />
    {/if}

    <ToastHost />
</div>

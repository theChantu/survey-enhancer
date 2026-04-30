<script lang="ts">
    import { LoaderCircle } from "@lucide/svelte";
    import SelectControl from "@/components/SelectControl.svelte";

    import {
        sites,
        supportedHosts,
        type SupportedHosts,
    } from "@/adapters/siteConfigs";
    import { capitalize } from "@/lib/utils";

    import AutoReloadSettings from "../settings/AutoReloadSettings.svelte";
    import CurrencySettings from "../settings/CurrencySettings.svelte";
    import DebugSettings from "../settings/debug/DebugSettings.svelte";
    import HighlightSettings from "../settings/HighlightSettings.svelte";
    import NotificationSettings from "../settings/NotificationSettings.svelte";
    import ProviderSettings from "../settings/ProviderSettings.svelte";
    import { queueMutation, selectHost } from "../../popupModel.svelte";
    import { settingsState } from "../../state.svelte";

    import type { SettingsTabModel } from "../../types";

    let { model }: { model: SettingsTabModel } = $props();

    let siteEnhancements = $derived(
        new Set(sites[model.activeSite.url].enhancements),
    );

    let siteFeatures = $derived(new Set(sites[model.activeSite.url].features));
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="shrink-0 px-5">
        <SelectControl
            class="font-medium"
            value={model.activeSite.url}
            onchange={(e) =>
                selectHost(e.currentTarget.value as SupportedHosts)}
        >
            {#each supportedHosts as url}
                <option value={url}>
                    {capitalize(sites[url].name)}
                </option>
            {/each}
        </SelectControl>
    </div>

    <div
        class="popup-settings-list flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pl-5 pr-1 pb-4 [scrollbar-gutter:stable]"
    >
        {#if !model.activeSite.settings}
            <div
                class="flex items-center justify-center gap-2 border-t border-popup-border p-8 pt-3 text-sm text-popup-text-faint"
            >
                <LoaderCircle
                    size={18}
                    class="animate-spin text-popup-accent-indicator"
                />
                <span>Loading settings...</span>
            </div>
        {:else}
            {#if siteEnhancements.has("highlightRates")}
                <HighlightSettings
                    model={{
                        queueMutation,
                        siteName: model.activeSite.name,
                        conversionRates: settingsState.globals.conversionRates,
                        currency: settingsState.globals.currency,
                        highlightRates: settingsState.globals.highlightRates,
                    }}
                />
            {/if}

            {#if siteEnhancements.has("currency")}
                <CurrencySettings
                    model={{
                        queueMutation,
                        siteName: model.activeSite.name,
                        currency: settingsState.globals.currency,
                    }}
                />
            {/if}

            {#if siteEnhancements.has("opportunityAlerts")}
                <NotificationSettings
                    model={{
                        queueMutation,
                        siteName: model.activeSite.name,
                        opportunityAlerts:
                            model.activeSite.settings.opportunityAlerts,
                        notifications: settingsState.globals.notifications,
                    }}
                />
            {/if}

            <ProviderSettings
                model={{
                    queueMutation,
                    idleThreshold: settingsState.globals.idleThreshold,
                    providers: settingsState.globals.providers,
                }}
            />

            {#if siteFeatures.has("autoReload")}
                <AutoReloadSettings
                    model={{
                        queueMutation,
                        siteName: model.activeSite.name,
                        autoReload: model.activeSite.settings.autoReload,
                    }}
                />
            {/if}

            <DebugSettings
                model={{
                    queueMutation,
                    activeSite: model.activeSite,
                    settingsState: settingsState,
                }}
            />
        {/if}
    </div>
</div>

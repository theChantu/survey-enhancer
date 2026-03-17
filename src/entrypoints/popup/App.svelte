<script lang="ts">
    import { onMount } from "svelte";
    import { defaultSettings } from "@/store/defaultSettings";
    import { sites, type SupportedSites } from "@/adapters/sites";
    import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
    import Toggle from "@/components/Toggle.svelte";
    import ResearcherList from "@/components/ResearcherList.svelte";
    import {
        Settings as SettingsIcon,
        CircleDollarSign,
        ChevronDown,
        Bell,
        Bug,
        LoaderCircle,
    } from "@lucide/svelte";
    import { capitalize } from "@/lib/utils";

    import type { Settings, SettingsUpdate } from "@/store/createStore";
    import type { NewSurveyNotificationsSettings } from "@/store/types";

    const siteKeys = Object.keys(sites) as SupportedSites[];

    let selectedSite: SupportedSites = siteKeys[0];

    let loadedSites = {} as Partial<Record<SupportedSites, Settings>>;

    $: currentSite = loadedSites[selectedSite];

    function updateSetting(values: SettingsUpdate) {
        const current = loadedSites[selectedSite];
        if (!current) return;
        loadedSites[selectedSite] = { ...current, ...values };
        sendExtensionMessage({
            type: "store-update",
            data: { siteName: sites[selectedSite].name, ...values },
        });
    }

    function setSetting(values: SettingsUpdate) {
        const current = loadedSites[selectedSite];
        if (!current) return;
        loadedSites[selectedSite] = { ...current, ...values };
        sendExtensionMessage({
            type: "store-set",
            data: { siteName: sites[selectedSite].name, ...values },
        });
    }

    type ResearcherKey = Exclude<
        keyof NewSurveyNotificationsSettings,
        "enableNewSurveyNotifications" | "cachedResearchers"
    >;

    function addResearcher(key: ResearcherKey, name: string) {
        const loadedSite = loadedSites[selectedSite];
        if (!loadedSite || loadedSite[key].includes(name)) return;
        updateSetting({ [key]: [...loadedSite[key], name] });
    }

    function removeResearcher(key: ResearcherKey, name: string) {
        const loadedSite = loadedSites[selectedSite];
        if (!loadedSite) return;
        updateSetting({
            [key]: loadedSite[key].filter((n) => n !== name),
        });
    }

    type ResettableKey = Exclude<keyof typeof defaultSettings, "enableDebug">;

    function resetKey(key: ResettableKey) {
        if (!currentSite) return;
        setSetting({ [key]: defaultSettings[key] });
    }

    // Exclude enableDebug because there's already a dedicated toggle for it
    const resettableKeys = Object.keys(defaultSettings).filter(
        (k) => k in defaultSettings && k !== "enableDebug",
    ) as ResettableKey[];

    function formatKey(key: string) {
        return key.replace(/([A-Z])/g, " $1").toLowerCase();
    }

    async function loadSite(siteUrl: SupportedSites) {
        if (siteUrl in loadedSites) return;
        try {
            const response = await sendExtensionMessage({
                type: "store-fetch",
                data: {
                    url: `https://${siteUrl}`,
                    settings: Object.keys(
                        defaultSettings,
                    ) as (keyof Settings)[],
                },
            });
            if (response?.data) loadedSites[siteUrl] = response.data;
        } catch (error) {
            console.error(error);
        }
    }

    onMount(async () => {
        // Try to detect the current site and load it by default
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        if (tab?.url) {
            try {
                const host = new URL(tab.url).hostname as SupportedSites;
                if (host in sites) selectedSite = host;
            } catch (error) {
                console.error(error);
            }
        }

        await loadSite(selectedSite);
    });
</script>

<div class="popup">
    <div class="header">
        <div class="site-select-wrap">
            <select
                class="site-select"
                value={selectedSite}
                on:change={(e: { currentTarget: HTMLSelectElement }) => {
                    selectedSite = e.currentTarget.value as SupportedSites;
                    loadSite(selectedSite);
                }}
            >
                {#each siteKeys as siteUrl}
                    <option value={siteUrl}>
                        {capitalize(sites[siteUrl].name)}
                    </option>
                {/each}
            </select>
            <ChevronDown size={14} />
        </div>
    </div>

    {#if !currentSite}
        <div class="card loading-card">
            <LoaderCircle size={18} class="spinner-icon" />
            <span>Loading settings...</span>
        </div>
    {:else}
        <div class="card section">
            <h2>
                <SettingsIcon size={14} strokeWidth={2.5} />
                General
            </h2>

            <Toggle
                title="Survey links"
                description="Show direct survey links when available."
                value={currentSite?.enableSurveyLinks}
                onClick={() =>
                    updateSetting({
                        enableSurveyLinks: !currentSite?.enableSurveyLinks,
                    })}
            />

            <Toggle
                title="Highlight rates"
                description="Visually emphasize stronger survey rates."
                value={currentSite?.enableHighlightRates}
                onClick={() =>
                    updateSetting({
                        enableHighlightRates:
                            !currentSite?.enableHighlightRates,
                    })}
            />
        </div>

        <div class="card section">
            <h2>
                <CircleDollarSign size={14} strokeWidth={2.5} />
                Currency
            </h2>
            <Toggle
                title="Currency conversion"
                description="Convert rewards into your selected currency."
                value={currentSite?.enableCurrencyConversion}
                onClick={() =>
                    updateSetting({
                        enableCurrencyConversion:
                            !currentSite?.enableCurrencyConversion,
                    })}
            />
            <div class="field">
                <label for="currency">Selected currency</label>
                <div class="select-wrap">
                    <select
                        id="currency"
                        bind:value={currentSite.selectedCurrency}
                        on:change={(e) =>
                            updateSetting({
                                selectedCurrency: e.currentTarget
                                    .value as Settings["selectedCurrency"],
                            })}
                    >
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                    </select>
                    <ChevronDown size={14} />
                </div>
            </div>
        </div>

        <div class="card section">
            <h2>
                <Bell size={14} strokeWidth={2.5} />
                Notifications
            </h2>
            <Toggle
                title="New survey notifications"
                description="Send a desktop notification when a new survey appears."
                value={currentSite?.enableNewSurveyNotifications}
                onClick={() =>
                    updateSetting({
                        enableNewSurveyNotifications:
                            !currentSite?.enableNewSurveyNotifications,
                    })}
            />
            {#if currentSite?.enableNewSurveyNotifications}
                <ResearcherList
                    title="Included researchers"
                    names={currentSite?.includedResearchers}
                    suggestions={Object.keys(currentSite?.cachedResearchers)}
                    onAdd={(name) => addResearcher("includedResearchers", name)}
                    onRemove={(name) =>
                        removeResearcher("includedResearchers", name)}
                />
                <ResearcherList
                    title="Excluded researchers"
                    names={currentSite?.excludedResearchers}
                    suggestions={Object.keys(currentSite?.cachedResearchers)}
                    onAdd={(name) => addResearcher("excludedResearchers", name)}
                    onRemove={(name) =>
                        removeResearcher("excludedResearchers", name)}
                />
            {/if}
        </div>

        <div class="card section">
            <h2>
                <Bug size={14} strokeWidth={2.5} />
                Developer
            </h2>
            <Toggle
                title="Debug mode"
                description="Log extension activity to the browser console."
                value={currentSite?.enableDebug}
                onClick={() =>
                    updateSetting({
                        enableDebug: !currentSite?.enableDebug,
                    })}
            />

            {#if currentSite?.enableDebug}
                <div class="debug-resets">
                    <span class="list-label">Reset to default</span>
                    <div class="debug-buttons">
                        {#each resettableKeys as key}
                            <button
                                class="debug-btn"
                                on:click={() => resetKey(key)}
                            >
                                {formatKey(key)}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    :global(body) {
        margin: 0;
        min-width: 340px;
        background: #121417;
        color: #d1d5db;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        -webkit-font-smoothing: antialiased;
    }

    .popup {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .site-select-wrap {
        position: relative;
        color: #6b7280;
    }

    .site-select-wrap :global(svg) {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
    }

    .site-select {
        width: 100%;
        padding: 8px 32px 8px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #f3f4f6;
        font-size: 0.9rem;
        font-weight: 600;
        font-family: inherit;
        outline: none;
        appearance: none;
        cursor: pointer;
    }

    .site-select:focus {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .site-select option {
        background: #1a1d21;
        color: #d1d5db;
    }

    .card {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 12px;
    }

    .section h2 {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 8px;
        font-size: 0.7rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .field label {
        font-size: 0.78rem;
        font-weight: 500;
        color: #6b7280;
    }

    .select-wrap {
        position: relative;
        color: #6b7280;
    }

    .select-wrap :global(svg) {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
    }

    .select-wrap select {
        width: 100%;
        padding: 8px 32px 8px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #d1d5db;
        font-size: 0.82rem;
        font-family: inherit;
        outline: none;
        appearance: none;
        cursor: pointer;
    }

    .select-wrap select option {
        background: #1a1d21;
        color: #d1d5db;
    }

    .select-wrap select:focus {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .loading-card {
        padding: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #6b7280;
        font-size: 0.82rem;
    }

    .loading-card :global(.spinner-icon) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .debug-resets {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .debug-resets .list-label {
        font-size: 0.78rem;
        font-weight: 500;
        color: #6b7280;
    }

    .debug-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .debug-btn {
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #d1d5db;
        font-size: 0.72rem;
        font-family: inherit;
        cursor: pointer;
    }

    .debug-btn:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }
</style>

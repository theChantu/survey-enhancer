<script lang="ts">
    import { onMount } from "svelte";
    import { defaultSettings } from "@/store/defaultSettings";
    import { sites, type SupportedSites } from "@/adapters/siteConfigs";
    import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
    import Toggle from "@/components/Toggle.svelte";
    import Section from "@/components/Section.svelte";
    import Field from "@/components/Field.svelte";
    import Subsection from "@/components/Subsection.svelte";
    import TagInput from "@/components/TagInput.svelte";
    import ToastHost from "@/components/ToastHost.svelte";
    import { showActionToast, showToast } from "@/entrypoints/popup/toastStore";
    import {
        Settings as SettingsIcon,
        CircleDollarSign,
        ChevronDown,
        Bell,
        Bug,
        LoaderCircle,
        RefreshCw,
        Send,
    } from "@lucide/svelte";
    import { capitalize, cleanResearcherName } from "@/lib/utils";
    import { currencyKeys } from "@/store/types";

    import type { Settings, SettingsUpdate } from "@/store/createStore";
    import type { NewSurveyNotificationsSettings } from "@/store/types";
    import type { ProviderConfigMap } from "@/providers/providers";
    import type { NotificationData } from "@/enhancements/NewSurveyNotificationsEnhancement";

    const siteKeys = Object.keys(sites) as SupportedSites[];
    const providerSetupUrl =
        "https://github.com/theChantu/survey-enhancer#provider-setup";

    let selectedSite: SupportedSites = siteKeys[0];
    let loadedSites = {} as Partial<Record<SupportedSites, Settings>>;

    $: currentSite = loadedSites[selectedSite];

    let settingsMutationQueue = Promise.resolve();

    function updateProvider<K extends keyof ProviderConfigMap>(
        name: K,
        values: Partial<ProviderConfigMap[K]>,
    ) {
        updateSetting({
            providers: { [name]: values },
        });
    }

    async function applySettingsMutation(
        type: "store-update" | "store-set",
        siteUrl: SupportedSites,
        values: SettingsUpdate,
    ) {
        if (!loadedSites[siteUrl]) return;

        try {
            const response = await sendExtensionMessage({
                type,
                data: { siteName: sites[siteUrl].name, ...values },
            });
            const current = loadedSites[siteUrl];
            if (!current) return;
            loadedSites[siteUrl] = { ...current, ...response.data };
        } catch (error) {
            console.error(error);
        }
    }

    function queueSettingsMutation(
        type: "store-update" | "store-set",
        values: SettingsUpdate,
        siteUrl: SupportedSites = selectedSite,
    ) {
        settingsMutationQueue = settingsMutationQueue
            .catch((error) => {
                console.error(error);
            })
            .then(() => applySettingsMutation(type, siteUrl, values));
        return settingsMutationQueue;
    }

    function updateSetting(
        values: SettingsUpdate,
        siteUrl: SupportedSites = selectedSite,
    ) {
        void queueSettingsMutation("store-update", values, siteUrl);
    }

    function setSetting(
        values: SettingsUpdate,
        siteUrl: SupportedSites = selectedSite,
    ) {
        return queueSettingsMutation("store-set", values, siteUrl);
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
        const siteUrl = selectedSite;
        const siteSettings = loadedSites[siteUrl];
        if (!siteSettings) return;

        const previousValue = structuredClone(siteSettings[key]);
        const resetValue = structuredClone(defaultSettings[key]);

        void setSetting({ [key]: resetValue }, siteUrl);

        showActionToast({
            message: `Reset ${formatKey(key)}.`,
            actionLabel: "Undo",
            onAction: () => setSetting({ [key]: previousValue }, siteUrl),
        });
    }

    // Exclude enableDebug because there's already a dedicated toggle for it
    const resettableKeys = Object.keys(defaultSettings).filter(
        (k) => k in defaultSettings && k !== "enableDebug",
    ) as ResettableKey[];

    function formatKey(key: string) {
        return key.replace(/([A-Z])/g, " $1").toLowerCase();
    }

    const testNotificationModes = ["auto", "provider", "browser"] as const;
    async function sendTestNotification(
        delivery: (typeof testNotificationModes)[number] = "auto",
    ) {
        const notifications: NotificationData[] = [
            {
                title: "Test Notification",
                message: "This is a test notification.",
                surveyLink: "https://example.com",
                iconUrl: browser.runtime.getURL("/icon-48.png"),
            },
        ];
        try {
            const ok = await sendExtensionMessage({
                type: "notification",
                data: {
                    siteName: sites[selectedSite].name,
                    notifications,
                    delivery,
                },
            });

            showToast(
                ok
                    ? "Notification sent successfully."
                    : "Failed to send notification.",
            );
        } catch (error) {
            console.error(error);
            showToast("Failed to send notification.");
        }
    }

    function parsePositiveInt(raw: string): number | null {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 1) return null;
        return Math.round(value);
    }

    async function loadSite(siteUrl: SupportedSites) {
        if (siteUrl in loadedSites) return;
        try {
            const response = await sendExtensionMessage({
                type: "store-fetch",
                data: {
                    siteName: sites[siteUrl].name,
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

    $: siteModules = new Set(sites[selectedSite].modules);
</script>

<div class="p-4 flex flex-col gap-4">
    <div>
        <div class="relative text-gray-500">
            <select
                class="w-full py-2 pl-2.5 pr-8 rounded-md border border-white/8 bg-white/4 hover:bg-white/4 text-gray-100 text-[0.9rem] font-semibold font-[inherit] outline-none appearance-none cursor-pointer focus:border-white/20 [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                value={selectedSite}
                on:change={(e) => {
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
            <div
                class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            >
                <ChevronDown size={14} />
            </div>
        </div>
    </div>

    {#if !currentSite}
        <div
            class="border-t border-white/6 pt-3 p-8 flex items-center justify-center gap-2 text-gray-500 text-[0.82rem]"
        >
            <LoaderCircle size={18} class="animate-spin" />
            <span>Loading settings...</span>
        </div>
    {:else}
        {#if siteModules.has("SurveyLinks") || siteModules.has("HighlightRates")}
            <Section title="General" icon={SettingsIcon}>
                {#if siteModules.has("SurveyLinks")}
                    <Toggle
                        title="Survey links"
                        description="Show direct survey links when available."
                        value={currentSite?.enableSurveyLinks}
                        onClick={() =>
                            updateSetting({
                                enableSurveyLinks:
                                    !currentSite?.enableSurveyLinks,
                            })}
                    />
                {/if}

                {#if siteModules.has("HighlightRates")}
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
                {/if}
            </Section>
        {/if}

        {#if siteModules.has("CurrencyConversion")}
            <Section title="Currency" icon={CircleDollarSign}>
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
                <Field label="Selected currency" id="currency">
                    <div class="relative text-gray-500">
                        <select
                            id="currency"
                            class="w-full py-2 pl-2.5 pr-8 rounded-md border border-white/8 bg-white/4 hover:bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none appearance-none cursor-pointer focus:border-white/20 [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                            bind:value={currentSite.selectedCurrency}
                            on:change={(e) =>
                                updateSetting({
                                    selectedCurrency: e.currentTarget
                                        .value as Settings["selectedCurrency"],
                                })}
                        >
                            {#each currencyKeys as currency}
                                <option value={currency}>{currency}</option>
                            {/each}
                        </select>
                        <div
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        >
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </Field>
            </Section>
        {/if}

        {#if siteModules.has("NewSurveyNotifications")}
            <Section title="Notifications" icon={Bell}>
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
                    <TagInput
                        title="Included researchers"
                        values={currentSite?.includedResearchers}
                        suggestions={Object.keys(
                            currentSite?.cachedResearchers,
                        )}
                        placeholder="Add researcher..."
                        clean={cleanResearcherName}
                        onAdd={(name) =>
                            addResearcher("includedResearchers", name)}
                        onRemove={(name) =>
                            removeResearcher("includedResearchers", name)}
                    />
                    <TagInput
                        title="Excluded researchers"
                        values={currentSite?.excludedResearchers}
                        suggestions={Object.keys(
                            currentSite?.cachedResearchers,
                        )}
                        placeholder="Add researcher..."
                        clean={cleanResearcherName}
                        onAdd={(name) =>
                            addResearcher("excludedResearchers", name)}
                        onRemove={(name) =>
                            removeResearcher("excludedResearchers", name)}
                    />
                {/if}
            </Section>
        {/if}

        <Section title="Providers" icon={Send}>
            <div class="mb-2 text-[0.74rem] text-gray-500">
                Need help with bot setup?
                <a
                    href={providerSetupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ml-1 text-indigo-300 hover:text-indigo-200"
                    >View setup guide</a
                >
            </div>

            <Field label="Idle threshold (minutes)" id="idle-threshold">
                <input
                    id="idle-threshold"
                    type="number"
                    min="1"
                    step="1"
                    class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
                    value={Math.max(
                        1,
                        Math.round(currentSite.idleThreshold / 60),
                    )}
                    on:change={(e) => {
                        const minutes = parsePositiveInt(e.currentTarget.value);
                        if (minutes === null) return;
                        updateSetting({
                            idleThreshold: minutes * 60,
                        });
                    }}
                />
            </Field>

            <Subsection withDivider={false}>
                <Toggle
                    title="Telegram"
                    description="Send notifications via Telegram bot when idle."
                    value={currentSite.providers.telegram?.enabled ?? false}
                    onClick={() =>
                        updateProvider("telegram", {
                            enabled: !currentSite.providers.telegram?.enabled,
                        })}
                />
                {#if currentSite.providers.telegram?.enabled}
                    <Field label="Bot token" id="telegram-bot-token">
                        <input
                            id="telegram-bot-token"
                            type="password"
                            class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
                            value={currentSite.providers.telegram?.botToken ??
                                ""}
                            on:change={(e) =>
                                updateProvider("telegram", {
                                    botToken: e.currentTarget.value,
                                })}
                        />
                    </Field>
                {/if}
            </Subsection>
        </Section>

        <Section title="Auto Reload" icon={RefreshCw}>
            <Toggle
                title="Auto reload"
                description="Periodically refresh the page in the background to check for new studies."
                value={currentSite?.enableAutoReload}
                onClick={() =>
                    updateSetting({
                        enableAutoReload: !currentSite?.enableAutoReload,
                    })}
            />
            {#if currentSite?.enableAutoReload}
                <Field label="Min interval (minutes)" id="min-interval">
                    <input
                        id="min-interval"
                        type="number"
                        min="1"
                        step="1"
                        class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
                        value={currentSite?.minReloadInterval}
                        on:change={(e) => {
                            const minutes = parsePositiveInt(
                                e.currentTarget.value,
                            );
                            if (minutes === null) return;
                            updateSetting({
                                minReloadInterval: minutes,
                            });
                        }}
                    />
                </Field>
                <Field label="Max interval (minutes)" id="max-interval">
                    <input
                        id="max-interval"
                        type="number"
                        min="1"
                        step="1"
                        class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
                        value={currentSite?.maxReloadInterval}
                        on:change={(e) => {
                            const minutes = parsePositiveInt(
                                e.currentTarget.value,
                            );
                            if (minutes === null) return;
                            updateSetting({
                                maxReloadInterval: minutes,
                            });
                        }}
                    />
                </Field>
            {/if}
        </Section>

        <Section title="Developer" icon={Bug}>
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
                <Subsection
                    className="flex flex-col gap-2"
                    borderClass="border-white/4"
                >
                    <span class="text-[0.78rem] font-medium text-gray-500"
                        >Reset to default</span
                    >
                    <div class="flex flex-wrap gap-1">
                        {#each resettableKeys as key}
                            <button
                                class="py-1 px-2 rounded border border-white/8 bg-white/4 text-gray-300 text-[0.72rem] font-[inherit] cursor-pointer hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
                                on:click={() => resetKey(key)}
                            >
                                {formatKey(key)}
                            </button>
                        {/each}
                    </div>
                </Subsection>
                <Subsection
                    className="flex flex-col gap-2"
                    borderClass="border-white/4"
                >
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[0.78rem] font-medium text-gray-300"
                            >Test notifications</span
                        >
                        <span class="text-[0.72rem] text-gray-500">
                            Send a sample notification to verify routing and
                            provider setup.
                        </span>
                    </div>
                    <div class="grid grid-cols-3 gap-1.5">
                        {#each testNotificationModes as mode}
                            <button
                                class="py-1.5 px-2 rounded border border-white/10 bg-white/4 text-gray-200 text-[0.72rem] font-medium font-[inherit] cursor-pointer hover:bg-white/8 hover:border-white/20"
                                on:click={() => sendTestNotification(mode)}
                            >
                                {capitalize(mode)}
                            </button>
                        {/each}
                    </div>
                </Subsection>
            {/if}
        </Section>
    {/if}

    <ToastHost />
</div>

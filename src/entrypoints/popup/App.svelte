<script lang="ts">
    import { onMount } from "svelte";
    import {
        defaultGlobalSettings,
        defaultGlobalSettingsKeys,
    } from "@/store/defaultGlobalSettings";
    import { sites, type SupportedHosts } from "@/adapters/siteConfigs";
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
    import {
        defaultSiteSettings,
        defaultSiteSettingsKeys,
    } from "@/store/defaultSiteSettings";
    import { applyMutation } from "./handlers/mutations";

    import type { GlobalSettings, SiteSettings } from "@/store/types";
    import type { NewSurveyNotificationsSettings } from "@/store/types";
    import type {
        MessageMap,
        StoreMutationMessageType,
    } from "@/messages/types";

    const siteKeys = Object.keys(sites) as SupportedHosts[];
    const providerSetupUrl =
        "https://github.com/theChantu/survey-enhancer#provider-setup";

    let selectedSite: SupportedHosts = siteKeys[0];
    type LoadedSettings = {
        globals: GlobalSettings;
        sites: Partial<Record<SupportedHosts, SiteSettings>>;
    };

    let loadedSettings: LoadedSettings = {
        globals: defaultGlobalSettings,
        sites: {},
    };

    $: currentSite = loadedSettings.sites[selectedSite];

    let settingsMutationQueue = Promise.resolve();

    type QueueMutationType = Exclude<StoreMutationMessageType, "store-fetch">;

    function queueMutation<T extends QueueMutationType>(
        type: T,
        values: MessageMap[T],
    ): Promise<void> {
        settingsMutationQueue = settingsMutationQueue
            .then(async () => {
                const result = await applyMutation(type, values);
                if (result.namespace === "globals") {
                    loadedSettings.globals = {
                        ...loadedSettings.globals,
                        ...result.data,
                    };
                    return;
                }

                const siteUrl = siteKeys.find(
                    (url) => sites[url].name === result.entry,
                );
                if (!siteUrl) return;

                const current = loadedSettings.sites[siteUrl];
                if (!current) return;

                loadedSettings.sites[siteUrl] = {
                    ...current,
                    ...result.data,
                };
            })
            .catch((error) => {
                console.error(error);
            });

        return settingsMutationQueue;
    }

    function siteTarget(siteUrl: SupportedHosts = selectedSite) {
        return {
            namespace: "sites" as const,
            entry: sites[siteUrl].name,
        };
    }

    type ResearcherKey = Exclude<
        keyof NewSurveyNotificationsSettings,
        "surveys" | "cachedResearchers"
    >;

    function addResearcher(key: ResearcherKey, name: string) {
        const loadedSite = loadedSettings.sites[selectedSite];
        if (
            !loadedSite ||
            loadedSite.newSurveyNotifications?.[key].includes(name)
        )
            return;
        void queueMutation("store-patch", {
            ...siteTarget(),
            data: {
                newSurveyNotifications: {
                    [key]: [...loadedSite.newSurveyNotifications[key], name],
                },
            },
        });
    }

    function removeResearcher(key: ResearcherKey, name: string) {
        const loadedSite = loadedSettings.sites[selectedSite];
        if (!loadedSite) return;
        void queueMutation("store-patch", {
            ...siteTarget(),
            data: {
                newSurveyNotifications: {
                    [key]: loadedSite.newSurveyNotifications[key].filter(
                        (n) => n !== name,
                    ),
                },
            },
        });
    }

    type GlobalResetKey = Exclude<
        keyof typeof defaultGlobalSettings,
        "enableDebug"
    >;
    type SiteResetKey = keyof typeof defaultSiteSettings;

    const resettableGlobalKeys = Object.keys(defaultGlobalSettings).filter(
        (k) => k in defaultGlobalSettings && k !== "enableDebug",
    ) as GlobalResetKey[];
    const resettableSiteKeys = Object.keys(
        defaultSiteSettings,
    ) as SiteResetKey[];

    function resetGlobalKey(key: GlobalResetKey) {
        const previous = structuredClone(loadedSettings.globals?.[key]);
        const next = structuredClone(defaultGlobalSettings[key]);

        void queueMutation("store-set", {
            namespace: "globals",
            data: { [key]: next },
        });

        showActionToast({
            message: `Reset ${formatKey(key)}.`,
            actionLabel: "Undo",
            onAction: () =>
                previous !== undefined
                    ? queueMutation("store-set", {
                          namespace: "globals",
                          data: { [key]: previous },
                      })
                    : Promise.resolve(),
        });
    }

    function resetSiteKey(
        key: SiteResetKey,
        siteUrl: SupportedHosts = selectedSite,
    ) {
        const site = loadedSettings.sites[siteUrl];
        if (!site) return;

        const previous = structuredClone(site[key]);
        const next = structuredClone(defaultSiteSettings[key]);

        void queueMutation("store-set", {
            ...siteTarget(siteUrl),
            data: { [key]: next },
        });

        showActionToast({
            message: `Reset ${formatKey(key)}.`,
            actionLabel: "Undo",
            onAction: () =>
                queueMutation("store-set", {
                    ...siteTarget(siteUrl),
                    data: { [key]: previous },
                }),
        });
    }

    function formatKey(key: string) {
        return key.replace(/([A-Z])/g, " $1").toLowerCase();
    }

    const testNotificationModes = ["auto", "provider", "browser"] as const;
    type TestNotificationDelivery = (typeof testNotificationModes)[number];

    async function notifyTestNotification(
        delivery: TestNotificationDelivery,
    ): Promise<boolean> {
        try {
            return await sendExtensionMessage({
                type: "notification",
                data: {
                    siteName: sites[selectedSite].name,
                    notifications: [
                        {
                            title: "Test Notification",
                            message: "This is a test notification.",
                            link: "https://example.com",
                            iconUrl: browser.runtime.getURL("/icon-48.png"),
                        },
                    ],
                    delivery,
                },
            });
        } catch (error) {
            console.error("Failed to send test notification:", error);
            return false;
        }
    }

    async function sendTestNotification(
        delivery: TestNotificationDelivery = "auto",
    ) {
        const success = await notifyTestNotification(delivery);
        showToast(
            success
                ? "Notification sent successfully."
                : "Failed to send notification.",
        );
    }

    function parsePositiveInt(raw: string): number | null {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 1) return null;
        return Math.round(value);
    }

    let hasLoadedGlobals = false;

    async function loadGlobalsOnce() {
        if (hasLoadedGlobals) return;
        try {
            const response = await sendExtensionMessage({
                type: "store-fetch",
                data: {
                    namespace: "globals",
                    data: { keys: defaultGlobalSettingsKeys },
                },
            });

            loadedSettings.globals = {
                ...defaultGlobalSettings,
                ...response.data,
            };
            hasLoadedGlobals = true;
        } catch (error) {
            console.error(error);
        }
    }

    async function handleLoadSite(siteUrl: SupportedHosts) {
        await loadGlobalsOnce();
        if (siteUrl in loadedSettings.sites) return;
        try {
            const response = await sendExtensionMessage({
                type: "store-fetch",
                data: {
                    ...siteTarget(siteUrl),
                    data: { keys: defaultSiteSettingsKeys },
                },
            });

            if (response.namespace === "globals") return;

            loadedSettings.sites[siteUrl] = {
                ...defaultSiteSettings,
                ...response.data,
            };
        } catch (error) {
            console.error(error);
        }
    }

    onMount(async () => {
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        if (tab?.url) {
            try {
                const host = new URL(tab.url).hostname as SupportedHosts;
                if (host in sites) selectedSite = host;
            } catch (error) {
                console.error(error);
            }
        }

        await handleLoadSite(selectedSite);
    });

    $: siteEnhancements = new Set(sites[selectedSite].enhancements);
</script>

<div class="p-4 flex flex-col gap-4">
    <div>
        <div class="relative text-gray-500">
            <select
                class="w-full py-2 pl-2.5 pr-8 rounded-md border border-white/8 bg-white/4 hover:bg-white/4 text-gray-100 text-[0.9rem] font-semibold font-[inherit] outline-none appearance-none cursor-pointer focus:border-white/20 [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                value={selectedSite}
                on:change={(e) => {
                    selectedSite = e.currentTarget.value as SupportedHosts;
                    handleLoadSite(selectedSite);
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
        {#if siteEnhancements.has("surveyLinks") || siteEnhancements.has("highlightRates")}
            <Section title="General" icon={SettingsIcon}>
                {#if siteEnhancements.has("surveyLinks")}
                    <Toggle
                        title="Survey links"
                        description="Show direct survey links when available."
                        value={currentSite?.surveyLinks.enabled}
                        onClick={() =>
                            queueMutation("store-patch", {
                                ...siteTarget(),
                                data: {
                                    surveyLinks: {
                                        enabled:
                                            !currentSite?.surveyLinks.enabled,
                                    },
                                },
                            })}
                    />
                {/if}

                {#if siteEnhancements.has("highlightRates")}
                    <Toggle
                        title="Highlight rates"
                        description="Visually emphasize stronger survey rates."
                        value={currentSite?.highlightRates.enabled}
                        onClick={() =>
                            queueMutation("store-patch", {
                                ...siteTarget(),
                                data: {
                                    highlightRates: {
                                        enabled:
                                            !currentSite?.highlightRates
                                                .enabled,
                                    },
                                },
                            })}
                    />
                {/if}
            </Section>
        {/if}

        {#if siteEnhancements.has("currencyConversion")}
            <Section title="Currency" icon={CircleDollarSign}>
                <Toggle
                    title="Currency conversion"
                    description="Convert rewards into your selected currency."
                    value={currentSite?.currencyConversion.enabled}
                    onClick={() =>
                        queueMutation("store-patch", {
                            ...siteTarget(),
                            data: {
                                currencyConversion: {
                                    enabled:
                                        !currentSite?.currencyConversion
                                            .enabled,
                                },
                            },
                        })}
                />
                <Field label="Selected currency" id="currency">
                    <div class="relative text-gray-500">
                        <select
                            id="currency"
                            class="w-full py-2 pl-2.5 pr-8 rounded-md border border-white/8 bg-white/4 hover:bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none appearance-none cursor-pointer focus:border-white/20 [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                            bind:value={
                                currentSite.currencyConversion.selectedCurrency
                            }
                            on:change={(e) =>
                                queueMutation("store-patch", {
                                    ...siteTarget(),
                                    data: {
                                        currencyConversion: {
                                            selectedCurrency: e.currentTarget
                                                .value as SiteSettings["currencyConversion"]["selectedCurrency"],
                                        },
                                    },
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

        {#if siteEnhancements.has("newSurveyNotifications")}
            <Section title="Notifications" icon={Bell}>
                <Toggle
                    title="New survey notifications"
                    description="Send a desktop notification when a new survey appears."
                    value={currentSite?.newSurveyNotifications.enabled}
                    onClick={() =>
                        queueMutation("store-patch", {
                            ...siteTarget(),
                            data: {
                                newSurveyNotifications: {
                                    enabled:
                                        !currentSite?.newSurveyNotifications
                                            .enabled,
                                },
                            },
                        })}
                />
                {#if currentSite?.newSurveyNotifications.enabled}
                    <TagInput
                        title="Included researchers"
                        values={currentSite?.newSurveyNotifications
                            .includedResearchers}
                        suggestions={Object.keys(
                            currentSite?.newSurveyNotifications
                                .cachedResearchers,
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
                        values={currentSite?.newSurveyNotifications
                            .excludedResearchers}
                        suggestions={Object.keys(
                            currentSite?.newSurveyNotifications
                                .cachedResearchers,
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
                        Math.round(loadedSettings.globals.idleThreshold / 60),
                    )}
                    on:change={(e) => {
                        const minutes = parsePositiveInt(e.currentTarget.value);
                        if (minutes === null) return;
                        queueMutation("store-patch", {
                            namespace: "globals",
                            data: {
                                idleThreshold: minutes * 60,
                            },
                        });
                    }}
                />
            </Field>

            <Subsection withDivider={false}>
                <Toggle
                    title="Telegram"
                    description="Send notifications via Telegram bot when idle."
                    value={loadedSettings.globals.providers.telegram?.enabled ??
                        false}
                    onClick={() =>
                        queueMutation("store-patch", {
                            namespace: "globals",
                            data: {
                                providers: {
                                    telegram: {
                                        enabled:
                                            !loadedSettings.globals.providers
                                                .telegram?.enabled,
                                    },
                                },
                            },
                        })}
                />
                {#if loadedSettings.globals.providers.telegram?.enabled}
                    <Field label="Bot token" id="telegram-bot-token">
                        <input
                            id="telegram-bot-token"
                            type="password"
                            class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
                            value={loadedSettings.globals.providers.telegram
                                ?.botToken ?? ""}
                            on:change={(e) =>
                                queueMutation("store-patch", {
                                    namespace: "globals",
                                    data: {
                                        providers: {
                                            telegram: {
                                                botToken: e.currentTarget.value,
                                            },
                                        },
                                    },
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
                value={currentSite?.autoReload.enabled}
                onClick={() =>
                    queueMutation("store-patch", {
                        ...siteTarget(),
                        data: {
                            autoReload: {
                                enabled: !currentSite?.autoReload.enabled,
                            },
                        },
                    })}
            />
            {#if currentSite?.autoReload.enabled}
                <Field label="Min interval (minutes)" id="min-interval">
                    <input
                        id="min-interval"
                        type="number"
                        min="1"
                        step="1"
                        class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
                        value={currentSite?.autoReload.minInterval}
                        on:change={(e) => {
                            const minutes = parsePositiveInt(
                                e.currentTarget.value,
                            );
                            if (minutes === null) return;
                            queueMutation("store-patch", {
                                ...siteTarget(),
                                data: {
                                    autoReload: {
                                        minInterval: minutes,
                                    },
                                },
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
                        value={currentSite?.autoReload.maxInterval}
                        on:change={(e) => {
                            const minutes = parsePositiveInt(
                                e.currentTarget.value,
                            );
                            if (minutes === null) return;
                            queueMutation("store-patch", {
                                ...siteTarget(),
                                data: {
                                    autoReload: {
                                        maxInterval: minutes,
                                    },
                                },
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
                value={loadedSettings.globals.enableDebug}
                onClick={() =>
                    queueMutation("store-patch", {
                        namespace: "globals",
                        data: {
                            enableDebug: !loadedSettings.globals.enableDebug,
                        },
                    })}
            />

            {#if loadedSettings.globals.enableDebug}
                <Subsection
                    className="flex flex-col gap-2"
                    borderClass="border-white/4"
                >
                    <span class="text-[0.78rem] font-medium text-gray-500"
                        >Reset to default</span
                    >
                    <div class="flex flex-wrap gap-1">
                        {#each resettableGlobalKeys as key}
                            <button
                                class="py-1 px-2 rounded border border-white/8 bg-white/4 text-gray-300 text-[0.72rem] font-[inherit] cursor-pointer hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
                                on:click={() => resetGlobalKey(key)}
                            >
                                {formatKey(key)}
                            </button>
                        {/each}
                        {#each resettableSiteKeys as key}
                            <button
                                class="py-1 px-2 rounded border border-white/8 bg-white/4 text-gray-300 text-[0.72rem] font-[inherit] cursor-pointer hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
                                on:click={() => resetSiteKey(key)}
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

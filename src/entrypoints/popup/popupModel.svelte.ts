import {
    sites,
    supportedHosts,
    type SiteName,
    type SupportedHosts,
} from "@/adapters/siteConfigs";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import {
    defaultGlobalSettings,
    defaultGlobalSettingsKeys,
} from "@/store/defaultGlobalSettings";
import {
    defaultSiteSettings,
    defaultSiteSettingsKeys,
} from "@/store/defaultSiteSettings";
import { runtimeState, settingsState, uiState } from "./state.svelte";

import type {
    Message,
    MessageMap,
    RuntimeChangedMessage,
    RuntimeDataMap,
    StoreChangedMessage,
    StoreMutationMessageType,
} from "@/messages/types";
import { RuntimeState } from "./types";

let globalsPromise: Promise<void> | null = null;
export let pendingMutation: Promise<void> = Promise.resolve();

const siteNameToHost = supportedHosts.reduce(
    (map, host) => {
        map[sites[host].name] = host;
        return map;
    },
    {} as Record<SiteName, SupportedHosts>,
);

function loadGlobals() {
    if (globalsPromise) return globalsPromise;

    globalsPromise = (async () => {
        const response = await sendExtensionMessage({
            type: "store-fetch",
            data: {
                namespace: "globals",
                data: { keys: defaultGlobalSettingsKeys },
            },
        });

        settingsState.globals = {
            ...defaultGlobalSettings,
            ...response.data,
        };
    })();

    return globalsPromise;
}

async function loadSite(host: SupportedHosts) {
    if (host in settingsState.sites) return;

    try {
        const response = await sendExtensionMessage({
            type: "store-fetch",
            data: {
                namespace: "sites",
                entry: sites[host].name,
                data: { keys: defaultSiteSettingsKeys },
            },
        });

        if (response.namespace === "globals") return;

        settingsState.sites[host] = {
            ...defaultSiteSettings,
            ...response.data,
        };
    } catch (error) {
        console.error(error);
    }
}

async function loadRuntimeState(host: SupportedHosts) {
    for (const channel of Object.keys(runtimeState) as (keyof RuntimeState)[]) {
        if (host in runtimeState[channel]) continue;

        try {
            const response = await sendExtensionMessage({
                type: "runtime-fetch",
                data: {
                    channel,
                    siteName: sites[host].name,
                },
            });
            runtimeState[channel][host] = response?.data ?? null;
        } catch (error) {
            console.error(error);
            runtimeState[channel][host] = null;
        }
    }
}

export function queueMutation<T extends StoreMutationMessageType>(
    type: T,
    values: MessageMap[T],
): Promise<void> {
    pendingMutation = pendingMutation
        .then(async () => {
            const result = await sendExtensionMessage({
                type,
                data: values,
            } as Message<T>);
            if (result.namespace === "globals") {
                settingsState.globals = {
                    ...settingsState.globals,
                    ...result.data,
                };
                return;
            }

            const siteUrl = siteNameToHost[result.entry];
            if (!siteUrl) return;

            const current = settingsState.sites[siteUrl];
            if (!current) return;

            settingsState.sites[siteUrl] = {
                ...current,
                ...result.data,
            };
        })
        .catch((error) => {
            console.error(error);
        });

    return pendingMutation;
}

export async function selectHost(host: SupportedHosts) {
    uiState.selectedHost = host;
    await Promise.all([loadSite(host), loadRuntimeState(host)]);
}

function applyStoreChange(payload: StoreChangedMessage) {}

function applyRuntimeChange(payload: RuntimeChangedMessage) {
    if (!(payload.channel in runtimeState)) return;

    const host = siteNameToHost[payload.siteName];
    if (!host) return;

    runtimeState[payload.channel][host] = payload.data;
}

async function initializePopup() {
    const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
    });

    if (tab?.url) {
        try {
            const host = new URL(tab.url).hostname as SupportedHosts;
            if (host in sites) {
                uiState.selectedHost = host;
            }
        } catch (error) {
            console.error(error);
        }
    }

    await Promise.all([
        loadGlobals(),
        loadSite(uiState.selectedHost),
        loadRuntimeState(uiState.selectedHost),
    ]);
}

export function initPopup() {
    const unsubscribeStore = onExtensionMessage("store-changed", (payload) => {
        applyStoreChange(payload);
    });
    const unsubscribeRuntime = onExtensionMessage(
        "runtime-changed",
        (payload) => applyRuntimeChange(payload),
    );

    void initializePopup();

    return () => {
        unsubscribeStore();
        unsubscribeRuntime();
    };
}

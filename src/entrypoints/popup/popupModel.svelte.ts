import { sites, type SupportedHosts } from "@/adapters/siteConfigs";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import {
    defaultGlobalSettings,
    defaultGlobalSettingsKeys,
} from "@/store/defaultGlobalSettings";
import {
    defaultSiteSettings,
    defaultSiteSettingsKeys,
} from "@/store/defaultSiteSettings";
import { settingsState, uiState } from "./state.svelte";

let globalsPromise: Promise<void> | null = null;

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

export async function selectHost(host: SupportedHosts) {
    uiState.selectedHost = host;
    await loadSite(host);
}

export async function initPopup() {
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

    await Promise.all([loadGlobals(), loadSite(uiState.selectedHost)]);
}

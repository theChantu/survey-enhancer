import { browser } from "#imports";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { SettingsStore } from "@/store/SettingsStore";
import { supportedSites, supportedHosts, sites } from "@/adapters/siteConfigs";
import { handleStoreFetch } from "./handlers/handleStoreFetch";
import { handleStoreMutate } from "./handlers/handleStoreMutate";
import {
    handleNotificationClicked,
    handleNotificationClosed,
    deliverNotifications,
    handleOpportunitiesDetected,
} from "./handlers/handleNotifications";
import {
    isSupportedHostTabUrl,
    getRuntimeSyncChannels,
} from "./runtime/runtimeHelpers";
import { parseJsonRequestBody } from "./network/requestBody";
import { registerRuntimeSync } from "./runtime/runtimeSync";
import { safeSendPageMessage } from "./utils/safeSendPageMessage";
import { safeSendTabMessage } from "./utils/safeSendTabMessage";
import { delay } from "@/lib/delay";

import type { Message } from "@/messages/types";

const RUNTIME_SYNC_REQUEST_RETRY_DELAY_MS = 750;
const RUNTIME_SYNC_REQUEST_ATTEMPTS = 2;

function runBackgroundScript() {
    const store = new SettingsStore();
    const requestBodies = new Map<string, unknown>();

    const filteredUrls = supportedHosts.flatMap((host) =>
        sites[host].watchedRequestTargets.map(
            (target) => `https://${target}*` as const,
        ),
    );

    browser.webRequest.onBeforeRequest.addListener(
        (details) => {
            const requestBody = parseJsonRequestBody(details.requestBody);

            if (requestBody === undefined) {
                requestBodies.delete(details.requestId);
                return undefined;
            }

            requestBodies.set(details.requestId, requestBody);
            return undefined;
        },
        { urls: filteredUrls },
        ["requestBody"],
    );

    browser.webRequest.onCompleted.addListener(
        (details) => {
            if (details.tabId < 0) return;

            const requestBody = requestBodies.get(details.requestId);
            requestBodies.delete(details.requestId);

            safeSendTabMessage(details.tabId, {
                type: "network",
                data: {
                    url: details.url,
                    method: details.method,
                    statusCode: details.statusCode,
                    ...(requestBody === undefined ? {} : { requestBody }),
                },
            });
        },
        { urls: filteredUrls },
    );

    browser.webRequest.onErrorOccurred.addListener(
        (details) => {
            requestBodies.delete(details.requestId);
        },
        { urls: filteredUrls },
    );

    async function broadcastStoreChanged(
        message: Message<"store-changed">,
        shouldSendToTab: (tab: Browser.tabs.Tab) => boolean,
    ): Promise<void> {
        await safeSendPageMessage(message);

        const tabs = await browser.tabs.query({});

        for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;
            if (!shouldSendToTab(tab)) continue;

            await safeSendTabMessage(tab.id, message);
        }
    }

    browser.notifications.onClicked.addListener((id) => {
        void handleNotificationClicked(id).catch((error) => {
            console.error("Error handling notification click:", error);
        });
    });

    browser.notifications.onClosed.addListener(async (id) =>
        handleNotificationClosed(id),
    );

    registerRuntimeSync(store);

    async function requestRuntimeSync() {
        const channels = getRuntimeSyncChannels();

        for (
            let attempt = 0;
            attempt < RUNTIME_SYNC_REQUEST_ATTEMPTS;
            attempt++
        ) {
            const tabs = await browser.tabs.query({});

            for (const tab of tabs) {
                if (!tab.id || !isSupportedHostTabUrl(tab.url)) continue;

                await safeSendTabMessage(tab.id, {
                    type: "runtime-sync-request",
                    data: { channels },
                });
            }

            if (attempt < RUNTIME_SYNC_REQUEST_ATTEMPTS - 1) {
                await delay(RUNTIME_SYNC_REQUEST_RETRY_DELAY_MS);
            }
        }
    }

    void requestRuntimeSync().catch((error) => {
        console.error("Error requesting initial runtime sync:", error);
    });

    onExtensionMessage("opportunities-detected", (payload) =>
        handleOpportunitiesDetected(store, payload),
    );

    onExtensionMessage("opportunity-alert", (payload) =>
        deliverNotifications(store, payload),
    );

    store.globals.subscribe((changed) => {
        void broadcastStoreChanged(
            {
                type: "store-changed",
                data: { namespace: "globals", data: changed },
            },
            (tab) => supportedSites.some((site) => tab.url!.includes(site)),
        ).catch((error) => {
            console.error("Error broadcasting global store change:", error);
        });
    });

    for (const siteName of supportedSites) {
        store.sites.entry(siteName).subscribe((changed) => {
            void broadcastStoreChanged(
                {
                    type: "store-changed",
                    data: {
                        namespace: "sites",
                        entry: siteName,
                        data: changed,
                    },
                },
                (tab) => tab.url!.includes(siteName),
            ).catch((error) => {
                console.error(
                    `Error broadcasting store change for "${siteName}":`,
                    error,
                );
            });
        });
    }

    onExtensionMessage("fetch", async (payload) => {
        try {
            const response = await fetch(payload.url);
            return await response.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    });

    onExtensionMessage("store-fetch", (payload) =>
        handleStoreFetch(store, payload),
    );

    onExtensionMessage("store-patch", (payload) =>
        handleStoreMutate(store, "store-patch", payload),
    );
    onExtensionMessage("store-set", (payload) =>
        handleStoreMutate(store, "store-set", payload),
    );

    onExtensionMessage("study-completion", async (payload) => {
        const { siteName } = payload;

        await store.sites.entry(siteName).update((current) => {
            const nextDailyCount =
                current.analytics.dailyStudyCompletions.count + 1;
            const nextTimestamp =
                current.analytics.dailyStudyCompletions.count === 0
                    ? Date.now()
                    : current.analytics.dailyStudyCompletions.timestamp;

            return {
                analytics: {
                    totalStudyCompletions:
                        current.analytics.totalStudyCompletions + 1,
                    bestDailyStudyCompletions: Math.max(
                        current.analytics.bestDailyStudyCompletions,
                        nextDailyCount,
                    ),
                    dailyStudyCompletions: {
                        count: nextDailyCount,
                        timestamp: nextTimestamp,
                    },
                },
            };
        });
    });
}

export { runBackgroundScript };

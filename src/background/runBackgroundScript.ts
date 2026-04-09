import { browser } from "#imports";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendTabMessage } from "@/messages/sendTabMessage";
import { SettingsStore } from "@/store/SettingsStore";
import {
    supportedSites,
    supportedHosts,
    sites,
    type SiteName,
} from "@/adapters/siteConfigs";
import { getProvider, type ProviderName } from "@/providers/providers";
import { capitalize } from "@/lib/utils";
import { handleStoreSet } from "./handlers/handleStoreSet";
import { handleStorePatch } from "./handlers/handleStorePatch";

import type { NotificationData } from "@/enhancements/NewSurveyNotificationsEnhancement";
import { handleStoreFetch } from "./handlers/handleStoreFetch";
import type {
    Message,
    MessageMap,
    RuntimeChannel,
    RuntimeDataMap,
} from "@/messages/types";
import { run } from "svelte/legacy";

function runBackgroundScript() {
    const store = new SettingsStore();
    const runtimeCache: {
        [K in RuntimeChannel]: Partial<Record<SiteName, RuntimeDataMap[K]>>;
    } = {
        studies: {},
    };

    const filteredUrls = supportedHosts.flatMap((host) =>
        sites[host].watchedRequestTargets.map(
            (target) => `https://${target}*` as const,
        ),
    );
    const defaultNotificationIconUrl = browser.runtime.getURL("/icon-48.png");

    browser.webRequest.onCompleted.addListener(
        (details) => {
            if (details.tabId < 0) return;

            sendTabMessage(details.tabId, {
                type: "network",
                data: {
                    url: details.url,
                    method: details.method,
                    statusCode: details.statusCode,
                },
            });
        },
        { urls: filteredUrls },
    );

    const notificationActions = new Map<string, () => void | Promise<void>>();

    function isMissingReceiverError(error: unknown): boolean {
        return (
            error instanceof Error &&
            error.message.includes("Receiving end does not exist")
        );
    }

    async function sendExtensionPageMessage<K extends keyof MessageMap>(
        message: Message<K>,
    ): Promise<void> {
        try {
            await browser.runtime.sendMessage(message);
        } catch (error) {
            if (!isMissingReceiverError(error)) {
                console.error("Error sending extension page message:", error);
            }
        }
    }

    async function broadcastStoreChanged(
        message: Message<"store-changed">,
        shouldSendToTab: (tab: Browser.tabs.Tab) => boolean,
    ): Promise<void> {
        await sendExtensionPageMessage(message);

        const tabs = await browser.tabs.query({});

        for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;
            if (!shouldSendToTab(tab)) continue;

            await sendTabMessage(tab.id, message);
        }
    }

    browser.notifications.onClicked.addListener(async (id) => {
        const action = notificationActions.get(id);
        if (!action) return;
        await action();

        notificationActions.delete(id);
        await browser.notifications.clear(id);
    });

    browser.notifications.onClosed.addListener(async (id) => {
        notificationActions.delete(id);
    });

    async function sendProviderNotifications(
        siteName: string,
        notifications: NotificationData[],
        providers: Awaited<ReturnType<typeof store.globals.get>>["providers"],
    ): Promise<boolean> {
        const enabledProviders = Object.entries(providers).filter(
            ([, config]) => config.enabled,
        );
        if (enabledProviders.length === 0) return false;

        let hasSuccess = false;

        for (const [name, config] of enabledProviders) {
            try {
                const provider = getProvider(name as ProviderName, config);
                const combined = notifications
                    .map((notification) => {
                        const { title, message, link } = notification;
                        return `${title}\n${message}\n${link}`;
                    })
                    .join("\n\n");

                const ok = await provider.sendMessage({
                    title: `${capitalize(siteName)} - ${notifications.length} New Survey${notifications.length > 1 ? "s" : ""}`,
                    body: combined,
                });

                if (ok) {
                    hasSuccess = true;
                    await store.globals.set({
                        providers: { [name]: provider.configData },
                    });
                } else {
                    console.error(`Provider "${name}" failed to send.`);
                }
            } catch (error) {
                console.error("Error sending notification:", error);
            }
        }

        return hasSuccess;
    }

    async function sendBrowserNotifications(
        notifications: NotificationData[],
    ): Promise<boolean> {
        let hasSuccess = false;

        for (const notification of notifications) {
            try {
                const { title, message, link, iconUrl } = notification;
                const resolvedIconUrl =
                    iconUrl && iconUrl.length > 0
                        ? iconUrl
                        : defaultNotificationIconUrl;
                const notificationId = await browser.notifications.create({
                    type: "basic",
                    iconUrl: resolvedIconUrl,
                    title,
                    message,
                });

                hasSuccess = true;
                notificationActions.set(notificationId, async () => {
                    await browser.tabs.create({
                        active: true,
                        url: link,
                    });
                });
            } catch (error) {
                console.error("Error creating browser notification:", error);
            }
        }

        return hasSuccess;
    }

    onExtensionMessage("notification", async (payload) => {
        const { siteName, notifications, delivery } = payload;
        const mode = delivery ?? "auto";

        if (mode === "browser") {
            return await sendBrowserNotifications(notifications);
        }

        const { providers, idleThreshold } = await store.globals.get([
            "providers",
            "idleThreshold",
        ]);

        if (mode === "provider") {
            return await sendProviderNotifications(
                siteName,
                notifications,
                providers,
            );
        }

        const enabledProviders = Object.entries(providers).filter(
            ([, config]) => config.enabled,
        );
        if (enabledProviders.length === 0) {
            return await sendBrowserNotifications(notifications);
        }

        const state = await browser.idle.queryState(idleThreshold);

        if (state === "idle" || state === "locked") {
            return await sendProviderNotifications(
                siteName,
                notifications,
                providers,
            );
        }

        return await sendBrowserNotifications(notifications);
    });

    store.globals.subscribe(async (changed) => {
        await broadcastStoreChanged(
            {
                type: "store-changed",
                data: { namespace: "globals", data: changed },
            },
            (tab) => supportedSites.some((site) => tab.url!.includes(site)),
        );
    });

    for (const siteName of supportedSites) {
        store.sites.entry(siteName).subscribe(async (changed) => {
            await broadcastStoreChanged(
                {
                    type: "store-changed",
                    data: {
                        namespace: "sites",
                        entry: siteName,
                        data: changed,
                    },
                },
                (tab) => tab.url!.includes(siteName),
            );
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
        handleStorePatch(store, payload),
    );
    onExtensionMessage("store-set", (payload) =>
        handleStoreSet(store, payload),
    );

    function runtimeEquals<K extends RuntimeChannel>(
        current: RuntimeDataMap[K] | undefined,
        next: RuntimeDataMap[K],
    ): boolean {
        return JSON.stringify(current ?? null) === JSON.stringify(next);
    }

    onExtensionMessage("runtime-sync", async (payload) => {
        const current = runtimeCache[payload.channel][payload.siteName];
        const unchanged = runtimeEquals(current, payload.data);
        if (unchanged) return;

        runtimeCache[payload.channel][payload.siteName] = structuredClone(
            payload.data,
        );

        await sendExtensionPageMessage({
            type: "runtime-changed",
            data: {
                channel: payload.channel,
                siteName: payload.siteName,
                data: structuredClone(payload.data),
            },
        });
    });

    onExtensionMessage("runtime-fetch", (payload) => {
        const data = runtimeCache[payload.channel][payload.siteName];
        if (data === undefined) return null;

        return {
            channel: payload.channel,
            siteName: payload.siteName,
            data: structuredClone(data),
        };
    });

    onExtensionMessage("survey-completion", async (payload) => {
        const { siteName } = payload;

        await store.sites.entry(siteName).update((current) => {
            const nextDailyCount =
                current.analytics.dailySurveyCompletions.count + 1;
            const nextTimestamp =
                current.analytics.dailySurveyCompletions.count === 0
                    ? Date.now()
                    : current.analytics.dailySurveyCompletions.timestamp;

            return {
                analytics: {
                    totalSurveyCompletions:
                        current.analytics.totalSurveyCompletions + 1,
                    bestDailySurveyCompletions: Math.max(
                        current.analytics.bestDailySurveyCompletions,
                        nextDailyCount,
                    ),
                    dailySurveyCompletions: {
                        count: nextDailyCount,
                        timestamp: nextTimestamp,
                    },
                },
            };
        });
    });
}

export { runBackgroundScript };

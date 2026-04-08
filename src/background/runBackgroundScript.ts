import { browser } from "#imports";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendTabMessage } from "@/messages/sendTabMessage";
import { SettingsStore } from "@/store/SettingsStore";
import { supportedSites, supportedHosts, sites } from "@/adapters/siteConfigs";
import { getProvider, type ProviderName } from "@/providers/providers";
import { capitalize } from "@/lib/utils";
import { handleStoreSet } from "./handlers/handleStoreSet";
import { handleStorePatch } from "./handlers/handleStorePatch";

import type { NotificationData } from "@/enhancements/NewSurveyNotificationsEnhancement";
import { handleStoreFetch } from "./handlers/handleStoreFetch";

function runBackgroundScript() {
    const store = new SettingsStore();

    const filteredUrls = supportedHosts.flatMap((host) =>
        sites[host].watchedRequestTargets.map(
            (target) => `https://${target}*` as const,
        ),
    );
    const defaultNotificationIconUrl = browser.runtime.getURL("/icon-48.png");

    browser.webRequest.onCompleted.addListener(
        (details) => {
            if (!details.tabId || details.tabId < 0) return;

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
        const tabs = await browser.tabs.query({});

        for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;
            if (!supportedSites.some((site) => tab.url!.includes(site)))
                continue;

            await sendTabMessage(tab.id, {
                type: "store-changed",
                data: { namespace: "globals", data: changed },
            });
        }
    });

    for (const siteName of supportedSites) {
        store.sites.entry(siteName).subscribe(async (changed) => {
            const tabs = await browser.tabs.query({});

            for (const tab of tabs) {
                if (!tab.id || !tab.url) continue;
                if (!tab.url.includes(siteName)) continue;

                await sendTabMessage(tab.id, {
                    type: "store-changed",
                    data: {
                        namespace: "sites",
                        entry: siteName,
                        data: changed,
                    },
                });
            }
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

    onExtensionMessage("survey-completion", async (payload) => {
        const { siteName } = payload;

        await store.sites.entry(siteName).update((current) => {
            const nextDailyCount =
                current.analytics.dailySurveyCompletions.count + 1;

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
                    },
                },
            };
        });
    });
}

export { runBackgroundScript };

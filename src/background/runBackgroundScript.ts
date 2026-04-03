import { browser } from "#imports";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendTabMessage } from "@/messages/sendTabMessage";
import { createStore } from "@/store/createStore";
import { supportedSites } from "@/adapters/siteConfigs";
import { getProvider, type ProviderName } from "@/providers/providers";
import { capitalize } from "@/lib/utils";

function runBackgroundScript() {
    const filteredUrls = supportedSites.map((site) => `https://${site}/*`);
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
        notifications: {
            title: string;
            message: string;
            surveyLink: string;
        }[],
        providers: Awaited<ReturnType<typeof store.get>>["providers"],
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
                        const { title, message, surveyLink } = notification;
                        return `${title}\n${message}\n${surveyLink}`;
                    })
                    .join("\n\n");

                const ok = await provider.sendMessage({
                    title: `${capitalize(siteName)} - ${notifications.length} New Survey${notifications.length > 1 ? "s" : ""}`,
                    body: combined,
                });

                if (ok) {
                    hasSuccess = true;
                    await store.set({ providers: { [name]: provider.configData } });
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
        notifications: {
            title: string;
            message: string;
            surveyLink: string;
            iconUrl?: string;
        }[],
    ): Promise<boolean> {
        let hasSuccess = false;

        for (const notification of notifications) {
            try {
                const { title, message, surveyLink, iconUrl } = notification;
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
                        url: surveyLink,
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

        const { providers } = await store.get(["providers"]);

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

        const { idleThreshold } = await store.get(["idleThreshold"]);
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

    const store = createStore();

    onExtensionMessage("store-fetch", async (payload) => {
        const { siteName, settings } = payload;
        const data = await store.get(siteName, settings);
        return { siteName, data };
    });

    store.subscribe("globals", async (changed) => {
        const tabs = await browser.tabs.query({});

        for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;
            if (!supportedSites.some((site) => tab.url!.includes(site)))
                continue;

            await sendTabMessage(tab.id, {
                type: "store-changed",
                data: changed,
            });
        }
    });

    store.subscribe("site", async (siteName, changed) => {
        const tabs = await browser.tabs.query({});

        for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;
            if (!tab.url.includes(siteName)) continue;

            await sendTabMessage(tab.id, {
                type: "store-changed",
                data: changed,
            });
        }
    });

    onExtensionMessage("fetch", async (payload) => {
        try {
            const response = await fetch(payload.url);
            return await response.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    });

    onExtensionMessage("store-update", async (payload) => {
        const { siteName, ...settings } = payload;
        const data = await store.update(siteName, settings);
        return { siteName, data };
    });

    onExtensionMessage("store-set", async (payload) => {
        const { siteName, ...settings } = payload;
        const data = await store.set(siteName, settings);
        return { siteName, data };
    });

    onExtensionMessage("survey-completion", async (payload) => {
        const { siteName, url } = payload;
        const { totalSurveyCompletions, dailySurveyCompletions } =
            await store.get(siteName, [
                "totalSurveyCompletions",
                "dailySurveyCompletions",
            ]);

        if (dailySurveyCompletions.urls.includes(url)) return;

        await store.update(siteName, {
            totalSurveyCompletions: totalSurveyCompletions + 1,
            dailySurveyCompletions: {
                urls: [...dailySurveyCompletions.urls, url],
            },
        });
    });
}

export { runBackgroundScript };

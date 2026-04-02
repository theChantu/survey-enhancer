import { browser } from "#imports";
import { onExtensionMessage } from "@/messages/onExtensionMessage";
import { sendTabMessage } from "@/messages/sendTabMessage";
import { createStore } from "@/store/createStore";
import { supportedSites } from "@/adapters/sites";

function runBackgroundScript() {
    const filteredUrls = supportedSites.map((site) => `https://${site}/*`);

    browser.webRequest.onCompleted.addListener(
        (details) => {
            if (!details.tabId || details.tabId < 0) return;

            sendTabMessage(details.tabId, {
                type: "network-event",
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

    onExtensionMessage("survey-notification", async (payload) => {
        const notifications = payload;

        // TODO: Query for custom idle time from the extension's settings
        // TODO: Route to Discord if queryState is idle
        const state = await browser.idle.queryState(15 * 60);
        if (state === "idle" || state === "locked") {
            // TODO: Send notification to providers
        } else {
            for (const notification of notifications) {
                const { title, message, surveyLink, iconUrl } = notification;
                const notificationId = await browser.notifications.create({
                    type: "basic",
                    iconUrl: iconUrl ?? "",
                    title,
                    message,
                });
                notificationActions.set(notificationId, async () => {
                    await browser.tabs.create({
                        active: true,
                        url: surveyLink,
                    });
                });
            }
        }
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
        await store.update(siteName, settings);
    });

    onExtensionMessage("store-set", async (payload) => {
        const { siteName, ...settings } = payload;
        await store.set(siteName, settings);
    });

    onExtensionMessage("track-survey-completion", async (payload) => {
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

    // TODO: Fetch provider API keys from the extension's storage and use them to send notifications
    // Send a notification to each provider when a new survey is detected, including the survey title, researcher, reward, and link
    // Events will be emitted from the adapter observeDom and observeNetwork methods
    // Replace current mutation observer implementation in content script with the adapter observeDom method
}

export { runBackgroundScript };

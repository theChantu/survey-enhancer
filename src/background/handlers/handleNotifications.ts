import { SettingsStore } from "@/store/SettingsStore";
import {
    getProvider,
    ProviderConfigMap,
    type ProviderName,
} from "@/providers/providers";
import { NOTIFY_TTL_MS, NAME_CACHE_TTL_MS } from "@/constants";
import { capitalize, cleanResearcherName } from "@/lib/utils";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import { sites, type SupportedHosts } from "@/adapters/siteConfigs";

import type { StudyInfo } from "@/adapters/BaseAdapter";
import type { MessageMap } from "@/messages/types";
import type { GlobalSettings } from "@/store/types";

export interface NotificationData {
    title: string;
    message: string;
    iconUrl?: string;
    link?: string;
}

const notificationActions = new Map<string, () => void | Promise<void>>();

const defaultNotificationIconUrl = browser.runtime.getURL("/icon-48.png");

async function ensureOffscreenDocument() {
    const url = "/offscreen.html";
    const offscreenUrl = browser.runtime.getURL(url);

    const contexts = await browser.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl],
    });

    if (contexts.length > 0) return;

    await browser.offscreen.createDocument({
        url,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play alert sounds for new study notifications.",
    });
}

type ProviderSendResult = {
    sent: boolean;
    updatedProviders: Partial<ProviderConfigMap>;
};

async function sendProviderNotifications(
    siteName: string,
    notifications: NotificationData[],
    providers: GlobalSettings["providers"],
): Promise<ProviderSendResult> {
    const enabledProviders = Object.entries(providers).filter(
        ([, config]) => config.enabled,
    );

    let providerSendResult: ProviderSendResult = {
        sent: false,
        updatedProviders: {},
    };

    if (enabledProviders.length === 0)
        return { sent: false, updatedProviders: {} };

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
                title: `${capitalize(siteName)} - ${notifications.length} New Study${notifications.length > 1 ? "s" : ""}`,
                body: combined,
            });

            if (ok) {
                providerSendResult.sent = true;
                providerSendResult.updatedProviders[name as ProviderName] =
                    provider.configData;
            } else {
                console.error(`Provider "${name}" failed to send.`);
            }
        } catch (error) {
            console.error("Error sending notification:", error);
        }
    }

    return providerSendResult;
}

async function sendBrowserNotifications(
    notifications: NotificationData[],
): Promise<boolean> {
    let sent = false;

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

            sent = true;
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

    return sent;
}

const siteHostByName = Object.fromEntries(
    Object.entries(sites).map(([host, config]) => [config.name, host]),
) as Record<string, SupportedHosts>;

function getSiteIconUrl(siteName: string): string | undefined {
    const host = siteHostByName[siteName];
    if (!host) return undefined;
    const config = sites[host];
    return `https://${host}${config.iconPath}`;
}

function buildNotification(
    study: StudyInfo,
    siteName: string,
): NotificationData {
    const { title, reward, rate, symbol, link } = study;

    const rewardText =
        reward !== null
            ? `${symbol ?? ""}${reward.toFixed(2)}`
            : "Unknown reward";
    const rateText =
        rate !== null ? `${symbol ?? ""}${rate.toFixed(2)}/hr` : "Unknown rate";

    const siteLabel = capitalize(siteName);

    return {
        title: title ?? siteLabel,
        message: `${siteLabel} • ${rewardText} • ${rateText}`,
        iconUrl: getSiteIconUrl(siteName),
        link: link ?? undefined,
    };
}

export async function handleStudiesDetected(
    store: SettingsStore,
    payload: MessageMap["studies-detected"],
): Promise<void> {
    const { siteName, studies, hidden } = payload;
    if (studies.length === 0) return;

    const siteStore = store.sites.entry(siteName);
    const now = Date.now();

    let newStudies: StudyInfo[] = [];
    let included: string[] = [];
    let excluded: string[] = [];

    await siteStore.update((current) => {
        const { cache } = current.studyAlerts;
        included = current.studyAlerts.included;
        excluded = current.studyAlerts.excluded;

        newStudies = studies.filter((s) => !(s.id in cache.studies));
        if (newStudies.length === 0) return {};

        const nextStudyCache = { ...cache.studies };
        for (const [key, timestamp] of Object.entries(nextStudyCache)) {
            if (now - timestamp >= NOTIFY_TTL_MS) delete nextStudyCache[key];
        }
        for (const study of newStudies) {
            nextStudyCache[study.id] = now;
        }

        const nextResearcherCache = { ...cache.researchers };
        for (const [name, timestamp] of Object.entries(nextResearcherCache)) {
            if (now - timestamp >= NAME_CACHE_TTL_MS)
                delete nextResearcherCache[name];
        }
        for (const study of newStudies) {
            if (!study.researcher) continue;
            const name = cleanResearcherName(study.researcher);
            if (!(name in cache.researchers)) nextResearcherCache[name] = now;
        }

        return {
            studyAlerts: {
                cache: {
                    studies: nextStudyCache,
                    researchers: nextResearcherCache,
                },
            },
        };
    });

    if (newStudies.length === 0) return;

    if (!hidden) return;

    const includedSet = new Set(included);
    const excludedSet = new Set(excluded);

    const notifications: NotificationData[] = [];
    for (const study of newStudies) {
        const { researcher } = study;
        if (!researcher) continue;
        const cleaned = cleanResearcherName(researcher);

        if (excludedSet.has(cleaned)) continue;
        if (includedSet.size > 0 && !includedSet.has(cleaned)) continue;

        notifications.push(buildNotification(study, siteName));
    }

    if (notifications.length === 0) return;

    await handleStudyAlert(store, {
        siteName,
        notifications,
    });
}

export async function handleStudyAlert(
    store: SettingsStore,
    payload: MessageMap["study-alert"],
): Promise<boolean> {
    const { siteName, notifications, delivery } = payload;
    const mode = delivery ?? "auto";

    const {
        notifications: {
            delivery: { browser: browserEnabled, sound },
        },
    } = await store.namespace("globals").get(["notifications"]);

    if (sound.enabled) {
        try {
            await ensureOffscreenDocument();
            await sendExtensionMessage({
                type: "play-sound",
                data: {
                    sound: sound.type,
                    volume: sound.volume,
                },
            });
        } catch (error) {
            console.error("Error playing sound:", error);
        }
    }

    if (mode === "browser") {
        if (!browserEnabled) return false;
        return await sendBrowserNotifications(notifications);
    }

    const { providers, idleThreshold } = await store.globals.get([
        "providers",
        "idleThreshold",
    ]);

    if (mode === "provider") {
        const { sent, updatedProviders } = await sendProviderNotifications(
            siteName,
            notifications,
            providers,
        );

        if (Object.keys(updatedProviders).length > 0) {
            await store.globals.set({
                providers: updatedProviders,
            });
        }

        return sent;
    }

    const enabledProviders = Object.entries(providers).filter(
        ([, config]) => config.enabled,
    );
    if (browserEnabled && enabledProviders.length === 0) {
        return await sendBrowserNotifications(notifications);
    }

    const state = await browser.idle.queryState(idleThreshold);

    if (state === "idle" || state === "locked") {
        const { sent, updatedProviders } = await sendProviderNotifications(
            siteName,
            notifications,
            providers,
        );

        if (Object.keys(updatedProviders).length > 0) {
            await store.globals.set({
                providers: updatedProviders,
            });
        }

        return sent;
    }

    if (browserEnabled) return await sendBrowserNotifications(notifications);

    return false;
}

export async function handleNotificationClicked(id: string): Promise<void> {
    const action = notificationActions.get(id);
    if (!action) return;
    await action();

    notificationActions.delete(id);
    await browser.notifications.clear(id);
}

export async function handleNotificationClosed(id: string): Promise<void> {
    notificationActions.delete(id);
}

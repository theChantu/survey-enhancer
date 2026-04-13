import { browser } from "#imports";
import { readRuntimeCache, type RuntimeCache } from "./runtimeCache";
import { setBadgeCount } from "./badge";

import type { SettingsStore } from "@/store/SettingsStore";
import type { SiteName } from "@/adapters/siteConfigs";
import type { RuntimeMetaStore } from "./runtimeStrategies";

const POPUP_PORT_NAME = "popup";

export function createBadgeSync(
    store: SettingsStore,
    getRuntimeCache: () => RuntimeCache,
    getRuntimeMeta: () => RuntimeMetaStore,
) {
    let lastPopupOpenedAt = 0;
    let popupOpen = false;

    let badgeSyncReady: Promise<void> | null = null;

    function ensureBadgeSync() {
        badgeSyncReady ??= (async () => {
            try {
                const globals = await store.globals.get(["lastPopupOpenedAt"]);
                lastPopupOpenedAt = globals.lastPopupOpenedAt;
            } catch (error) {
                lastPopupOpenedAt = 0;
                console.error("Error initializing badge sync:", error);
            }
        })();

        return badgeSyncReady;
    }

    store.globals.subscribe((changed) => {
        if (changed.lastPopupOpenedAt === undefined) return;
        lastPopupOpenedAt = changed.lastPopupOpenedAt;
        void recompute();
    });

    browser.runtime.onConnect.addListener((port) => {
        if (port.name !== POPUP_PORT_NAME) return;
        popupOpen = true;
        void recompute();

        port.onDisconnect.addListener(() => {
            popupOpen = false;
            void recompute();
        });
    });

    function countNewStudies(): number {
        if (popupOpen) return 0;

        const runtimeCache = getRuntimeCache();
        const runtimeMeta = getRuntimeMeta();
        let count = 0;

        for (const siteName of Object.keys(
            runtimeCache.studies,
        ) as SiteName[]) {
            const aggregated = readRuntimeCache(
                runtimeCache,
                "studies",
                siteName,
            );
            if (!aggregated) continue;

            const meta = runtimeMeta.studies?.[siteName];
            for (const study of aggregated) {
                const firstSeenAt = meta?.[study.id]?.firstSeenAt ?? 0;
                if (firstSeenAt > lastPopupOpenedAt) count += 1;
            }
        }

        return count;
    }

    async function recompute(): Promise<void> {
        ensureBadgeSync();
        await setBadgeCount(countNewStudies());
    }

    return { recompute };
}

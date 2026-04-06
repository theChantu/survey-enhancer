import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
import { defaultSettings } from "@/store/defaultSettings";
import {
    defaultSiteSettings,
    defaultSiteSettingsKeys,
} from "@/store/defaultSiteSettings";
import {
    defaultGlobalSettings,
    defaultGlobalSettingsKeys,
} from "@/store/defaultGlobalSettings";

import type { GlobalSettings, SiteSettings } from "@/store/types";
import type { SiteName } from "@/adapters/siteConfigs";

type LoadedSettings = {
    globals: GlobalSettings;
    site: SiteSettings;
};

export async function loadSettings(
    siteName: SiteName,
): Promise<LoadedSettings> {
    let siteSettings = (await sendExtensionMessage({
        type: "store-fetch",
        data: {
            namespace: "sites",
            entry: siteName,
            data: { keys: defaultSiteSettingsKeys },
        },
    })) ?? { namespace: "sites", entry: siteName, data: defaultSiteSettings };

    let globalSettings = (await sendExtensionMessage({
        type: "store-fetch",
        data: {
            namespace: "globals",
            data: { keys: defaultGlobalSettingsKeys },
        },
    })) ?? { namespace: "globals", data: defaultGlobalSettings };

    return {
        globals: { ...defaultGlobalSettings, ...globalSettings.data },
        site: { ...defaultSiteSettings, ...siteSettings.data },
    };
}

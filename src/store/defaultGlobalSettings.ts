import type { GlobalSettings } from "./types";

const defaultGlobalSettings = Object.freeze({
    enableDebug: false,
    providers: {},
}) satisfies GlobalSettings;

const defaultGlobalSettingsKeys = Object.keys(
    defaultGlobalSettings,
) as (keyof typeof defaultGlobalSettings)[];

export { defaultGlobalSettings, defaultGlobalSettingsKeys };

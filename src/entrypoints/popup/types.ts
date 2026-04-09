import type { GlobalSettings, SiteSettings } from "@/store/types";
import type { SiteName, SupportedHosts } from "@/adapters/siteConfigs";
import type {
    MessageMap,
    RuntimeDataMap,
    StoreMutationMessageType,
} from "@/messages/types";

export type SettingsState = {
    globals: GlobalSettings;
    sites: Partial<Record<SupportedHosts, SiteSettings>>;
};

export type RuntimeState = {
    [K in keyof RuntimeDataMap]: Partial<
        Record<SupportedHosts, RuntimeDataMap[K] | null>
    >;
};

export type ActiveSiteState = {
    url: SupportedHosts;
    name: SiteName;
    settings?: SiteSettings;
};

export type SettingComponentProps = {
    activeSite: ActiveSiteState;
    settingsState: SettingsState;
};

export type QueueMutation = <T extends StoreMutationMessageType>(
    type: T,
    values: MessageMap[T],
) => Promise<void>;

type SiteMutationModel = {
    queueMutation: QueueMutation;
    siteName: SiteName;
};

type GlobalMutationModel = {
    queueMutation: QueueMutation;
};

export type HighlightSettingsModel = SiteMutationModel & {
    highlightRates: SiteSettings["highlightRates"];
};

export type CurrencySettingsModel = SiteMutationModel & {
    currencyConversion: SiteSettings["currencyConversion"];
};

export type NotificationSettingsModel = SiteMutationModel & {
    newSurveyNotifications: SiteSettings["newSurveyNotifications"];
};

export type ProviderSettingsModel = GlobalMutationModel & {
    idleThreshold: GlobalSettings["idleThreshold"];
    providers: GlobalSettings["providers"];
};

export type AutoReloadIntervalSetting = Exclude<
    keyof SiteSettings["autoReload"],
    "enabled"
>;

export type AutoReloadSettingsModel = SiteMutationModel & {
    autoReload: SiteSettings["autoReload"];
};

export type DebugSettingsModel = GlobalMutationModel & SettingComponentProps;

export type AnalyticsModel = SiteSettings["analytics"];

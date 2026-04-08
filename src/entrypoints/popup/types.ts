import type { Currency, GlobalSettings, SiteSettings } from "@/store/types";
import type { SiteName, SupportedHosts } from "@/adapters/siteConfigs";

export type SettingsState = {
    globals: GlobalSettings;
    sites: Partial<Record<SupportedHosts, SiteSettings>>;
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

export type ToggleControlComponentProps = {
    onToggle: () => void;
};

export type HighlightSettingsModel = ToggleControlComponentProps & {
    highlightRates: SiteSettings["highlightRates"];
};

export type CurrencySettingsModel = ToggleControlComponentProps & {
    currencyConversion: SiteSettings["currencyConversion"];
    onCurrencyChange: (currency: Currency) => void;
};

export type NotificationSettingsModel = ToggleControlComponentProps & {
    newSurveyNotifications: SiteSettings["newSurveyNotifications"];
    onAddIncluded: (name: string) => void;
    onRemoveIncluded: (name: string) => void;
    onAddExcluded: (name: string) => void;
    onRemoveExcluded: (name: string) => void;
};

export type ProviderSettingsModel = {
    idleThreshold: GlobalSettings["idleThreshold"];
    providers: GlobalSettings["providers"];
    onIdleThresholdChange: (minutes: number) => void;
    onBotTokenChange: (token: string) => void;
    onTelegramToggle: () => void;
};

export type AutoReloadIntervalSetting = Exclude<
    keyof SiteSettings["autoReload"],
    "enabled"
>;

export type AutoReloadSettingsModel = ToggleControlComponentProps & {
    autoReload: SiteSettings["autoReload"];
    onIntervalChange: (key: AutoReloadIntervalSetting, value: number) => void;
};

export type DebugSettingsModel = ToggleControlComponentProps &
    SettingComponentProps;

export type AnalyticsModel = SiteSettings["analytics"];

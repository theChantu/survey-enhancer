import type { SiteName, SupportedHosts } from "@/adapters/siteConfigs";
import type {
    MessageMap,
    RuntimeOutputDataMap,
    StoreMutationMessageType,
} from "@/messages/types";
import type { GlobalSettings, SiteSettings } from "@/store/types";

export type SettingsState = {
    globals: GlobalSettings;
    sites: Partial<Record<SupportedHosts, SiteSettings>>;
};

export const tabs = ["opportunities", "analytics", "settings"] as const;

export type PopupTab = (typeof tabs)[number];

export const filterChips = ["highRate", "quick", "recent"] as const;
export type FilterChip = (typeof filterChips)[number];

export type UiState = {
    selectedHost: SupportedHosts;
    selectedTab: PopupTab;
    detectedHost: SupportedHosts | null;
    platformFilter: SupportedHosts | "all";
    activeFilters: FilterChip[];
};

export type RuntimeState = {
    [K in keyof RuntimeOutputDataMap]: Partial<
        Record<SupportedHosts, RuntimeOutputDataMap[K] | null>
    >;
};

export type ActiveSiteState = {
    url: SupportedHosts;
    name: SiteName;
    settings?: SiteSettings;
};

type RuntimeOpportunity = RuntimeOutputDataMap["opportunities"][number];

export type OpportunityItem = RuntimeOpportunity & {
    host: SupportedHosts;
    siteName: SiteName;
    siteLabel: string;
    order: number;
    color: string | null;
    normalizedReward: number | null;
    normalizedRate: number | null;
    sortCompletionMinutes: number | null;
    matchesAlertRules: boolean;
};

export type StudyItem = Extract<OpportunityItem, { kind: "study" }>;
export type ProjectItem = Extract<OpportunityItem, { kind: "project" }>;

export type SettingComponentProps = {
    activeSite: ActiveSiteState;
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
    conversionRates: GlobalSettings["conversionRates"];
    currency: GlobalSettings["currency"];
    highlightRates: GlobalSettings["highlightRates"];
};

export type CurrencySettingsModel = SiteMutationModel & {
    currency: GlobalSettings["currency"];
};

export type NotificationSettingsModel = SiteMutationModel & {
    notifications: GlobalSettings["notifications"];
    opportunityAlerts: SiteSettings["opportunityAlerts"];
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

export type DebugSettingsModel = GlobalMutationModel &
    SettingComponentProps & {
        settingsState: SettingsState;
    };

export type AnalyticsModel = SiteSettings["analytics"];

export type OpportunitiesTabModel = SettingComponentProps & {};

export type AnalyticsTabModel = {
    sites: SettingsState["sites"];
};

export type SettingsTabModel = SettingComponentProps & {};

export type StudyCardModel = {
    item: StudyItem;
};

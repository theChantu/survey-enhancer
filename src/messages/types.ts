import type { Settings, SettingsUpdate } from "@/store/createStore";
import type { SiteName } from "@/adapters/siteConfigs";
import type { NotificationData } from "@/enhancements/NewSurveyNotificationsEnhancement";

type StoreUpdateMessage = SettingsUpdate & {
    siteName: SiteName;
};

type StoreSetMessage = SettingsUpdate & {
    siteName: SiteName;
};

type StoreMutationResponse = {
    siteName: SiteName;
    data: SettingsUpdate;
};

type StoreFetchMessage = {
    siteName: SiteName;
    settings: (keyof Settings)[];
};

type SurveyNotificationMessage = {
    siteName: SiteName;
    notifications: NotificationData[];
};

interface MessageMap {
    "store-fetch": StoreFetchMessage;
    "survey-notification": SurveyNotificationMessage;
    "store-update": StoreUpdateMessage;
    "store-set": StoreSetMessage;
    "store-changed": SettingsUpdate;
    fetch: { url: string };
    "network-event": { url: string; method: string; statusCode: number };
    "track-survey-completion": { siteName: SiteName; url: string };
}

interface ResponseMap {
    "store-fetch": { siteName: SiteName; data: Settings } | null;
    "survey-notification": void;
    "store-update": StoreMutationResponse;
    "store-set": StoreMutationResponse;
    "store-changed": void;
    fetch: unknown;
    "network-event": void;
    "track-survey-completion": void;
}

type MessageResponse<K extends keyof MessageMap> = K extends keyof ResponseMap
    ? ResponseMap[K]
    : void;

type HandlerPayload<K extends keyof MessageMap> =
    MessageMap[K] extends undefined ? undefined : MessageMap[K];

type Message<K extends keyof MessageMap = keyof MessageMap> =
    K extends keyof MessageMap
        ? MessageMap[K] extends undefined
            ? { type: K }
            : { type: K; data: MessageMap[K] }
        : never;

export { MessageMap, MessageResponse, HandlerPayload, Message };

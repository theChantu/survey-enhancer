import type { Settings } from "@/store/types";
import type { SettingsUpdate, SettingsPatch } from "@/store/createStore";
import type { SiteName } from "@/adapters/siteConfigs";
import type { NotificationData } from "@/enhancements/NewSurveyNotificationsEnhancement";

type StoreUpdateMessage = {
    siteName: SiteName;
    data: SettingsPatch;
};

type StoreSetMessage = {
    siteName: SiteName;
    data: SettingsUpdate;
};

type StoreMutationResponse = {
    siteName: SiteName;
    data: SettingsUpdate;
};

type StoreFetchMessage = {
    siteName: SiteName;
    settings: (keyof Settings)[];
};

type NotificationMessage = {
    siteName: SiteName;
    notifications: NotificationData[];
    delivery?: "auto" | "provider" | "browser";
};

interface MessageMap {
    "store-fetch": StoreFetchMessage;
    notification: NotificationMessage;
    "store-set": StoreSetMessage;
    "store-update": StoreUpdateMessage;
    "store-changed": SettingsUpdate;
    fetch: { url: string };
    network: { url: string; method: string; statusCode: number };
    "survey-completion": { siteName: SiteName; url: string };
}

interface ResponseMap {
    "store-fetch": { siteName: SiteName; data: Settings } | null;
    notification: boolean;
    "store-update": StoreMutationResponse;
    "store-set": StoreMutationResponse;
    "store-changed": void;
    fetch: unknown;
    network: void;
    "survey-completion": void;
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

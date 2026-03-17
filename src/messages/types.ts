import type { Settings, SettingsUpdate } from "@/store/createStore";
import type { SiteName } from "@/adapters/sites";

type StoreUpdateMessage = SettingsUpdate & {
    siteName: SiteName;
};

type StoreSetMessage = SettingsUpdate & {
    siteName: SiteName;
};

type StoreFetchMessage = {
    url: string;
    settings: (keyof Settings)[];
};

interface MessageMap {
    "store-fetch": StoreFetchMessage;
    "survey-notification": {
        title: string;
        message: string;
        iconUrl?: string;
        surveyLink: string;
    };
    "store-update": StoreUpdateMessage;
    "store-set": StoreSetMessage;
    "store-changed": SettingsUpdate;
}

interface ResponseMap {
    "store-fetch": { siteName: SiteName; data: Settings } | null;
    "survey-notification": void;
    "store-update": void;
    "store-set": void;
    "store-changed": void;
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

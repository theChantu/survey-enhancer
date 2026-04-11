import type {
    GlobalSettings,
    NotificationSound,
    SiteSettings,
} from "@/store/types";
import type {
    SiteSettingsSet,
    GlobalSettingsSet,
    SiteSettingsPatch,
    GlobalSettingsPatch,
    SiteSettingsChange,
    GlobalSettingsChange,
} from "@/store/SettingsStore";
import type { SiteName } from "@/adapters/siteConfigs";
import type { StudyInfo } from "@/adapters/BaseAdapter";
import type { NotificationData } from "@/background/handlers/handleNotifications";
import type { NetworkRequestEvent } from "@/events/network";

type GlobalsTarget<TData> = {
    namespace: "globals";
    data: TData;
};

type SiteEntryTarget<TData> = {
    namespace: "sites";
    entry: SiteName;
    data: TData;
};

type StoreTarget<TGlobal, TSite> =
    | GlobalsTarget<TGlobal>
    | SiteEntryTarget<TSite>;

export type StorePatchMessage = StoreTarget<
    GlobalSettingsPatch,
    SiteSettingsPatch
>;
export type StorePatchResponse = StoreTarget<
    GlobalSettingsSet,
    SiteSettingsSet
>;

export type StoreSetMessage = StoreTarget<GlobalSettingsSet, SiteSettingsSet>;
export type StoreSetResponse = StoreSetMessage;

export type StoreChangedMessage = StoreTarget<
    GlobalSettingsChange,
    SiteSettingsChange
>;

export type StoreFetchMessage = StoreTarget<
    { keys: readonly (keyof GlobalSettings)[] },
    { keys: readonly (keyof SiteSettings)[] }
>;
export type StoreFetchResponse = StoreTarget<
    Partial<GlobalSettings>,
    Partial<SiteSettings>
>;

export interface StoreMutationMessage {
    "store-set": StoreSetMessage;
    "store-patch": StorePatchMessage;
}

export type StoreMutationMessageType = keyof StoreMutationMessage;

export type StudiesDetectedMessage = {
    siteName: SiteName;
    studies: StudyInfo[];
    hidden: boolean;
};

export type NotificationMessage = {
    siteName: SiteName;
    notifications: NotificationData[];
    delivery?: "auto" | "provider" | "browser";
};

type PlaySoundMessage = {
    sound: NotificationSound;
    volume: number;
};

export type RuntimeSeenMeta = {
    firstSeenAt: number;
    lastSeenAt: number;
};

export type RuntimeInputDataMap = {
    studies: StudyInfo[];
};

export type RuntimeOutputDataMap = {
    studies: Array<RuntimeInputDataMap["studies"][number] & RuntimeSeenMeta>;
};

export type RuntimeChannel = keyof RuntimeInputDataMap & keyof RuntimeOutputDataMap;

type RuntimeTarget<
    TDataMap extends Partial<Record<RuntimeChannel, unknown>>,
    K extends keyof TDataMap & RuntimeChannel = keyof TDataMap & RuntimeChannel,
> = {
    channel: K;
    siteName: SiteName;
    data: TDataMap[K];
};

export type RuntimeSyncMessage<K extends RuntimeChannel = RuntimeChannel> =
    RuntimeTarget<RuntimeInputDataMap, K>;

export type RuntimeSyncRequestMessage = {
    channels?: RuntimeChannel[];
};

export type RuntimeChangedMessage<K extends RuntimeChannel = RuntimeChannel> = {
    channel: K;
    siteName: SiteName;
    data: RuntimeOutputDataMap[K] | null;
};

export type RuntimeFetchMessage<K extends RuntimeChannel = RuntimeChannel> = {
    channel: K;
    siteName: SiteName;
};

export type RuntimeFetchResponse<K extends RuntimeChannel = RuntimeChannel> =
    RuntimeTarget<RuntimeOutputDataMap, K> | null;

export interface MessageMap extends StoreMutationMessage {
    "store-fetch": StoreFetchMessage;
    "store-changed": StoreChangedMessage;
    "runtime-sync": RuntimeSyncMessage;
    "runtime-sync-request": RuntimeSyncRequestMessage;
    "runtime-fetch": RuntimeFetchMessage;
    "runtime-changed": RuntimeChangedMessage;
    fetch: { url: string };
    network: NetworkRequestEvent;
    "play-sound": PlaySoundMessage;
    "studies-detected": StudiesDetectedMessage;
    "study-alert": NotificationMessage;
    "study-completion": { siteName: SiteName; url: string };
}

export interface ResponseMap {
    "store-fetch": StoreFetchResponse;
    "store-set": StoreSetResponse;
    "store-patch": StorePatchResponse;
    "store-changed": void;
    "runtime-sync": void;
    "runtime-sync-request": void;
    "runtime-fetch": RuntimeFetchResponse;
    "runtime-changed": void;
    fetch: unknown;
    network: void;
    "play-sound": void;
    "studies-detected": void;
    "study-alert": boolean;
    "study-completion": void;
}

export type MessageResponse<K extends keyof MessageMap> =
    K extends keyof ResponseMap ? ResponseMap[K] : void;

export type HandlerPayload<K extends keyof MessageMap> =
    MessageMap[K] extends undefined ? undefined : MessageMap[K];

export type Message<K extends keyof MessageMap = keyof MessageMap> =
    K extends keyof MessageMap
        ? MessageMap[K] extends undefined
            ? { type: K }
            : { type: K; data: MessageMap[K] }
        : never;

import { storage } from "#imports";
import { supportedSites, type SiteName } from "@/adapters/siteConfigs";
import deepMerge from "@/lib/deepMerge";
import { defaultGlobalSettings } from "./defaultGlobalSettings";
import { defaultSiteSettings } from "./defaultSiteSettings";
import { normalizeSitesState } from "./sitePolicies";

import type {
    DeepPartial,
    GlobalSettings,
    Settings,
    SiteSettings,
} from "./types";

type StorageKey = `local:${string}`;

type StorePick<T extends object, K extends readonly (keyof T)[]> = Pick<
    T,
    K[number]
>;

type StoreChange<T extends object> = Partial<T> | DeepPartial<T>;
type StoreListener<T extends object> = (change: StoreChange<T>) => void;
type StoreUnsubscribe = () => void;
type StoreNormalizer<T extends object> = (current: T) => {
    current: T;
    persistedPatch?: DeepPartial<T>;
};

type NamespaceConfig<T extends object> = {
    storageKey: StorageKey;
    defaults: T;
    normalize?: StoreNormalizer<T>;
};

type CollectionEntryChange<TValue extends object> =
    | Partial<TValue>
    | DeepPartial<TValue>;

export interface StoreNode<T extends object> {
    get<K extends readonly (keyof T)[]>(keys: K): Promise<StorePick<T, K>>;
    set(values: Partial<T>): Promise<Partial<T>>;
    patch(patch: DeepPartial<T>): Promise<Partial<T>>;
    subscribe(listener: StoreListener<T>): StoreUnsubscribe;
}

export interface CollectionStore<
    TKey extends string,
    TValue extends object,
> extends StoreNode<Record<TKey, TValue>> {
    entry(name: TKey): StoreNode<TValue>;
}

export type SettingsPatch = DeepPartial<Settings>;
export type SettingsUpdate = Partial<Settings>;

export type GlobalSettingsSet = Partial<GlobalSettings>;
export type SiteSettingsSet = Partial<SiteSettings>;

export type GlobalSettingsPatch = DeepPartial<GlobalSettings>;
export type SiteSettingsPatch = DeepPartial<SiteSettings>;

export type GlobalSettingsChange = StoreChange<GlobalSettings>;
export type SiteSettingsChange = StoreChange<SiteSettings>;

export type SitesState = Record<SiteName, SiteSettings>;
export type SitesSet = Partial<Record<SiteName, SiteSettingsSet>>;
export type SitesPatch = Partial<Record<SiteName, SiteSettingsPatch>>;

type NamespaceDataMap = {
    globals: GlobalSettings;
    sites: SitesState;
};

export type NamespaceName = keyof NamespaceDataMap;
export type GlobalsStore = StoreNode<GlobalSettings>;
export type SitesStore = CollectionStore<SiteName, SiteSettings>;
export type SiteStore = StoreNode<SiteSettings>;
type NamespaceStoreMap = {
    globals: GlobalsStore;
    sites: SitesStore;
};

export interface Store {
    readonly globals: GlobalsStore;
    readonly sites: SitesStore;
    namespace<TName extends NamespaceName>(
        name: TName,
    ): NamespaceStoreMap[TName];
}

function pick<T extends object, K extends readonly (keyof T)[]>(
    value: T,
    keys: K,
): StorePick<T, K> {
    return Object.fromEntries(
        keys.map((key) => [key, value[key]]),
    ) as StorePick<T, K>;
}

function stripUndefined<T extends object>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
}

function isEmptyChange<T extends object>(changed: StoreChange<T>): boolean {
    return Object.keys(changed).length === 0;
}

function getEntryChange<TKey extends string, TValue extends object>(
    changed: StoreChange<Record<TKey, TValue>>,
    name: TKey,
): CollectionEntryChange<TValue> | undefined {
    return (changed as Partial<Record<TKey, CollectionEntryChange<TValue>>>)[
        name
    ];
}

function createStorageKey(namespace: NamespaceName): StorageKey {
    return `local:settings:${namespace}`;
}

function defineNamespace<T extends object>(
    config: NamespaceConfig<T>,
): NamespaceConfig<T> {
    return config;
}

function buildDefaultSites(): SitesState {
    return supportedSites.reduce((sites, siteName) => {
        sites[siteName] = structuredClone(defaultSiteSettings);
        return sites;
    }, {} as SitesState);
}

const namespaceConfigs = {
    globals: defineNamespace<GlobalSettings>({
        storageKey: createStorageKey("globals"),
        defaults: defaultGlobalSettings,
    }),
    sites: defineNamespace<SitesState>({
        storageKey: createStorageKey("sites"),
        defaults: buildDefaultSites(),
        normalize: normalizeSitesState,
    }),
};
function buildNextStored<T extends object>(
    stored: DeepPartial<T>,
    changed: StoreChange<T>,
    mode: "set" | "patch",
): DeepPartial<T> {
    return mode === "set"
        ? ({ ...stored, ...changed } as DeepPartial<T>)
        : (deepMerge(stored, changed) as DeepPartial<T>);
}

export class SettingsStore implements Store {
    readonly globals = this.createStore(namespaceConfigs.globals);
    readonly sites = this.createCollectionStore<SiteName, SiteSettings>(
        this.createStore(namespaceConfigs.sites),
    );

    private readonly namespaces: NamespaceStoreMap = {
        globals: this.globals,
        sites: this.sites,
    };

    namespace<TName extends NamespaceName>(
        name: TName,
    ): NamespaceStoreMap[TName] {
        return this.namespaces[name];
    }

    private createStore<T extends object>(
        config: NamespaceConfig<T>,
    ): StoreNode<T> {
        const listeners = new Set<StoreListener<T>>();

        const hydrate = async (
            stored: DeepPartial<T>,
        ): Promise<{
            current: T;
            stored: DeepPartial<T>;
        }> => {
            let current = deepMerge(config.defaults, stored) as T;
            let nextStored = stored;

            if (config.normalize) {
                const normalized = config.normalize(current);
                current = normalized.current;

                if (normalized.persistedPatch) {
                    nextStored = deepMerge(
                        stored,
                        normalized.persistedPatch,
                    ) as DeepPartial<T>;
                    await storage.setItem(config.storageKey, nextStored);
                }
            }

            return { current, stored: nextStored };
        };

        const load = async (): Promise<{
            current: T;
            stored: DeepPartial<T>;
        }> => {
            const stored =
                (await storage.getItem<DeepPartial<T>>(config.storageKey)) ??
                ({} as DeepPartial<T>);

            return await hydrate(stored);
        };

        const resolveChanged = (
            current: T,
            changed: StoreChange<T>,
        ): Partial<T> => {
            const keys = Object.keys(changed) as (keyof T)[];
            if (keys.length === 0) return {};

            return pick(current, keys as readonly (keyof T)[]) as Partial<T>;
        };

        const notify = (changed: StoreChange<T>) => {
            if (isEmptyChange(changed)) return;

            for (const listener of listeners) {
                listener(changed);
            }
        };

        const commit = async (
            raw: StoreChange<T>,
            mode: "set" | "patch",
        ): Promise<Partial<T>> => {
            const changed = stripUndefined(raw) as StoreChange<T>;
            if (isEmptyChange(changed)) return {};

            const stored =
                (await storage.getItem<DeepPartial<T>>(config.storageKey)) ??
                ({} as DeepPartial<T>);
            const nextStored = buildNextStored(stored, changed, mode);

            await storage.setItem(config.storageKey, nextStored);
            notify(changed);

            const { current } = await hydrate(nextStored);
            return resolveChanged(current, changed);
        };

        return {
            get: async (keys) => {
                const { current } = await load();
                return pick(current, keys);
            },
            set: async (values) => await commit(values, "set"),
            patch: async (patch) => await commit(patch, "patch"),
            subscribe: (listener) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        };
    }

    private createCollectionStore<TKey extends string, TValue extends object>(
        parent: StoreNode<Record<TKey, TValue>>,
    ): CollectionStore<TKey, TValue> {
        const entries = new Map<TKey, StoreNode<TValue>>();

        const entry = (name: TKey): StoreNode<TValue> => {
            const cached = entries.get(name);
            if (cached) return cached;

            const store: StoreNode<TValue> = {
                get: async (keys) => {
                    const selected = await parent.get([
                        name,
                    ] as readonly TKey[]);
                    return pick(selected[name], keys);
                },
                set: async (values) => {
                    const changed = await parent.set({
                        [name]: values,
                    } as Partial<Record<TKey, TValue>>);

                    return (changed[name] ?? {}) as Partial<TValue>;
                },
                patch: async (patch) => {
                    const changed = await parent.patch({
                        [name]: patch,
                    } as DeepPartial<Record<TKey, TValue>>);

                    return (changed[name] ?? {}) as Partial<TValue>;
                },
                subscribe: (listener) =>
                    parent.subscribe((changed) => {
                        const next = getEntryChange(changed, name);
                        if (next !== undefined) {
                            listener(next);
                        }
                    }),
            };

            entries.set(name, store);
            return store;
        };

        return { ...parent, entry };
    }
}

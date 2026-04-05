import { defaultSiteSettings } from "./defaultSiteSettings";
import { defaultGlobalSettingsKeys } from "./defaultGlobalSettings";
import { defaultSettings } from "./defaultSettings";
import { storage } from "#imports";
import { SiteName, sites } from "@/adapters/siteConfigs";
import deepMerge from "@/lib/deepMerge";

import type { SiteSettings, GlobalSettings, Settings } from "./types";

type DeepNonNullable<T> = T extends (...args: any[]) => any
    ? T
    : T extends object
      ? { [K in keyof T]-?: DeepNonNullable<T[K]> }
      : NonNullable<T>;

export type DeepPartial<T> = T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

type NestedArrayKeys<K extends keyof SiteSettings> = {
    [P in keyof SiteSettings[K]]: NonNullable<SiteSettings[K][P]> extends any[]
        ? P
        : never;
}[keyof SiteSettings[K]];

export type SettingsUpdate = Partial<Settings>;
export type SettingsPatch = DeepPartial<Settings>;
export type GlobalSettingsUpdate = Partial<GlobalSettings>;
export type SiteSettingsUpdate = Partial<SiteSettings>;

export type ResolvedSettings<K extends readonly (keyof Settings)[]> = Pick<
    { [P in keyof Settings]: DeepNonNullable<Settings[P]> },
    K[number]
>;

type ResolvedGlobalSettings<K extends readonly (keyof GlobalSettings)[]> = Pick<
    { [P in keyof GlobalSettings]: DeepNonNullable<GlobalSettings[P]> },
    K[number]
>;

export type GlobalListener = (changed: GlobalSettingsUpdate) => void;
export type SiteListener = (
    siteName: SiteName,
    changed: SiteSettingsUpdate,
) => void;

type SettingsPath = {
    [K in keyof SiteSettings & string]:
        | K
        | (SiteSettings[K] extends object
              ? `${K}.${keyof SiteSettings[K] & string}`
              : never);
}[keyof SiteSettings & string];

type FieldPolicy = {
    field: SettingsPath;
    shouldReset: (value: any) => boolean;
};

const GLOBALS_KEY = localKey("globals");
const globalKeys = new Set<string>(defaultGlobalSettingsKeys);
const siteNames = new Set<SiteName>(
    Object.values(sites).map((site) => site.name),
);

const fieldPolicies: FieldPolicy[] = [
    {
        field: "analytics.dailySurveyCompletions",
        shouldReset: (v) => Date.now() - v.timestamp > 24 * 60 * 60 * 1000,
    },
];

function localKey(key: string) {
    return `local:${key}` as const;
}

function isSiteName(value: unknown): value is SiteName {
    return typeof value === "string" && siteNames.has(value as SiteName);
}

function splitByScope(values: Record<string, unknown>) {
    const global: Record<string, unknown> = {};
    const site: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(values)) {
        (globalKeys.has(key) ? global : site)[key] = val;
    }
    return { global, site };
}

async function readStorage(siteName: SiteName | null, keys: readonly string[]) {
    const needsGlobals = keys.some((k) => globalKeys.has(k));
    const needsSite = siteName !== null && keys.some((k) => !globalKeys.has(k));

    const [globals, site] = await Promise.all([
        needsGlobals
            ? storage.getItem<Partial<GlobalSettings>>(GLOBALS_KEY)
            : null,
        needsSite
            ? storage.getItem<SiteSettingsUpdate>(localKey(siteName))
            : null,
    ]);

    return { globals: globals ?? {}, site: site ?? {} };
}

function resolveValues(
    keys: readonly (keyof Settings)[],
    globals: Record<string, unknown>,
    site: Record<string, unknown>,
) {
    return Object.fromEntries(
        keys.map((k) => {
            const stored = globalKeys.has(k as string) ? globals[k] : site[k];
            return [k, deepMerge(defaultSettings[k], stored)];
        }),
    );
}

function getByPath(obj: any, path: string): any {
    for (const key of path.split(".")) obj = obj?.[key];
    return obj;
}

function setByPath(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    const last = keys.pop()!;
    for (const key of keys) obj = obj?.[key];
    if (obj != null) obj[last] = value;
}

function applyPolicies(
    result: Record<string, any>,
    siteName: SiteName | null,
    storedSite: Record<string, unknown>,
) {
    const dirtyTopKeys = new Set<string>();

    for (const policy of fieldPolicies) {
        const value = getByPath(result, policy.field);
        if (value === undefined || !policy.shouldReset(value)) continue;
        const defaultValue = structuredClone(
            getByPath(defaultSiteSettings, policy.field),
        );
        setByPath(result, policy.field, defaultValue);
        dirtyTopKeys.add(policy.field.split(".")[0]);
    }

    if (dirtyTopKeys.size > 0 && siteName !== null) {
        const patch = Object.fromEntries(
            [...dirtyTopKeys].map((k) => [k, result[k]]),
        );
        storage.setItem(localKey(siteName), { ...storedSite, ...patch });
    }
}

export function createStore() {
    const globalListeners = new Set<GlobalListener>();
    const siteListeners = new Set<SiteListener>();

    function notify(
        siteName: SiteName | null,
        globalValues: Record<string, unknown>,
        siteValues: Record<string, unknown>,
    ) {
        if (Object.keys(globalValues).length > 0) {
            for (const listener of globalListeners)
                listener(globalValues as GlobalSettingsUpdate);
        }
        if (Object.keys(siteValues).length > 0 && siteName !== null) {
            for (const listener of siteListeners)
                listener(siteName, siteValues as SiteSettingsUpdate);
        }
    }

    async function get<K extends readonly (keyof GlobalSettings)[]>(
        keys: K,
    ): Promise<ResolvedGlobalSettings<K>>;
    async function get<K extends readonly (keyof Settings)[]>(
        siteName: SiteName,
        keys: K,
    ): Promise<ResolvedSettings<K>>;
    async function get(
        siteNameOrKeys: SiteName | readonly (keyof Settings)[],
        maybeKeys?: readonly (keyof Settings)[],
    ) {
        const siteName = isSiteName(siteNameOrKeys) ? siteNameOrKeys : null;
        const keys = (
            siteName ? maybeKeys : siteNameOrKeys
        ) as readonly (keyof Settings)[];
        const stored = await readStorage(siteName, keys as string[]);
        const result = resolveValues(keys, stored.globals, stored.site);
        applyPolicies(result, siteName, stored.site);
        return result;
    }

    async function set(
        values: GlobalSettingsUpdate,
    ): Promise<GlobalSettingsUpdate>;
    async function set(
        siteName: SiteName,
        values: SettingsPatch,
    ): Promise<SettingsUpdate>;
    async function set(
        siteNameOrValues: SiteName | SettingsPatch,
        maybeValues?: SettingsPatch,
    ) {
        const siteName = isSiteName(siteNameOrValues) ? siteNameOrValues : null;
        const values = (siteName ? maybeValues : siteNameOrValues) as Record<
            string,
            unknown
        >;

        const filtered = Object.fromEntries(
            Object.entries(values).filter(([, v]) => v !== undefined),
        );
        const { global: globalValues, site: siteValues } =
            splitByScope(filtered);

        const writes: Promise<void>[] = [];

        if (Object.keys(globalValues).length > 0) {
            const stored =
                (await storage.getItem<Partial<GlobalSettings>>(GLOBALS_KEY)) ??
                {};
            writes.push(
                storage.setItem(GLOBALS_KEY, { ...stored, ...globalValues }),
            );
        }

        if (Object.keys(siteValues).length > 0 && siteName !== null) {
            const siteKey = localKey(siteName);
            const stored =
                (await storage.getItem<SiteSettingsUpdate>(siteKey)) ?? {};
            writes.push(storage.setItem(siteKey, { ...stored, ...siteValues }));
        }

        await Promise.all(writes);
        notify(siteName, globalValues, siteValues);

        if (siteName === null) {
            const changedKeys = Object.keys(
                globalValues,
            ) as (keyof GlobalSettings)[];
            return changedKeys.length > 0
                ? ((await get(changedKeys)) as GlobalSettingsUpdate)
                : ({} as GlobalSettingsUpdate);
        }

        const changedKeys = Object.keys(filtered) as (keyof Settings)[];
        return changedKeys.length > 0
            ? ((await get(siteName, changedKeys)) as SettingsUpdate)
            : ({} as SettingsUpdate);
    }

    async function update(siteName: SiteName, values: SettingsPatch) {
        const keys = Object.keys(values) as (keyof Settings)[];
        if (keys.length === 0) return {} as SettingsUpdate;

        const current = await get(siteName, keys);
        const merged = Object.fromEntries(
            keys.map((k) => [k, deepMerge(current[k], values[k])]),
        ) as SettingsUpdate;

        return await set(siteName, merged);
    }

    async function getNestedArray<K extends keyof SiteSettings>(
        siteName: SiteName,
        key: K,
        prop: string,
    ) {
        const current = await get(siteName, [key]);
        const parent = current[key] as Record<string, unknown>;
        return ((parent[prop] ?? []) as unknown[]).slice();
    }

    async function push<
        K extends keyof SiteSettings,
        P extends NestedArrayKeys<K>,
    >(
        siteName: SiteName,
        key: K,
        prop: P,
        ...items: NonNullable<SiteSettings[K][P]> extends (infer U)[]
            ? U[]
            : never
    ) {
        const arr = await getNestedArray(siteName, key, prop as string);
        const unique = items.filter((item) => !arr.includes(item));
        if (unique.length === 0) return;
        await update(siteName, {
            [key]: { [prop]: [...arr, ...unique] },
        } as any);
    }

    async function remove<
        K extends keyof SiteSettings,
        P extends NestedArrayKeys<K>,
    >(
        siteName: SiteName,
        key: K,
        prop: P,
        ...items: NonNullable<SiteSettings[K][P]> extends (infer U)[]
            ? U[]
            : never
    ) {
        const arr = await getNestedArray(siteName, key, prop as string);
        const removeSet = new Set(items);
        const filtered = arr.filter((item) => !removeSet.has(item));
        if (filtered.length === arr.length) return;
        await update(siteName, {
            [key]: { [prop]: filtered },
        } as any);
    }

    function subscribe(topic: "globals", listener: GlobalListener): () => void;
    function subscribe(topic: "site", listener: SiteListener): () => void;
    function subscribe(
        topic: "globals" | "site",
        listener: GlobalListener | SiteListener,
    ) {
        if (topic === "globals") {
            globalListeners.add(listener as GlobalListener);
            return () => globalListeners.delete(listener as GlobalListener);
        }
        siteListeners.add(listener as SiteListener);
        return () => siteListeners.delete(listener as SiteListener);
    }

    return { get, set, update, push, remove, subscribe };
}

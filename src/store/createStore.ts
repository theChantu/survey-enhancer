import { defaultSiteSettings } from "./defaultSiteSettings";
import { defaultGlobalSettingsKeys } from "./defaultGlobalSettings";
import { defaultSettings } from "./defaultSettings";
import { storage } from "#imports";

import type { SiteSettings, GlobalSettings } from "./types";

export type Settings = SiteSettings & GlobalSettings;
export type SettingsUpdate = Partial<Settings>;
export type GlobalSettingsUpdate = Partial<GlobalSettings>;
export type SiteSettingsUpdate = Partial<SiteSettings>;

export type ResolvedSettings<K extends readonly (keyof Settings)[]> = Pick<
    { [P in keyof Settings]: DeepNonNullable<Settings[P]> },
    K[number]
>;

export type GlobalListener = (changed: GlobalSettingsUpdate) => void;
export type SiteListener = (
    siteName: SiteName,
    changed: SiteSettingsUpdate,
) => void;

type SiteName = string;

type ResolvedGlobalSettings<K extends readonly (keyof GlobalSettings)[]> = Pick<
    { [P in keyof GlobalSettings]: DeepNonNullable<GlobalSettings[P]> },
    K[number]
>;

type DeepNonNullable<T> = T extends (...args: any[]) => any
    ? T
    : T extends object
      ? { [K in keyof T]-?: DeepNonNullable<T[K]> }
      : NonNullable<T>;

type DeepPartial<T> = T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

type FieldPolicy = {
    field: keyof SiteSettings;
    shouldReset: (value: any) => boolean;
};

type ArrayKeys = {
    [K in keyof SiteSettings]: SiteSettings[K] extends any[] ? K : never;
}[keyof SiteSettings];

const GLOBALS_KEY = localKey("globals");
const globalKeys = new Set<string>(defaultGlobalSettingsKeys);

const fieldPolicies: FieldPolicy[] = [
    {
        field: "dailySurveyCompletions",
        shouldReset: (v) => Date.now() - v.timestamp > 24 * 60 * 60 * 1000,
    },
];

function localKey(key: string) {
    return `local:${key}` as const;
}

function deepMerge(target: any, source: any): any {
    if (source === undefined) return target;
    if (Array.isArray(source) || Array.isArray(target)) return source;

    if (
        typeof target === "object" &&
        target !== null &&
        typeof source === "object" &&
        source !== null
    ) {
        const merged = { ...target };
        for (const key of Object.keys(source)) {
            merged[key] = deepMerge(target[key], source[key]);
        }
        return merged;
    }

    return source;
}

function parseOverloadArgs(
    siteNameOrFirst: SiteName | any,
    second?: any,
): { siteName: SiteName | null; value: any } {
    const hasSiteName = typeof siteNameOrFirst === "string";
    return {
        siteName: hasSiteName ? siteNameOrFirst : null,
        value: hasSiteName ? second : siteNameOrFirst,
    };
}

function splitByScope(entries: [string, unknown][]) {
    const global: [string, unknown][] = [];
    const site: [string, unknown][] = [];
    for (const entry of entries) {
        (globalKeys.has(entry[0]) ? global : site).push(entry);
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
            const stored = globalKeys.has(k as string)
                ? (globals as Record<string, unknown>)[k as string]
                : site[k as string];
            return [k, deepMerge(defaultSettings[k], stored)];
        }),
    );
}

function applyPolicies(
    result: Record<string, any>,
    siteName: SiteName | null,
    storedSite: Record<string, unknown>,
) {
    const resets: Partial<SiteSettings> = {};
    for (const policy of fieldPolicies) {
        if (!(policy.field in result)) continue;
        if (!policy.shouldReset(result[policy.field])) continue;
        result[policy.field] = structuredClone(
            defaultSiteSettings[policy.field],
        );
        resets[policy.field] = result[policy.field];
    }

    if (Object.keys(resets).length > 0 && siteName !== null) {
        storage.setItem(localKey(siteName), { ...storedSite, ...resets });
    }
}

export function createStore() {
    const globalListeners = new Set<GlobalListener>();
    const siteListeners = new Set<SiteListener>();

    function notify(
        siteName: SiteName | null,
        globalValues: GlobalSettingsUpdate,
        siteValues: SiteSettingsUpdate,
    ) {
        if (Object.keys(globalValues).length > 0) {
            for (const listener of globalListeners) listener(globalValues);
        }
        if (Object.keys(siteValues).length > 0 && siteName !== null) {
            for (const listener of siteListeners)
                listener(siteName, siteValues);
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
        const { siteName, value: keys } = parseOverloadArgs(
            siteNameOrKeys,
            maybeKeys,
        );
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
        values: SettingsUpdate,
    ): Promise<SettingsUpdate>;
    async function set(
        siteNameOrValues: SiteName | SettingsUpdate,
        maybeValues?: SettingsUpdate,
    ) {
        const { siteName, value: values } = parseOverloadArgs(
            siteNameOrValues,
            maybeValues,
        );

        const filtered = Object.fromEntries(
            Object.entries(values).filter(([, v]) => v !== undefined),
        );
        const { global: globalEntries, site: siteEntries } = splitByScope(
            Object.entries(filtered),
        );

        const writes: Promise<void>[] = [];

        if (globalEntries.length > 0) {
            const stored =
                (await storage.getItem<Partial<GlobalSettings>>(GLOBALS_KEY)) ??
                {};
            writes.push(
                storage.setItem(GLOBALS_KEY, {
                    ...stored,
                    ...Object.fromEntries(globalEntries),
                }),
            );
        }

        if (siteEntries.length > 0 && siteName !== null) {
            const siteKey = localKey(siteName);
            const stored =
                (await storage.getItem<SiteSettingsUpdate>(siteKey)) ?? {};
            writes.push(
                storage.setItem(siteKey, {
                    ...stored,
                    ...Object.fromEntries(siteEntries),
                }),
            );
        }

        await Promise.all(writes);
        notify(
            siteName,
            Object.fromEntries(globalEntries) as GlobalSettingsUpdate,
            Object.fromEntries(siteEntries) as SiteSettingsUpdate,
        );

        if (siteName === null) {
            const changedGlobalKeys = globalEntries.map(
                ([k]) => k as keyof GlobalSettings,
            );
            if (changedGlobalKeys.length === 0) {
                return {} as GlobalSettingsUpdate;
            }
            return (await get(changedGlobalKeys)) as GlobalSettingsUpdate;
        }

        const changedKeys = Object.keys(filtered) as (keyof Settings)[];
        if (changedKeys.length === 0) {
            return {} as SettingsUpdate;
        }
        return (await get(siteName, changedKeys)) as SettingsUpdate;
    }

    async function update(siteName: SiteName, values: DeepPartial<Settings>) {
        const keys = Object.keys(values) as (keyof Settings)[];
        if (keys.length === 0) {
            return {} as SettingsUpdate;
        }
        const current = await get(siteName, keys);

        const merged = Object.fromEntries(
            keys.map((k) => [k, deepMerge(current[k], values[k])]),
        ) as SettingsUpdate;

        return await set(siteName, merged);
    }

    async function push<K extends ArrayKeys>(
        siteName: SiteName,
        key: K,
        ...items: SiteSettings[K] extends (infer U)[] ? U[] : never
    ) {
        const current = await get(siteName, [key]);
        const arr = current[key] as unknown[];
        const unique = items.filter((item) => !arr.includes(item));
        if (unique.length === 0) return;
        await set(siteName, {
            [key]: [...arr, ...unique],
        } as SiteSettingsUpdate);
    }

    async function remove<K extends ArrayKeys>(
        siteName: SiteName,
        key: K,
        ...items: SiteSettings[K] extends (infer U)[] ? U[] : never
    ) {
        const current = await get(siteName, [key]);
        const arr = current[key] as unknown[];
        const removeSet = new Set(items);
        const filtered = arr.filter((item) => !removeSet.has(item));
        if (filtered.length === arr.length) return;
        await set(siteName, { [key]: filtered } as SiteSettingsUpdate);
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

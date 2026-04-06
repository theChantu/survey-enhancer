import type { StoreFetchMessage, StoreFetchResponse } from "@/messages/types";
import type { SettingsStore } from "@/store/SettingsStore";

export async function handleStoreFetch(
    store: SettingsStore,
    payload: StoreFetchMessage,
): Promise<StoreFetchResponse> {
    if (payload.namespace === "globals") {
        const data = await store.globals.get(payload.data.keys);
        return { namespace: payload.namespace, data };
    }

    const data = await store
        .namespace("sites")
        .entry(payload.entry)
        .get(payload.data.keys);
    return { namespace: "sites", entry: payload.entry, data };
}

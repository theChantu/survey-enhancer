import type { StoreSetMessage, StoreSetResponse } from "@/messages/types";
import type { SettingsStore } from "@/store/store";

export async function handleStoreSet(
    store: SettingsStore,
    payload: StoreSetMessage,
): Promise<StoreSetResponse> {
    if (payload.namespace === "globals") {
        const data = await store.globals.set(payload.data);
        return { namespace: "globals", data };
    }

    const data = await store.namespace("sites").entry(payload.entry).set(
        payload.data,
    );
    return { namespace: "sites", entry: payload.entry, data };
}

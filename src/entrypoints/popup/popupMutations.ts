import { handleQueueMutation } from "./handlers/handleQueueMutation";

import type { StorePatchMessage, StoreSetMessage } from "@/messages/types";

export function patch(target: StorePatchMessage): Promise<void> {
    return handleQueueMutation("store-patch", target);
}

export function set(target: StoreSetMessage): Promise<void> {
    return handleQueueMutation("store-set", target);
}

import { queueMutation } from "./popupModel.svelte";
import { settingsState } from "./state.svelte";

import type { RuntimeChangedMessage } from "@/messages/types";

export let popupSession = $state({ seenAt: Date.now(), ready: false });

function persistSeenAt(now: number): void {
    settingsState.globals.lastPopupOpenedAt = now;
    void queueMutation("store-patch", {
        namespace: "globals",
        data: { lastPopupOpenedAt: now },
    });
}

export function beginPopupSession(): void {
    popupSession.seenAt = settingsState.globals.lastPopupOpenedAt;
    popupSession.ready = true;
    persistSeenAt(Date.now());
}

export function acknowledgeRuntimeChange(payload: RuntimeChangedMessage): void {
    if (!popupSession.ready) return;
    if (payload.channel !== "opportunities" || payload.data === null) return;

    if (
        payload.data.some(
            (opportunity) =>
                opportunity.lastAlertableChangeAt > popupSession.seenAt,
        )
    ) {
        persistSeenAt(Date.now());
    }
}

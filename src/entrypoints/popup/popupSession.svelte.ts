import { queueMutation } from "./popupModel.svelte";
import { settingsState } from "./state.svelte";

export let lastOpenedAt = Date.now();

export function captureAndUpdateLastOpened() {
    lastOpenedAt = settingsState.globals.lastPopupOpenedAt;
    void queueMutation("store-patch", {
        namespace: "globals",
        data: { lastPopupOpenedAt: Date.now() },
    });
}

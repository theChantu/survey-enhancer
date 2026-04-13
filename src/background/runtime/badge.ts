import { browser } from "#imports";

let initialized = false;

export async function setBadgeCount(count: number): Promise<void> {
    if (!initialized) {
        initialized = true;
        await browser.action.setBadgeBackgroundColor({ color: "#2563eb" });
    }

    await browser.action.setBadgeText({
        text: count > 0 ? String(count) : "",
    });
}

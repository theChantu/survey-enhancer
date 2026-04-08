<script lang="ts">
    import Subsection from "@/components/Subsection.svelte";
    import { sendExtensionMessage } from "@/messages/sendExtensionMessage";
    import { showToast } from "@/entrypoints/popup/toastStore";
    import { capitalize } from "@/lib/utils";

    import type { ActiveSiteState } from "@/entrypoints/popup/types";
    import type { NotificationMessage } from "@/messages/types";

    let { activeSite }: { activeSite: ActiveSiteState } = $props();

    type TestNotificationDelivery = NotificationMessage["delivery"];

    const testNotificationModes = [
        "auto",
        "provider",
        "browser",
    ] as const satisfies TestNotificationDelivery[];

    async function notifyTestNotification(
        delivery: TestNotificationDelivery,
    ): Promise<boolean> {
        try {
            return await sendExtensionMessage({
                type: "notification",
                data: {
                    siteName: activeSite.name,
                    notifications: [
                        {
                            title: "Test Notification",
                            message: "This is a test notification.",
                            link: "https://example.com",
                            iconUrl: browser.runtime.getURL("/icon-48.png"),
                        },
                    ],
                    delivery,
                },
            });
        } catch (error) {
            console.error("Failed to send test notification:", error);
            return false;
        }
    }

    async function handleTestNotification(
        delivery: TestNotificationDelivery = "auto",
    ) {
        const success = await notifyTestNotification(delivery);
        showToast(
            success
                ? "Notification sent successfully."
                : "Failed to send notification.",
        );
    }
</script>

<Subsection className="flex flex-col gap-2" borderClass="border-white/4">
    <div class="flex flex-col gap-0.5">
        <span class="text-[0.78rem] font-medium text-gray-400"
            >Test notifications</span
        >
        <span class="text-[0.72rem] text-gray-500">
            Send a sample alert to check delivery and provider setup.
        </span>
    </div>
    <div class="grid grid-cols-3 gap-1.5">
        {#each testNotificationModes as mode}
            <button
                class="popup-compact-button"
                onclick={() => handleTestNotification(mode)}
            >
                {capitalize(mode)}
            </button>
        {/each}
    </div>
</Subsection>

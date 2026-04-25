import BaseEnhancement from "./BaseEnhancement";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

export class NotificationsEnhancement extends BaseEnhancement {
    async apply() {
        const opportunities = this.adapter.extractOpportunities("display");
        if (opportunities.length === 0) return;

        await sendExtensionMessage({
            type: "opportunities-detected",
            data: {
                siteName: this.adapter.config.name,
                opportunities,
                hidden: document.hidden,
            },
        });
    }

    async revert() {
        // No cleanup necessary for notifications
    }
}

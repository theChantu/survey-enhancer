import BaseEnhancement from "./BaseEnhancement";
import { sendExtensionMessage } from "@/messages/sendExtensionMessage";

export class NotificationsEnhancement extends BaseEnhancement {
    async apply() {
        const studies = this.adapter.extractStudies("display");
        if (studies.length === 0) return;

        await sendExtensionMessage({
            type: "studies-detected",
            data: {
                siteName: this.adapter.config.name,
                studies,
                hidden: document.hidden,
            },
        });
    }

    async revert() {
        // No cleanup necessary for notifications
    }
}

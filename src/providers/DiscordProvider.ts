import { BaseProvider } from "./BaseProvider";

import type { ProviderConfigMap } from "./providers";

type DiscordChannelResponse = {
    id: string;
};

export class DiscordProvider extends BaseProvider<
    ProviderConfigMap["discord"]
> {
    constructor(protected config: ProviderConfigMap["discord"]) {
        super(config);
    }

    private async fetchChannelId() {
        const response = await fetch(
            "https://discord.com/api/v10/users/@me/channels",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bot ${this.config.botToken}`,
                },
                body: JSON.stringify({
                    recipient_id: this.config.userId,
                }),
            },
        );
        return (await response.json()) as DiscordChannelResponse;
    }

    private async getChannelId() {
        if (!this.config.channelId) {
            this.config.channelId = (await this.fetchChannelId()).id;
        }
        return this.config.channelId;
    }

    override onRetry(): void {
        this.config.channelId = undefined;
    }

    protected async send(message: string): Promise<boolean> {
        const channelId = await this.getChannelId();
        // Discord messages have a max length of 2000 characters
        const messageParts = this.splitMessage(message, 2000);

        for (const part of messageParts) {
            const response = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bot ${this.config.botToken}`,
                    },
                    body: JSON.stringify({ content: part }),
                },
            );
            if (!response.ok) {
                return false;
            }
        }
        return true;
    }
}

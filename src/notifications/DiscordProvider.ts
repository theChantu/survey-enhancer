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

    private async createChannel() {
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

    async sendMessage(message: string): Promise<void> {
        this.config.channelId ??= (await this.createChannel()).id;
        const channelId = this.config.channelId;

        await fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bot ${this.config.botToken}`,
                },
                body: JSON.stringify({
                    content: message,
                }),
            },
        );
    }
}

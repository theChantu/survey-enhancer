import { BaseProvider, type MessageData } from "./BaseProvider";
import { TELEGRAM_API_BASE_URL } from "./providerHosts";

import type { ProviderConfigMap } from "./providers";

type TelegramChannelResponse = {
    result: [
        {
            message: {
                chat: {
                    id: number;
                };
            };
        },
    ];
};

export class TelegramProvider extends BaseProvider<
    ProviderConfigMap["telegram"]
> {
    constructor(protected config: ProviderConfigMap["telegram"]) {
        super(config);
    }

    private async fetchChatId() {
        const response = await fetch(
            `${TELEGRAM_API_BASE_URL}/bot${this.config.botToken}/getUpdates`,
        );
        return (await response.json()) as TelegramChannelResponse;
    }

    private async getChatId() {
        if (!this.config.chatId) {
            this.config.chatId = (
                await this.fetchChatId()
            ).result[0].message.chat.id;
        }
        return this.config.chatId;
    }

    protected override onRetry(): void {
        this.config.chatId = undefined;
    }

    protected override formatMessage(data: MessageData): string {
        return `<b>${data.title}</b>\n\n${data.body}${data.url ? `\n\n${data.url}` : ""}`;
    }

    protected async send(message: string): Promise<boolean> {
        try {
            const chatId = await this.getChatId();
            // Telegram messages have a max length of 4096 characters
            const messageParts = this.splitMessage(message, 4096);

            for (const part of messageParts) {
                const response = await fetch(
                    `${TELEGRAM_API_BASE_URL}/bot${this.config.botToken}/sendMessage`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: part,
                            parse_mode: "HTML",
                        }),
                    },
                );
                if (!response.ok) {
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }
}

import { DiscordProvider } from "./DiscordProvider";
import { TelegramProvider } from "./TelegramProvider";
import { BaseProvider } from "./BaseProvider";

import type { ProviderName } from "@/store/types";

type ProviderClass = new (config: any) => BaseProvider;

export const providers = {
    discord: DiscordProvider,
    telegram: TelegramProvider,
} as const satisfies Record<ProviderName, ProviderClass>;

export type ProviderConfigMap = {
    discord: { botToken: string; userId: string; channelId?: string };
    telegram: { botToken: string; chatId: string };
};

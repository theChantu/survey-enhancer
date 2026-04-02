import { DiscordProvider } from "./DiscordProvider";
import { TelegramProvider } from "./TelegramProvider";
import { BaseProvider } from "./BaseProvider";

type ProviderClass = new (config: any) => BaseProvider;

export const providers = {
    discord: DiscordProvider,
    telegram: TelegramProvider,
} as const satisfies Record<string, ProviderClass>;

const providerNames = Object.keys(providers) as (keyof typeof providers)[];

export type ProviderName = (typeof providerNames)[number];

type ProviderConfig<T> = { enabled: boolean } & T;

export type ProviderConfigMap = {
    discord: ProviderConfig<{ botToken: string; userId: string; channelId?: string }>;
    telegram: ProviderConfig<{ botToken: string; chatId: string }>;
};

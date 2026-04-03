import { TelegramProvider } from "./TelegramProvider";
import { BaseProvider } from "./BaseProvider";

type ProviderClass = new (config: any) => BaseProvider;

export const nameToProvider = {
    telegram: TelegramProvider,
} as const satisfies Record<string, ProviderClass>;

const providerNames = Object.keys(
    nameToProvider,
) as (keyof typeof nameToProvider)[];

export type ProviderName = (typeof providerNames)[number];

type ProviderConfig<T> = { enabled: boolean } & T;

export type ProviderConfigMap = {
    telegram: ProviderConfig<{ botToken: string; chatId?: number }>;
};

export function getProvider<K extends ProviderName>(
    name: K,
    config: ProviderConfigMap[K],
): BaseProvider<ProviderConfigMap[K]> {
    return new (nameToProvider[name] as any)(config);
}

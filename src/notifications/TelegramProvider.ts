import { BaseProvider } from "./BaseProvider";

import type { ProviderConfigMap } from "./providers";

type TelegramChannelResponse = {
    id: string;
};

export class TelegramProvider extends BaseProvider<
    ProviderConfigMap["telegram"]
> {
    constructor(protected config: ProviderConfigMap["telegram"]) {
        super(config);
    }

    async sendMessage(message: string): Promise<void> {}
}

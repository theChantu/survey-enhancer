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

    protected send(message: string): Promise<boolean> {
        return Promise.resolve(true);
    }
}

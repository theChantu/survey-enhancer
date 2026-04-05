import deepMerge from "../lib/deepMerge";
import {
    enhancementConfigs,
    type EnhancementKey,
} from "@/enhancements/enhancementConfigs";

import type { Settings } from "@/store/types";
import type { SettingsUpdate } from "@/store/createStore";
import type { BaseAdapter } from "@/adapters";

const enhancementConfigArray = Object.entries(enhancementConfigs).map(
    ([key, config]) => ({
        key: key as EnhancementKey,
        ...config,
    }),
);
enhancementConfigArray.sort(
    (a, b) => Number(Boolean(b.priority)) - Number(Boolean(a.priority)),
);

export class EnhancementManager {
    private enhancementConfigs: typeof enhancementConfigArray;

    constructor(
        private adapter: BaseAdapter,
        private settings: Settings,
    ) {
        this.enhancementConfigs = enhancementConfigArray.filter((config) =>
            adapter.hasModule(config.key),
        );
    }

    async initialize() {}

    private mergeSettings(changed: SettingsUpdate) {
        this.settings = deepMerge(this.settings, changed);
    }

    async update(changed: SettingsUpdate) {
        this.mergeSettings(changed);

        for (const config of this.enhancementConfigs) {
            if (!(config.key in changed)) continue;

            const enhancement = new config.enhancement(this.adapter);
            const enabled = this.settings[config.key].enabled;

            enabled ? await enhancement.run() : await enhancement.revert();
        }
    }

    async run() {
        for (const config of this.enhancementConfigs) {
            const enhancement = new config.enhancement(this.adapter);
            const enabled = this.settings[config.key]?.enabled;

            enabled ? await enhancement.apply() : await enhancement.revert();
        }
    }

    destroy() {}
}

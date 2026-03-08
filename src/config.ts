import { ProlificAdapter, CloudResearchAdapter } from "./adapters";

import type { BaseAdapter } from "./adapters";

const siteAdapters = {
    prolific: new ProlificAdapter(),
    cloudresearch: new CloudResearchAdapter(),
} satisfies Record<string, BaseAdapter>;

export type SiteName = keyof typeof siteAdapters;

type SiteAdapterKey = keyof typeof siteAdapters;

function getSiteAdapter(): { siteName: SiteName; adapter: BaseAdapter } {
    const host = window.location.hostname;

    for (const key of Object.keys(siteAdapters) as SiteAdapterKey[]) {
        if (host.includes(key))
            return {
                siteName: key,
                adapter: siteAdapters[key],
            };
    }

    throw new Error(`Extension injected on unsupported host: ${host}`);
}

export default getSiteAdapter;

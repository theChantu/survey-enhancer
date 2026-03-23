import { ProlificAdapter } from "@/adapters/ProlificAdapter";
import { CloudResearchAdapter } from "@/adapters/CloudResearchAdapter";
import { BaseAdapter } from "@/adapters/BaseAdapter";
import type { SupportedSites } from "@/adapters/sites";

const siteToAdapter = {
    "app.prolific.com": ProlificAdapter,
    "connect.cloudresearch.com": CloudResearchAdapter,
} as const satisfies Record<SupportedSites, new () => BaseAdapter>;

type SiteAdapter = InstanceType<
    (typeof siteToAdapter)[keyof typeof siteToAdapter]
>;

const siteAdapters = Object.values(siteToAdapter).map(
    (AdapterClass) => new AdapterClass(),
) as SiteAdapter[];

function matchesHost(host: string, allowedHost: string): boolean {
    return host === allowedHost || host.endsWith(`.${allowedHost}`);
}

function getSiteAdapter(): SiteAdapter;
function getSiteAdapter(input: string): SiteAdapter | null;
function getSiteAdapter(input?: string): SiteAdapter | null {
    const host = input ? new URL(input).hostname : window.location.hostname;

    for (const adapter of siteAdapters) {
        if (matchesHost(host, adapter.config.host)) {
            return adapter;
        }
    }

    if (input === undefined) {
        throw new Error(
            `Extension injected on unsupported host: ${window.location.hostname}`,
        );
    }

    return null;
}

export default getSiteAdapter;
export { siteAdapters };

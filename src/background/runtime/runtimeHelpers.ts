import { sites, type SupportedHosts } from "@/adapters/siteConfigs";
import type { RuntimeChannel } from "@/messages/types";

export const runtimeChannels = [
    "opportunities",
] as const satisfies readonly RuntimeChannel[];

export function getRuntimeSyncChannels(
    channels?: RuntimeChannel[],
): RuntimeChannel[] {
    return channels && channels.length > 0
        ? [...channels]
        : [...runtimeChannels];
}

export function isSupportedHostTabUrl(url?: string | null): boolean {
    if (!url) return false;

    try {
        const host = new URL(url).hostname as SupportedHosts;
        return host in sites;
    } catch {
        return false;
    }
}

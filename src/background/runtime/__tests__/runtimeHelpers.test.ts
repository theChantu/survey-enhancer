import { describe, expect, it } from "vitest";
import {
    getRuntimeSyncChannels,
    isSupportedHostTabUrl,
    runtimeChannels,
} from "../runtimeHelpers";

describe("runtimeSync helpers", () => {
    it("defaults requested channels to all supported runtime channels", () => {
        expect(getRuntimeSyncChannels()).toEqual([...runtimeChannels]);
    });

    it("returns explicitly requested runtime channels as-is", () => {
        expect(getRuntimeSyncChannels(["opportunities"])).toEqual([
            "opportunities",
        ]);
    });

    it("detects supported host tab urls", () => {
        expect(isSupportedHostTabUrl("https://app.prolific.com/studies")).toBe(
            true,
        );
        expect(isSupportedHostTabUrl("https://example.com")).toBe(false);
        expect(isSupportedHostTabUrl(undefined)).toBe(false);
    });
});

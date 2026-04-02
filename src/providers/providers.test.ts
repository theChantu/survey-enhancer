import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiscordProvider } from "./DiscordProvider";

beforeEach(() => {});

describe("DiscordProvider", () => {
    it("should store channelId after sending a message", async () => {
        const provider = new DiscordProvider({
            botToken: process.env.DISCORD_BOT_TOKEN!,
            userId: process.env.DISCORD_USER_ID!,
        });
        await provider.sendMessage("test message");
        expect(provider.configData.channelId).toBeDefined();
    });
});

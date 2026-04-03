import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseProvider } from "./BaseProvider";
import { TelegramProvider } from "./TelegramProvider";

function createResponse(ok: boolean, body: unknown = {}) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(body),
    } as unknown as Response;
}

class RetryTestProvider extends BaseProvider<{ enabled: boolean }> {
    private outcomes: boolean[];
    public sendCalls = 0;
    public retryCalls = 0;

    constructor(outcomes: boolean[]) {
        super({ enabled: true });
        this.outcomes = [...outcomes];
    }

    protected async send(): Promise<boolean> {
        this.sendCalls += 1;
        return this.outcomes.shift() ?? false;
    }

    protected override onRetry(): void {
        this.retryCalls += 1;
    }
}

describe("BaseProvider", () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("retries when send returns false and stops after a success", async () => {
        vi.useFakeTimers();
        const provider = new RetryTestProvider([false, false, true]);

        await provider.sendMessage({ title: "t", body: "b" });
        await vi.runAllTimersAsync();

        expect(provider.sendCalls).toBe(3);
        expect(provider.retryCalls).toBe(2);
    });

    it("stops retrying after 3 retries with increasing backoff", async () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
        const provider = new RetryTestProvider([
            false,
            false,
            false,
            false,
            false,
        ]);

        await provider.sendMessage({ title: "t", body: "b" });
        await vi.runAllTimersAsync();

        expect(provider.sendCalls).toBe(4);
        expect(provider.retryCalls).toBe(3);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
        expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(5000);
        expect(setTimeoutSpy.mock.calls[1]?.[1]).toBe(10000);
        expect(setTimeoutSpy.mock.calls[2]?.[1]).toBe(15000);
    });
});

describe("TelegramProvider", () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("fetches chat id once and reuses it across sends", async () => {
        const fetchMock = vi.mocked(globalThis.fetch);
        fetchMock.mockImplementation(async (input) => {
            const url = String(input);
            if (url.includes("/getUpdates")) {
                return createResponse(true, {
                    result: [{ message: { chat: { id: 123 } } }],
                });
            }
            return createResponse(true);
        });

        const provider = new TelegramProvider({
            enabled: true,
            botToken: "token",
        });

        await provider.sendMessage({ title: "One", body: "Body" });
        await provider.sendMessage({ title: "Two", body: "Body" });

        const updateCalls = fetchMock.mock.calls.filter(([input]) =>
            String(input).includes("/getUpdates"),
        );
        const sendCalls = fetchMock.mock.calls.filter(([input]) =>
            String(input).includes("/sendMessage"),
        );

        expect(updateCalls).toHaveLength(1);
        expect(sendCalls).toHaveLength(2);
        expect(provider.configData.chatId).toBe(123);
    });

    it("retries when Telegram message API is non-2xx", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.mocked(globalThis.fetch);
        fetchMock.mockResolvedValue(createResponse(false));

        const provider = new TelegramProvider({
            enabled: true,
            botToken: "token",
            chatId: 123,
        });

        await provider.sendMessage({ title: "Fail", body: "Body" });
        await vi.runAllTimersAsync();

        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("retries when Telegram fetch throws", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.mocked(globalThis.fetch);
        fetchMock.mockRejectedValue(new Error("boom"));

        const provider = new TelegramProvider({
            enabled: true,
            botToken: "token",
            chatId: 123,
        });

        await provider.sendMessage({ title: "Throw", body: "Body" });
        await vi.runAllTimersAsync();

        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("retries when getUpdates has no usable chat id", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.mocked(globalThis.fetch);
        fetchMock.mockResolvedValue(createResponse(true, { result: [] }));

        const provider = new TelegramProvider({
            enabled: true,
            botToken: "token",
        });

        await provider.sendMessage({ title: "Missing", body: "Body" });
        await vi.runAllTimersAsync();

        const updateCalls = fetchMock.mock.calls.filter(([input]) =>
            String(input).includes("/getUpdates"),
        );
        const sendCalls = fetchMock.mock.calls.filter(([input]) =>
            String(input).includes("/sendMessage"),
        );

        expect(updateCalls).toHaveLength(4);
        expect(sendCalls).toHaveLength(0);
    });

    it("splits long messages into 4096-char chunks", async () => {
        const fetchMock = vi.mocked(globalThis.fetch);
        fetchMock.mockResolvedValue(createResponse(true));

        const provider = new TelegramProvider({
            enabled: true,
            botToken: "token",
            chatId: 123,
        });

        await provider.sendMessage({ title: "T", body: "x".repeat(9000) });

        expect(fetchMock).toHaveBeenCalledTimes(4);
        const lengths = fetchMock.mock.calls.map(([, init]) => {
            const body = JSON.parse((init as RequestInit).body as string);
            return body.text.length as number;
        });
        expect(lengths).toEqual([9, 4096, 4096, 808]);
    });

    it("clears cached chat id on retry and refreshes it", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.mocked(globalThis.fetch);

        fetchMock.mockImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/getUpdates")) {
                return createResponse(true, {
                    result: [{ message: { chat: { id: 222 } } }],
                });
            }
            if (url.includes("/sendMessage")) {
                const body = JSON.parse((init as RequestInit).body as string);
                if (body.chat_id === 111) return createResponse(false);
                if (body.chat_id === 222) return createResponse(true);
            }
            return createResponse(false);
        });

        const provider = new TelegramProvider({
            enabled: true,
            botToken: "token",
            chatId: 111,
        });

        await provider.sendMessage({ title: "Recover", body: "Body" });
        await vi.runAllTimersAsync();

        const updateCalls = fetchMock.mock.calls.filter(([input]) =>
            String(input).includes("/getUpdates"),
        );
        const send111Calls = fetchMock.mock.calls.filter(([, init]) => {
            if (!init || !(init as RequestInit).body) return false;
            const body = JSON.parse((init as RequestInit).body as string);
            return body.chat_id === 111;
        });
        const send222Calls = fetchMock.mock.calls.filter(([, init]) => {
            if (!init || !(init as RequestInit).body) return false;
            const body = JSON.parse((init as RequestInit).body as string);
            return body.chat_id === 222;
        });

        expect(send111Calls).toHaveLength(1);
        expect(updateCalls).toHaveLength(1);
        expect(send222Calls).toHaveLength(1);
        expect(provider.configData.chatId).toBe(222);
    });
});

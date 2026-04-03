export interface MessageData {
    title: string;
    body: string;
    url?: string;
}

export abstract class BaseProvider<T = unknown> {
    constructor(protected config: T) {}

    get configData() {
        return this.config;
    }

    protected abstract send(message: string): Promise<boolean>;
    protected onRetry(): void {}

    protected splitMessage(message: string, maxLength: number): string[] {
        const parts: string[] = [];
        let currentPart = "";

        for (const line of message.split("\n")) {
            if (line.length > maxLength) {
                if (currentPart) {
                    parts.push(currentPart);
                    currentPart = "";
                }
                for (let i = 0; i < line.length; i += maxLength) {
                    parts.push(line.slice(i, i + maxLength));
                }
                continue;
            }
            if (currentPart.length + line.length + 1 > maxLength) {
                parts.push(currentPart);
                currentPart = "";
            }
            currentPart += (currentPart ? "\n" : "") + line;
        }

        if (currentPart) {
            parts.push(currentPart);
        }

        return parts;
    }

    protected formatMessage(data: MessageData): string {
        let message = `${data.title}\n\n${data.body}`;
        if (data.url) {
            message += `\n\n${data.url}`;
        }
        return message;
    }

    async sendMessage(
        data: MessageData,
        attempts = 0,
        timeout = 5000,
    ): Promise<void> {
        const ok = await this.send(this.formatMessage(data));
        if (ok || attempts >= 3) return;

        this.onRetry();
        setTimeout(() => {
            void this.sendMessage(data, attempts + 1, timeout + 5000);
        }, timeout);
    }
}

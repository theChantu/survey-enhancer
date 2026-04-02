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

    async sendMessage(
        message: string,
        attempts = 0,
        timeout = 5000,
    ): Promise<void> {
        const ok = await this.send(message);

        if (!ok && attempts < 3) {
            this.onRetry();
            setTimeout(
                () => this.sendMessage(message, attempts + 1, timeout + 5000),
                timeout,
            );
        }
    }
}

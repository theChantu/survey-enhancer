export abstract class BaseProvider<T = unknown> {
    constructor(protected config: T) {}

    protected abstract send(message: string): Promise<boolean>;
    protected onRetry(): void {}

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

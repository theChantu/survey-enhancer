export abstract class BaseProvider<T = unknown> {
    constructor(protected config: T) {}

    abstract sendMessage(message: string): Promise<void> | void;
}

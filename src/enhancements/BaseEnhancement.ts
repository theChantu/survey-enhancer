import type { BaseAdapter } from "@/adapters";

export default abstract class BaseEnhancement {
    readonly adapter;

    constructor(adapter: BaseAdapter) {
        this.adapter = adapter;
    }

    abstract apply(): Promise<void>;
    abstract revert(): Promise<void>;

    async run() {
        await this.revert();
        await this.apply();
    }
}

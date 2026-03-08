import getSiteAdapter from "../config";

type CurrentSite = ReturnType<typeof getSiteAdapter>;

export default abstract class Enhancement {
    readonly siteName: CurrentSite["siteName"];
    readonly siteAdapter: CurrentSite["adapter"];

    constructor() {
        const { siteName, adapter } = getSiteAdapter();
        this.siteName = siteName;
        this.siteAdapter = adapter;
    }

    abstract apply(): void;
    abstract revert(): void;
}

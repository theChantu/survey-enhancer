export type ChangelogEntry = {
    version: string;
    title: string;
    items: string[];
};

export const changelogEntries = [
    {
        version: "1.8.6",
        title: "Alert visibility control",
        items: [
            "Added an option to suppress alerts while viewing a site's page.",
            "Improved opportunity card timestamp and capability icon contrast.",
            "Fixed Prolific project alerts when available studies refill from zero.",
            'Renamed the "New" filter to "Recent" to include recently updated opportunities.',
        ],
    },
    {
        version: "1.8.1",
        title: "Alerts, filtering & UI refresh",
        items: [
            "Added notification conditions with include and exclude rules.",
            "Filter alerts by title, researcher, reward, hourly rate, slots, and completion time.",
            "Added opportunity support for Prolific projects.",
            "Updated alerts, badges, and the popup to track opportunities instead of studies only.",
            "Gave the UI a new look.",
            "Added min and max sliders for highlighting rates.",
            "Auto reload settings now only appear on supported platforms.",
        ],
    },
] as const satisfies ChangelogEntry[];

export const latestChangelogEntry = changelogEntries[0] ?? null;

export type ChangelogEntry = {
    version: string;
    title: string;
    items: string[];
};

export const changelogEntries = [
    {
        version: "1.8.0",
        title: "Alerts, filtering & UI refresh",
        items: [
            "Added notification conditions with include and exclude rules.",
            "Filter alerts by title, researcher, reward, hourly rate, slots, and completion time.",
            "Added opportunity support for Prolific projects.",
            "Updated alerts, badges, and the popup to track opportunities instead of studies only.",
            "Gave the UI a new look.",
            "Added min and max sliders for highlighting rates.",
        ],
    },
] as const satisfies ChangelogEntry[];

export const latestChangelogEntry = changelogEntries[0] ?? null;

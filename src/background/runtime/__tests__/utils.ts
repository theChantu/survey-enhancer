import type { ProjectInfo, StudyInfo } from "@/adapters/BaseAdapter";

export function createStudy(
    id: string,
    overrides: Partial<StudyInfo> = {},
): StudyInfo {
    return {
        id,
        kind: "study",
        title: `Study ${id.toUpperCase()}`,
        researcher: `Researcher ${id.toUpperCase()}`,
        reward: 1,
        rate: 12,
        link: `https://app.prolific.com/studies/${id}`,
        symbol: "$",
        devices: [],
        peripherals: [],
        averageCompletionMinutes: 10,
        slots: 10,
        ...overrides,
    };
}

export function createProject(
    id: string,
    overrides: Partial<ProjectInfo> = {},
): ProjectInfo {
    return {
        id,
        kind: "project",
        title: `Project ${id.toUpperCase()}`,
        link: `https://app.prolific.com/projects/${id}`,
        availableStudyCount: 1,
        ...overrides,
    };
}

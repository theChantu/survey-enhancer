import { BaseAdapter } from "./BaseAdapter";
import { extractSymbol } from "../lib/utils";
import { sites } from "./siteConfigs";
import { parseNumericValue } from "@/lib/parse/parseNumericValue";

import type { OpportunityInfo, ProjectInfo, Source } from "./BaseAdapter";

const HOST = "app.prolific.com";

export class ProlificAdapter extends BaseAdapter<typeof HOST> {
    constructor() {
        super({ ...sites[HOST], host: HOST });
    }

    getStudyElements() {
        return document.querySelectorAll<HTMLElement>(
            'li[data-testid^="study-"]',
        );
    }

    getStudyId(el: HTMLElement) {
        return el.getAttribute("data-testid")?.replace("study-", "") ?? null;
    }

    getStudyContainer(el: HTMLElement) {
        return el.querySelector<HTMLElement>("div.study-content");
    }

    getStudyTitle(el: HTMLElement) {
        return this.getText(el, "h2");
    }

    getStudyResearcher(el: HTMLElement): string | null {
        return this.getText(el, '[aria-labelledby*="host-name-"]');
    }

    getSourceSymbol(el: HTMLElement) {
        return extractSymbol(el.textContent);
    }

    getRewardElements() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                "[data-testid='study-tag-reward-per-hour'], [data-testid='study-tag-reward'], ul.info-hint li span.amount",
            ),
        );
    }

    getRewardElement(el: HTMLElement) {
        return el.querySelector<HTMLElement>(
            "[data-testid='study-tag-reward']",
        );
    }

    getHourlyRateElements() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                "[data-testid='study-tag-reward-per-hour']",
            ),
        );
    }

    getHourlyRateElement(el: HTMLElement) {
        return el.querySelector<HTMLElement>(
            "[data-testid='study-tag-reward-per-hour']",
        );
    }

    getCapabilityHints(el: HTMLElement) {
        const capabilityElements = el.querySelectorAll(
            "span.device-icon[data-testid]",
        );

        return this.collectHints(capabilityElements, (el) => [
            el.getAttribute("data-testid") ?? "",
        ]);
    }

    protected getStudyAverageCompletionText(el: HTMLElement): string | null {
        return this.getText(el, '[data-testid="study-tag-completion-time"]');
    }

    protected getStudySlotsText(el: HTMLElement): string | null {
        return this.getText(el, '[data-testid="study-tag-places"]');
    }

    private getProjectElements() {
        const projectSection = Array.from(
            document.querySelectorAll<HTMLElement>(
                "nav.projects-sidebar section",
            ),
        ).find((section) => {
            const heading = section.querySelector("h2")?.textContent;
            return heading?.trim().toLowerCase() === "projects";
        });

        return Array.from(
            projectSection?.querySelectorAll<HTMLElement>("li") ?? [],
        );
    }

    private normalizeProjectName(name: string): string {
        return name.trim().toLowerCase().replace(/\s+/g, " ");
    }

    private getSyntheticProjectId(name: string): string {
        const normalized = this.normalizeProjectName(name);
        let hash = 0;

        for (let index = 0; index < normalized.length; index += 1) {
            hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
        }

        return hash.toString(36);
    }

    private getProjectTitle(el: HTMLElement): string | null {
        return this.getText(el, "span.nav-item__text");
    }

    private getProjectAvailableStudyCount(el: HTMLElement): number | null {
        const count = this.getText(el, "sup.indicator");
        return count ? parseNumericValue(count) : null;
    }

    private extractProject(el: HTMLElement): ProjectInfo | null {
        const title = this.getProjectTitle(el);
        if (!title) return null;

        const availableStudyCount = this.getProjectAvailableStudyCount(el);
        if (availableStudyCount === null || availableStudyCount <= 0) return null;

        return {
            id: this.getSyntheticProjectId(title),
            kind: "project",
            title,
            link: null,
            availableStudyCount,
        };
    }

    private extractProjects() {
        const projectElements = this.getProjectElements();
        if (projectElements.length === 0) return [];

        const projectIds = new Set<string>();
        const projects: ProjectInfo[] = [];

        for (const el of projectElements) {
            const project = this.extractProject(el);
            if (!project || projectIds.has(project.id)) continue;

            projectIds.add(project.id);
            projects.push(project);
        }

        return projects;
    }

    extractOpportunities(source: Source = "original"): OpportunityInfo[] {
        const opportunities = super.extractOpportunities(source);
        const projects = this.extractProjects();

        return [...opportunities, ...projects];
    }
}

import BaseEnhancement from "./BaseEnhancement";

class SurveyLinksEnhancement extends BaseEnhancement {
    constructor() {
        super();
    }

    async apply() {
        const surveys = this.adapter.getSurveyElements();
        for (const survey of surveys) {
            const surveyId = this.adapter.getSurveyId(survey);
            const surveyContainer = this.adapter.getSurveyContainer(survey);

            if (!surveyId || !surveyContainer) continue;
            const previousButton =
                surveyContainer.querySelector(".se-custom-btn");
            if (previousButton) continue;

            const { surveyPath, suffix } = this.adapter.config;
            const surveyLink = this.adapter.buildUrl([
                surveyPath,
                surveyId,
                ...(suffix ? [suffix] : []),
            ]);

            const container = document.createElement("div");
            const link = document.createElement("a");
            container.className = "se-btn-container";
            container.appendChild(link);
            link.className = "se-custom-btn";
            link.href = surveyLink;
            link.textContent = "Take part in this study";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            surveyContainer.appendChild(container);
        }
    }

    async revert() {
        const elements = document.querySelectorAll(".se-btn-container");
        for (const el of elements) {
            if (!el) continue;
            el.remove();
        }
    }
}

const surveyLinksEnhancement = new SurveyLinksEnhancement();
export { surveyLinksEnhancement };

export interface AdapterEventMap {
    surveyCompletion: {
        url: string;
    };
}

export type AdapterEventType = keyof AdapterEventMap;

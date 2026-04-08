export interface AdapterEventMap {
    surveyCompletion: {
        url: string;
    };
}

export interface NetworkEventMatcher {
    path: string;
    method?: string;
}

export type AdapterEventType = keyof AdapterEventMap;

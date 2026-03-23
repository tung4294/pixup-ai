export interface SourceImage {
    base64: string;
    mimeType: string;
}

export interface GeneratedPromptItem {
    title: string;
    description: string;
}

export interface GeneratedPrompts {
    wide_shots?: GeneratedPromptItem[];
    medium_shots?: GeneratedPromptItem[];
    closeup_shots?: GeneratedPromptItem[];
    artistic_shots?: GeneratedPromptItem[];
}

export type FinishBuildAnalysis = Record<string, string>;
export type LandscapeAnalysis = Record<string, string>;
export type PlanningAnalysis = Record<string, string>;

export interface RenderHistoryItem {
    id: number;
    timestamp: string;
    images: string[];
    prompt: string;
}

export interface EditHistoryItem {
    id: number;
    timestamp: string;
    resultImage: string;
    prompt: string;
}

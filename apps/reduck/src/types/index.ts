export interface ModelInfo {
  id: string;
  label: string;
  providerId: string;
  description?: string;
}

export interface ProviderGroup {
  id: string;
  name: string;
  models: ModelInfo[];
}

export interface ProcessRequest {
  systemPrompt: string;
  text: string;
  modelId: string;
  providerId: string;
}

export interface ProcessResult {
  processedText: string;
  tokensUsed?: number;
  model: string;
  provider: string;
}

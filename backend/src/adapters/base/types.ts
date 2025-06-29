// Base types for Knowledge Store Adapters

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

export interface ResourceContent {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  details?: Record<string, any>;
}

export interface SearchArgs {
  query: string;
  limit?: number;
}

export interface FetchArgs {
  id: string;
}

export interface ListArgs {
  limit?: number;
  offset?: number;
}
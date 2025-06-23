import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  created_at: Date;
  updated_at: Date;
}

export interface Exchange {
  id: string;
  user_id: string;
  name: string;
  description: string;
  type: 'local' | 'google-drive' | 'github';
  slug: string;
  status: 'processing' | 'active' | 'error' | 'stopped';
  privacy: 'private' | 'public';
  config: Record<string, any>;
  metadata: Record<string, any>;
  container_id?: string;
  port?: number;
  queries_count: number;
  last_accessed?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AnalyticsEntry {
  id: string;
  exchange_id: string;
  query: string;
  response_time: number;
  user_agent: string;
  ip_address: string;
  created_at: Date;
}

export interface CreateExchangeRequest {
  name: string;
  description: string;
  type: string;
  privacy?: 'private' | 'public';
  config?: Record<string, any>;
}

export interface LocalExchangeConfig {
  folderPath: string;
}

export interface GoogleDriveConfig {
  credentials: any;
  folderId: string;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}


export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Mock MCP types until SDK is available
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPServer {
  name: string;
  version: string;
  capabilities: {
    tools?: Record<string, any>;
    resources?: Record<string, any>;
  };
}
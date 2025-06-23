import React from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  avatar?: string;
  createdAt: string;
}

export interface Exchange {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'google-drive' | 'github';
  status: 'active' | 'processing' | 'error' | 'stopped';
  queries: number;
  lastAccess: string;
  url: string;
  createdAt: string;
  privacy: 'private' | 'public';
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SourceType {
  id: string;
  name: string;
  icon: React.ComponentType;
  description: string;
  features: string[];
  color: string;
}

export interface CreateExchangeForm {
  name: string;
  description: string;
  type: string;
  privacy: 'private' | 'public';
  files?: File[];
  repository?: string;
  folderId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
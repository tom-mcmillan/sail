import { Upload, Github, Cloud } from 'lucide-react';
import { SourceType } from '@/types';

export const EXCHANGE_TYPES = {
  LOCAL: 'local',
  GOOGLE_DRIVE: 'google-drive',
  GITHUB: 'github'
} as const;

export const EXCHANGE_STATUS = {
  ACTIVE: 'active',
  PROCESSING: 'processing',
  ERROR: 'error',
  STOPPED: 'stopped'
} as const;

export const USER_PLANS = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
  ENTERPRISE: 'enterprise'
} as const;

export const SOURCE_TYPES: SourceType[] = [
  {
    id: EXCHANGE_TYPES.LOCAL,
    name: 'Local Files',
    icon: Upload,
    description: 'Upload documents, PDFs, text files from your computer',
    features: ['Instant upload', 'Full-text search', 'Document parsing'],
    color: 'bg-blue-500'
  },
  {
    id: EXCHANGE_TYPES.GOOGLE_DRIVE,
    name: 'Google Drive',
    icon: Cloud,
    description: 'Connect Google Docs, Sheets, and Drive folders',
    features: ['Real-time sync', 'Collaborative docs', 'Rich formatting'],
    color: 'bg-green-500'
  },
  {
    id: EXCHANGE_TYPES.GITHUB,
    name: 'GitHub Repository',
    icon: Github,
    description: 'Share code repositories, documentation, and issues',
    features: ['Code search', 'Commit history', 'Issue tracking'],
    color: 'bg-gray-800'
  }
];

export const MOCK_USER = {
  id: '1',
  name: 'Jane Researcher',
  email: 'jane@university.edu',
  plan: USER_PLANS.PRO,
  avatar: null,
  createdAt: '2024-01-01T00:00:00Z'
};

export const MOCK_EXCHANGES = [
  {
    id: 'ai-research-2024-jane',
    name: 'AI Research Papers 2024',
    type: EXCHANGE_TYPES.GOOGLE_DRIVE,
    status: EXCHANGE_STATUS.ACTIVE,
    queries: 1247,
    lastAccess: '2 hours ago',
    url: 'https://getsail.net/mcp/ai-research-2024-jane',
    description: 'My collection of AI and ML research papers from 2024',
    createdAt: '2024-01-15T10:30:00Z',
    privacy: 'private' as const
  },
  {
    id: 'startup-knowledge-base',
    name: 'Startup Knowledge Base',
    type: EXCHANGE_TYPES.LOCAL,
    status: EXCHANGE_STATUS.ACTIVE,
    queries: 89,
    lastAccess: '1 day ago',
    url: 'https://getsail.net/mcp/startup-knowledge-base',
    description: 'Business plans, market research, and strategy documents',
    createdAt: '2024-01-10T14:20:00Z',
    privacy: 'private' as const
  },
  {
    id: 'open-source-project',
    name: 'My Open Source Project',
    type: EXCHANGE_TYPES.GITHUB,
    status: EXCHANGE_STATUS.PROCESSING,
    queries: 234,
    lastAccess: '3 hours ago',
    url: 'https://getsail.net/mcp/open-source-project',
    description: 'Documentation and code for my ML library',
    createdAt: '2024-01-08T09:15:00Z',
    privacy: 'public' as const
  }
];
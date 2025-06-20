'use client';

import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  Github, 
  Share2, 
  Search, 
  Users, 
  BarChart3, 
  Settings, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Database, 
  Zap, 
  Cloud,
  X,
  Loader2
} from 'lucide-react';

// Import our types and utilities
import { Exchange, CreateExchangeForm, SourceType, User } from '@/types';
import { SOURCE_TYPES, MOCK_USER, EXCHANGE_TYPES, EXCHANGE_STATUS } from '@/constants';
import { validateExchangeForm } from '@/utils/validation';
import { useClipboard } from '@/hooks/useClipboard';
import { useExchanges } from '@/hooks/useExchanges';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Header } from '@/components/layout/Header';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  
  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return fallback || (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-red-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h3>
        <p className="text-gray-600">Please refresh the page and try again</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Source Type Card Component
interface SourceTypeCardProps {
  source: SourceType;
  onSelect: (source: SourceType) => void;
  isSelected: boolean;
}

const SourceTypeCard: React.FC<SourceTypeCardProps> = React.memo(({ source, onSelect, isSelected }) => {
  const IconComponent = source.icon;
  
  return (
    <div 
      className={`bg-white rounded-xl border p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group ${
        isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'
      }`}
      onClick={() => onSelect(source)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(source);
        }
      }}
      aria-label={`Select ${source.name}`}
    >
      <div className={`${source.color} rounded-lg p-3 w-fit mb-4 group-hover:scale-110 transition-transform`}>
        <IconComponent className="h-6 w-6 text-white" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{source.name}</h3>
      <p className="text-gray-600 mb-4">{source.description}</p>
      
      <ul className="space-y-2">
        {source.features.map((feature, idx) => (
          <li key={idx} className="flex items-center text-sm text-gray-500">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      
      <Button 
        className="w-full mt-6"
        variant={isSelected ? "primary" : "secondary"}
      >
        {isSelected ? "Selected" : `Connect ${source.name}`}
      </Button>
    </div>
  );
});

SourceTypeCard.displayName = 'SourceTypeCard';

// Create Exchange Component
interface CreateExchangeProps {
  onComplete?: (exchange: Exchange) => void;
  onBack?: () => void;
}

const CreateExchange: React.FC<CreateExchangeProps> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<SourceType | null>(null);
  const [formData, setFormData] = useState<CreateExchangeForm>({
    name: '',
    description: '',
    type: '',
    privacy: 'private',
    files: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createExchange, loading } = useExchanges();

  const handleSourceSelect = useCallback((sourceType: SourceType) => {
    setSelectedSource(sourceType);
    setFormData(prev => ({ ...prev, type: sourceType.id }));
    setStep(2);
  }, []);

  const handleInputChange = useCallback((field: keyof CreateExchangeForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const handleCreateExchange = useCallback(async () => {
    const validation = validateExchangeForm(formData);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      const newExchange = await createExchange(formData);
      onComplete?.(newExchange);
    } catch (error) {
      setErrors({ submit: 'Failed to create exchange. Please try again.' });
    }
  }, [formData, createExchange, onComplete]);

  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Share Your Knowledge</h1>
          <p className="text-xl text-gray-600">Choose how you want to share your research, documents, or code with AI assistants</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {SOURCE_TYPES.map((source) => (
            <SourceTypeCard
              key={source.id}
              source={source}
              onSelect={handleSourceSelect}
              isSelected={selectedSource?.id === source.id}
            />
          ))}
        </div>
      </div>
    );
  }

  if (step === 2 && selectedSource) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <div className={`${selectedSource.color} rounded-lg p-2 mr-4`}>
              <selectedSource.icon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold">Configure {selectedSource.name}</h2>
          </div>

          <div className="space-y-6">
            <Input
              label="Exchange Name"
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., My Research Papers 2024"
              error={errors.name}
            />

            <Textarea
              label="Description"
              required
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what kind of knowledge you're sharing..."
              rows={3}
              error={errors.description}
            />

            {selectedSource.id === EXCHANGE_TYPES.LOCAL && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Files</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Drag and drop files here, or click to browse</p>
                  <p className="text-sm text-gray-500 mt-2">Supports PDF, DOC, TXT, MD, and more</p>
                </div>
              </div>
            )}

            {selectedSource.id === EXCHANGE_TYPES.GOOGLE_DRIVE && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google Drive Connection</label>
                <Button variant="outline" className="w-full justify-center">
                  <Cloud className="h-5 w-5 text-green-600 mr-3" />
                  Connect to Google Drive
                </Button>
                <p className="text-sm text-gray-500 mt-2">We&apos;ll ask permission to access specific folders or documents</p>
              </div>
            )}

            {selectedSource.id === EXCHANGE_TYPES.GITHUB && (
              <Input
                label="GitHub Repository"
                placeholder="username/repository-name"
                value={formData.repository || ''}
                onChange={(e) => handleInputChange('repository', e.target.value)}
                error={errors.repository}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Privacy Settings</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="privacy"
                    value="private"
                    checked={formData.privacy === 'private'}
                    onChange={(e) => handleInputChange('privacy', e.target.value)}
                    className="mr-3"
                  />
                  <span>Private - Only people with the link can access</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="privacy"
                    value="public"
                    checked={formData.privacy === 'public'}
                    onChange={(e) => handleInputChange('privacy', e.target.value)}
                    className="mr-3"
                  />
                  <span>Public - Anyone can discover and use</span>
                </label>
              </div>
            </div>

            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errors.submit}
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (onBack) {
                    onBack();
                  } else {
                    setStep(1);
                  }
                }}
                disabled={loading}
              >
                Back
              </Button>
              <Button 
                className="flex-1"
                onClick={handleCreateExchange}
                disabled={!formData.name || !formData.description || loading}
                loading={loading}
              >
                Create Exchange
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Exchange Card Component
interface ExchangeCardProps {
  exchange: Exchange;
  onCopy?: (url: string, id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}

const ExchangeCard: React.FC<ExchangeCardProps> = React.memo(({ exchange, onCopy, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { copyToClipboard, copiedId } = useClipboard();
  
  const getTypeIcon = (type: Exchange['type']) => {
    switch (type) {
      case EXCHANGE_TYPES.LOCAL: return FileText;
      case EXCHANGE_TYPES.GOOGLE_DRIVE: return Cloud;
      case EXCHANGE_TYPES.GITHUB: return Github;
      default: return Database;
    }
  };

  const getStatusColor = (status: Exchange['status']) => {
    switch (status) {
      case EXCHANGE_STATUS.ACTIVE: return 'bg-green-100 text-green-800';
      case EXCHANGE_STATUS.PROCESSING: return 'bg-yellow-100 text-yellow-800';
      case EXCHANGE_STATUS.ERROR: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const TypeIcon = getTypeIcon(exchange.type);
  
  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(exchange.url, exchange.id);
    if (success && onCopy) {
      onCopy(exchange.url, exchange.id);
    }
  }, [exchange.url, exchange.id, copyToClipboard, onCopy]);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete?.(exchange.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete exchange:', error);
    }
  }, [exchange.id, onDelete]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <div className="bg-gray-100 rounded-lg p-3">
            <TypeIcon className="h-6 w-6 text-gray-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-semibold text-gray-900 truncate">{exchange.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(exchange.status)}`}>
                {exchange.status}
              </span>
            </div>
            
            <p className="text-gray-600 mb-4 line-clamp-2">{exchange.description}</p>
            
            <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
              <div className="flex items-center">
                <Search className="h-4 w-4 mr-1" />
                {exchange.queries} queries
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Last accessed {exchange.lastAccess}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 truncate">
                {exchange.url}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copiedId === exchange.id ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy MCP URL
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="View analytics"
          >
            <BarChart3 className="h-5 w-5" />
          </button>
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button 
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete exchange"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Exchange</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &quot;{exchange.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ExchangeCard.displayName = 'ExchangeCard';

// Dashboard Component
interface DashboardProps {
  onCreateNew: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onCreateNew }) => {
  const { exchanges, loading, error, deleteExchange } = useExchanges();
  const { copyToClipboard } = useClipboard();

  const handleCopy = useCallback(async (url: string, id: string) => {
    await copyToClipboard(url, id);
  }, [copyToClipboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-red-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Exchanges</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Knowledge Exchanges</h1>
          <p className="text-gray-600 mt-2">Manage and monitor your shared knowledge sources</p>
        </div>
        <Button onClick={onCreateNew} className="flex items-center">
          <Zap className="h-5 w-5 mr-2" />
          Create New Exchange
        </Button>
      </div>

      <div className="grid gap-6">
        {exchanges.map((exchange) => (
          <ExchangeCard
            key={exchange.id}
            exchange={exchange}
            onCopy={handleCopy}
            onDelete={deleteExchange}
          />
        ))}
      </div>

      {exchanges.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No exchanges yet</h3>
          <p className="text-gray-600 mb-6">Create your first knowledge exchange to start sharing with AI assistants</p>
          <Button onClick={onCreateNew}>
            Create Your First Exchange
          </Button>
        </div>
      )}
    </div>
  );
};

// How It Works Component
const HowItWorks: React.FC = () => (
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">How GetSail Works</h1>
      <p className="text-xl text-gray-600">Share your knowledge with AI assistants in three simple steps</p>
    </div>

    <div className="space-y-16">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="bg-blue-100 rounded-lg p-4 w-fit mb-6">
            <Upload className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">1. Connect Your Knowledge</h3>
          <p className="text-gray-600 text-lg leading-relaxed">
            Upload local files, connect your Google Drive folders, or link GitHub repositories. 
            GetSail automatically indexes and organizes your content for AI access.
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            </div>
            <div className="space-y-2">
              <div className="bg-gray-100 rounded p-2 text-sm">📁 Research Papers</div>
              <div className="bg-gray-100 rounded p-2 text-sm">📄 Project Documentation</div>
              <div className="bg-gray-100 rounded p-2 text-sm">💻 Code Repository</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-8">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-center py-4">
                <Share2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-mono">
                  getsail.net/mcp/ai-research-2024
                </div>
                <p className="text-xs text-gray-500 mt-2">Ready to share!</p>
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 md:order-2">
          <div className="bg-green-100 rounded-lg p-4 w-fit mb-6">
            <Share2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">2. Get Your MCP URL</h3>
          <p className="text-gray-600 text-lg leading-relaxed">
            GetSail creates a unique MCP server URL for your knowledge. This URL acts as a bridge 
            between your content and any AI assistant that supports MCP integration.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="bg-purple-100 rounded-lg p-4 w-fit mb-6">
            <Zap className="h-8 w-8 text-purple-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">3. AI Magic Happens</h3>
          <p className="text-gray-600 text-lg leading-relaxed">
            Your collaborators paste the MCP URL into their AI assistant. Now they can ask questions 
            about your knowledge in natural language and get intelligent, contextual answers.
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl p-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <strong>User:</strong> &quot;What did Jane write about transformer architectures?&quot;
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <strong>AI:</strong> &quot;Based on Jane&apos;s research papers, she discussed three key innovations in transformer architectures...&quot;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-center text-white">
      <h3 className="text-2xl font-semibold mb-4">Ready to Share Your Knowledge?</h3>
      <p className="text-lg mb-6 opacity-90">Join researchers, teams, and families already using GetSail</p>
      <Button className="bg-white text-blue-600 hover:bg-gray-100">
        Start Your First Exchange
      </Button>
    </div>
  </div>
);

// Footer Component
const Footer: React.FC = () => (
  <footer className="bg-gray-50 border-t border-gray-200 mt-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-blue-600 rounded-lg p-1">
              <Share2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">GetSail</span>
          </div>
          <p className="text-gray-600 text-sm">
            Connecting knowledge with AI assistants through seamless MCP integration.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="#" className="hover:text-gray-900">Features</a></li>
            <li><a href="#" className="hover:text-gray-900">Pricing</a></li>
            <li><a href="#" className="hover:text-gray-900">API Docs</a></li>
            <li><a href="#" className="hover:text-gray-900">Integrations</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="#" className="hover:text-gray-900">Documentation</a></li>
            <li><a href="#" className="hover:text-gray-900">Tutorials</a></li>
            <li><a href="#" className="hover:text-gray-900">Community</a></li>
            <li><a href="#" className="hover:text-gray-900">Support</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="#" className="hover:text-gray-900">About</a></li>
            <li><a href="#" className="hover:text-gray-900">Privacy</a></li>
            <li><a href="#" className="hover:text-gray-900">Terms</a></li>
            <li><a href="#" className="hover:text-gray-900">Contact</a></li>
          </ul>
        </div>
      </div>
      
      <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
        © 2024 GetSail. All rights reserved.
      </div>
    </div>
  </footer>
);

// Main App Component
const GetSailApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [user] = useState<User>(MOCK_USER);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleCreateComplete = useCallback((exchange: Exchange) => {
    console.log('Exchange created:', exchange);
    setActiveTab('dashboard');
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'create':
        return (
          <CreateExchange 
            onComplete={handleCreateComplete}
            onBack={() => setActiveTab('dashboard')}
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            onCreateNew={() => setActiveTab('create')}
          />
        );
      case 'how-it-works':
        return <HowItWorks />;
      default:
        return <Dashboard onCreateNew={() => setActiveTab('create')} />;
    }
};
return (
<ErrorBoundary>
<div className="min-h-screen bg-gray-50">
<Header 
       user={user}
       activeTab={activeTab}
       onTabChange={handleTabChange}
     />
    <main className="py-8 px-4 sm:px-6 lg:px-8">
      {renderContent()}
    </main>

    <Footer />
  </div>
</ErrorBoundary>
);
};
export default GetSailApp;
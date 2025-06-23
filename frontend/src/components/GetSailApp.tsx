'use client';

import { useState } from 'react';

interface Exchange {
  id: string;
  name: string;
  description: string;
  type: string;
  slug: string;
  status: string;
  url: string;
  created_at: string;
}

export function GetSailApp() {
  const [activeTab, setActiveTab] = useState('local');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    folderPath: '',
    privacy: 'private'
  });

  const handleFolderSelect = async () => {
    try {
      // Try to use the modern File System Access API (Chrome/Edge only)
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const path = dirHandle.name; // This gives us the folder name, not full path
        // For security reasons, browsers don't expose full system paths
        // We'll use the folder name and let user confirm/edit
        const fullPath = prompt(`Selected folder: "${path}"\n\nPlease enter the full path to this folder:`, `/Users/thomasmcmillan/${path}`);
        if (fullPath) {
          setFormData(prev => ({ ...prev, folderPath: fullPath }));
        }
      } else {
        // Fallback for browsers that don't support File System Access API
        const path = prompt(
          'Browser folder selection not supported.\n\nPlease enter the full path to your folder:\n\nExamples:\n• /Users/yourname/Documents/Research\n• /Users/yourname/Desktop/MyProject\n• /home/user/documents'
        );
        if (path) {
          setFormData(prev => ({ ...prev, folderPath: path }));
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled the picker
        return;
      }
      console.error('Error selecting folder:', error);
      alert('Could not access folder picker. Please enter the path manually.');
    }
  };

  const handleCreateExchange = async () => {
    if (!formData.name || !formData.description || !formData.folderPath) {
      alert('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:3001/api/exchanges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: 'local',
          privacy: formData.privacy,
          config: {
            folderPath: formData.folderPath
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setExchanges(prev => [...prev, result.data]);
        setFormData({ name: '', description: '', folderPath: '', privacy: 'private' });
        alert(`MCP Server created successfully!\n\nMCP URL: ${result.data.url}\n\nCopy this URL and paste it into Claude Desktop or ChatGPT's MCP integrations.`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating MCP server:', error);
      alert('Failed to create MCP server. Please check if the backend is running.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Create MCP Server
      </h1>
      <p className="text-gray-600 mb-8">
        Turn your knowledge sources into MCP servers that AI assistants can query
      </p>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Panel - Creation Form */}
        <div className="lg:col-span-2">
          {/* Source Type Selection */}
          <div className="flex border-b border-gray-200 mb-8">
            <button
              onClick={() => setActiveTab('local')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'local'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📁 Local Folder
            </button>
            <button
              onClick={() => setActiveTab('google-drive')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'google-drive'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📄 Google Drive
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'github'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔗 GitHub Repository
            </button>
          </div>

          {/* Configuration Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            {activeTab === 'local' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Local Folder MCP Server
                </h2>
                <p className="text-gray-600 mb-6">
                  Select a folder to create an MCP server that provides continuous access to your documents and files.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Server Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., My Research Documents"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what kind of documents are in this folder..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Folder Path *
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={formData.folderPath}
                        placeholder="/Users/yourname/Documents/Research"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        readOnly
                      />
                      <button 
                        onClick={handleFolderSelect}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-sm font-medium"
                      >
                        Select Folder
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      This folder will be continuously monitored. You maintain full control over your files.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Privacy
                    </label>
                    <select
                      value={formData.privacy}
                      onChange={(e) => setFormData(prev => ({ ...prev, privacy: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="private">Private (requires authentication)</option>
                      <option value="public">Public (anyone with URL can access)</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={handleCreateExchange}
                    disabled={isCreating || !formData.name || !formData.description || !formData.folderPath}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium"
                  >
                    {isCreating ? 'Creating MCP Server...' : 'Create MCP Server'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'google-drive' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Google Drive MCP Server
                </h2>
                <p className="text-gray-600 mb-6">
                  Connect your Google Drive to make specific folders searchable through AI assistants.
                </p>
                <div className="text-center py-8">
                  <p className="text-gray-500">Google Drive integration coming soon...</p>
                </div>
              </div>
            )}

            {activeTab === 'github' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  GitHub Repository MCP Server
                </h2>
                <p className="text-gray-600 mb-6">
                  Share your code repositories, documentation, and issues through MCP servers.
                </p>
                <div className="text-center py-8">
                  <p className="text-gray-500">GitHub integration coming soon...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - MCP Servers List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Your MCP Servers
            </h3>
            
            {exchanges.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No MCP servers created yet. Create your first server to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {exchanges.map((exchange) => (
                  <div key={exchange.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">{exchange.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{exchange.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        exchange.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exchange.status}
                      </span>
                      <span className="text-xs text-gray-500">{exchange.type}</span>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">MCP URL:</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={exchange.url}
                          readOnly
                          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(exchange.url)}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <button className="text-xs text-red-600 hover:text-red-800">
                        Delete Server
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { GetSailApp } from '@/components/GetSailApp';

export default function Home() {
  const [currentView, setCurrentView] = useState<'home' | 'app'>('home');

  if (currentView === 'app') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onBack={() => setCurrentView('home')} />
        <GetSailApp />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Sail MCP
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Turn your local folders, Google Drive, and GitHub repositories into MCP servers 
            that AI assistants can query and search through natural language.
          </p>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setCurrentView('app')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              Create MCP Server
            </button>
            <button className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
              View Demo
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              📁
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Local Folders</h3>
            <p className="text-gray-600">
              Select a folder on your computer and create an MCP server that provides 
              real-time access to your documents and files.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              📄
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Google Drive</h3>
            <p className="text-gray-600">
              Connect your Google Drive folders and documents to make them searchable 
              through AI assistants with proper permissions.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              🔗
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">GitHub Repos</h3>
            <p className="text-gray-600">
              Share your code repositories, documentation, and issues through 
              MCP servers for collaborative AI-assisted development.
            </p>
          </div>
        </div>

        {/* How it Works */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">How it Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Choose Your Source</h3>
              <p className="text-gray-600">Select local folders, Google Drive, or GitHub repositories to share</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">Get MCP URL</h3>
              <p className="text-gray-600">Receive a shareable MCP server URL for your knowledge source</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Integration</h3>
              <p className="text-gray-600">Add the URL to Claude Desktop or other MCP-compatible AI assistants</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

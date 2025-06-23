'use client';

import React from 'react';

interface HeaderProps {
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onBack }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 rounded-lg p-2">
                <span className="text-white font-bold text-lg">⛵</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Sail MCP</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                ← Back to Home
              </button>
            )}
            <div className="flex items-center space-x-3">
              <button className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
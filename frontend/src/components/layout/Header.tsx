'use client';

import React from 'react';
import { Share2 } from 'lucide-react';
import { User } from '@/types';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  user?: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ user, activeTab, onTabChange }) => {
  const navigation = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'create', label: 'Create Exchange' },
    { id: 'how-it-works', label: 'How It Works' }
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600 rounded-lg p-2">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">GetSail</span>
            </div>
            
            <nav className="hidden md:flex space-x-6">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === item.id 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">Welcome, {user.name}</span>
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium capitalize">
                  {user.plan}
                </div>
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                  Sign In
                </button>
                <Button size="sm">
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
import { useState, useCallback } from 'react';
import { Exchange, CreateExchangeForm } from '@/types';
// import { api } from '@/utils/api';
import { MOCK_EXCHANGES } from '@/constants';

export const useExchanges = () => {
  const [exchanges, setExchanges] = useState<Exchange[]>(MOCK_EXCHANGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const createExchange = useCallback(async (formData: CreateExchangeForm): Promise<Exchange> => {
    setLoading(true);
    setError(null);
    
    try {
      // For now, simulate API call - replace with real API later
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newExchange: Exchange = {
        id: `exchange-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        type: formData.type as Exchange['type'],
        status: 'processing',
        queries: 0,
        lastAccess: 'Never',
        url: `https://getsail.net/mcp/${formData.name.toLowerCase().replace(/\s+/g, '-')}`,
        createdAt: new Date().toISOString(),
        privacy: formData.privacy
      };
      
      setExchanges(prev => [newExchange, ...prev]);
      return newExchange;
    } catch {
      const errorMessage = 'Failed to create exchange';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const deleteExchange = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setExchanges(prev => prev.filter(ex => ex.id !== id));
    } catch {
      const errorMessage = 'Failed to delete exchange';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    exchanges,
    loading,
    error,
    createExchange,
    deleteExchange
  };
};
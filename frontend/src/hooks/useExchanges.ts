import { useState, useCallback } from 'react';
import { Exchange, CreateExchangeForm } from '@/types';
import { api } from '@/utils/api';
import { MOCK_EXCHANGES } from '@/constants';

export const useExchanges = () => {
  const [exchanges, setExchanges] = useState<Exchange[]>(MOCK_EXCHANGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const createExchange = useCallback(async (formData: CreateExchangeForm): Promise<Exchange> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.createExchange(formData);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (!response.data) {
        throw new Error('No data returned from API');
      }
      
      const newExchange = response.data;
      setExchanges(prev => [newExchange, ...prev]);
      return newExchange;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create exchange';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const deleteExchange = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.deleteExchange(id);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      setExchanges(prev => prev.filter(ex => ex.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete exchange';
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
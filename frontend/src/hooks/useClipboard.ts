import { useState, useCallback } from 'react';

export const useClipboard = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const copyToClipboard = useCallback(async (text: string, id?: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);
  
  return { copyToClipboard, copiedId };
};
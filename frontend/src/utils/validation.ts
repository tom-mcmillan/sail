import { CreateExchangeForm, ValidationError } from '@/types';

export const validateExchangeForm = (formData: CreateExchangeForm): {
  isValid: boolean;
  errors: Record<string, string>;
} => {
  const errors: Record<string, string> = {};
  
  if (!formData.name?.trim()) {
    errors.name = 'Exchange name is required';
  } else if (formData.name.length > 100) {
    errors.name = 'Exchange name must be less than 100 characters';
  }
  
  if (!formData.description?.trim()) {
    errors.description = 'Description is required';
  } else if (formData.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }
  
  if (!formData.type) {
    errors.type = 'Please select a source type';
  }
  
  // Type-specific validation
  if (formData.type === 'github' && !formData.repository?.trim()) {
    errors.repository = 'Repository name is required for GitHub sources';
  }
  
  return { 
    isValid: Object.keys(errors).length === 0, 
    errors 
  };
};

export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
};
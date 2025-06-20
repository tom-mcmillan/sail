import { ApiResponse, Exchange, CreateExchangeForm } from '@/types';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://getsail.net/api' 
  : 'http://localhost:3001/api';

class ApiClient {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { error: data.error || 'An error occurred' };
      }
      
      return { data };
    } catch (error) {
      return { error: 'Network error occurred' };
    }
  }

  async createExchange(formData: CreateExchangeForm): Promise<ApiResponse<Exchange>> {
    return this.request<Exchange>('/exchanges', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
  }

  async getExchanges(): Promise<ApiResponse<Exchange[]>> {
    return this.request<Exchange[]>('/exchanges');
  }

  async deleteExchange(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/exchanges/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
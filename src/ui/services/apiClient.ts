/**
 * Basic API client for communicating with the backend
 */
import { API_BASE_URL, API_ENDPOINTS, API_TIMEOUT } from '../config/api';
import type {
  ApiResponse,
  SessionStartRequest,
  QueryRequest,
  SessionData,
  AgentStatus,
  PermissionRequest,
  PermissionResolveRequest,
} from '../types/api';

/**
 * Handles API request errors and formats them consistently
 */
const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'An unknown error occurred';
  let errorCode = 'UNKNOWN_ERROR';
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.error?.message || `Request failed with status ${response.status}`;
    errorCode = errorData.error?.code || `ERROR_${response.status}`;
  } catch (e) {
    errorMessage = `Request failed with status ${response.status}`;
    errorCode = `ERROR_${response.status}`;
  }
  
  throw {
    message: errorMessage,
    code: errorCode,
    status: response.status,
  };
};

/**
 * Generic API request function
 */
async function apiRequest<T = any, D = any>(
  endpoint: string,
  method: string = 'GET',
  data?: D,
  timeout: number = API_TIMEOUT
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // Log API requests in development mode
    if (process.env.NODE_ENV === 'development') {
      console.group(`API Request: ${method} ${API_BASE_URL}${endpoint}`);
      console.log('Request data:', data);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0', // Add version for debugging
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
      credentials: 'same-origin', // Include cookies for session handling
    });
    
    clearTimeout(timeoutId);
    
    // Log response in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
    }
    
    if (!response.ok) {
      await handleApiError(response);
    }
    
    const result = await response.json();
    
    // Log API response in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Response data:', result);
      console.groupEnd();
    }
    
    return result as ApiResponse<T>;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (process.env.NODE_ENV === 'development') {
      console.error('API request error:', error);
      console.groupEnd();
    }
    
    if (error.name === 'AbortError') {
      throw {
        message: 'Request timed out',
        code: 'TIMEOUT',
      };
    }
    
    throw error;
  }
}

/**
 * API client with methods for each endpoint
 */
export const apiClient = {
  /**
   * Start a new agent session
   */
  startSession: (options?: SessionStartRequest) => 
    apiRequest<{ sessionId: string }>(API_ENDPOINTS.START, 'POST', options),
  
  /**
   * Send a query to the agent
   */
  sendQuery: (sessionId: string, query: string) => 
    apiRequest<void>(API_ENDPOINTS.QUERY, 'POST', { sessionId, query }),
  
  /**
   * Abort the current operation
   */
  abortOperation: () => 
    apiRequest<void>(API_ENDPOINTS.ABORT, 'POST'),
  
  /**
   * Get conversation history
   */
  getHistory: () => 
    apiRequest<SessionData>(API_ENDPOINTS.HISTORY),
  
  /**
   * Get current agent status
   */
  getStatus: () => 
    apiRequest<AgentStatus>(API_ENDPOINTS.STATUS),
  
  /**
   * Get pending permission requests
   */
  getPermissionRequests: () => 
    apiRequest<{ permissionRequests: PermissionRequest[] }>(API_ENDPOINTS.PERMISSIONS),
  
  /**
   * Resolve a permission request
   */
  resolvePermission: (id: string, granted: boolean) => 
    apiRequest<{ resolved: boolean }>(
      API_ENDPOINTS.PERMISSIONS_RESOLVE, 
      'POST', 
      { id, granted } as PermissionResolveRequest
    ),
  
  /**
   * Get API documentation
   */
  getApiDocs: () => 
    apiRequest<any>(API_ENDPOINTS.DOCS),
};

export default apiClient;
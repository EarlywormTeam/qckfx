/**
 * Utilities for working with the API
 */

// Format API error for display
export function formatApiError(error: any): string {
  if (!error) {
    return 'Unknown error occurred';
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return JSON.stringify(error);
}

// Parse error codes to determine specific error types
export function isNetworkError(error: any): boolean {
  return error?.code === 'NETWORK_ERROR' || 
         error?.code === 'TIMEOUT' ||
         error?.message?.includes('network') ||
         error?.message?.includes('timeout');
}

// Check if error is due to server being unavailable
export function isServerUnavailableError(error: any): boolean {
  return error?.status === 503 || 
         error?.status === 502 ||
         error?.status === 500;
}

// Check if error is due to invalid request
export function isClientError(error: any): boolean {
  const status = error?.status;
  return status >= 400 && status < 500;
}
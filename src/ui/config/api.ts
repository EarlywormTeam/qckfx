/**
 * API configuration and settings
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_ENDPOINTS = {
  START: '/start',
  QUERY: '/query',
  ABORT: '/abort',
  HISTORY: '/history',
  STATUS: '/status',
  PERMISSIONS: '/permissions',
  PERMISSIONS_RESOLVE: '/permissions/resolve',
  DOCS: '/docs',
};

// API request timeout in milliseconds
export const API_TIMEOUT = 30000;
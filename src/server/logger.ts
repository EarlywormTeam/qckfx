/**
 * Server logger
 */

import { createLogger, LogLevel } from '../utils/logger';

/**
 * Create a logger for the server
 */
export const serverLogger = createLogger({
  level: LogLevel.INFO,
  prefix: 'server',
  formatOptions: {
    showTimestamp: false,
    showPrefix: true,
    colors: true
  }
});
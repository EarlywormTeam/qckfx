/**
 * Log levels in order of increasing verbosity
 */
export enum LogLevel {
  SILENT = 'silent',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Log categories for better filtering
 */
export enum LogCategory {
  SYSTEM = 'system',
  TOOLS = 'tools',
  MODEL = 'model',
  PERMISSIONS = 'permissions',
  USER_INTERACTION = 'user',
  UI = 'ui',
  STATIC = 'static'
}

export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
  silent?: boolean;
  formatOptions?: {
    showTimestamp?: boolean;
    showPrefix?: boolean;
    colors?: boolean;
  };
  /**
   * Categories to include in logs (if not specified, all categories are included)
   */
  enabledCategories?: LogCategory[];
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private silent: boolean;
  private formatOptions: {
    showTimestamp: boolean;
    showPrefix: boolean;
    colors: boolean;
  };
  private enabledCategories?: LogCategory[];

  constructor(options: LoggerOptions) {
    this.level = options.level;
    this.prefix = options.prefix || '';
    this.silent = options.silent || false;
    this.formatOptions = {
      showTimestamp: options.formatOptions?.showTimestamp ?? false,
      showPrefix: options.formatOptions?.showPrefix ?? true,
      colors: options.formatOptions?.colors ?? false
    };
    this.enabledCategories = options.enabledCategories;
  }

  /**
   * Format a log message with optional timestamp and styling
   */
  private format(level: string, message: string): string {
    const timestamp = this.formatOptions.showTimestamp ? `[${new Date().toISOString()}] ` : '';
    const prefix = this.formatOptions.showPrefix && this.prefix ? `${this.prefix} ` : '';
    return `${timestamp}${prefix}[${level}] ${message}`;
  }

  /**
   * Check if a given log level should be displayed based on the current logger level
   */
  private shouldLog(messageLevel: LogLevel, category?: LogCategory): boolean {
    // Check if silent or level is SILENT
    if (this.silent || this.level === LogLevel.SILENT) return false;
    
    // Check if category is enabled (if categories are specified)
    if (category && this.enabledCategories && this.enabledCategories.length > 0) {
      if (!this.enabledCategories.includes(category)) {
        return false;
      }
    }
    
    // Convert string enum to numeric values for comparison
    const levels = {
      [LogLevel.SILENT]: 0,
      [LogLevel.ERROR]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.INFO]: 3,
      [LogLevel.DEBUG]: 4
    };
    
    return levels[this.level] >= levels[messageLevel];
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: unknown[]): void;

  /**
   * Log a debug message with category
   * @param message - The message to log
   * @param category - Category for filtering
   * @param args - Additional arguments to log
   */
  debug(message: string, category: LogCategory, ...args: unknown[]): void;

  // Implementation that handles both overloads
  debug(message: string, categoryOrArg?: LogCategory | unknown, ...args: unknown[]): void {
    let category = LogCategory.SYSTEM;
    let logArgs: unknown[] = [];

    if (categoryOrArg !== undefined) {
      if (Object.values(LogCategory).includes(categoryOrArg as LogCategory)) {
        category = categoryOrArg as LogCategory;
        logArgs = args;
      } else {
        logArgs = [categoryOrArg, ...args];
      }
    }

    if (this.shouldLog(LogLevel.DEBUG, category)) {
      const categoryPrefix = category ? `[${category}] ` : '';
      console.debug(this.format('DEBUG', `${categoryPrefix}${message}`), ...logArgs);
    }
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: unknown[]): void;

  /**
   * Log an info message with category
   * @param message - The message to log
   * @param category - Category for filtering
   * @param args - Additional arguments to log
   */
  info(message: string, category: LogCategory, ...args: unknown[]): void;

  // Implementation that handles both overloads
  info(message: string, categoryOrArg?: LogCategory | unknown, ...args: unknown[]): void {
    let category = LogCategory.SYSTEM;
    let logArgs: unknown[] = [];

    if (categoryOrArg !== undefined) {
      if (Object.values(LogCategory).includes(categoryOrArg as LogCategory)) {
        category = categoryOrArg as LogCategory;
        logArgs = args;
      } else {
        logArgs = [categoryOrArg, ...args];
      }
    }

    if (this.shouldLog(LogLevel.INFO, category)) {
      const categoryPrefix = category ? `[${category}] ` : '';
      console.info(this.format('INFO', `${categoryPrefix}${message}`), ...logArgs);
    }
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: unknown[]): void;

  /**
   * Log a warning message with category
   * @param message - The message to log
   * @param category - Category for filtering
   * @param args - Additional arguments to log
   */
  warn(message: string, category: LogCategory, ...args: unknown[]): void;

  // Implementation that handles both overloads
  warn(message: string, categoryOrArg?: LogCategory | unknown, ...args: unknown[]): void {
    let category = LogCategory.SYSTEM;
    let logArgs: unknown[] = [];

    if (categoryOrArg !== undefined) {
      if (Object.values(LogCategory).includes(categoryOrArg as LogCategory)) {
        category = categoryOrArg as LogCategory;
        logArgs = args;
      } else {
        logArgs = [categoryOrArg, ...args];
      }
    }

    if (this.shouldLog(LogLevel.WARN, category)) {
      const categoryPrefix = category ? `[${category}] ` : '';
      console.warn(this.format('WARN', `${categoryPrefix}${message}`), ...logArgs);
    }
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param error - Optional error object to log
   */
  error(message: string, error?: Error | unknown): void;

  /**
   * Log an error message with category
   * @param message - The message to log
   * @param error - Optional error object to log
   * @param category - Category for filtering
   */
  error(message: string, error: Error | unknown, category: LogCategory): void;

  // Implementation that handles both overloads
  error(message: string, errorOrCategory?: Error | unknown | LogCategory, categoryOrNothing?: LogCategory): void {
    let error: Error | unknown | undefined;
    let category = LogCategory.SYSTEM;

    if (errorOrCategory !== undefined) {
      if (Object.values(LogCategory).includes(errorOrCategory as LogCategory) && categoryOrNothing === undefined) {
        category = errorOrCategory as LogCategory;
      } else {
        error = errorOrCategory;
        if (categoryOrNothing !== undefined) {
          category = categoryOrNothing;
        }
      }
    }

    if (this.shouldLog(LogLevel.ERROR, category)) {
      const categoryPrefix = category ? `[${category}] ` : '';
      console.error(this.format('ERROR', `${categoryPrefix}${message}`));
      if (error && this.level === LogLevel.DEBUG) {
        console.error(error);
      }
    }
  }
}

/**
 * Creates a logger instance
 * @param options - Logger configuration options
 * @returns The logger instance
 */
export const createLogger = (options: LoggerOptions): Logger => {
  return new Logger(options);
};
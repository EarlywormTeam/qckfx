/**
 * Server configuration
 */
interface ServerConfig {
  /** Whether the web UI is enabled */
  enabled: boolean;
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** Whether to run in development mode with extra logging */
  development: boolean;
}

/**
 * Default server configuration
 */
const defaultConfig: ServerConfig = {
  enabled: true,
  port: 3000,
  host: 'localhost',
  development: process.env.NODE_ENV === 'development',
};

/**
 * Create a server configuration object from CLI options and environment variables
 */
export function createServerConfig(options: {
  web?: boolean;
  port?: number;
  development?: boolean;
}): ServerConfig {
  return {
    enabled: options.web !== undefined ? options.web : (process.env.QCKFX_DISABLE_WEB !== 'true'),
    port: options.port ?? (parseInt(process.env.QCKFX_PORT ?? '', 10) || defaultConfig.port),
    host: process.env.QCKFX_HOST ?? defaultConfig.host,
    development: options.development ?? process.env.NODE_ENV === 'development' ?? defaultConfig.development,
  };
}

/**
 * Get the URL where the server will be available
 */
export function getServerUrl(config: ServerConfig): string {
  return `http://${config.host}:${config.port}`;
}

export type { ServerConfig };
export { defaultConfig };
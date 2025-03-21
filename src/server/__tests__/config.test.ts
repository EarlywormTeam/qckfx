import { createServerConfig, getServerUrl, defaultConfig } from '../config';

describe('Server Configuration', () => {
  // Save and restore environment
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  describe('createServerConfig', () => {
    test('should use default values when no options provided', () => {
      const config = createServerConfig({});
      expect(config).toEqual(defaultConfig);
    });
    
    test('should use provided options', () => {
      const config = createServerConfig({
        web: false,
        port: 4000,
      });
      expect(config).toEqual({
        ...defaultConfig,
        enabled: false,
        port: 4000,
      });
    });
    
    test('should use environment variables', () => {
      process.env.QCKFX_DISABLE_WEB = 'true';
      process.env.QCKFX_PORT = '5000';
      process.env.QCKFX_HOST = '0.0.0.0';
      
      const config = createServerConfig({});
      expect(config).toEqual({
        enabled: false,
        port: 5000,
        host: '0.0.0.0',
      });
    });
    
    test('should prioritize options over environment variables', () => {
      process.env.QCKFX_DISABLE_WEB = 'true';
      process.env.QCKFX_PORT = '5000';
      
      const config = createServerConfig({
        web: true,
        port: 4000,
      });
      expect(config).toEqual({
        ...defaultConfig,
        enabled: true,
        port: 4000,
      });
    });
  });
  
  describe('getServerUrl', () => {
    test('should return correct URL', () => {
      const config = {
        enabled: true,
        port: 3000,
        host: 'localhost',
      };
      expect(getServerUrl(config)).toBe('http://localhost:3000');
    });
    
    test('should handle different host and port', () => {
      const config = {
        enabled: true,
        port: 8080,
        host: '127.0.0.1',
      };
      expect(getServerUrl(config)).toBe('http://127.0.0.1:8080');
    });
  });
});
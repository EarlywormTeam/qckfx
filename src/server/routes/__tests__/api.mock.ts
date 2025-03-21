/**
 * Mock API routes for tests
 */
// Simple middleware mock for testing
export default function mockRouter() {
  // Return a mock middleware function
  return (req: any, res: any, next: any) => {
    next();
  };
}
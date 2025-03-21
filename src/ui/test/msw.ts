import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

// Define basic mock handlers for API services
export const handlers = [
  // Start session handler
  http.post('/api/start', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        sessionId: 'test-session-id',
      },
    });
  }),
  
  // Send query handler
  http.post('/api/query', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
    });
  }),
  
  // Get history handler
  http.get('/api/history', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-session-id',
        startTime: new Date().toISOString(),
        status: 'idle',
        history: []
      }
    });
  }),
  
  // Get status handler
  http.get('/api/status', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        sessionId: 'test-session-id',
        status: 'idle',
        lastActivityTime: new Date().toISOString()
      }
    });
  }),
];

// Set up the server
export const server = setupServer(...handlers);
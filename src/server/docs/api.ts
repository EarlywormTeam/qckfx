/**
 * OpenAPI documentation for the API
 */
export const apiDocumentation = {
  openapi: '3.0.0',
  info: {
    title: 'QCKFX Agent API',
    version: '1.0.0',
    description: 'API for interacting with the QCKFX agent',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  paths: {
    '/api/start': {
      post: {
        summary: 'Start a new agent session',
        operationId: 'startSession',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  config: {
                    type: 'object',
                    properties: {
                      model: {
                        type: 'string',
                        description: 'The model to use for this session',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Session created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'createdAt', 'lastActiveAt', 'isProcessing'],
                  properties: {
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the created session',
                    },
                    createdAt: {
                      type: 'string',
                      format: 'date-time',
                      description: 'When the session was created',
                    },
                    lastActiveAt: {
                      type: 'string',
                      format: 'date-time',
                      description: 'When the session was last active',
                    },
                    isProcessing: {
                      type: 'boolean',
                      description: 'Whether the session is currently processing a query',
                    },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/query': {
      post: {
        summary: 'Submit a query to the agent',
        operationId: 'submitQuery',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId', 'query'],
                properties: {
                  sessionId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'The ID of the session',
                  },
                  query: {
                    type: 'string',
                    description: 'The query to submit',
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Query accepted for processing',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['accepted', 'sessionId', 'message'],
                  properties: {
                    accepted: {
                      type: 'boolean',
                      description: 'Whether the query was accepted',
                    },
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the session',
                    },
                    message: {
                      type: 'string',
                      description: 'A message about the query status',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Agent is busy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/abort': {
      post: {
        summary: 'Abort current operation',
        operationId: 'abortOperation',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                  sessionId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'The ID of the session',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Operation aborted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success', 'sessionId', 'message'],
                  properties: {
                    success: {
                      type: 'boolean',
                      description: 'Whether the operation was aborted',
                    },
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the session',
                    },
                    message: {
                      type: 'string',
                      description: 'A message about the abort status',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/history': {
      get: {
        summary: 'Get conversation history',
        operationId: 'getHistory',
        parameters: [
          {
            name: 'sessionId',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'The ID of the session',
          },
        ],
        responses: {
          '200': {
            description: 'History retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'history'],
                  properties: {
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the session',
                    },
                    history: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['role', 'content'],
                        properties: {
                          role: {
                            type: 'string',
                            enum: ['user', 'assistant'],
                            description: 'The role of the message sender',
                          },
                          content: {
                            type: 'array',
                            items: {
                              type: 'object',
                              required: ['type', 'text'],
                              properties: {
                                type: {
                                  type: 'string',
                                  description: 'The type of content',
                                },
                                text: {
                                  type: 'string',
                                  description: 'The message text',
                                },
                                citations: {
                                  type: 'null',
                                  description: 'Citations (not used yet)',
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/status': {
      get: {
        summary: 'Get current agent status',
        operationId: 'getStatus',
        parameters: [
          {
            name: 'sessionId',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'The ID of the session',
          },
        ],
        responses: {
          '200': {
            description: 'Status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'isProcessing', 'lastActiveAt'],
                  properties: {
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the session',
                    },
                    isProcessing: {
                      type: 'boolean',
                      description: 'Whether the session is currently processing a query',
                    },
                    lastActiveAt: {
                      type: 'string',
                      format: 'date-time',
                      description: 'When the session was last active',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/permissions': {
      get: {
        summary: 'Get pending permission requests for a session',
        operationId: 'getPermissionRequests',
        parameters: [
          {
            name: 'sessionId',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'The ID of the session',
          },
        ],
        responses: {
          '200': {
            description: 'Permission requests retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'permissions'],
                  properties: {
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the session',
                    },
                    permissions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['permissionId', 'toolId', 'args', 'timestamp'],
                        properties: {
                          permissionId: {
                            type: 'string',
                            description: 'The ID of the permission request',
                          },
                          toolId: {
                            type: 'string',
                            description: 'The ID of the tool requiring permission',
                          },
                          args: {
                            type: 'object',
                            description: 'The arguments for the tool',
                          },
                          timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the permission was requested',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/permissions/resolve': {
      post: {
        summary: 'Resolve a permission request',
        operationId: 'resolvePermission',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId', 'permissionId', 'granted'],
                properties: {
                  sessionId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'The ID of the session',
                  },
                  permissionId: {
                    type: 'string',
                    description: 'The ID of the permission request',
                  },
                  granted: {
                    type: 'boolean',
                    description: 'Whether the permission is granted',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Permission resolved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success', 'sessionId', 'permissionId', 'message'],
                  properties: {
                    success: {
                      type: 'boolean',
                      description: 'Whether the permission was resolved',
                    },
                    sessionId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The ID of the session',
                    },
                    permissionId: {
                      type: 'string',
                      description: 'The ID of the permission request',
                    },
                    message: {
                      type: 'string',
                      description: 'A message about the resolution status',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Session or permission not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Error code',
              },
              message: {
                type: 'string',
                description: 'Error message',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
              },
            },
          },
        },
      },
    },
  },
};
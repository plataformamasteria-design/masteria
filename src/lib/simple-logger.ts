// src/lib/simple-logger.ts

export interface ErrorContext {
  requestId: string;
  userId: string;
  companyId: string;
  userAgent: string;
  ip: string;
}

export function createErrorContext(data: {
  requestId: string;
  userId: string;
  companyId: string;
  userAgent: string;
  ip: string;
}): ErrorContext {
  return data;
}

export const logger = {
  info: (message: string, context?: ErrorContext, data?: any) => {
    const logMessage = context 
      ? `[${context.requestId}] ${message}`
      : message;
    console.log(logMessage, data || '');
  },
  
  error: (message: string, context?: ErrorContext, error?: any) => {
    const logMessage = context 
      ? `[${context.requestId}] ERROR: ${message}`
      : `ERROR: ${message}`;
    console.error(logMessage, error || '');
  },
  
  operationStart: (operation: string, context?: ErrorContext) => {
    const logMessage = context 
      ? `[${context.requestId}] START: ${operation}`
      : `START: ${operation}`;
    console.log(logMessage);
  }
};
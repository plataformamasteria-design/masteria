'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LogEntry {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
  stack?: string;
  count: number;
  metadata?: any;
}

interface ConsoleMonitorContextType {
  logs: LogEntry[];
  clearLogs: () => void;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp' | 'count'>) => void;
  errorCount: number;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const ConsoleMonitorContext = createContext<ConsoleMonitorContextType | undefined>(undefined);

export function ConsoleMonitorProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);

  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp' | 'count'>) => {
    if (!isEnabled) return;

    setLogs(prev => {
      const lastLog = prev[prev.length - 1];
      if (lastLog && lastLog.message === entry.message && lastLog.type === entry.type) {
        return prev.map((log, index) => 
          index === prev.length - 1 
            ? { ...log, count: log.count + 1 }
            : log
        );
      }

      const newLog: LogEntry = {
        ...entry,
        id: Date.now().toString() + Math.random(),
        timestamp: new Date(),
        count: 1
      };

      if (entry.type === 'error') {
        setErrorCount(prev => prev + 1);
      }

      // Keep only last 100 logs
      return [...prev.slice(-99), newLog];
    });
  };

  const clearLogs = () => {
    setLogs([]);
    setErrorCount(0);
  };

  useEffect(() => {
    if (!isEnabled) return;

    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const interceptLog = (type: LogEntry['type'], originalMethod: (...args: any[]) => void) => {
      return function(...args: any[]) {
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

        addLog({ type, message });
        originalMethod.apply(console, args);
      };
    };

    // Override console methods
    console.log = interceptLog('log', originalLog);
    console.error = interceptLog('error', originalError);
    console.warn = interceptLog('warn', originalWarn);
    console.info = interceptLog('info', originalInfo);

    // Capture window errors
    const handleError = (event: ErrorEvent) => {
      addLog({
        type: 'error',
        message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
        stack: event.error?.stack
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog({
        type: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [isEnabled]);

  return (
    <ConsoleMonitorContext.Provider value={{
      logs,
      clearLogs,
      addLog,
      errorCount,
      isEnabled,
      setIsEnabled
    }}>
      {children}
    </ConsoleMonitorContext.Provider>
  );
}

export function useConsoleMonitor() {
  const context = useContext(ConsoleMonitorContext);
  if (context === undefined) {
    throw new Error('useConsoleMonitor must be used within a ConsoleMonitorProvider');
  }
  return context;
}
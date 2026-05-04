'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Trash2, Download, AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
  stack?: string;
  count: number;
}

export function ConsoleMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Desabilitar em dev local — overhead desnecessário de interceptar console.*
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return null;
  }


  useEffect(() => {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], args: any[]) => {
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

      setLogs(prev => {
        const lastLog = prev[prev.length - 1];
        if (lastLog && lastLog.message === message && lastLog.type === type) {
          return prev.map((log, index) =>
            index === prev.length - 1
              ? { ...log, count: log.count + 1 }
              : log
          );
        }

        const newLog: LogEntry = {
          id: Date.now().toString() + Math.random(),
          type,
          message,
          timestamp: new Date(),
          count: 1
        };

        if (type === 'error') {
          setErrorCount(prev => prev + 1);
        }

        return [...prev.slice(-99), newLog];
      });
    };

    // Override console methods
    console.log = (...args) => {
      addLog('log', args);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      addLog('error', args);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      addLog('warn', args);
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      addLog('info', args);
      originalInfo.apply(console, args);
    };

    // Capture window errors
    const handleError = (event: ErrorEvent) => {
      addLog('error', [event.message, `at ${event.filename}:${event.lineno}:${event.colno}`]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog('error', ['Unhandled Promise Rejection:', event.reason]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Log initial message
    console.info('[Console Monitor] Iniciado - Capturando todos os logs');

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.type !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearLogs = () => {
    setLogs([]);
    setErrorCount(0);
  };

  const exportLogs = () => {
    const content = logs.map(log =>
      `[${log.timestamp.toISOString()}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all",
          errorCount > 0 ? "bg-red-500 hover:bg-red-600" : "bg-gray-800 hover:bg-gray-700",
          isOpen && "scale-0"
        )}
      >
        <div className="relative">
          <AlertCircle className="w-6 h-6 text-white" />
          {errorCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
              {errorCount}
            </span>
          )}
        </div>
      </button>

      {/* Console Panel */}
      <div className={cn(
        "fixed bottom-0 right-0 z-50 bg-gray-900 text-white rounded-tl-lg shadow-2xl transition-all",
        isOpen ? "w-[600px] h-[400px]" : "w-0 h-0 overflow-hidden"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h3 className="font-semibold">Console Monitor</h3>
          <div className="flex items-center gap-2">
            <button onClick={exportLogs} className="p-1 hover:bg-gray-700 rounded">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={clearLogs} className="p-1 hover:bg-gray-700 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 p-2 border-b border-gray-700">
          <div className="flex gap-1">
            {['all', 'log', 'error', 'warn', 'info'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={cn(
                  "px-2 py-1 text-xs rounded",
                  filter === type ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600"
                )}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-gray-800 rounded"
            />
          </div>
        </div>

        {/* Logs */}
        <div className="h-[calc(100%-88px)] overflow-y-auto p-2 font-mono text-xs">
          {filteredLogs.map(log => (
            <div key={log.id} className="flex items-start gap-2 py-1 hover:bg-gray-800">
              {getIcon(log.type)}
              <span className="text-gray-400">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <div className="flex-1">
                <pre className="whitespace-pre-wrap break-words">
                  {log.message}
                  {log.count > 1 && (
                    <span className="ml-2 text-yellow-400">({log.count}x)</span>
                  )}
                </pre>
              </div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </>
  );
}
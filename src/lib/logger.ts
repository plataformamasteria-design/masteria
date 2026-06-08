type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
  companyId?: string;
}

class Logger {
  private piiPatterns = [
    { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'PHONE', regex: /\+?[0-9]{10,15}/g }, // Simple phone regex
    { name: 'TOKEN', regex: /(bearer\s+|token=)[a-zA-Z0-9._~+/-]+=*/gi }
  ];

  private scrub(text: string): string {
    let scrubbed = text;
    for (const pattern of this.piiPatterns) {
      scrubbed = scrubbed.replace(pattern.regex, (match) => {
        if (pattern.name === 'EMAIL') {
          const [user, domain] = match.split('@');
          return `${(user && user[0]) || '*'}***@${domain}`;
        }
        return `[REDACTED_${pattern.name}]`;
      });
    }
    return scrubbed;
  }

  private scrubObject(obj: any): any {
    if (!obj) return obj;
    const str = JSON.stringify(obj);
    return JSON.parse(this.scrub(str));
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const isProd = process.env.NODE_ENV === 'production';
    const isDebugEnabled = process.env.DEBUG === 'true';

    // SUPRESSÃO EM PRODUÇÃO: Para economizar I/O, ignorar debug/info se não estiver em modo debug
    if (isProd && !isDebugEnabled && (level === 'debug' || level === 'info')) {
        return;
    }

    const timestamp = new Date().toISOString();
    const scrubbedMessage = this.scrub(message);
    const scrubbedContext = context ? this.scrubObject(context) : undefined;

    const contextStr = scrubbedContext ? ` ${JSON.stringify(scrubbedContext)}` : '';

    if (level === 'error') {
        console.error(`[${timestamp}] [${level.toUpperCase()}] ${scrubbedMessage}${contextStr}`);
    } else if (level === 'warn') {
        console.warn(`[${timestamp}] [${level.toUpperCase()}] ${scrubbedMessage}${contextStr}`);
    } else {
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${scrubbedMessage}${contextStr}`);
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();

import pino from 'pino';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'fatal';

interface LogContext {
  [key: string]: any;
  companyId?: string;
  conversationId?: string;
}

const piiPatterns = [
  { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'PHONE', regex: /\+?[0-9]{10,15}/g },
  { name: 'TOKEN', regex: /(bearer\s+|token=)[a-zA-Z0-9._~+/-]+=*/gi }
];

function scrubString(text: string): string {
  if (typeof text !== 'string') return text;
  let scrubbed = text;
  for (const pattern of piiPatterns) {
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

function scrubObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  try {
    const str = JSON.stringify(obj);
    return JSON.parse(scrubString(str));
  } catch (e) {
    return obj; // Se não puder stringificar (circular), retorna original
  }
}

// Criação da instância Pino base
const pinoLogger = pino({
  level: process.env.DEBUG === 'true' ? 'debug' : process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined, // Em produção, cospe JSON estruturado (stdout)
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

class Logger {
  private formatArgs(message: string, context?: LogContext) {
    const scrubbedMessage = scrubString(message);
    const scrubbedContext = context ? scrubObject(context) : undefined;
    return { scrubbedMessage, scrubbedContext };
  }

  info(message: string, context?: LogContext) {
    const { scrubbedMessage, scrubbedContext } = this.formatArgs(message, context);
    if (scrubbedContext) {
      pinoLogger.info(scrubbedContext, scrubbedMessage);
    } else {
      pinoLogger.info(scrubbedMessage);
    }
  }

  warn(message: string, context?: LogContext) {
    const { scrubbedMessage, scrubbedContext } = this.formatArgs(message, context);
    if (scrubbedContext) {
      pinoLogger.warn(scrubbedContext, scrubbedMessage);
    } else {
      pinoLogger.warn(scrubbedMessage);
    }
  }

  error(message: string | Error, context?: LogContext) {
    const msgString = message instanceof Error ? message.message : message;
    const { scrubbedMessage, scrubbedContext } = this.formatArgs(msgString, context);
    
    const errObj = message instanceof Error ? { err: message } : {};
    
    if (scrubbedContext) {
      pinoLogger.error({ ...errObj, ...scrubbedContext }, scrubbedMessage);
    } else {
      pinoLogger.error(errObj, scrubbedMessage);
    }
  }

  debug(message: string, context?: LogContext) {
    const { scrubbedMessage, scrubbedContext } = this.formatArgs(message, context);
    if (scrubbedContext) {
      pinoLogger.debug(scrubbedContext, scrubbedMessage);
    } else {
      pinoLogger.debug(scrubbedMessage);
    }
  }
}

export const logger = new Logger();


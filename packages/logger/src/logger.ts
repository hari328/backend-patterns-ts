import winston from 'winston';
import { Logger, LoggerConfig, LoggerOptions } from './interfaces';

function extractError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  return { message: String(error) };
}

function buildFormat(environment: string): winston.Logform.Format {
  const isProduction = environment !== 'development';

  if (isProduction) {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    );
  }

  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, service, environment: env, component, ...rest }) => {
      const prefix = component ? `[${component}] ` : '';
      const meta = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
      return `${timestamp} ${level}: ${prefix}${message}${meta}`;
    }),
  );
}

function createLoggerInstance(
  winstonLogger: winston.Logger,
  staticMeta: Record<string, unknown>,
  messagePrefix?: string,
): Logger {
  const formatMessage = (message: string) =>
    messagePrefix ? `${messagePrefix} ${message}` : message;

  return {
    info(message: string, meta?: Record<string, unknown>): void {
      winstonLogger.info(formatMessage(message), { ...staticMeta, ...meta });
    },

    warn(message: string, meta?: Record<string, unknown>): void {
      winstonLogger.warn(formatMessage(message), { ...staticMeta, ...meta });
    },

    debug(message: string, meta?: Record<string, unknown>): void {
      winstonLogger.debug(formatMessage(message), { ...staticMeta, ...meta });
    },

    error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
      winstonLogger.error(formatMessage(message), {
        ...staticMeta,
        ...meta,
        error: error !== undefined ? extractError(error) : undefined,
      });
    },

    forComponent(component: string): Logger {
      return createLoggerInstance(
        winstonLogger,
        { ...staticMeta, component },
        `[${component}]`,
      );
    },
  };
}

export function createLogger(config: LoggerConfig, options?: LoggerOptions): Logger {
  const environment = config.environment ?? 'production';
  const level = config.level ?? 'info';

  const winstonLogger = winston.createLogger({
    level,
    format: buildFormat(environment),
    defaultMeta: { service: config.service, environment },
    transports: options?.transports ?? [new winston.transports.Console()],
  });

  return createLoggerInstance(winstonLogger, {});
}


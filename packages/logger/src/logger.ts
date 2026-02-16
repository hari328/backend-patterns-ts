import winston from 'winston';
import { trace, context, isSpanContextValid } from '@opentelemetry/api';
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

function getTraceContext(): Record<string, string> {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();
  if (!isSpanContextValid(spanContext)) {
    return {};
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

function buildFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
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
      winstonLogger.info(formatMessage(message), { ...staticMeta, ...getTraceContext(), ...meta });
    },

    warn(message: string, meta?: Record<string, unknown>): void {
      winstonLogger.warn(formatMessage(message), { ...staticMeta, ...getTraceContext(), ...meta });
    },

    debug(message: string, meta?: Record<string, unknown>): void {
      winstonLogger.debug(formatMessage(message), { ...staticMeta, ...getTraceContext(), ...meta });
    },

    error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
      winstonLogger.error(formatMessage(message), {
        ...staticMeta,
        ...getTraceContext(),
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
    format: buildFormat(),
    defaultMeta: { service: config.service, environment },
    transports: options?.transports ?? [new winston.transports.Console()],
  });

  return createLoggerInstance(winstonLogger, {});
}


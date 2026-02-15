import winston from 'winston';

export interface LoggerConfig {
  service: string;
  environment?: string;
  level?: string;
}

export interface LoggerOptions {
  transports?: winston.transport[];
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  forComponent(component: string): Logger;
}


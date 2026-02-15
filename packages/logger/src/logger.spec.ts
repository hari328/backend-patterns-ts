import { describe, it, expect, beforeEach } from 'vitest';
import winston from 'winston';
import { createLogger } from './logger';

function createTestTransport(): winston.transport & { logs: Record<string, unknown>[] } {
  const logs: Record<string, unknown>[] = [];
  const transport = new winston.transports.Stream({
    stream: new (require('stream').Writable)({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        logs.push(JSON.parse(chunk.toString()));
        callback();
      },
    }),
  });
  return Object.assign(transport, { logs });
}

describe('createLogger', () => {
  let transport: ReturnType<typeof createTestTransport>;

  beforeEach(() => {
    transport = createTestTransport();
  });

  describe('static metadata', () => {
    it('includes service, environment, timestamp, level, and message on every log', () => {
      const logger = createLogger({
        service: 'posts-service',
        environment: 'production',
      }, { transports: [transport] });

      logger.info('hello');

      expect(transport.logs).toHaveLength(1);
      const log = transport.logs[0];
      expect(log).toMatchObject({
        service: 'posts-service',
        environment: 'production',
        level: 'info',
        message: 'hello',
      });
      expect(log).toHaveProperty('timestamp');
    });

    it('includes per-call metadata alongside static fields', () => {
      const logger = createLogger({
        service: 'posts-service',
      }, { transports: [transport] });

      logger.info('Post created', { postId: '123', userId: '456' });

      const log = transport.logs[0];
      expect(log).toMatchObject({
        service: 'posts-service',
        message: 'Post created',
        postId: '123',
        userId: '456',
      });
    });

    it('does not bleed per-call metadata across calls', () => {
      const logger = createLogger({
        service: 'posts-service',
      }, { transports: [transport] });

      logger.info('first', { postId: '123' });
      logger.info('second');

      expect(transport.logs[0]).toHaveProperty('postId', '123');
      expect(transport.logs[1]).not.toHaveProperty('postId');
    });
  });

  describe('log levels', () => {
    it('sets the correct level field for each log method', () => {
      const logger = createLogger({
        service: 'test-service',
        level: 'debug',
      }, { transports: [transport] });

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      expect(transport.logs[0]).toHaveProperty('level', 'debug');
      expect(transport.logs[1]).toHaveProperty('level', 'info');
      expect(transport.logs[2]).toHaveProperty('level', 'warn');
      expect(transport.logs[3]).toHaveProperty('level', 'error');
    });

    it('respects minimum log level — suppresses logs below threshold', () => {
      const logger = createLogger({
        service: 'test-service',
        level: 'warn',
      }, { transports: [transport] });

      logger.debug('should not appear');
      logger.info('should not appear');
      logger.warn('should appear');
      logger.error('should appear');

      expect(transport.logs).toHaveLength(2);
      expect(transport.logs[0]).toHaveProperty('level', 'warn');
      expect(transport.logs[1]).toHaveProperty('level', 'error');
    });
  });

  describe('forComponent', () => {
    it('adds component to metadata', () => {
      const logger = createLogger({
        service: 'posts-service',
      }, { transports: [transport] });

      const componentLogger = logger.forComponent('PostService');
      componentLogger.info('hello');

      expect(transport.logs[0]).toHaveProperty('component', 'PostService');
    });

    it('prepends component to message', () => {
      const logger = createLogger({
        service: 'posts-service',
      }, { transports: [transport] });

      const componentLogger = logger.forComponent('PostService');
      componentLogger.info('hello');

      expect(transport.logs[0]).toHaveProperty('message', '[PostService] hello');
    });

    it('inherits parent static metadata', () => {
      const logger = createLogger({
        service: 'posts-service',
        environment: 'staging',
      }, { transports: [transport] });

      const componentLogger = logger.forComponent('PostService');
      componentLogger.info('hello');

      expect(transport.logs[0]).toMatchObject({
        service: 'posts-service',
        environment: 'staging',
        component: 'PostService',
      });
    });
  });

  describe('error handling', () => {
    it('extracts message, stack, and name from Error objects', () => {
      const logger = createLogger({
        service: 'test-service',
      }, { transports: [transport] });

      const error = new Error('db timeout');
      logger.error('Insert failed', error);

      const log = transport.logs[0];
      expect(log).toHaveProperty('level', 'error');
      expect(log).toHaveProperty('message', 'Insert failed');
      expect(log).toHaveProperty('error');

      const errorField = log.error as Record<string, unknown>;
      expect(errorField).toHaveProperty('message', 'db timeout');
      expect(errorField).toHaveProperty('stack');
      expect(errorField).toHaveProperty('name', 'Error');
    });

    it('handles non-Error values without crashing', () => {
      const logger = createLogger({
        service: 'test-service',
      }, { transports: [transport] });

      logger.error('Something broke', 'string error');

      const log = transport.logs[0];
      expect(log).toHaveProperty('level', 'error');
      expect(log).toHaveProperty('message', 'Something broke');
      expect(log).toHaveProperty('error');

      const errorField = log.error as Record<string, unknown>;
      expect(errorField).toHaveProperty('message', 'string error');
    });
  });

  describe('environment-aware formatting', () => {
    it('outputs parseable JSON in production', () => {
      const stdoutChunks: string[] = [];
      const jsonTransport = new winston.transports.Stream({
        stream: new (require('stream').Writable)({
          write(chunk: Buffer, _encoding: string, callback: () => void) {
            stdoutChunks.push(chunk.toString());
            callback();
          },
        }),
      });

      const logger = createLogger({
        service: 'test-service',
        environment: 'production',
      }, { transports: [jsonTransport] });

      logger.info('hello');

      expect(stdoutChunks).toHaveLength(1);
      const parsed = JSON.parse(stdoutChunks[0]!);
      expect(parsed).toHaveProperty('message', 'hello');
    });

    it('outputs JSON in development too', () => {
      const stdoutChunks: string[] = [];
      const devTransport = new winston.transports.Stream({
        stream: new (require('stream').Writable)({
          write(chunk: Buffer, _encoding: string, callback: () => void) {
            stdoutChunks.push(chunk.toString());
            callback();
          },
        }),
      });

      const logger = createLogger({
        service: 'test-service',
        environment: 'development',
      }, { transports: [devTransport] });

      logger.info('hello');

      expect(stdoutChunks).toHaveLength(1);
      const parsed = JSON.parse(stdoutChunks[0]!);
      expect(parsed).toHaveProperty('message', 'hello');
    });
  });
});


import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import { incrementActive, decrementActive } from './pool-metrics';

const TRACER_NAME = 'drizzle-orm';
const INSTRUMENTED_FLAG = '__dbInstrumented';

function extractOperation(sql: string): string | undefined {
  const match = sql.trimStart().match(/^(\w+)/);
  return match?.[1]?.toUpperCase();
}

export function instrumentDb(db: { session?: any; _?: any }): void {
  const session = db.session ?? db._?.session;
  if (!session || typeof session.prepareQuery !== 'function') {
    return;
  }

  if (session[INSTRUMENTED_FLAG]) {
    return;
  }

  const originalPrepareQuery = session.prepareQuery;

  session.prepareQuery = function (...args: any[]) {
    const prepared = originalPrepareQuery.apply(this, args);

    if (prepared && typeof prepared.execute === 'function') {
      const originalExecute = prepared.execute;

      prepared.execute = function (...executeArgs: any[]) {
        incrementActive();

        const parentSpan = trace.getSpan(context.active());
        if (!parentSpan) {
          return Promise.resolve(originalExecute.apply(this, executeArgs))
            .finally(() => decrementActive());
        }

        const queryText: string | undefined =
          args[0]?.sql ?? prepared.queryString;
        const operation = queryText ? extractOperation(queryText) : undefined;
        const spanName = operation
          ? `db.${operation.toLowerCase()}`
          : 'db.query';

        const tracer = trace.getTracer(TRACER_NAME);
        const span = tracer.startSpan(spanName, {
          kind: SpanKind.CLIENT,
        });

        span.setAttribute('db.system', 'postgresql');
        if (operation) {
          span.setAttribute('db.operation', operation);
        }
        if (queryText) {
          span.setAttribute('db.statement', queryText);
        }

        const activeContext = trace.setSpan(context.active(), span);

        return context.with(activeContext, () => {
          try {
            const result = originalExecute.apply(this, executeArgs);
            return Promise.resolve(result)
              .then((value: unknown) => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return value;
              })
              .catch((error: Error) => {
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: error.message,
                });
                span.recordException(error);
                span.end();
                throw error;
              })
              .finally(() => decrementActive());
          } catch (error: any) {
            decrementActive();
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.recordException(error);
            span.end();
            throw error;
          }
        });
      };
    }

    return prepared;
  };

  session[INSTRUMENTED_FLAG] = true;
}

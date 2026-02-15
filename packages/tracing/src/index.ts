import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BatchSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';
import type { IncomingMessage } from 'http';

const IGNORED_PATHS = ['/metrics', '/health'];

const SUPPRESSED_SPAN_NAMES = new Set([
  'SQS.DeleteMessageBatch',
  'SQS.ReceiveMessage',
  'post-stream receive',
  'post-stream send',
]);

class FilteringSpanProcessor extends BatchSpanProcessor {
  onEnd(span: ReadableSpan): void {
    if (SUPPRESSED_SPAN_NAMES.has(span.name)) {
      return;
    }
    super.onEnd(span);
  }
}

const ignoreIncomingRequestHook = (request: IncomingMessage): boolean => {
  const urlPath = request.url ?? '';
  return IGNORED_PATHS.some(
    (ignored) => urlPath === ignored || urlPath.startsWith(`${ignored}?`),
  );
};

const traceExporter = new OTLPTraceExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
});

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'unknown-service',
  spanProcessors: [new FilteringSpanProcessor(traceExporter)],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-express': {
        ignoreLayersType: [
          ExpressLayerType.MIDDLEWARE,
          ExpressLayerType.ROUTER,
          ExpressLayerType.REQUEST_HANDLER,
        ],
      },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook,
      },
      '@opentelemetry/instrumentation-aws-sdk': {
        suppressInternalInstrumentation: true,
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().catch(console.error);
});

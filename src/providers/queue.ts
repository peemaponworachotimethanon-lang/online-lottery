/**
 * Background job abstraction.
 *
 * Settlement, bulk notifications, reports, and exports must never run inside a
 * user-facing HTTP request: a round with 100k bets would blow the request budget
 * and hold a database connection for minutes.
 *
 * The demo provider runs handlers in-process on a microtask so the flows are
 * observable end to end. Production swaps in BullMQ + Redis (or a serverless
 * queue) behind this same interface; see PERFORMANCE.md § Queue.
 */

export type JobName =
  | 'settle-round'
  | 'settle-round-batch'
  | 'broadcast-notification'
  | 'generate-report'
  | 'export-data'
  | 'send-email'
  | 'analytics-rollup';

export interface JobOptions {
  /** Delay before the job becomes eligible to run, in milliseconds. */
  delayMs?: number;
  attempts?: number;
  /** Deduplication key — a second enqueue with the same id is ignored. */
  jobId?: string;
}

export interface EnqueuedJob {
  id: string;
  name: JobName;
  payload: unknown;
  enqueuedAt: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  error?: string;
}

export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void>;

export interface JobQueue {
  register<TPayload>(name: JobName, handler: JobHandler<TPayload>): void;
  enqueue(name: JobName, payload: unknown, options?: JobOptions): Promise<EnqueuedJob>;
  /** Test/demo affordance: resolves once every queued job has finished. */
  drain(): Promise<void>;
  list(limit?: number): EnqueuedJob[];
}

export function createMockJobQueue(): JobQueue {
  const handlers = new Map<JobName, JobHandler<never>>();
  const jobs: EnqueuedJob[] = [];
  const seenJobIds = new Set<string>();
  let pending: Promise<void> = Promise.resolve();

  return {
    register<TPayload>(name: JobName, handler: JobHandler<TPayload>) {
      handlers.set(name, handler as JobHandler<never>);
    },
    async enqueue(name, payload, options) {
      const jobId = options?.jobId ?? `${name}:${jobs.length}:${Date.now()}`;
      const existing = jobs.find((job) => job.id === jobId);
      if (existing && seenJobIds.has(jobId)) return existing;
      seenJobIds.add(jobId);

      const job: EnqueuedJob = {
        id: jobId,
        name,
        payload,
        enqueuedAt: new Date().toISOString(),
        status: 'queued',
      };
      jobs.unshift(job);
      if (jobs.length > 200) jobs.length = 200;

      const handler = handlers.get(name);
      if (!handler) return job;

      pending = pending.then(async () => {
        if (options?.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        job.status = 'running';
        try {
          await (handler as JobHandler<unknown>)(payload);
          job.status = 'completed';
        } catch (error) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          console.error(`[queue] job ${name} failed`, error);
        }
      });

      return job;
    },
    async drain() {
      await pending;
    },
    list(limit = 50) {
      return jobs.slice(0, limit);
    },
  };
}

const GLOBAL_KEY = Symbol.for('elp.queue');

interface GlobalWithQueue {
  [GLOBAL_KEY]?: JobQueue;
}

export function getQueue(): JobQueue {
  const container = globalThis as unknown as GlobalWithQueue;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;
  const created = createMockJobQueue();
  container[GLOBAL_KEY] = created;
  return created;
}

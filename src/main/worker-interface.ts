/**
 * Internal message interface between the worker and the master.
 *
 * None of this is public API.
 */

/* API documentation barrier. */

import { SchedulingFailure } from './api-types';
import { computeSchedule } from './scheduling';

// Ambient declarations.
//
// We do not rely on the TypeScript webworker library, because the current file is meant to be importable also by code
// that requires the DOM library. However, Web Worker API and DOM are at present mutually exclusive.
// https://github.com/Microsoft/TypeScript/issues/20595
// Since the Web Worker API used in this file is extremely simple, we just make the declarations ourselves here.

declare global {
  /**
   * A web worker’s global scope.
   */
  interface DedicatedWorkerGlobalScope {
    /**
     * EventHandler to be called when a message is sent to the worker using its `postMessage()` method.
     */
    onmessage: ((this: DedicatedWorkerGlobalScope, event: MessageEvent) => any) | null;

    /**
     * Sends a message to the main thread that spawned the worker.
     *
     * The web worker API specifies an optional second argument for postMessage(), which we do not use. Unfortunately,
     * information on the web is not crystal clear on whether it should be possible to transfer (without copying) a
     * plain JavaScript object from the worker to the thread that spawned it. In C++ terminology, this would be called
     * move semantics.
     *
     * See for instance a discussion on
     * [StackOverflow](https://stackoverflow.com/questions/33544994/pass-object-by-reference-from-to-webworker) or a
     * related
     * [issue of the TypeScript project on GitHub]
     * (https://github.com/Microsoft/TypeScript/issues/25176#issuecomment-400117198).
     *
     * For now the answer is, however, very clear. It is not possible. Chrome 74 reports "Value at index 0 does not have
     * a transferable type" if we were to set the `transfer` argument in the postMessage() invocation to `[plainObject]`
     * (i.e., an array with a plain JavaScript object as only element).
     */
    postMessage(message: any): void;

    /**
     * Closes the worker from inside the worker itself.
     */
    close(): void;
  }

  /**
   * The DedicatedWorkerGlobalScope constructor.
   */
  // tslint:disable-next-line:variable-name
  let DedicatedWorkerGlobalScope: new() => DedicatedWorkerGlobalScope;
}

/**
 * Type guard that returns whether the given value is a {@link DedicatedWorkerGlobalScope}.
 */
export function isDedicatedWorkerGlobalScope(value: any): value is DedicatedWorkerGlobalScope {
  return typeof DedicatedWorkerGlobalScope === 'function' && value instanceof DedicatedWorkerGlobalScope;
}


// Internal interfaces

/**
 * Message from master to worker with all information to start processing.
 */
export type ComputeScheduleParameters = Parameters<typeof computeSchedule>;

/**
 * Message from worker to master containing the result.
 */
export type ComputeScheduleReturnType = ReturnType<typeof computeSchedule>;

/**
 * Factory for a web worker.
 *
 * The {@link Worker} constructor requires a script URL that is either absolute or relative *to the the domain* of the
 * current script. See: https://html.spec.whatwg.org/multipage/workers.html#dom-worker
 *
 * Unfortunately, the location of the current script is generally unknowable. Additionally, in case of the UMD
 * distribution of this module, the worker script is the simply the current script (for ease of distribution).
 * Otherwise, the worker script is in a separate file, and we expect a bundler to substitute the correct absolute URL at
 * build time.
 */
export interface WorkerFactory {
  /**
   * Creates and returns a new {@link Worker}, or a failure if an error occurs.
   */
  createWorker?: () => Worker | SchedulingFailure;
}

export const workerFactory: WorkerFactory = {};

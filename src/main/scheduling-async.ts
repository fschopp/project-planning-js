import { strict as assert } from 'assert';
import { isSchedulingFailure, Schedule, SchedulingFailure } from './api-types';
import { computeSchedule } from './scheduling';
import { ComputeScheduleParameters, ComputeScheduleReturnType, workerFactory } from './worker-interface';

/**
 * Runs (in a separate thread) the list scheduling algorithm on the given problem instance and returns the result
 * asynchronously.
 *
 * See [the project page](https://github.com/fschopp/project-planning-js) for more information on the algorithm.
 *
 * @param args argument list that will be passed on to {@link computeSchedule} unaltered
 * @return promise that will be resolved with the solution or rejected with a {@link SchedulingFailure} containing a
 *     human-readable failure description if the problem instance is invalid (for example, has a cyclic dependency
 *     graph)
 */
export function computeScheduleAsync(...args: ComputeScheduleParameters): Promise<Schedule> {
  assert(workerFactory.createWorker !== undefined, 'workerFactory.createWorker cannot be undefined');
  const worker: Worker | SchedulingFailure = workerFactory.createWorker!();
  if (isSchedulingFailure(worker)) {
    const failure: SchedulingFailure = worker;
    return Promise.reject(failure);
  }

  let isSettled: boolean = false;
  // From MDN: "the executor is called before the Promise constructor even returns the created object"
  // Hence all worker callbacks are in place before we send it the "go" message below.
  const promise = new Promise<Schedule>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const result: ComputeScheduleReturnType = event.data;
      if (isSchedulingFailure(result)) {
        assert(!isSettled, 'Attempted to settle promise more than once.');
        reject(result);
        isSettled = true;
      } else {
        assert(!isSettled, 'Attempted to settle promise more than once.');
        resolve(result);
        isSettled = true;
      }
    };
    worker.onerror = (event: ErrorEvent) => {
      worker.terminate();
      const failure: SchedulingFailure = 'A runtime error occurred in source file ' +
          `${event.filename} (line ${event.lineno}:${event.colno}):\n${event.message}`;
      // In theory, the worker could still cause an error after it has sent its last message. However, the ES6
      // specification says:
      // "Attempting to resolve or reject a resolved promise has no effect."
      // https://www.ecma-international.org/ecma-262/6.0/#sec-promise-objects
      // Hence, there is no race condition. On the other hand, we don't want to swallow the problem. Therefore, we
      // add an assertion:
      assert(!isSettled, 'Attempted to settle promise more than once.');
      reject(failure);
      isSettled = true;
    };
  });
  worker.postMessage(args);
  return promise;
}

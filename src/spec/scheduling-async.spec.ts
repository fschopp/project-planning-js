import { computeScheduleAsync, isSchedulingFailure, Schedule, SchedulingFailure, SchedulingInstance } from '../main';
import { ComputeScheduleParameters, ComputeScheduleReturnType, workerFactory } from '../main/worker-interface';

const trivialInstance: SchedulingInstance = {
  machineSpeeds: [1],
  jobs: [],
};
const trivialResult: ComputeScheduleReturnType = [];
const originalCreateWorker = workerFactory.createWorker;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  workerFactory.createWorker = originalCreateWorker;
});

test('creates web worker and resolves promise on success', async () => {
  const postMessage = jest.fn();
  const terminate = jest.fn();
  const createWorker: jest.Mock<Worker> = jest.fn().mockImplementation(() => ({
    postMessage,
    terminate,
  }));
  workerFactory.createWorker = createWorker;

  const promise: Promise<Schedule> = computeScheduleAsync(trivialInstance);
  expect(createWorker).toHaveBeenCalled();
  const worker: Worker = createWorker.mock.results[0].value;
  expect(worker.onmessage).not.toBeNull();

  const expectedMessage: ComputeScheduleParameters = [trivialInstance];
  expect(postMessage).toHaveBeenCalledWith(expectedMessage);

  worker.onmessage!(new MessageEvent('MessageEvent', {data: trivialResult}));
  await expect(promise).resolves.toEqual(trivialResult);
  expect(terminate).not.toHaveBeenCalled();
});

test('rejects promise if worker not created', async () => {
  const failure: SchedulingFailure = 'expected failure';
  workerFactory.createWorker = () => failure;
  await expect(computeScheduleAsync(trivialInstance)).rejects.toBe(failure);
});

test('rejects promise on scheduling failure', async () => {
  const postMessage = jest.fn();
  const createWorker: jest.Mock<Worker> = jest.fn().mockImplementation(() => ({
    postMessage,
  }));
  workerFactory.createWorker = createWorker;

  const promise: Promise<Schedule> = computeScheduleAsync(trivialInstance);
  const worker: Worker = createWorker.mock.results[0].value;

  const failureResult: ComputeScheduleReturnType = 'expected failure!';
  worker.onmessage!(new MessageEvent('MessageEvent', {data: failureResult}));
  await expect(promise).rejects.toEqual(failureResult);
});

test('runtime errors in the worker are handled', async () => {
  const postMessage = jest.fn();
  const terminate = jest.fn();
  const createWorker: jest.Mock<Worker> = jest.fn().mockImplementation(() => ({
    postMessage,
    terminate,
  }));
  workerFactory.createWorker = createWorker;

  const promise: Promise<Schedule> = computeScheduleAsync(trivialInstance);
  const worker: Worker = createWorker.mock.results[0].value;
  const errorEvent = new ErrorEvent('oh no!', {
    filename: 'some file',
    lineno: 42,
    colno: 24,
  });
  worker.onerror!(errorEvent);

  let schedulingFailure: SchedulingFailure | undefined;
  try {
    await promise;
  } catch (exception) {
    schedulingFailure = exception;
  }
  expect(isSchedulingFailure(schedulingFailure)).toBeTruthy();
  expect(schedulingFailure).toMatch('some file');
  expect(schedulingFailure).toMatch(/(^|\D)42($|\D)/);
  expect(schedulingFailure).toMatch(/(^|\D)24($|\D)/);
  expect(terminate).toHaveBeenCalled();
});

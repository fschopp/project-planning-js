import * as ProjectPlanningJs from '../main/index';
import MockDedicatedWorkerGlobalScope from '../mocks/mock-dedicated-worker-global-scope';
import MockWorker from '../mocks/mock-worker';

type ProjectPlanningJs = typeof ProjectPlanningJs;

describe('module loaded when document.currentScript is non-null', () => {
  let inBrowserModule: ProjectPlanningJs;

  beforeAll(() => {
    // Load module in a browsing context
    MockWorker.setup();
    jest.isolateModules(() => {
      inBrowserModule = require('../main/index');
    });

    // Load module in a worker context. This simulates the worker in a separate thread.
    MockDedicatedWorkerGlobalScope.setup<ProjectPlanningJs>(() => require('../main/worker'));
  });

  afterAll(() => {
    MockDedicatedWorkerGlobalScope.tearDown();
    MockWorker.tearDown();
  });

  test('computeScheduleAsync() works', async () => {
    await expect(inBrowserModule.computeScheduleAsync({
      machineSpeeds: [1],
      jobs: [],
    })).resolves.toEqual([]);
  });
});

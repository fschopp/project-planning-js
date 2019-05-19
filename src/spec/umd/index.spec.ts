import MockDedicatedWorkerGlobalScope from '../../mocks/mock-dedicated-worker-global-scope';
import MockWorker from '../../mocks/mock-worker';

import * as ProjectPlanningJs from '../../main/umd/index';
type ProjectPlanningJs = typeof ProjectPlanningJs;

describe('module loaded when document.currentScript is non-null', () => {
  const originalDocumentCurrentScript = document.currentScript;
  let inBrowser: ProjectPlanningJs;

  beforeAll(() => {
    // Load module in a browsing context
    MockWorker.setup();
    jest.isolateModules(() => {
      const scriptElement = document.createElement('script');
      scriptElement.src = 'ignored';
      Object.defineProperties(document, {
        currentScript: {
          configurable: true,
          value: scriptElement,
        },
      });
      inBrowser = require('../../main/umd/index');
    });

    // Load module in a worker context. This simulates the worker in a separate thread.
    MockDedicatedWorkerGlobalScope.setup<ProjectPlanningJs>(() => require('../../main/umd/index'));
  });

  afterAll(() => {
    Object.defineProperties(document, {
      currentScript: {
        configurable: true,
        value: originalDocumentCurrentScript,
      },
    });
    MockDedicatedWorkerGlobalScope.tearDown();
    MockWorker.tearDown();
  });

  test('computeScheduleAsync() works', async () => {
    await expect(inBrowser.computeScheduleAsync({
      machineSpeeds: [1],
      jobs: [],
    })).resolves.toEqual([]);
  });
});

describe('module loaded when document.currentScript is null', () => {
  let inBrowser: ProjectPlanningJs;
  const originalDocumentCurrentScript = document.currentScript;

  beforeAll(() => {
    // Mock a browsing context
    jest.isolateModules(() => {
      Object.defineProperties(document, {
        currentScript: {
          configurable: true,
          value: null,
        },
      });
      inBrowser = require('../../main/umd/index');
    });
  });

  afterAll(() => {
    Object.defineProperties(document, {
      currentScript: {
        configurable: true,
        value: originalDocumentCurrentScript,
      },
    });
  });

  test('computeScheduleAsync() rejects promise', async () => {
    await expect(inBrowser.computeScheduleAsync({
      machineSpeeds: [1],
      jobs: [],
    })).rejects.toMatch('Failed to create web worker because the URL of the current script could not be determined.');
  });
});

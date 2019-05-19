import MockDedicatedWorkerGlobalScope from './mock-dedicated-worker-global-scope';

declare global {
  namespace NodeJS {
    interface Global {
      Worker?: new() => object;
    }
  }
}

/**
 * Mock for {@link Worker}.
 */
export default class MockWorker {
  public static lastInstance?: MockWorker;
  private static hadWorker_: boolean = false;
  private static originalWorker_: typeof global.Worker;

  public onmessage: ((this: MockWorker, event: MessageEvent) => any) | null = null;

  constructor() {
    MockWorker.lastInstance = this;
  }

  public postMessage(message: any) {
    const event = new MessageEvent('worker -> separate thread', {data: JSON.parse(JSON.stringify(message))});
    expect(MockDedicatedWorkerGlobalScope.lastInstance).toBeDefined();
    expect(MockDedicatedWorkerGlobalScope.lastInstance!.onmessage).not.toBeNull();
    MockDedicatedWorkerGlobalScope.lastInstance!.onmessage!(event);
  }

  public static setup(): void {
    MockWorker.hadWorker_ = 'Worker' in global;
    MockWorker.originalWorker_ = global.Worker;

    global.Worker = MockWorker;
  }

  public static tearDown() {
    if (MockWorker.hadWorker_) {
      global.Worker = MockWorker.originalWorker_;
    } else {
      delete global.Worker;
    }
  }
}

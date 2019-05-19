import { strict as assert } from 'assert';
import MockWorker from './mock-worker';

declare global {
  // tslint:disable-next-line:no-empty-interface
  interface DedicatedWorkerGlobalScope {}

  namespace NodeJS {
    interface Global {
      self?: any;
      DedicatedWorkerGlobalScope?: new() => DedicatedWorkerGlobalScope;
    }
  }
}

/**
 * Mock for {@link DedicatedWorkerGlobalScope} (the global scope in a web worker).
 *
 * For testing, the web worker will run in the same thread.
 */
export default class MockDedicatedWorkerGlobalScope {
  public static lastInstance?: MockDedicatedWorkerGlobalScope;
  private static hadDedicatedWorkerGlobalScope_: boolean = false;
  private static originalDedicatedWorkerGlobalScope_: typeof global.DedicatedWorkerGlobalScope;
  private static hadSelf_: boolean = false;
  private static originalSelf_: typeof global.self;

  // public readonly eventQueue: PrimitiveQueue<() => any> = new PrimitiveQueue();
  public onmessage: ((this: MockDedicatedWorkerGlobalScope, event: MessageEvent) => any) | null = null;

  constructor() {
    MockDedicatedWorkerGlobalScope.lastInstance = this;
  }

  public postMessage(message: any): void {
    // JavaScript VMs can actually transfer certain objects with cyclic references, too, but this is good enough for our
    // test.
    const event = new MessageEvent('separate thread -> worker', {data: JSON.parse(JSON.stringify(message))});
    expect(MockWorker.lastInstance).toBeDefined();
    expect(MockWorker.lastInstance!.onmessage).not.toBeNull();
    MockWorker.lastInstance!.onmessage!(event);
  }

  public close(): void { /* no-op */}

  /**
   * Prepares the global context to mimic a DedicatedWorkerGlobalScope.
   *
   * It is advisable to call {@link tearDown} later.
   */
  public static setup<T>(loader: () => T): T {
    MockDedicatedWorkerGlobalScope.hadDedicatedWorkerGlobalScope_ = 'DedicatedWorkerGlobalScope' in global;
    MockDedicatedWorkerGlobalScope.originalDedicatedWorkerGlobalScope_ = global.DedicatedWorkerGlobalScope;
    MockDedicatedWorkerGlobalScope.hadSelf_ = 'self' in global;
    MockDedicatedWorkerGlobalScope.originalSelf_ = global.self;

    global.DedicatedWorkerGlobalScope = MockDedicatedWorkerGlobalScope;
    const dedicatedWorkerGlobalScope = new MockDedicatedWorkerGlobalScope();
    const setSelf = () => Object.defineProperties(global, {
      self: {
        configurable: true,
        value: dedicatedWorkerGlobalScope,
      },
    });
    let loadedModuleWithWorkerGlobalScope: T | null = null;
    jest.isolateModules(() => {
      setSelf();
      loadedModuleWithWorkerGlobalScope = loader();
    });
    assert(loadedModuleWithWorkerGlobalScope !== null);
    return loadedModuleWithWorkerGlobalScope!;
  }

  public static tearDown() {
    if (MockDedicatedWorkerGlobalScope.hadDedicatedWorkerGlobalScope_) {
      global.DedicatedWorkerGlobalScope = MockDedicatedWorkerGlobalScope.originalDedicatedWorkerGlobalScope_;
    } else {
      delete global.DedicatedWorkerGlobalScope;
    }

    if (MockDedicatedWorkerGlobalScope.hadSelf_) {
      Object.defineProperties(global, {
        self: {
          configurable: true,
          value: MockDedicatedWorkerGlobalScope.originalSelf_,
        },
      });
    } else {
      delete global.self;
    }
  }
}


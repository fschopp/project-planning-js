import { computeSchedule } from './scheduling';
import {
  ComputeScheduleParameters,
  ComputeScheduleReturnType,
  isDedicatedWorkerGlobalScope,
} from './worker-interface';

if (isDedicatedWorkerGlobalScope(self)) {
  const dedicatedWorkerGlobalScope: DedicatedWorkerGlobalScope = self;

  function onMessageFromMaster(event: MessageEvent): void {
    const computeScheduleArgs: ComputeScheduleParameters = event.data;
    const result: ComputeScheduleReturnType = computeSchedule(...computeScheduleArgs);
    dedicatedWorkerGlobalScope.postMessage(result);
    dedicatedWorkerGlobalScope.close();
  }

  dedicatedWorkerGlobalScope.onmessage = onMessageFromMaster;
}

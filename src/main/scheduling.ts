/**
 * Algorithm for project planning. More precisely, *list scheduling* with support for machines running at different
 * speeds, optional preemption, optional splitting of jobs across machines, release dates, and delivery times.
 *
 * See README file for details.
 */

/** API documentation barrier */

import {
  Job,
  JobFragment,
  JobSplitting,
  Schedule,
  ScheduledJob,
  SchedulingFailure,
  SchedulingInstance,
} from './api-types';
import MinHeap from './minheap';

// Notes on assert:
// 1. console.assert() is not guaranteed to throw an Error. Should that be needed for whatever reason, replace the
//    following line with:
//    import { strict as assert } from 'assert';
// 2. assert() calls will be stripped from the build.
const assert = console.assert;

/**
 * Type that consists of the union of all properties that are marked as optional through a question mark.
 *
 * Note that properties that have undefined in their domain, but no question mark next to the property name are *not*
 * included. Also note that, in strict compilation mode, TypeScript will add undefined to the domain of the property if
 * there is a question mark next to the property name.
 *
 * @typeparam T generic type parameter
 */
type OptionalPropertyNames<T extends {}> = {[K in keyof T]-?: {} extends {[_ in K]: T[K]} ? K : never}[keyof T];
type Defined<T> = T extends undefined ? never : T;
type OnlyOptionals<T extends {}> = {[K in OptionalPropertyNames<T>]: Defined<T[K]>};

const JOB_DEFAULTS = Object.freeze<OnlyOptionals<Job>>({
  deliveryTime: 0,
  splitting: JobSplitting.PREEMPTION,
  dependencies: [],
  releaseTime: 0,
  preAssignment: -1,
});

/**
 * Runs the list scheduling algorithm on the given problem instance and returns the result.
 *
 * See [the project page](https://github.com/fschopp/project-planning-js) for more information on the algorithm.
 *
 * @param instance the problem instance
 * @return solution or a human-readable failure description if the problem instance is invalid (for example, has a
 *     cyclic dependency graph)
 */
export function computeSchedule(instance: SchedulingInstance): Schedule | SchedulingFailure {
  const nonNegativeInteger = (number: number) => number >= 0 && Number.isInteger(number);
  const nonNegativeIntegers = (numbers: number[]) =>
      numbers.filter((number) => !nonNegativeInteger(number)).length === 0;
  const undefinedOrNonNegativeInteger = (number: number | undefined) =>
      number === undefined || nonNegativeInteger(number);
  const undefinedOrNonNegativeIntegers = (...numbers: (number | undefined)[]) =>
      numbers.filter((number) => !undefinedOrNonNegativeInteger(number)).length === 0;
  const undefinedOrIntegerWithinZeroTo = (upperBoundExcl: number, number: number | undefined) =>
      number === undefined || nonNegativeInteger(number) && number < upperBoundExcl;
  const integersWithinZeroTo = (upperBoundExcl: number, numbers: number[]) =>
      numbers.filter((number) => !(number >= 0 && nonNegativeInteger(number) && number < upperBoundExcl)).length === 0;

  const numMachines: number = instance.machineSpeeds.length;
  const numJobs: number = instance.jobs.length;

  if (numMachines === 0) {
    return 'At least one machine is required to compute a schedule.';
  } else if (
      !nonNegativeIntegers(instance.machineSpeeds) ||
      instance.jobs.filter((job) =>
          !nonNegativeInteger(job.size) ||
          !undefinedOrNonNegativeIntegers(job.deliveryTime, job.releaseTime) ||
          !undefinedOrIntegerWithinZeroTo(numMachines, job.preAssignment) ||
          (job.dependencies !== undefined && !integersWithinZeroTo(numJobs, job.dependencies))
      ).length > 0 ||
      !undefinedOrNonNegativeInteger(instance.minFragmentSize)
  ) {
    return 'All job processing times and machine speeds need to be non-negative integers. ' +
        'All job dependency and pre-assignment indices need to be within bounds.';
  }

  const jobs: Required<Job>[] = instance.jobs.map((job) => Object.assign({}, JOB_DEFAULTS, job));
  const minFragmentSize: number = instance.minFragmentSize === undefined ? 0 : instance.minFragmentSize;
  return new ListScheduling(numMachines, instance.machineSpeeds, jobs, minFragmentSize).schedule;
}

/**
 * A gap in the schedule for a particular machine. A gap can be filled when scheduling subsequent jobs.
 */
interface Gap {
  startTime: number;
  endTime: number;
}

/**
 * Linked list of gaps.
 */
interface GapsList {
  head: Gap;
  tail: GapsList | null;
}

/**
 * A machine and associated data required by {@link ListScheduling.scheduleJob}().
 */
interface Machine {
  /**
   * Index in array of all machines.
   *
   * This is a value between 0 (inclusive) and the length of {@link SchedulingInstance.machineSpeeds} (exclusive).
   */
  readonly index: number;

  /**
   * Index in array of available machines for the current job.
   */
  readonly availableIdx: number;

  /**
   * Speed of the machine.
   */
  readonly speed: number;

  /**
   * Time when the current job fragment started on the machine, or null if the current job is not currently running on
   * the machine.
   */
  currentFragmentStart: number | null;

  /**
   * Linked list of gaps.
   *
   * Whenever starting to schedule a job, this is initialized with a tail list of {@link ListScheduling.gapsLists_}.
   */
  gapsList: GapsList;

  /**
   * Node of the linked list of gaps before the current node (which is {@link gapsList}).
   *
   * This field is only needed to “commit” the insertion of job fragments by making changes to the gap list shared
   * between scheduling of individual jobs.
   */
  previousGapsList: GapsList;
}

/**
 * Node in the job graph induced by the dependencies.
 */
interface JobGraphNode {
  idx: number;
  numDependencies: number;
  dependents: JobGraphNode[];
}

/**
 * Abstraction for a collection of machines available for a job.
 */
interface AvailableMachineIndices {
  readonly length: number;
  forEach(callbackfn: (index: number, availableIdx: number) => void): void;
  map<T>(callbackfn: (index: number, availableIdx: number) => T): T[];
}

/**
 * Internal class whose sole purpose is to store algorithm state, so it does not have to be inconveniently passed around
 * between functions.
 */
class ListScheduling {
  public readonly schedule: Schedule | SchedulingFailure;

  private readonly numMachines_: number;
  private readonly machineSpeeds_: number[];
  private readonly jobs_: Required<Job>[];
  private readonly minFragmentSize_: number;

  private readonly gapsLists_: GapsList[];

  constructor(numMachines: number, machineSpeeds: number[], jobs: Required<Job>[], minFragmentSize: number) {
    this.numMachines_ = numMachines;
    this.machineSpeeds_ = machineSpeeds;
    this.jobs_ = jobs;
    this.minFragmentSize_ = minFragmentSize;

    this.gapsLists_ = this.machineSpeeds_.map((ignoredMachineSpeed) => ({
      head: {
        startTime: Number.MIN_SAFE_INTEGER,
        endTime: 0,
      },
      tail: {
        head: {
          startTime: 0,
          endTime: Number.MAX_SAFE_INTEGER,
        },
        tail: null,
      },
    }));
    this.schedule = this.computeSchedule();
  }

  /**
   * Returns the next “event” for the given machine.
   *
   * This method has side-effects. It updates field {@link Machine.previousGapsList} and {@link Machine.gapsList} of the
   * given machine.
   */
  private static nextTimeStamp(minWallClockTime: number, earliestStart: number, machine: Machine): number {
    let currentGap: Gap = machine.gapsList.head;

    assert(Number.isInteger(minWallClockTime) && Number.isInteger(earliestStart) &&
        Number.isInteger(currentGap.startTime) && Number.isInteger(currentGap.endTime), 'Invalid arguments');

    if (machine.currentFragmentStart === null) {
      while (true) {
        const timeStamp = Math.max(earliestStart, currentGap.startTime) + minWallClockTime;
        if (timeStamp <= currentGap.endTime) {
          return timeStamp;
        }
        assert(machine.gapsList.tail !== null, 'Invariant: last gap has endTime === Number.MAX_SAFE_INTEGER');
        machine.previousGapsList = machine.gapsList;
        machine.gapsList = machine.gapsList.tail!;
        currentGap = machine.gapsList.head;
      }
    } else {
      return currentGap.endTime;
    }
  }

  /**
   * Adjust the linked list of gaps to account for the newly scheduled job fragment.
   *
   * There are 4 cases to consider. The new job fragment either:
   * 1. Fills out the current gap completely. In this case, the current gap needs to be removed
   *    entirely.
   * 2. Aligns with the start of the current gap, but ends before it. In this case, the start of the current gap is
   *    changed to when the new job fragment ends.
   * 3. Does not start with the current gap, but aligns with the end of it. In this case, the end of the current gap is
   *    changed to when the job fragment starts.
   * 4. If the current gap aligns with neither start nor end of the current gap, a new gap is inserted before the
   *    current gap. It starts with the current gap and ends with the start of the job fragment. The start of the
   *    current gap is then changed to the end of the job fragment.
   *
   * @param machineState State of the machine that the job fragment has been scheduled on.
   * @param end end time of the job fragment
   * @param commitGaps if true, then commit the updated gaps to the state that is shared across scheduling of individual
   *     jobs
   */
  private adjustGaps(machineState: Machine, end: number, commitGaps: boolean): void {
    assert(machineState.index >= 0 && machineState.index < this.numMachines_ &&
        machineState.currentFragmentStart !== null && Number.isInteger(machineState.currentFragmentStart) &&
        Number.isInteger(end) && machineState.currentFragmentStart <= end, 'Invalid arguments');

    // machineState also points to state that is shared across scheduling of individual jobs. This shared state we must
    // not modify if dryRun is true. We therefore cannot make modifications to the properties of
    // machineState.previousGapsList or machineState.gap.

    const start: number = machineState.currentFragmentStart!;
    const currentGap = machineState.gapsList.head;

    if (commitGaps) {
      if (start === currentGap.startTime && end === currentGap.endTime) {
        machineState.previousGapsList.tail = machineState.gapsList.tail;
      } else if (start === currentGap.startTime) {
        currentGap.startTime = end;
      } else if (end === currentGap.endTime) {
        currentGap.endTime = start;
        machineState.previousGapsList = machineState.gapsList;
        // Note that machineState.gapsList will be updated below.
      } else {
        machineState.previousGapsList.tail = {
          head: {
            startTime: currentGap.startTime,
            endTime: start,
          },
          tail: machineState.gapsList,
        };
        currentGap.startTime = end;
      }
    }

    if (end === currentGap.endTime) {
      // Note that machineState.gapsList.tail === null would imply that the current gap is the last gap; that is,
      // currentGap.endTime === Number.MAX_SAFE_INTEGER. But we are also in the case where (end === currentGap.endTime).
      // Since we don't support schedules that long, it is safe to assert:
      assert(machineState.gapsList.tail !== null, 'Expected currentGap.endTime < Number.MAX_SAFE_INTEGER');
      machineState.gapsList = machineState.gapsList.tail!;
    } else if (!commitGaps) {
      machineState.gapsList = {
        head: {
          startTime: end,
          endTime: currentGap.endTime,
        },
        tail: machineState.gapsList.tail,
      };
    }

    // Upon return, we will be "before" the gap represented by machineState.gapsList.head.
    machineState.currentFragmentStart = null;
  }

  private createJobFragment(machineState: Machine, end: number, scheduledJob?: ScheduledJob): void {
    if (scheduledJob) {
      const start: number = machineState.currentFragmentStart!;
      if (end - start > 0) {
        const jobFragment: JobFragment = {
          machine: machineState.index,
          start,
          end,
          isWaiting: false,
        };
        scheduledJob.push(jobFragment);
      }
    }
    this.adjustGaps(machineState, end, scheduledJob !== undefined);
  }

  /**
   * Schedules processing of a job and returns its completion time (excluding delivery time).
   */
  private scheduleJob(availableMachineIndices: AvailableMachineIndices, size: number, isPreemptible: boolean,
      earliestStart: number, scheduledJob?: ScheduledJob): number {
    assert(availableMachineIndices.length > 0 && Number.isInteger(size) && size >= 0 &&
        Number.isInteger(earliestStart), 'Invalid arguments');

    const minFragmentSize = isPreemptible ? Math.min(size, this.minFragmentSize_) : size;
    let currentSpeed = 0;
    let lastTimestamp = earliestStart;
    let remainingSize = size;
    const machines: Machine[] = availableMachineIndices.map((index, availableIdx): Machine => {
      const gapsList = this.gapsLists_[index];
      assert(gapsList.tail !== null, 'Invariant: at least 2 elements in linked list gapsList');
      return {
        index,
        availableIdx,
        speed: this.machineSpeeds_[index],
        currentFragmentStart: null,
        previousGapsList: gapsList,
        gapsList: gapsList.tail!,
      };
    });

    while (remainingSize > 0) {
      let eventTime: number = Number.MAX_SAFE_INTEGER;
      let machine: Machine = machines[0];
      availableMachineIndices.forEach((index, availableIdx) => {
        const minWallClockTime = Math.ceil(minFragmentSize / machines[availableIdx].speed);
        const machineEventTime = ListScheduling.nextTimeStamp(minWallClockTime, earliestStart, machines[availableIdx]);
        if (machineEventTime < eventTime) {
          eventTime = machineEventTime;
          machine = machines[availableIdx];
        }
      });
      let isProjectedEndTime: boolean = false;
      const currentProjectedEndTime: number = Math.ceil(lastTimestamp + remainingSize / currentSpeed);
      if (currentProjectedEndTime < eventTime) {
        eventTime = currentProjectedEndTime;
        isProjectedEndTime = true;
      }
      assert(Number.isInteger(eventTime) && Number.isInteger(lastTimestamp) && Number.isInteger(currentSpeed),
          'Invariant: timestamps and speeds are integers');
      remainingSize -= (eventTime - lastTimestamp) * currentSpeed;
      assert(!isProjectedEndTime || remainingSize <= 0,
          'Invariant: isProjectedEndTime implies remainingSize <= 0');

      if (!isProjectedEndTime) {
        if (machine.currentFragmentStart === null) {
          const nextGap: Gap = machine.gapsList.head;
          machine.currentFragmentStart = Math.max(earliestStart, nextGap.startTime);
          remainingSize -= (eventTime - machine.currentFragmentStart) * machine.speed;
          currentSpeed += machine.speed;
        } else {
          this.createJobFragment(machine, eventTime, scheduledJob);
          currentSpeed -= machine.speed;
          assert(machine.currentFragmentStart === null && currentSpeed >= 0);
        }
      }

      lastTimestamp = eventTime;
      assert(Number.isInteger(lastTimestamp) && Number.isInteger(remainingSize),
          'Invariant: timestamps and durations are integers');
    }

    availableMachineIndices.forEach((ignoredIndex, availableIdx) => {
      if (machines[availableIdx].currentFragmentStart !== null) {
        this.createJobFragment(machines[availableIdx], lastTimestamp, scheduledJob);
      }
    });

    return lastTimestamp;
  }

  private static scheduleDeliveryTime(machineIdx: number, processingCompletionTime: number, deliveryTime: number,
      scheduledJob: ScheduledJob) {
    assert(Number.isInteger(deliveryTime), 'Invalid arguments');
    assert(scheduledJob.length > 0 ? processingCompletionTime === scheduledJob[scheduledJob.length - 1].end : true,
        'Processing completion time is end timestamp of last job fragment');
    if (deliveryTime > 0) {
      const deliveryJobFragment: JobFragment = {
        machine: machineIdx,
        start: processingCompletionTime,
        end: processingCompletionTime + deliveryTime,
        isWaiting: true,
      };
      scheduledJob.push(deliveryJobFragment);
    }
  }

  private allMachines(): AvailableMachineIndices {
    return {
      length: this.machineSpeeds_.length,
      forEach(callbackfn: (index: number, availableIdx: number) => void): void {
        for (let i = 0; i < this.length; ++i) {
          callbackfn(i, i);
        }
      },
      map<T>(callbackfn: (index: number, availableIdx: number) => T): T[] {
        const array: T[] = [];
        array.length = this.length;
        for (let i = 0; i < this.length; ++i) {
          array[i] = callbackfn(i, i);
        }
        return array;
      },
    };
  }

  private static singleMachine(singleMachineIdx: number): AvailableMachineIndices {
    return {
      length: 1,
      forEach(callbackfn: (index: number, availableIdx: number) => void): void {
        callbackfn(singleMachineIdx, 0);
      },
      map<T>(callbackfn: (index: number, availableIdx: number) => T): T[] {
        return [callbackfn(singleMachineIdx, 0)];
      },
    };
  }

  private computeSchedule(): Schedule | SchedulingFailure {
    const noDependencyNodes: JobGraphNode[] = [];
    const jobGraphNodes: JobGraphNode[] = this.jobs_.map((job, index): JobGraphNode => ({
      idx: index,
      numDependencies: job.dependencies.length,
      dependents: [],
    }));
    for (let i = 0; i < this.jobs_.length; ++i) {
      const job = this.jobs_[i];
      const jobGraphNode = jobGraphNodes[i];
      for (const dependencyIdx of job.dependencies) {
        jobGraphNodes[dependencyIdx].dependents.push(jobGraphNode);
      }
      if (job.dependencies.length === 0) {
        noDependencyNodes.push(jobGraphNode);
      }
    }

    const allMachines: AvailableMachineIndices = this.allMachines();
    const newSchedule: Schedule = this.jobs_.map((ignoredJob) => []);
    let numScheduledJobs = 0;
    const noDependencyNodesHeap = new MinHeap<JobGraphNode>(noDependencyNodes, (left, right) => left.idx - right.idx);
    while (!noDependencyNodesHeap.isEmpty()) {
      const jobGraphNode: JobGraphNode = noDependencyNodesHeap.extractMin()!;
      const job = this.jobs_[jobGraphNode.idx];
      const isPreemptible: boolean = job.splitting !== JobSplitting.NONE;
      const earliestStartTime = job.dependencies.reduce((previousEarliestStartTime, dependencyIdx) => {
        const dependency: ScheduledJob = newSchedule[dependencyIdx];
        assert(dependency.length > 0, 'Dependencies are scheduled before their dependents');
        const lastJobFragment: JobFragment = dependency[dependency.length - 1];
        return Math.max(previousEarliestStartTime, lastJobFragment.end);
      }, job.releaseTime);
      let availableMachines: AvailableMachineIndices = allMachines;
      let deliveryMachineIdx: number | undefined;
      if (job.splitting === JobSplitting.MULTIPLE_MACHINES) {
        deliveryMachineIdx = job.preAssignment >= 0
            ? job.preAssignment
            : 0;
      } else if (job.preAssignment >= 0) {
        availableMachines = ListScheduling.singleMachine(job.preAssignment);
        deliveryMachineIdx = job.preAssignment;
      } else {
        let maxCompletionTime: number = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < this.numMachines_; ++i) {
          const currentAvailableMachines = ListScheduling.singleMachine(i);
          const currentCompletionTime =
              this.scheduleJob(currentAvailableMachines, job.size, isPreemptible, earliestStartTime);
          if (currentCompletionTime < maxCompletionTime) {
            availableMachines = currentAvailableMachines;
            deliveryMachineIdx = i;
            maxCompletionTime = currentCompletionTime;
          }
        }
      }
      assert(deliveryMachineIdx !== undefined);
      const completionTime: number = this.scheduleJob(
          availableMachines, job.size, isPreemptible, earliestStartTime, newSchedule[jobGraphNode.idx]);
      ListScheduling.scheduleDeliveryTime(
          deliveryMachineIdx!, completionTime, job.deliveryTime, newSchedule[jobGraphNode.idx]);
      ++numScheduledJobs;
      for (const dependent of jobGraphNode.dependents) {
        --dependent.numDependencies;
        if (dependent.numDependencies === 0) {
          noDependencyNodesHeap.add(dependent);
        }
      }
    }

    return numScheduledJobs !== this.jobs_.length
        ? 'Detected a cycle in the dependency graph.'
        : newSchedule;
  }
}

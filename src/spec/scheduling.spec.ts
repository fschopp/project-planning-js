import {
  computeSchedule,
  isSchedulingFailure,
  JobFragment,
  JobSplitting,
  Schedule,
  SchedulingInstance,
} from '../main/scheduling';

interface SimplifiedJobFragment extends Partial<JobFragment> {
  machine: number;
  start: number;
  end: number;
  isWaiting?: boolean;
}

type SimplifiedScheduledJob = SimplifiedJobFragment[];

type SimplifiedSchedule = SimplifiedScheduledJob[];

function completeSchedule(partialSchedule: SimplifiedSchedule): Schedule {
  return partialSchedule.map(
      (partialScheduledJob) => partialScheduledJob.map(
          (partialJobFragment) => ({...{
            isWaiting: false,
          }, ...partialJobFragment})
      )
  );
}

describe('schedule() handles edge cases and invalid input', () => {
  test('returns error on empty machine list', () => {
    const noMachinesInstance: SchedulingInstance = {
      machineSpeeds: [],
      jobs: [{size: 1}],
    };
    const schedule = computeSchedule(noMachinesInstance);
    expect(isSchedulingFailure(schedule)).toBeTruthy();
    expect(schedule).toMatch('required');
  });

  test('returns error on cyclic dependencies', () => {
    const cyclicDependenciesInstance: SchedulingInstance = {
      machineSpeeds: [1],
      jobs: [
        {size: 1, dependencies: [1]},
        {size: 1, dependencies: [0]},
      ],
    };
    const schedule = computeSchedule(cyclicDependenciesInstance);
    expect(isSchedulingFailure(schedule)).toBeTruthy();
    expect(schedule).toMatch('cycle');
  });

  test.each([-1, 1.2])('returns error on negative or non-integer machine speed %d', (speed) => {
    const cyclicDependenciesInstance: SchedulingInstance = {
      machineSpeeds: [1, speed],
      jobs: [],
    };
    const schedule = computeSchedule(cyclicDependenciesInstance);
    expect(isSchedulingFailure(schedule)).toBeTruthy();
    expect(schedule).toMatch(/negative|integer/);
  });

  test('returns empty schedule on empty job list', () => {
    const noJobsInstance: SchedulingInstance = {
      machineSpeeds: [1],
      jobs: [],
    };
    const schedule = computeSchedule(noJobsInstance);
    expect(isSchedulingFailure(schedule)).toBeFalsy();
    expect(schedule).toEqual([]);
  });
});

describe('schedule() handles optional job properties', () => {
  test('wait time', () => {
    const simpleInstance: SchedulingInstance = {
      machineSpeeds: [2],
      jobs: [
        {size: 2, deliveryTime: 2},
        {size: 4, deliveryTime: 1},
      ],
    };
    const result: Schedule = [
      [{machine: 0, start: 0, end: 1, isWaiting: false}, {machine: 0, start: 1, end: 3, isWaiting: true}],
      [{machine: 0, start: 1, end: 3, isWaiting: false}, {machine: 0, start: 3, end: 4, isWaiting: true}],
    ];
    expect(computeSchedule(simpleInstance)).toEqual(result);
  });

  test('splittable jobs', () => {
    const simpleInstance: SchedulingInstance = {
      machineSpeeds: [10, 1],
      jobs: [
        {size: 10, releaseTime: 1},
        {size: 23, splitting: JobSplitting.MULTIPLE_MACHINES},
        {size: 10, releaseTime: 5},
        {size: 30, splitting: JobSplitting.NONE},
      ],
    };
    const result: SimplifiedSchedule = [
      [{machine: 0, start: 1, end: 2}],
      [{machine: 0, start: 0, end: 1}, {machine: 0, start: 2, end: 3}, {machine: 1, start: 0, end: 3}],
      [{machine: 0, start: 5, end: 6}],
      [{machine: 0, start: 6, end: 9}],
    ];
    expect(computeSchedule(simpleInstance)).toEqual(completeSchedule(result));
  });

  test('dependencies', () => {
    const simpleInstance: SchedulingInstance = {
      machineSpeeds: [2],
      jobs: [
        {size: 4, deliveryTime: 1, dependencies: [1]},
        {size: 6},
        {size: 2, dependencies: [0, 1]},
      ],
    };
    const result: SimplifiedSchedule = [
      [{machine: 0, start: 3, end: 5}, {machine: 0, start: 5, end: 6, isWaiting: true}],
      [{machine: 0, start: 0, end: 3}],
      [{machine: 0, start: 6, end: 7}],
    ];
    expect(computeSchedule(simpleInstance)).toEqual(completeSchedule(result));
  });

  test('releaseTime', () => {
    const simpleInstance: SchedulingInstance = {
      machineSpeeds: [1],
      jobs: [
        {size: 2, releaseTime: 4},
        {size: 3, releaseTime: 2, dependencies: [2]},
        {size: 4, releaseTime: 1},
      ],
    };
    const result: SimplifiedSchedule = [
      [{machine: 0, start: 4, end: 6}],
      [{machine: 0, start: 7, end: 10}],
      [{machine: 0, start: 1, end: 4}, {machine: 0, start: 6, end: 7}],
    ];
    expect(computeSchedule(simpleInstance)).toEqual(completeSchedule(result));
  });

  test('pre-assignment', () => {
    const simpleInstance: SchedulingInstance = {
      machineSpeeds: [1, 10],
      jobs: [
        {size: 10, preAssignment: 0},
        {size: 1, preAssignment: 0},
        {size: 10},
      ],
    };
    const result: SimplifiedSchedule = [
      [{machine: 0, start: 0, end: 10}],
      [{machine: 0, start: 10, end: 11}],
      [{machine: 1, start: 0, end: 1}],
    ];
    expect(computeSchedule(simpleInstance)).toEqual(completeSchedule(result));
  });
});

function minWorkTestCase(minFragment: number, lastJob: SimplifiedScheduledJob): [number, SimplifiedSchedule] {
  return [
    minFragment,
    [
      [{machine: 0, start: 0, end: 1}],
      [{machine: 1, start: 1, end: 2}],
      [{machine: 2, start: 2, end: 3}],
      lastJob,
    ],
  ];
}

test.each([
  minWorkTestCase(0, [{machine: 1, start: 0, end: 1}, {machine: 2, start: 0, end: 2}, {machine: 0, start: 1, end: 3},
      {machine: 1, start: 2, end: 3}]),
  minWorkTestCase(2, [{machine: 2, start: 0, end: 2}, {machine: 0, start: 1, end: 4}, {machine: 1, start: 2, end: 4}]),
  minWorkTestCase(3, [{machine: 0, start: 1, end: 5}, {machine: 1, start: 2, end: 5}]),
  minWorkTestCase(4, [{machine: 0, start: 1, end: 6}, {machine: 1, start: 2, end: 6}]),
  minWorkTestCase(5, [{machine: 0, start: 1, end: 6}]),
] as [number, SimplifiedSchedule][])(
    'schedule() handles minimum fragment size %d',
    (minFragmentSize, result) => {
      const simpleInstance: SchedulingInstance = {
        machineSpeeds: [1, 1, 1],
        jobs: [
          {size: 1, dependencies: [], preAssignment: 0},
          {size: 1, dependencies: [0], preAssignment: 1},
          {size: 1, dependencies: [0, 1], preAssignment: 2},
          {size: 5, splitting: JobSplitting.MULTIPLE_MACHINES, preAssignment: 2},
        ],
        minFragmentSize,
      };
      expect(computeSchedule(simpleInstance)).toEqual(completeSchedule(result));
    }
);

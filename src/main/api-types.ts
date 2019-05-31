/**
 * Enumeration of the job-splitting options.
 */
export enum JobSplitting {
  // Note that this is deliberately not a const enum. The TypeScript compiler inlines const enums, which means that the
  // generated declaration file is *required* for compiling into valid JavaScript. However, the declaration file may not
  // always be taken into consideration or even available. For example, the parcel bundler uses `transpileModule()` for
  // TypeScript assets:
  // https://github.com/parcel-bundler/parcel/blob/parcel-bundler%401.12.3/packages/core/parcel-bundler/src/assets/TypeScriptAsset.js#L46-L49
  // However, `transpileModule()` is just a simple transform function:
  // https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#a-simple-transform-function
  // It does not look at any imports at all:
  // https://github.com/Microsoft/TypeScript/issues/5243

  /**
   * The job needs to be executed by a single machine en bloc (that is, with a single job fragment).
   */
  NONE = 'none',

  /**
   * The job needs to be executed by a single machine but it allows preemption; that is, its execution may be
   * interrupted by other jobs.
   */
  PREEMPTION = 'preemption',

  /**
   * The job can be executed by multiple machines, and it also allows preemption.
   */
  MULTIPLE_MACHINES = 'multi',
}

/**
 * A job.
 */
export interface Job {
  /**
   * The processing requirement of a job (or, more succinctly, the job size).
   *
   * The actual *processing time* of a job (or job fragment) on a machine with speed `speed` is `size / speed`. This is
   * the amount of time the machine is busy. In addition, a job may also have a delivery time. During that time, the
   * machine is already available again and can process other jobs.
   *
   * If the job size is 0, the corresponding {@link ScheduledJob} will contain no {@link JobFragment} for *processing*
   * this job. However, if {@link deliveryTime} is greater than 0, there would still be a job fragment for the delivery
   * time (which starts at time 0).
   */
  size: number;

  /**
   * Delivery time of a job, independent of the machine that it is scheduled on.
   *
   * During the delivery time of a job, a machine is available again to process other jobs. However, no dependents of
   * this job can start before the delivery time has elapsed.
   *
   * In the computed {@link Schedule}, a separate {@link JobFragment} will be created to represent the delivery time. If
   * {@link splitting} is {@link JobSplitting.MULTIPLE_MACHINES}, then this job fragment will be assigned to the machine
   * specified by {@link preAssignment} (or simply the first machine if that field is `undefined`).
   *
   * The default is no delivery time; that is, 0.
   */
  deliveryTime?: number;

  /**
   * Whether the job allows preemption or may be processed concurrently by more than one machine at a time.
   *
   * The default is {@link JobSplitting.PREEMPTION}.
   */
  splitting?: JobSplitting;

  /**
   * Indices of the jobs that this job depends on.
   *
   * Dependencies are finish-to-start; that is, a job cannot start before all job dependencies are fully completed
   * (including any delivery time they may have).
   *
   * The default is no dependencies; that is, the empty array.
   */
  dependencies?: number[];

  /**
   * The earliest possible start time for this job.
   *
   * This constraint is in addition to {@link dependencies}.
   *
   * The default is none; that is, an earliest possible start time of 0.
   */
  releaseTime?: number;

  /**
   * Index of the machine that this job must be assigned to.
   *
   * If both this is set and {@link splitting} is {@link JobSplitting.MULTIPLE_MACHINES}, then this field only
   * determines what machine the delivery time (if any) will be assigned to.
   *
   * The default is no pre-assignment.
   */
  preAssignment?: number;
}

/**
 * An instance of the scheduling problem solved by this module.
 */
export interface SchedulingInstance {
  /**
   * The speeds of the machines available for processing jobs.
   *
   * The length of this array determines the number of machines available.
   */
  machineSpeeds: number[];

  /**
   * The jobs that needs to be processed on one (or more) of the available machines.
   *
   * The dependency graph induced by {@link Job.dependencies} must be an acyclic graph.
   */
  jobs: Job[];

  /**
   * The minimum processing requirement that a job fragment must have.
   *
   * The default is 0 (that is, there is no effective minimum).
   */
  minFragmentSize?: number;
}

/**
 * A job fragment is a an assignment of a job (or part of it) to a machine at a specific time.
 */
export interface JobFragment {
  /**
   * The machine that this job fragment is scheduled to be executed by.
   */
  machine: number;

  /**
   * The wall clock start time for this job fragment.
   */
  start: number;

  /**
   * The wall clock end time for this job fragment.
   */
  end: number;

  /**
   * Whether this job fragment represents delivery time.
   *
   * If true, this job fragment does not prevent other jobs to be scheduled concurrently on the same machine. However,
   * any dependent job can only execute once all processing of this job has been finished and the delivery time has
   * elapsed.
   */
  isWaiting: boolean;
}

/**
 * A scheduled job consists of one or more job fragments.
 *
 * The job fragments are sorted by {@link JobFragment.end} and {@link JobFragment.machine} (in that order). Fragments on
 * the same machine are guaranteed to not overlap. Moreover, if `a` and `b` are two consecutive job fragments on the
 * same machine with `a.end === b.start`, then they differ in {@link JobFragment.isWaiting}.
 */
export type ScheduledJob = JobFragment[];

/**
 * A schedule is an array of scheduled jobs.
 *
 * Machines are identified by their array index. For the result returned by {@link computeSchedule}(), there is a 1:1
 * correspondence between the jobs in {@link Schedule} and in {@link SchedulingInstance.jobs} (given as argument).
 */
export type Schedule = ScheduledJob[];

/**
 * Describes a failure while computing a schedule in {@link computeSchedule}().
 */
export type SchedulingFailure = string;

/**
 * Returns whether the given value is a {@link SchedulingFailure}.
 */
export function isSchedulingFailure(value: any): value is SchedulingFailure {
  return typeof value === 'string';
}

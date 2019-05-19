import IntervalTree from 'node-interval-tree';
import SVG from 'svg.js';
import {
  computeSchedule,
  computeScheduleAsync,
  isSchedulingFailure,
  JobFragment,
  Schedule,
  SchedulingFailure,
  SchedulingInstance,
} from '../main';


// Constants

const SOURCE_PARAM_NAME: string = 'src';
const SPACING: number = 10;
const MACHINE_HEIGHT: number = 20;

type AlertKind = 'success' | 'warning';
const ALERT_KINDS: readonly AlertKind[] = Object.freeze(['success', 'warning']);


// Global state (sigh)

let hashFromShareLink: string = '';


// Data structures for visualization

interface VisualizedJobFragment extends JobFragment {
  jobIdx: number;
  layer: number;
}

interface Machine {
  index: number;
  top: number;
  numLayers: number;
  fragments: IntervalTree<VisualizedJobFragment>;
}

interface Visualization {
  scheduleLength: number;
  machines: Machine[];
}


// HTML elements
// Implied assumption here is this script is loaded after all of the following elements (the <script> element is at the
// very end).

const svgRoot = SVG('drawing').size('100%', 0);
const instanceInput = document.getElementById('instance')! as HTMLTextAreaElement;
const separateThread = document.getElementById('chkSeparateThread')! as HTMLInputElement;
const scheduleOutput = document.getElementById('schedule')! as HTMLTextAreaElement;
const feedback = document.getElementById('feedback') as HTMLDivElement;
const feedbackTitle: HTMLElement = feedback.querySelector('strong')!;
const feedbackMsg: HTMLElement = feedback.querySelector('span')!;


// Implementation

function computeVisualization(instance: SchedulingInstance, result: Schedule): Visualization {
  const visualization: Visualization = {
    scheduleLength: 0,
    machines: instance.machineSpeeds.map((ignoredSpeed, index) => ({
      index,
      top: 0,
      numLayers: 1,
      fragments: new IntervalTree<VisualizedJobFragment>(),
    })),
  };

  for (let scheduledJobIdx = 0; scheduledJobIdx < result.length; ++scheduledJobIdx) {
    const scheduledJob = result[scheduledJobIdx];
    for (const jobFragment of scheduledJob) {
      visualization.scheduleLength = Math.max(visualization.scheduleLength, jobFragment.end);
      const machine = visualization.machines[jobFragment.machine];
      const halfOpenInterval: [number, number] = [jobFragment.start, jobFragment.end - 0.5];
      const existingLayers: number[] = machine.fragments.search(...halfOpenInterval)
          .map((fragment) => (fragment as VisualizedJobFragment).layer).sort();
      let newLayer = 0;
      for (const existingLayer of existingLayers) {
        if (newLayer < existingLayer) {
          break;
        } else if (newLayer === existingLayer) {
          newLayer = existingLayer + 1;
        }
      }
      machine.numLayers = Math.max(machine.numLayers, newLayer + 1);
      const extendedJobFragment: VisualizedJobFragment = {
        jobIdx: scheduledJobIdx,
        layer: newLayer,
        ...jobFragment,
      };
      // Unfortunately, the interval tree implements closed intervals. Since our algorithm is guaranteed to output
      // integer solutions, we can simulate half-closed intervals slightly reducing the upper bound.
      machine.fragments.insert(halfOpenInterval[0], halfOpenInterval[1], extendedJobFragment);
    }
  }
  return visualization;
}

function createSvg(draw: SVG.Doc, visualization: Visualization): void {
  // The first rule sets the font-family only if the SVG is used stand-alone. Otherwise, we want to inherit.
  draw.clear().width('100%').element('style').attr('type', 'text/css').words(`/* <![CDATA[ */
svg:root {
  font-family: sans-serif;
}

.row-in-schedule:nth-child(odd) > rect {
  fill: none;
}

.row-in-schedule:nth-child(even) > rect {
  fill: #e3e3e3
}

.schedule-baseline {
  stroke: black;
  stroke-width: 2px;
}

.schedule-finish-line {
  stroke: #DDD;
  stroke-width: 1px;
}

#drawing {
  overflow-x: auto;
}
/* ]]> */`);

  // Create machine labels first
  const machineLabels: SVG.Text[] = [];
  let maxLabelWidth: number = 0;
  for (const machine of visualization.machines) {
    const label: SVG.Text = draw.plain(`Machine ${machine.index}`).font({anchor: 'end'}).attr('font-family', null);
    machineLabels.push(label);
    maxLabelWidth = Math.max(label.bbox().width, maxLabelWidth);
  }

  const drawWidth = draw.node.clientWidth || (draw.node.parentNode as HTMLElement).clientWidth;
  const scalingFactor = (drawWidth - (maxLabelWidth + 3 * SPACING)) / visualization.scheduleLength;

  const g = draw.group();
  const rowBackgroundsGroup = g.group();
  let top: number = 0;
  for (let i = 0; i < visualization.machines.length; ++i) {
    const machine = visualization.machines[i];
    const machineLabel = machineLabels[i];
    const rowGroup = rowBackgroundsGroup.group().addClass('row-in-schedule');

    rowGroup
        .rect(
            maxLabelWidth + 3 * SPACING + scalingFactor * visualization.scheduleLength,
            MACHINE_HEIGHT * machine.numLayers + SPACING
        )
        .move(-maxLabelWidth - 2 * SPACING, top - SPACING / 2);
    machineLabel.addTo(rowGroup).move(-SPACING, top);
    for (const interval of machine.fragments.inOrder()) {
      const jobFragment: VisualizedJobFragment = interval.data;
      const jobFragmentGroup = g.group().opacity(jobFragment.isWaiting ? 0.5 : 1);
      jobFragmentGroup
          .rect(scalingFactor * (jobFragment.end - jobFragment.start), MACHINE_HEIGHT)
          .fill('none')
          .stroke('black')
          .move(scalingFactor * jobFragment.start, top + jobFragment.layer * MACHINE_HEIGHT);
      jobFragmentGroup
          .plain(`Job ${jobFragment.jobIdx}`)
          .font({anchor: 'middle'})
          .attr({'font-family': null})
          .move(scalingFactor * (jobFragment.end + jobFragment.start) / 2, top + jobFragment.layer * MACHINE_HEIGHT);
    }
    top += MACHINE_HEIGHT * machine.numLayers + SPACING;
  }
  g.line(0, -SPACING, 0, top).addClass('schedule-baseline');
  const finishLine = g
      .line(scalingFactor * visualization.scheduleLength, -SPACING, scalingFactor * visualization.scheduleLength, top)
      .addClass('schedule-finish-line');
  const lengthLabel = g
      .plain(visualization.scheduleLength.toString())
      .font({anchor: 'end'})
      .attr({'font-family': null, 'alignment-baseline': 'hanging'})
      .move(scalingFactor * visualization.scheduleLength, top);
  rowBackgroundsGroup.after(finishLine);

  g.move(0.5 + maxLabelWidth + 2 * SPACING, 0.5 + SPACING);
  draw.size(drawWidth, Math.ceil(top + SPACING + lengthLabel.bbox().height));
}

function showAlert(title: string, message: string, alertKind: 'success' | 'warning'): void {
  feedbackTitle.innerText = title;
  feedbackMsg.innerText = message;
  feedback.classList.remove(...ALERT_KINDS.map((otherAlertKind) => `alert-${otherAlertKind}`));
  feedback.classList.add(`alert-${alertKind}`);
  feedback.classList.toggle('show', true);
}

function hideAlert() {
  feedback.classList.toggle('show', false);
}

async function compute(...args: Parameters<typeof computeSchedule>): Promise<Schedule> {
  if (separateThread.checked) {
    return computeScheduleAsync(...args);
  } else {
    const result = computeSchedule(...args);
    return isSchedulingFailure(result)
        ? Promise.reject(result)
        : Promise.resolve(result);
  }
}

async function computeAndVisualize(): Promise<void> {
  let instance: SchedulingInstance;
  try {
    instance = JSON.parse(instanceInput.value);
  } catch (syntaxError) {
    showAlert('Parsing failed.', `The text field does not contain valid JSON. Problem: ${syntaxError.message}`,
        'warning');
    return;
  }

  let schedule: Schedule | SchedulingFailure;
  try {
    schedule = await compute(instance);
  } catch (error) {
    showAlert('Scheduling failed.',
        `The JSON is probably not a valid scheduling instance. Problem (${error.name}): ${error.message}`, 'warning');
    return;
  }

  if (isSchedulingFailure(schedule)) {
    scheduleOutput.value = '';
    showAlert('Scheduling failed.', schedule, 'warning');
    return;
  }

  scheduleOutput.value = JSON.stringify(schedule, undefined, 2);
  createSvg(svgRoot, computeVisualization(instance, schedule));
  hideAlert();
}

function shareLink(): void {
  const json: string = instanceInput.value;
  window.location.replace(`#${SOURCE_PARAM_NAME}=${encodeURIComponent(instanceInput.value)}`);
  hashFromShareLink = window.location.hash;
  let decodedHash: string | undefined;
  try {
    decodedHash = decodeURIComponent(hashFromShareLink);
  } catch (ignoredUriError) { /* ignored */ }
  let title: string;
  let message: string;
  let alertKind: AlertKind;
  if (decodedHash === undefined || decodedHash.slice(2 + SOURCE_PARAM_NAME.length) !== json) {
    title = 'Sharing failed.';
    message = 'Text buffer too large to share.';
    alertKind = 'warning';
  } else {
    title = 'Sharable URL created.';
    message = 'Shareable link now in address bar.';
    alertKind = 'success';
  }
  showAlert(title, message, alertKind);
}

async function loadFromHash(): Promise<void> {
  // Ignore change of hash (once) if the hash is the one previously set in shareLink().
  if (window.location.hash === hashFromShareLink) {
    hashFromShareLink = '';
    return;
  }

  const urlSearchParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new Map<string, string>(urlSearchParams.entries());
  const encodedJson: string | undefined = queryParams.get(SOURCE_PARAM_NAME);
  if (encodedJson !== undefined) {
    try {
      instanceInput.value = decodeURIComponent(encodedJson);
    } catch (ignoredUriError) {
      showAlert('Invalid URL.', 'Cannot parse the given URL.', 'warning');
      return;
    }
    await computeAndVisualize();
  }
}

// Set up events

document.getElementById('btnRefresh')!.onclick = computeAndVisualize;
document.getElementById('btnShare')!.onclick = shareLink;
document.querySelectorAll('button.close[data-dismiss="alert"]').forEach((element: Element) => {
  const alert: Element | null = element.closest('.alert[role="alert"]');
  const button = element as HTMLButtonElement;
  if (alert !== null) {
    button.onclick = () => {
      alert.classList.toggle('show', false);
    };
  }
});
window.onhashchange = loadFromHash;


// Initialization

loadFromHash().finally();

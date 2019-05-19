// Builders like Parcel substitute the constructor argument if it is a relative path.
import { workerFactory } from './worker-interface';

workerFactory.createWorker = () => new Worker('./worker.ts');

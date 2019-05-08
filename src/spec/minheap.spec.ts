import MinHeap from '../main/minheap';

function nTimes<T>(count: number, value: T) {
  return Array<T>(count).fill(value);
}

const EXTRACT = 'extract';
type Action = number | 'extract';

test.each([
  [[3, 2, 5], nTimes(3, EXTRACT), [2, 3, 5]],
  [[9, 1, 8, 2, 7, 3, 6, 4, 5], nTimes(10, EXTRACT), [1, 2, 3, 4, 5, 6, 7, 8, 9, undefined]],
  [[1, 0, 1], nTimes<Action>(4, EXTRACT).concat(1).concat(EXTRACT).concat(3, 2, 5).concat(nTimes(5, EXTRACT)),
      [0, 1, 1, undefined, 1, 2, 3, 5, undefined, undefined]],
] as [number[], Action[], number[]][])(
    'insert/extractMin sequence #%#',
    (initSequence, actionSequence, extractSeq) => {
      const array: (number | undefined)[] = [];
      const heap = new MinHeap(initSequence, (left, right) => left - right);
      for (const action of actionSequence) {
        if (action === EXTRACT) {
          array.push(heap.extractMin());
        } else {
          heap.add(action);
        }
      }
      expect(array).toEqual(extractSeq);
    }
);

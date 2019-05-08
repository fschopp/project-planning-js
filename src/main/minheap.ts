/**
 * A classical min-heap.
 */

/** API documentation barrier */

/**
 * Comparator function for the min-heap.
 */
export type Comparator<T> = (left: T, right: T) => number;

function parentIdx(idx: number): number {
  return Math.trunc((idx - 1) / 2);
}

function leftChildIdx(idx: number): number {
  return 2 * idx + 1;
}

function rightChildIdx(idx: number): number {
  return 2 * idx + 2;
}

function swap<T>(array: T[], leftIdx: number, rightIdx: number): void {
  const temp = array[leftIdx];
  array[leftIdx] = array[rightIdx];
  array[rightIdx] = temp;
}

function heapify<T>(array: T[], comparatorFn: Comparator<T>, rootIdx: number) {
  // Precondition: indices leftChildIdx(rootIdx) and rightChildIdx(rootIdx) are roots of heaps
  let currentIdx = rootIdx;
  do {
    let minIdx = currentIdx;
    const l = leftChildIdx(currentIdx);
    if (l < array.length && comparatorFn(array[l], array[minIdx]) < 0) {
      minIdx = l;
    }
    const r = rightChildIdx(currentIdx);
    if (r < array.length && comparatorFn(array[r], array[minIdx]) < 0) {
      minIdx = r;
    }
    if (minIdx === currentIdx) {
      break;
    }
    swap(array, currentIdx, minIdx);
    currentIdx = minIdx;
  } while (true);
}

/**
 * A binary min-heap.
 *
 * @typeparam T the type of elements held in this min heap
 */
export default class MinHeap<T> {
  private readonly comparatorFn_: Comparator<T>;
  private readonly array_: T[];

  constructor(iterable: Iterable<T>, comparatorFn: Comparator<T>) {
    this.comparatorFn_ = comparatorFn;
    this.array_ = Array.from(iterable);
    for (let i = Math.trunc(this.array_.length / 2) - 1; i >= 0; --i) {
      heapify(this.array_, this.comparatorFn_, i);
    }
  }

  /**
   * Inserts the given element into this min-heap.
   *
   * The runtime of this operation is O(log n).
   *
   * @param element the element to add
   */
  public add(element: T): void {
    this.array_.push(element);
    let currentIdx = this.array_.length - 1;
    do {
      const p = parentIdx(currentIdx);
      if (currentIdx <= 0 || this.comparatorFn_(this.array_[p], this.array_[currentIdx]) < 0) {
        break;
      }
      swap(this.array_, p, currentIdx);
      currentIdx = p;
    } while (true);
  }

  /**
   * Retrieves and removes the minimum element of this min-heap.
   *
   * The runtime of this operation is O(log n).
   *
   * @return the minimum element or undefined if the min-heap is empty
   */
  public extractMin(): T | undefined {
    if (this.array_.length === 0) {
      return undefined;
    } else if (this.array_.length === 1) {
      return this.array_.pop();
    }

    const min = this.array_[0];
    this.array_[0] = this.array_.pop()!;
    heapify(this.array_, this.comparatorFn_, 0);
    return min;
  }

  /**
   * Returns whether this min-heap is empty.
   */
  public isEmpty(): boolean {
    return this.array_.length === 0;
  }
}

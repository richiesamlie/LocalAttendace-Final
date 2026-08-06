interface WriteTask {
  fn: () => void | Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

const writeQueue: WriteTask[] = [];
let isProcessingWriteQueue = false;

let restoreLockActive = false;

export function acquireRestoreLock(): void {
  restoreLockActive = true;
}
export function releaseRestoreLock(): void {
  restoreLockActive = false;
}

export async function processWriteQueue(): Promise<void> {
  if (isProcessingWriteQueue || writeQueue.length === 0) return;
  isProcessingWriteQueue = true;

  try {
    while (writeQueue.length > 0) {
      if (restoreLockActive) break;
      const task = writeQueue.shift();
      if (!task) continue;
      try {
        await task.fn();
        task.resolve();
      } catch (error) {
        task.reject(error as Error);
      }
    }
  } finally {
    isProcessingWriteQueue = false;
  }
}

export function enqueueWrite(fn: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject });
    processWriteQueue();
  });
}

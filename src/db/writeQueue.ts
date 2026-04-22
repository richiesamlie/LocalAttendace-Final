interface WriteTask {
  fn: () => void | Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

const writeQueue: WriteTask[] = [];
let isProcessingWriteQueue = false;

export async function processWriteQueue(): Promise<void> {
  if (isProcessingWriteQueue || writeQueue.length === 0) return;
  isProcessingWriteQueue = true;

  while (writeQueue.length > 0) {
    const task = writeQueue.shift()!;
    try {
      await task.fn();
      task.resolve();
    } catch (error) {
      task.reject(error as Error);
    }
  }

  isProcessingWriteQueue = false;
}

export function enqueueWrite(fn: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject });
    processWriteQueue();
  });
}
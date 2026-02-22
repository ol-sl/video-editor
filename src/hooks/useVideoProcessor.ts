import { useEffect, useRef } from 'react';
import { wrap, Remote } from 'comlink';
import type { VideoProcessor } from '../workers/videoProcessor.worker';

export function useVideoProcessor() {
  const workerRef = useRef<Worker | null>(null);
  const processorRef = useRef<Remote<VideoProcessor> | null>(null);

  useEffect(() => {
    // Initialize worker
    const worker = new Worker(
      new URL('../workers/videoProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    const processor = wrap<VideoProcessor>(worker);
    
    workerRef.current = worker;
    processorRef.current = processor;

    // Cleanup on unmount
    return () => {
      worker.terminate();
      workerRef.current = null;
      processorRef.current = null;
    };
  }, []);

  return processorRef.current;
}

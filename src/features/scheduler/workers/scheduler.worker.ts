import { generateSchedule } from '../utils/scheduler';
import type { EventConfig, Supplier, Buyer } from '../types';

interface WorkerMessage {
  config: EventConfig;
  suppliers: Supplier[];
  buyers: Buyer[];
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  try {
    const { config, suppliers, buyers } = e.data;
    const result = generateSchedule(config, suppliers, buyers, (current, total) => {
      self.postMessage({ type: 'progress', current, total });
    });
    self.postMessage({ type: 'result', ...result });
  } catch (error) {
    console.error('[Worker] Error during generation:', error);
    self.postMessage({ type: 'error', error: String(error) });
  }
};

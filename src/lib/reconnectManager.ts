import { offlineQueue } from './offlineQueue';

// In a real implementation, you would bind real handlers based on action types 
// (e.g. submitting a bid to Firestore, or updating ride status).
type ActionHandler = (payload: any) => Promise<void>;

class ReconnectManager {
  private handlers = new Map<string, ActionHandler>();
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;
  private maxRetries = 5;

  public registerHandler(type: string, handler: ActionHandler) {
    this.handlers.set(type, handler);
  }

  public async processQueue() {
    if (this.isProcessing) return this.processingPromise;
    this.isProcessing = true;
    
    this.processingPromise = (async () => {
      try {
        const queue = await offlineQueue.getQueue();
        if (queue.length === 0) return;

        // Sort by timestamp so older actions are processed first
        queue.sort((a, b) => a.timestamp - b.timestamp);

        for (const action of queue) {
          // Check TTL
          if (action.ttl && Date.now() > action.timestamp + action.ttl) {
            console.log(`Action ${action.id} expired, removing from queue.`);
            await offlineQueue.remove(action.id);
            continue;
          }

          if (action.retryCount >= this.maxRetries) {
            console.log(`Action ${action.id} exceeded max retries, removing from queue.`);
            await offlineQueue.remove(action.id);
            continue;
          }

          const handler = this.handlers.get(action.type);
          if (!handler) {
            console.warn(`No handler registered for action type: ${action.type}`);
            continue;
          }

          try {
            await handler(action.payload);
            await offlineQueue.remove(action.id);
          } catch (error: any) {
            console.error(`Failed to execute action ${action.id}:`, error);
            await offlineQueue.incrementRetry(action);
            // If it's a permanent error (like permission denied), 
            // you might want to break or remove it immediately depending on your rules.
          }
        }
      } finally {
        this.isProcessing = false;
        this.processingPromise = null;
      }
    })();

    return this.processingPromise;
  }
}

export const reconnectManager = new ReconnectManager();

// Automatically attempt to process queue on window online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    reconnectManager.processQueue();
  });
}

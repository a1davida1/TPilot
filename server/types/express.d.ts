interface PendingOperation {
  cleanup: () => Promise<unknown>;
}

declare global {
  namespace Express {
    interface Request {
      pendingOperations?: PendingOperation[];
    }
  }
}

export {};
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type AsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export class CircuitBreaker<TArgs extends unknown[], TResult> {
  private failures = 0;
  private nextAttempt = 0;

  constructor(
    private readonly fn: AsyncFn<TArgs, TResult>,
    private readonly threshold = 5,
    private readonly timeout = 60_000
  ) {}

  async call(...args: TArgs): Promise<TResult> {
    if (this.failures >= this.threshold) {
      if (Date.now() < this.nextAttempt) {
        throw new AppError('Service temporarily unavailable', 503);
      }
      this.failures = 0;
    }

    try {
      const result = await this.fn(...args);
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.nextAttempt = Date.now() + this.timeout;
      }
      throw error;
    }
  }
}
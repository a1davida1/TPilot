export interface TestInfo {
  title: string;
  annotations: Array<{ type: string; description?: string }>;
  steps: Array<{ title: string; status: 'passed' | 'failed'; durationMs: number; error?: Error }>;
}

export interface TestFixtures {
  request: APIRequestContext;
}

export type TestFunction = (fixtures: TestFixtures, testInfo: TestInfo) => Promise<void> | void;
export type HookFunction = () => Promise<void> | void;

export interface RegisteredTest {
  title: string;
  fn: TestFunction;
  location: string;
  skip: boolean;
  only: boolean;
}

export interface APIResponse {
  ok(): boolean;
  status(): number;
  statusText(): string;
  headers(): Record<string, string>;
  json<T = any>(): Promise<T>;
  text(): Promise<string>;
  body(): Promise<Buffer>;
  url(): string;
}

export interface APIRequestContext {
  get(url: string, options?: RequestOptions): Promise<APIResponse>;
  post(url: string, options?: RequestOptions): Promise<APIResponse>;
  put(url: string, options?: RequestOptions): Promise<APIResponse>;
  delete(url: string, options?: RequestOptions): Promise<APIResponse>;
  patch(url: string, options?: RequestOptions): Promise<APIResponse>;
  head(url: string, options?: RequestOptions): Promise<APIResponse>;
  dispose(): Promise<void>;
}

export interface RequestOptions {
  data?: any;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface Expectation<T> {
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toBeDefined(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toMatch(expected: RegExp | string): void;
  toContain(expected: any): void;
  toHaveLength(expected: number): void;
  not: Expectation<T>;
}

export interface TestCallable {
  (title: string, fn: TestFunction): void;
  skip(title: string, fn: TestFunction): void;
  only(title: string, fn: TestFunction): void;
  describe: TestDescribe;
  beforeAll(fn: HookFunction): void;
  afterAll(fn: HookFunction): void;
  beforeEach(fn: HookFunction): void;
  afterEach(fn: HookFunction): void;
  step<T>(title: string, body: () => Promise<T> | T): Promise<T>;
}

export interface TestDescribe {
  (title: string, callback: () => void): void;
  skip(title: string, callback: () => void): void;
  only(title: string, callback: () => void): void;
  configure(options: unknown): void;
  parallel: TestDescribe;
}

export type PlaywrightStubConfig = {
  testDir: string;
  timeout?: number;
  retries?: number;
  use?: {
    baseURL?: string;
    extraHTTPHeaders?: Record<string, string>;
  };
};

export declare const test: TestCallable;
export declare function expect<T>(actual: T): Expectation<T>;
export declare function createApiRequestContext(options: { baseURL: string; defaultHeaders?: Record<string, string> }): APIRequestContext;
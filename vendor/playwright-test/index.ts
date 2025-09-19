import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { stringify } from 'node:querystring';

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

interface APIRequestContextInterface {
  get(url: string, options?: RequestOptions): Promise<APIResponse>;
  post(url: string, options?: RequestOptions): Promise<APIResponse>;
  put(url: string, options?: RequestOptions): Promise<APIResponse>;
  delete(url: string, options?: RequestOptions): Promise<APIResponse>;
  patch(url: string, options?: RequestOptions): Promise<APIResponse>;
  head(url: string, options?: RequestOptions): Promise<APIResponse>;
  dispose(): Promise<void>;
}

export type APIRequestContext = APIRequestContextInterface;

export interface RequestOptions {
  data?: any;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
}

class APIResponseImpl implements APIResponse {
  constructor(
    private response: http.IncomingMessage,
    private bodyBuffer: Buffer,
    private requestUrl: string
  ) {}

  ok(): boolean {
    return this.response.statusCode != null && this.response.statusCode >= 200 && this.response.statusCode < 300;
  }

  status(): number {
    return this.response.statusCode ?? 0;
  }

  statusText(): string {
    return this.response.statusMessage ?? '';
  }

  headers(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.response.headers)) {
      if (typeof value === 'string') {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.join(', ');
      }
    }
    return result;
  }

  async json<T = any>(): Promise<T> {
    const text = this.bodyBuffer.toString('utf8');
    return JSON.parse(text) as T;
  }

  async text(): Promise<string> {
    return this.bodyBuffer.toString('utf8');
  }

  async body(): Promise<Buffer> {
    return this.bodyBuffer;
  }

  url(): string {
    return this.requestUrl;
  }
}

class APIRequestContextImpl implements APIRequestContextInterface {
  private cookies: string[] = [];

  constructor(
    private baseURL: string,
    private defaultHeaders: Record<string, string> = {}
  ) {}

  async get(url: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.request('GET', url, options);
  }

  async post(url: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.request('POST', url, options);
  }

  async put(url: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.request('PUT', url, options);
  }

  async delete(url: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.request('DELETE', url, options);
  }

  async patch(url: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.request('PATCH', url, options);
  }

  async head(url: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.request('HEAD', url, options);
  }

  async dispose(): Promise<void> {
    this.cookies = [];
  }

  private async request(method: string, url: string, options: RequestOptions): Promise<APIResponse> {
    const fullUrl = new URL(url, this.baseURL);
    
    if (options.params) {
      const queryString = stringify(options.params);
      fullUrl.search = queryString;
    }

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
      'user-agent': 'PlaywrightStub/1.0',
    };

    if (this.cookies.length > 0) {
      headers.cookie = this.cookies.join('; ');
    }

    let body: string | undefined;
    if (options.data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (typeof options.data === 'string') {
        body = options.data;
        if (!headers['content-type']) {
          headers['content-type'] = 'text/plain';
        }
      } else {
        body = JSON.stringify(options.data);
        headers['content-type'] = 'application/json';
      }
      headers['content-length'] = Buffer.byteLength(body, 'utf8').toString();
    }

    const requestOptions: http.RequestOptions = {
      method,
      headers,
      timeout: options.timeout ?? 30000,
    };

    const clientModule = fullUrl.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
      const req = clientModule.request(fullUrl, requestOptions, (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks);
          
          if (res.headers['set-cookie']) {
            for (const cookie of res.headers['set-cookie']) {
              const [cookieValue] = cookie.split(';');
              if (cookieValue) {
                this.cookies.push(cookieValue);
              }
            }
          }
          
          resolve(new APIResponseImpl(res, responseBody, fullUrl.toString()));
        });
        
        res.on('error', reject);
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${requestOptions.timeout}ms`));
      });
      
      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }
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

class ExpectationImpl<T> implements Expectation<T> {
  constructor(private actual: T, private negated = false) {}

  get not(): Expectation<T> {
    return new ExpectationImpl(this.actual, !this.negated);
  }

  toBe(expected: T): void {
    const passed = Object.is(this.actual, expected);
    this.assert(passed, `Expected ${String(this.actual)} to be ${String(expected)}`);
  }

  toEqual(expected: T): void {
    const passed = JSON.stringify(this.actual) === JSON.stringify(expected);
    this.assert(passed, `Expected ${String(this.actual)} to equal ${String(expected)}`);
  }

  toBeDefined(): void {
    const passed = this.actual !== undefined;
    this.assert(passed, `Expected ${String(this.actual)} to be defined`);
  }

  toBeNull(): void {
    const passed = this.actual === null;
    this.assert(passed, `Expected ${String(this.actual)} to be null`);
  }

  toBeUndefined(): void {
    const passed = this.actual === undefined;
    this.assert(passed, `Expected ${String(this.actual)} to be undefined`);
  }

  toBeTruthy(): void {
    const passed = Boolean(this.actual);
    this.assert(passed, `Expected ${String(this.actual)} to be truthy`);
  }

  toBeFalsy(): void {
    const passed = !this.actual;
    this.assert(passed, `Expected ${String(this.actual)} to be falsy`);
  }

  toBeGreaterThan(expected: number): void {
    const passed = (this.actual as unknown as number) > expected;
    this.assert(passed, `Expected ${String(this.actual)} to be greater than ${expected}`);
  }

  toBeGreaterThanOrEqual(expected: number): void {
    const passed = (this.actual as unknown as number) >= expected;
    this.assert(passed, `Expected ${String(this.actual)} to be greater than or equal to ${expected}`);
  }

  toBeLessThan(expected: number): void {
    const passed = (this.actual as unknown as number) < expected;
    this.assert(passed, `Expected ${String(this.actual)} to be less than ${expected}`);
  }

  toBeLessThanOrEqual(expected: number): void {
    const passed = (this.actual as unknown as number) <= expected;
    this.assert(passed, `Expected ${String(this.actual)} to be less than or equal to ${expected}`);
  }

  toMatch(expected: RegExp | string): void {
    const pattern = typeof expected === 'string' ? new RegExp(expected) : expected;
    const passed = pattern.test(String(this.actual));
    this.assert(passed, `Expected ${String(this.actual)} to match ${pattern}`);
  }

  toContain(expected: any): void {
    const actualArray = this.actual as unknown as ArrayLike<any>;
    let passed = false;
    if (typeof this.actual === 'string') {
      passed = this.actual.includes(expected);
    } else if (Array.isArray(this.actual)) {
      passed = this.actual.includes(expected);
    } else if (actualArray && typeof actualArray.length === 'number') {
      for (let i = 0; i < actualArray.length; i++) {
        if (actualArray[i] === expected) {
          passed = true;
          break;
        }
      }
    }
    this.assert(passed, `Expected ${String(this.actual)} to contain ${String(expected)}`);
  }

  toHaveLength(expected: number): void {
    const actualLength = (this.actual as unknown as { length: number }).length;
    const passed = actualLength === expected;
    this.assert(passed, `Expected ${String(this.actual)} to have length ${expected}, but got ${actualLength}`);
  }

  private assert(passed: boolean, message: string): void {
    const shouldPass = this.negated ? !passed : passed;
    if (!shouldPass) {
      const finalMessage = this.negated ? message.replace('to be', 'not to be').replace('to equal', 'not to equal').replace('to match', 'not to match').replace('to contain', 'not to contain').replace('to have', 'not to have') : message;
      throw new Error(finalMessage);
    }
  }
}

class TestRegistry {
  readonly tests: RegisteredTest[] = [];
  readonly describeStack: string[] = [];
  readonly beforeAll: HookFunction[] = [];
  readonly afterAll: HookFunction[] = [];
  readonly beforeEach: HookFunction[] = [];
  readonly afterEach: HookFunction[] = [];
  currentFile: string | null = null;
  currentTestInfo: TestInfo | null = null;
  hasOnly: boolean = false;

  register(title: string, fn: TestFunction, options?: { skip?: boolean; only?: boolean }): void {
    const scopeTitle = [...this.describeStack, title].join(' › ');
    const skip = options?.skip ?? false;
    const only = options?.only ?? false;
    if (only) {
      this.hasOnly = true;
    }
    this.tests.push({
      title: scopeTitle,
      fn,
      location: this.currentFile ?? 'unknown',
      skip,
      only,
    });
  }

  describe(title: string, callback: () => void): void {
    this.describeStack.push(title);
    try {
      callback();
    } finally {
      this.describeStack.pop();
    }
  }

  skipDescribe(callback: () => void): void {
    const previous = [...this.describeStack];
    callback();
    this.describeStack.length = 0;
    this.describeStack.push(...previous);
  }

  recordStep<T>(title: string, body: () => Promise<T> | T): Promise<T> {
    const info = this.currentTestInfo;
    if (!info) {
      return Promise.resolve(body());
    }
    const start = Date.now();
    const run = async (): Promise<T> => body();
    return run()
      .then(result => {
        info.steps.push({ title, status: 'passed', durationMs: Date.now() - start });
        return result;
      })
      .catch(error => {
        const err = error instanceof Error ? error : new Error(String(error));
        info.steps.push({ title, status: 'failed', durationMs: Date.now() - start, error: err });
        throw err;
      });
  }

  setCurrentFile(file: string | null): void {
    this.currentFile = file;
  }

  setCurrentTestInfo(info: TestInfo | null): void {
    this.currentTestInfo = info;
  }
}

const registrySymbol = Symbol.for('tpilot.playwright.registry');

function getRegistry(): TestRegistry {
  const globalObject = globalThis as typeof globalThis & { [registrySymbol]?: TestRegistry };
  if (!globalObject[registrySymbol]) {
    globalObject[registrySymbol] = new TestRegistry();
  }
  return globalObject[registrySymbol] as TestRegistry;
}

export function resetTests(): void {
  const globalObject = globalThis as typeof globalThis & { [registrySymbol]?: TestRegistry };
  globalObject[registrySymbol] = new TestRegistry();
}

export function setCurrentTestFile(file: string | null): void {
  getRegistry().setCurrentFile(file);
}

export function getRegisteredTests(): RegisteredTest[] {
  return getRegistry().tests;
}

export function getBeforeAllHooks(): HookFunction[] {
  return getRegistry().beforeAll;
}

export function getAfterAllHooks(): HookFunction[] {
  return getRegistry().afterAll;
}

export function getBeforeEachHooks(): HookFunction[] {
  return getRegistry().beforeEach;
}

export function getAfterEachHooks(): HookFunction[] {
  return getRegistry().afterEach;
}

export function hasOnlyTests(): boolean {
  return getRegistry().hasOnly;
}

export function createApiRequestContext(options: { baseURL: string; defaultHeaders?: Record<string, string> }): APIRequestContext {
  return new APIRequestContextImpl(options.baseURL, options.defaultHeaders);
}

export function setCurrentTestInfo(info: TestInfo | null): void {
  getRegistry().setCurrentTestInfo(info);
}

interface TestCallable {
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

interface TestDescribe {
  (title: string, callback: () => void): void;
  skip(title: string, callback: () => void): void;
  only(title: string, callback: () => void): void;
  configure(_options: unknown): void;
  parallel: TestDescribe;
}

const baseTest = ((title: string, fn: TestFunction) => {
  getRegistry().register(title, fn);
}) as TestCallable;

baseTest.skip = (title: string, fn: TestFunction) => {
  getRegistry().register(title, fn, { skip: true });
};

baseTest.only = (title: string, fn: TestFunction) => {
  getRegistry().register(title, fn, { only: true });
};

const describeImpl = ((title: string, callback: () => void) => {
  getRegistry().describe(title, callback);
}) as TestDescribe;

describeImpl.skip = (_title: string, _callback: () => void) => {
  // Intentionally no-op to skip enclosed tests
};

describeImpl.only = (title: string, callback: () => void) => {
  getRegistry().describe(title, callback);
  // Mark every test inside as only by wrapping register
  const registry = getRegistry();
  registry.hasOnly = true;
};

describeImpl.configure = () => {
  // configuration is not required for stub implementation
};

describeImpl.parallel = describeImpl;

baseTest.describe = describeImpl;

baseTest.beforeAll = (fn: HookFunction) => {
  getRegistry().beforeAll.push(fn);
};

baseTest.afterAll = (fn: HookFunction) => {
  getRegistry().afterAll.push(fn);
};

baseTest.beforeEach = (fn: HookFunction) => {
  getRegistry().beforeEach.push(fn);
};

baseTest.afterEach = (fn: HookFunction) => {
  getRegistry().afterEach.push(fn);
};

baseTest.step = <T>(title: string, body: () => Promise<T> | T): Promise<T> => {
  return getRegistry().recordStep(title, body);
};

export const test: TestCallable = baseTest;

export function expect<T>(actual: T): Expectation<T> {
  return new ExpectationImpl(actual);
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


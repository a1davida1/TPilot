import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  createApiRequestContext,
  getAfterAllHooks,
  getAfterEachHooks,
  getBeforeAllHooks,
  getBeforeEachHooks,
  getRegisteredTests,
  hasOnlyTests,
  resetTests,
  setCurrentTestFile,
  setCurrentTestInfo,
  type HookFunction,
  type PlaywrightStubConfig,
  type TestInfo,
} from './index.js';

interface RunnerConfig extends PlaywrightStubConfig {
  testDir: string;
}

async function loadConfig(): Promise<RunnerConfig> {
  const configPathTs = path.resolve('playwright.config.ts');
  const configPathJs = path.resolve('playwright.config.js');
  const targetPath = await fileExists(configPathTs) ? configPathTs : configPathJs;
  if (!(await fileExists(targetPath))) {
    throw new Error('playwright.config.ts or playwright.config.js not found');
  }
  const module = await import(pathToFileURL(targetPath).href);
  const loaded: PlaywrightStubConfig = (module.default ?? module) as PlaywrightStubConfig;
  if (!loaded.testDir) {
    throw new Error('playwright config must specify testDir');
  }
  return {
    testDir: loaded.testDir,
    timeout: loaded.timeout,
    retries: loaded.retries,
    use: loaded.use,
  };
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    return false;
  }
}

async function discoverTests(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await discoverTests(fullPath);
      files.push(...nested);
      continue;
    }
    if (entry.isFile() && /(\.spec\.(ts|tsx|js))$/u.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function runHooks(hooks: HookFunction[]): Promise<void> {
  for (const hook of hooks) {
    await hook();
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function main(): Promise<void> {
  const config = await loadConfig();
  const testDirectory = path.resolve(config.testDir);
  const files = await discoverTests(testDirectory);
  if (files.length === 0) {
    console.warn(`No test files found in ${testDirectory}`);
    return;
  }

  resetTests();
  for (const file of files) {
    setCurrentTestFile(file);
    await import(pathToFileURL(file).href);
  }
  setCurrentTestFile(null);

  const allTests = getRegisteredTests();
  const testsToRun = hasOnlyTests() ? allTests.filter(t => t.only) : allTests.filter(t => !t.skip);

  if (testsToRun.length === 0) {
    console.warn('No tests to run after applying skip/only filters');
    return;
  }

  const beforeAllHooks = getBeforeAllHooks();
  const afterAllHooks = getAfterAllHooks();
  const beforeEachHooks = getBeforeEachHooks();
  const afterEachHooks = getAfterEachHooks();

  await runHooks(beforeAllHooks);

  let failures = 0;
  const retries = config.retries ?? 0;
  const baseURL = config.use?.baseURL ?? process.env.E2E_BASE_URL ?? 'http://localhost:5000';
  const extraHeaders = config.use?.extraHTTPHeaders ?? {};

  for (const testCase of testsToRun) {
    const attempts = retries + 1;
    let attempt = 0;
    let passed = false;

    while (attempt < attempts && !passed) {
      attempt += 1;
      const context = createApiRequestContext({ baseURL, defaultHeaders: extraHeaders });
      const info: TestInfo = { title: testCase.title, annotations: [], steps: [] };
      setCurrentTestInfo(info);

      try {
        await runHooks(beforeEachHooks);
        const execution = testCase.fn({ request: context }, info);
        await withTimeout(Promise.resolve(execution), config.timeout);
        await runHooks(afterEachHooks);
        passed = true;
        console.error(`✓ ${testCase.title}`);
      } catch (error) {
        await runHooks(afterEachHooks);
        if (attempt >= attempts) {
          failures += 1;
          console.error(`✗ ${testCase.title}`);
          console.error(error instanceof Error ? error : new Error(String(error)));
        } else {
          console.warn(`Retrying ${testCase.title} (${attempt}/${attempts})`);
          await delay(1000);
        }
      } finally {
        setCurrentTestInfo(null);
        await context.dispose();
      }
    }
  }

  await runHooks(afterAllHooks);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main().catch(error => {
  console.error('E2E runner failed:', error);
  process.exitCode = 1;
});
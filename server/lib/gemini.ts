import type { LegacyGoogleGenAI, GeminiModel } from "./gemini-client";
import {
  getGoogleGenerativeAI,
  getTextModel as loadTextModel,
  getVisionModel as loadVisionModel,
  isGeminiAvailable
} from "./gemini-client";

const createLazyProxy = <T extends object>(factory: () => T): T =>
  new Proxy({} as T, {
    get(_target, property, receiver) {
      const instance = factory();
      const value = Reflect.get(instance as object, property, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(instance);
      }
      return value;
    },
    has(_target, property) {
      const instance = factory();
      return Reflect.has(instance as object, property);
    },
    ownKeys() {
      const instance = factory();
      return Reflect.ownKeys(instance as object);
    },
    getOwnPropertyDescriptor(_target, property) {
      const instance = factory();
      const descriptor = Object.getOwnPropertyDescriptor(instance as object, property);
      if (descriptor) {
        descriptor.configurable = true;
      }
      return descriptor;
    }
  });

const genAI: LegacyGoogleGenAI | null = isGeminiAvailable()
  ? createLazyProxy<LegacyGoogleGenAI>(getGoogleGenerativeAI)
  : null;

const visionModel: GeminiModel | null = isGeminiAvailable()
  ? createLazyProxy<GeminiModel>(loadVisionModel)
  : null;

const textModel: GeminiModel | null = isGeminiAvailable()
  ? createLazyProxy<GeminiModel>(loadTextModel)
  : null;

export {
  genAI,
  visionModel,
  textModel,
  isGeminiAvailable,
  getGoogleGenerativeAI,
  loadVisionModel as getVisionModel,
  loadTextModel as getTextModel
};

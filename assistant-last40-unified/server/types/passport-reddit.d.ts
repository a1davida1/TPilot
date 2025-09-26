declare module 'passport-reddit' {
  import { Strategy as OAuth2Strategy } from 'passport-oauth2';

  export interface Profile {
    id: string;
    name?: string;
    icon_img?: string;
    _json: {
      icon_img?: string;
      name?: string;
      [key: string]: unknown;
    };
    provider: string;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[] | string;
    state?: boolean;
    store?: unknown;
    userProfileURL?: string;
  }

  export type VerifyCallback = (error: Error | null, user?: unknown, info?: unknown) => void;
  export type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;

  export class Strategy extends OAuth2Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
  }
}
declare module 'passport-reddit' {
  import { Strategy as OAuth2Strategy } from 'passport-oauth2';
  
  export interface Profile {
    id: string;
    name?: string;
    _json: Record<string, unknown>;
    provider: string;
  }
  
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  }
  
  export type VerifyCallback = (error: Error | null, user?: unknown, info?: unknown) => void;
  export type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;
  
  export class Strategy extends OAuth2Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
  }
}
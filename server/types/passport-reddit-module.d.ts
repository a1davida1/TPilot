declare module 'passport-reddit/lib/passport-reddit/index.js' {
  import { Strategy as PassportStrategy } from 'passport';
  
  interface RedditProfile {
    provider: string;
    id: string;
    username?: string;
    displayName?: string;
    emails?: Array<{ value: string; verified?: boolean }>;
    photos?: Array<{ value: string }>;
    _raw: string;
    _json: Record<string, unknown>;
  }
  
  interface RedditStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    state?: boolean;
  }
  
  type VerifyCallback = (error: unknown, user?: unknown, info?: unknown) => void;
  
  type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: RedditProfile,
    done: VerifyCallback
  ) => void;
  
  export class Strategy extends PassportStrategy {
    constructor(options: RedditStrategyOptions, verify: VerifyFunction);
    name: string;
  }
  
  export default Strategy;
}
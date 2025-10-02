declare module 'passport-reddit' {
  import type { Request } from 'express';
  import type { Strategy as OAuth2Strategy } from 'passport-oauth2';

  export interface RedditProfileJson extends Record<string, unknown> {
    icon_img?: string;
  }

  export interface Profile {
    id: string;
    name?: string;
    provider: string;
    _json: RedditProfileJson;
  }

  export interface RedditProfile extends Profile {
    icon_img?: string;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    state?: string | boolean;
  }

  export interface StrategyOptionsWithRequest extends StrategyOptions {
    passReqToCallback: true;
  }

  export type VerifyCallback = (error: Error | null, user?: unknown, info?: unknown) => void;

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: RedditProfile,
    done: VerifyCallback,
  ) => void | Promise<void>;

  export type VerifyFunctionWithRequest = (
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: RedditProfile,
    done: VerifyCallback,
  ) => void | Promise<void>;

  export class Strategy extends OAuth2Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    constructor(options: StrategyOptionsWithRequest, verify: VerifyFunctionWithRequest);
  }
}

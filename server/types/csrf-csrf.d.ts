declare module 'csrf-csrf' {
  import type { Request, Response, NextFunction, CookieOptions } from 'express';

  export interface DoubleCsrfConfig {
    getSecret: () => string;
    getSessionIdentifier: (req: Request) => string;
    cookieName?: string;
    cookieOptions?: CookieOptions;
    size?: number;
    ignoredMethods?: string[];
    getTokenFromRequest?: (req: Request) => string | null | undefined;
  }

  export interface DoubleCsrfProtection {
    (req: Request, res: Response, next: NextFunction): void;
  }

  export interface DoubleCsrfUtilities {
    doubleCsrfProtection: DoubleCsrfProtection;
    generateCsrfToken: (req: Request, res: Response) => string;
  }

  export function doubleCsrf(config: DoubleCsrfConfig): DoubleCsrfUtilities;
}

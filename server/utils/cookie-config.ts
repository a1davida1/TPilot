import type { Response } from "express";
import type { CookieOptions } from "express-serve-static-core";

export const getCookieConfig = () => {
  const isProd = process.env.NODE_ENV === "production";
  const domain = process.env.SESSION_COOKIE_DOMAIN;
  const sessionName = process.env.SESSION_COOKIE_NAME || "tpilot.sid";

  const options: CookieOptions = {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    ...(domain ? { domain } : {}),
  };

  const clear = (res: Response, name = sessionName, opts: CookieOptions = options) => {
    // do NOT include maxAge/expires when clearing
    res.clearCookie(name, opts);
  };

  return { sessionName, authName: "authToken", options, clear };
};
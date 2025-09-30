import type { RequestHandler } from 'express';

const PERMISSIONS_POLICY_DIRECTIVES: ReadonlyArray<string> = [
  'accelerometer=()',
  'ambient-light-sensor=()',
  'autoplay=()',
  'battery=()',
  'camera=()',
  'display-capture=()',
  'document-domain=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'interest-cohort=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'serial=()',
  'sync-xhr=()',
  'usb=()',
  'xr-spatial-tracking=()',
];

const HEADER_NAME = 'Permissions-Policy';

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  if (!res.getHeader(HEADER_NAME)) {
    res.setHeader(HEADER_NAME, PERMISSIONS_POLICY_DIRECTIVES.join(', '));
  }

  next();
};

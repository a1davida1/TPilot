import type { RequestHandler } from 'express';

// Only include widely supported directives to avoid browser warnings
// Removed: ambient-light-sensor, battery, document-domain (not recognized by most browsers)
const PERMISSIONS_POLICY_DIRECTIVES: ReadonlyArray<string> = [
  'geolocation=()',
  'camera=()',
  'microphone=()',
  'accelerometer=()',
  'autoplay=()',
  'gyroscope=()',
  'magnetometer=()',
  'midi=()',
  'usb=()',
  'fullscreen=(self)',
];

const HEADER_NAME = 'Permissions-Policy';

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  if (!res.getHeader(HEADER_NAME)) {
    res.setHeader(HEADER_NAME, PERMISSIONS_POLICY_DIRECTIVES.join(', '));
  }

  next();
};

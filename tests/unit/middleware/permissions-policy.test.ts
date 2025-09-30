import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { permissionsPolicy } from '../../../server/middleware/permissions-policy.js';

const routePath = '/health-check';

describe('permissionsPolicy middleware', () => {
  it('applies a restrictive Permissions-Policy header to responses', async () => {
    const app = express();
    app.use(permissionsPolicy);
    app.get(routePath, (_req, res) => {
      res.status(200).send('ok');
    });

    const response = await request(app).get(routePath);

    expect(response.headers['permissions-policy']).toBe(
      [
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
        'xr-spatial-tracking=()'
      ].join(', ')
    );
  });

  it('does not overwrite an existing Permissions-Policy header', async () => {
    const app = express();
    const customValue = 'geolocation="self"';

    app.use((_req, res, next) => {
      res.setHeader('Permissions-Policy', customValue);
      next();
    });

    app.use(permissionsPolicy);

    app.get(routePath, (_req, res) => {
      res.status(200).send('ok');
    });

    const response = await request(app).get(routePath);

    expect(response.headers['permissions-policy']).toBe(customValue);
  });
});

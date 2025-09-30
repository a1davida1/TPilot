import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
};

const base = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const health = http.get(`${base}/api/health`);
  check(health, {
    'health 200': (r) => r.status === 200,
  });
  const csrf = http.get(`${base}/api/csrf-token`);
  check(csrf, { 'csrf 200': (r) => r.status === 200 });
  sleep(1);
}

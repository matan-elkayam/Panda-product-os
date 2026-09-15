import { describe, expect, it } from 'vitest';
import { GET as live } from './live/route';
import { GET as ready } from './ready/route';

describe('health endpoints', () => {
  it('reports the web process as live', async () => {
    const response = live();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'panda-web',
      check: 'live',
    });
  });

  it('reports the web process as ready', async () => {
    const response = ready();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'panda-web',
      check: 'ready',
    });
  });
});

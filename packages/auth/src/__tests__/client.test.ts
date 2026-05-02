import { describe, expect, it } from 'vitest';

import {
  authClientPlugins,
  createAuthClient,
  twoFactorClient,
} from '../client.js';

describe('@mr/auth/client exports', () => {
  it('re-exports createAuthClient from better-auth/react', () => {
    expect(typeof createAuthClient).toBe('function');
  });

  it('re-exports twoFactorClient from better-auth/client/plugins', () => {
    expect(typeof twoFactorClient).toBe('function');
  });

  it('exports authClientPlugins as a non-empty array', () => {
    expect(Array.isArray(authClientPlugins)).toBe(true);
    expect(authClientPlugins.length).toBeGreaterThan(0);
  });

  it('authClientPlugins contains a plugin object with an id field', () => {
    const plugin = authClientPlugins[0];

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
    expect(plugin).toHaveProperty('id');
  });
});

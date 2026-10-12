import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The store is the only thing `getPostcode` touches, so stub it and assert on
 * the call. This keeps the test offline and focused on the format guard.
 */
const { storeGetPostcode } = vi.hoisted(() => ({ storeGetPostcode: vi.fn() }));

vi.mock('../atlas/store', () => ({
  atlasStore: { getPostcode: storeGetPostcode },
}));

import { getPostcode } from './executors';

describe('getPostcode format guard', () => {
  beforeEach(() => {
    storeGetPostcode.mockReset();
    storeGetPostcode.mockResolvedValue(null);
  });

  it('rejects a malformed code before touching the store', async () => {
    await expect(getPostcode({ code: 'NG-01-001-001-001-001' })).rejects.toMatchObject({
      name: 'ToolFault',
      code: 'invalid_args',
    });
    expect(storeGetPostcode).not.toHaveBeenCalled();
  });

  it('passes a well-formed code through to the store', async () => {
    await getPostcode({ code: 'FC-02-D43-LG-01' });
    expect(storeGetPostcode).toHaveBeenCalledWith('FC-02-D43-LG-01');
  });

  it('accepts the compact 11-character form', async () => {
    await getPostcode({ code: 'FC02D43LG01' });
    expect(storeGetPostcode).toHaveBeenCalledWith('FC-02-D43-LG-01');
  });

  it('returns null for a well-formed code with no record', async () => {
    await expect(getPostcode({ code: 'FC-02-D43-LG-01' })).resolves.toBeNull();
    expect(storeGetPostcode).toHaveBeenCalledOnce();
  });
});

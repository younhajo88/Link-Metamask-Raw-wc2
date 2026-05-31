import { appVersion } from './version';

describe('appVersion', () => {
  it('exposes build metadata for the footer', () => {
    expect(appVersion.version).toBe('0.1.0');
    expect(appVersion.commit).not.toBe('');
    expect(Number.isNaN(Date.parse(appVersion.buildTime))).toBe(false);
  });
});

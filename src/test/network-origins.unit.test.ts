import { describe, it, expect } from 'vitest';
import { resolveAllowedOrigins, isSameHostNetworkOrigin } from '../lib/networkOrigins';

describe('Socket.IO LAN network origin helpers', () => {
  const sampleInterfaces = {
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4' as const,
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8',
      },
    ],
    'Wi-Fi': [
      {
        address: '192.168.1.50',
        netmask: '255.255.255.0',
        family: 'IPv4' as const,
        mac: 'aa:bb:cc:dd:ee:ff',
        internal: false,
        cidr: '192.168.1.50/24',
      },
      {
        address: 'fe80::1',
        netmask: 'ffff:ffff:ffff:ffff::',
        family: 'IPv6' as const,
        mac: 'aa:bb:cc:dd:ee:ff',
        internal: false,
        cidr: 'fe80::1/64',
        scopeid: 1,
      },
    ],
  };

  it('defaults to localhost origins in local mode', () => {
    expect(
      resolveAllowedOrigins({ isNetworkMode: false, interfaces: sampleInterfaces }),
    ).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('adds external IPv4 LAN origins automatically in --network mode', () => {
    expect(
      resolveAllowedOrigins({ isNetworkMode: true, port: 3000, interfaces: sampleInterfaces }),
    ).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.1.50:3000',
    ]);
  });

  it('respects explicit ALLOWED_ORIGINS override even in --network mode', () => {
    expect(
      resolveAllowedOrigins({
        allowedOriginsEnv: 'https://school.example.com, http://10.0.0.5:3000 ',
        isNetworkMode: true,
        interfaces: sampleInterfaces,
      }),
    ).toEqual(['https://school.example.com', 'http://10.0.0.5:3000']);
  });

  it('allows same-host origins only in --network mode without ALLOWED_ORIGINS override', () => {
    expect(
      isSameHostNetworkOrigin('http://192.168.1.50:3000', '192.168.1.50:3000', {
        isNetworkMode: true,
      }),
    ).toBe(true);

    expect(
      isSameHostNetworkOrigin('https://evil.com', '192.168.1.50:3000', {
        isNetworkMode: true,
      }),
    ).toBe(false);

    expect(
      isSameHostNetworkOrigin('http://192.168.1.50:3000', '192.168.1.50:3000', {
        isNetworkMode: false,
      }),
    ).toBe(false);

    expect(
      isSameHostNetworkOrigin('http://192.168.1.50:3000', '192.168.1.50:3000', {
        allowedOriginsEnv: 'http://localhost:3000',
        isNetworkMode: true,
      }),
    ).toBe(false);
  });
});

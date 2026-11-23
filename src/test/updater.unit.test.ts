import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  compareSemver,
  isAllowedUpdateHost,
  isLoopbackAddress,
} from '../lib/updater';

interface UpdateManifestHelpers {
  sha256File: (filePath: string) => string;
  computeRuntimeHash: (releaseDir: string) => string;
  jwkToDotNetRsaPublicKeyXml: (publicKeyInput: crypto.KeyObject | string) => string;
  dotNetRsaXmlToPem: (xml: string) => string;
  signBufferRsaSha256: (buffer: Buffer, privateKeyPem: string) => string;
  verifyBufferRsaSha256: (buffer: Buffer, signatureBase64: string, publicKeyPem: string) => boolean;
}

async function loadManifestHelpers(): Promise<UpdateManifestHelpers> {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'update-manifest.mjs');
  const mod = await import(pathToFileURL(scriptPath).href);
  return mod as UpdateManifestHelpers;
}

describe('Updater core helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('compares semver strings accurately across v-prefixes and build metadata', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1);
    expect(compareSemver('v1.2.0', '1.1.9')).toBe(1);
    expect(compareSemver('2.0.0', 'v1.99.99')).toBe(1);
    expect(compareSemver('v1.0.1', '1.0.1')).toBe(0);
    expect(compareSemver('1.0.1-rc.1+build4', '1.0.1')).toBe(0);
    expect(compareSemver('1.0.1', '1.0.2')).toBe(-1);
    expect(compareSemver('1.9.0', '1.10.0')).toBe(-1);
  });

  it('recognizes loopback addresses exclusively', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.50')).toBe(false);
    expect(isLoopbackAddress('10.0.0.1')).toBe(false);
    expect(isLoopbackAddress('::ffff:192.168.1.50')).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
    expect(isLoopbackAddress('')).toBe(false);
  });

  it('restricts update URLs to allowlisted GitHub HTTPS hosts', () => {
    expect(isAllowedUpdateHost('https://github.com/richiesamlie/LocalAttendace-Final/releases/latest/download/update-manifest.json')).toBe(true);
    expect(isAllowedUpdateHost('https://api.github.com/repos/richiesamlie/LocalAttendace-Final/releases/latest')).toBe(true);
    expect(isAllowedUpdateHost('https://objects.githubusercontent.com/github-production-release-asset/123')).toBe(true);
    expect(isAllowedUpdateHost('https://release-assets.githubusercontent.com/foo.zip')).toBe(true);

    expect(isAllowedUpdateHost('http://github.com/richiesamlie/LocalAttendace-Final')).toBe(false);
    expect(isAllowedUpdateHost('https://evil.example.com/update-manifest.json')).toBe(false);
    expect(isAllowedUpdateHost('https://github.com.evil.com/manifest.json')).toBe(false);
    expect(isAllowedUpdateHost('http://127.0.0.1:3000/manifest.json')).toBe(false);
    expect(isAllowedUpdateHost('not-a-url')).toBe(false);
  });

  it('computes deterministic runtimeHash covering runtime binaries and ignoring app dist files', async () => {
    const { computeRuntimeHash } = await loadManifestHelpers();
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-rthash-a-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-rthash-b-'));
    tempDirs.push(dirA, dirB);

    for (const dir of [dirA, dirB]) {
      fs.mkdirSync(path.join(dir, 'node'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'node_modules', 'better-sqlite3', 'build'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node', 'node.exe'), 'node-binary-v22');
      fs.writeFileSync(path.join(dir, 'TeacherAssistant.exe'), 'tray-binary-v1');
      fs.writeFileSync(path.join(dir, 'node_modules', 'better-sqlite3', 'build', 'native.node'), 'sqlite-addon-v1');
    }

    fs.writeFileSync(path.join(dirA, 'dist', 'index.html'), '<h1>Build A</h1>');
    fs.writeFileSync(path.join(dirB, 'dist', 'index.html'), '<h1>Build B changed UI</h1>');

    const hashA = computeRuntimeHash(dirA);
    const hashB = computeRuntimeHash(dirB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).toBe(hashB);

    // Changing node_modules or node.exe MUST change runtimeHash
    fs.writeFileSync(path.join(dirB, 'node_modules', 'better-sqlite3', 'build', 'native.node'), 'sqlite-addon-v2');
    const hashBModified = computeRuntimeHash(dirB);
    expect(hashBModified).not.toBe(hashA);
  });

  it('signs and verifies RSA-2048 SHA-256 payloads across PEM and .NET XML public key format', async () => {
    const {
      jwkToDotNetRsaPublicKeyXml,
      dotNetRsaXmlToPem,
      signBufferRsaSha256,
      verifyBufferRsaSha256,
    } = await loadManifestHelpers();

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const xml = jwkToDotNetRsaPublicKeyXml(publicKey);

    expect(xml).toMatch(/^<RSAKeyValue><Modulus>[A-Za-z0-9+/=]+<\/Modulus><Exponent>[A-Za-z0-9+/=]+<\/Exponent><\/RSAKeyValue>$/);

    const roundtripPem = dotNetRsaXmlToPem(xml);
    const payload = Buffer.from(JSON.stringify({ version: '1.2.0', schemaVersion: 1 }), 'utf8');
    const signature = signBufferRsaSha256(payload, privatePem);

    expect(verifyBufferRsaSha256(payload, signature, roundtripPem)).toBe(true);

    const tamperedPayload = Buffer.from(JSON.stringify({ version: '1.2.1', schemaVersion: 1 }), 'utf8');
    expect(verifyBufferRsaSha256(tamperedPayload, signature, roundtripPem)).toBe(false);
  });
});

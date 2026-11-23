import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO = 'richiesamlie/LocalAttendace-Final';

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex').toLowerCase();
}

function collectFilesRecursively(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) return files;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursively(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export function computeRuntimeHash(releaseDir) {
  const resolvedRoot = path.resolve(releaseDir);
  const hash = crypto.createHash('sha256');
  const entries = [];

  const nodeExePath = path.join(resolvedRoot, 'node', 'node.exe');
  if (fs.existsSync(nodeExePath) && fs.statSync(nodeExePath).isFile()) {
    entries.push('node/node.exe');
  }

  const trayExePath = path.join(resolvedRoot, 'TeacherAssistant.exe');
  if (fs.existsSync(trayExePath) && fs.statSync(trayExePath).isFile()) {
    entries.push('TeacherAssistant.exe');
  }

  const nodeModulesDir = path.join(resolvedRoot, 'node_modules');
  const moduleFiles = collectFilesRecursively(nodeModulesDir)
    .map((absPath) => path.relative(resolvedRoot, absPath).split(path.sep).join('/'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const rel of moduleFiles) {
    entries.push(rel);
  }

  for (const relPath of entries) {
    const absPath = path.join(resolvedRoot, ...relPath.split('/'));
    const fileSha = sha256File(absPath);
    hash.update(`${relPath}\0${fileSha}\n`, 'utf8');
  }

  return hash.digest('hex').toLowerCase();
}

export function jwkToDotNetRsaPublicKeyXml(publicKeyInput) {
  const keyObj = publicKeyInput instanceof crypto.KeyObject
    ? (publicKeyInput.type === 'public' ? publicKeyInput : crypto.createPublicKey(publicKeyInput))
    : crypto.createPublicKey(publicKeyInput);
  const jwk = keyObj.export({ format: 'jwk' });
  if (!jwk || jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error('Expected an RSA public key');
  }
  const modulus = Buffer.from(jwk.n, 'base64url').toString('base64');
  const exponent = Buffer.from(jwk.e, 'base64url').toString('base64');
  return `<RSAKeyValue><Modulus>${modulus}</Modulus><Exponent>${exponent}</Exponent></RSAKeyValue>`;
}

export function dotNetRsaXmlToPem(xml) {
  const modMatch = /<Modulus>\s*([^<]+?)\s*<\/Modulus>/i.exec(xml);
  const expMatch = /<Exponent>\s*([^<]+?)\s*<\/Exponent>/i.exec(xml);
  if (!modMatch || !expMatch) {
    throw new Error('Invalid .NET RSA XML public key');
  }
  const n = Buffer.from(modMatch[1].trim(), 'base64').toString('base64url');
  const e = Buffer.from(expMatch[1].trim(), 'base64').toString('base64url');
  const keyObj = crypto.createPublicKey({
    key: { kty: 'RSA', n, e },
    format: 'jwk',
  });
  return keyObj.export({ type: 'spki', format: 'pem' }).toString();
}

export function signBufferRsaSha256(buffer, privateKeyPem) {
  return crypto
    .sign('sha256', buffer, {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    })
    .toString('base64');
}

export function verifyBufferRsaSha256(buffer, signatureBase64, publicKeyPem) {
  return crypto.verify(
    'sha256',
    buffer,
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(signatureBase64.trim(), 'base64'),
  );
}

export function normalizePrivateKeyPem(rawEnv) {
  const trimmed = String(rawEnv || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('-----BEGIN')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
  if (!decoded.includes('-----BEGIN')) {
    throw new Error('UPDATE_SIGNING_PRIVATE_KEY must be a PEM string or base64-encoded PEM');
  }
  return decoded;
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      flags[key] = val;
      i += 1;
    }
  }
  return flags;
}

function stripLeadingV(ver) {
  return String(ver || '').trim().replace(/^[vV]/, '');
}

function runWriteVersion(flags) {
  const releaseDir = flags['release-dir'];
  const version = stripLeadingV(flags.version);
  if (!releaseDir || !version) {
    throw new Error('Usage: write-version --release-dir <dir> --version <ver>');
  }
  const runtimeHash = computeRuntimeHash(releaseDir);
  const versionMeta = {
    version,
    runtimeHash,
    buildTime: new Date().toISOString(),
    channel: 'stable',
  };
  const outPath = path.join(releaseDir, 'version.json');
  fs.writeFileSync(outPath, `${JSON.stringify(versionMeta, null, 2)}\n`, 'utf8');
  console.log(`[update-manifest] Wrote ${outPath} (v${version}, runtimeHash=${runtimeHash.slice(0, 12)}...)`);
}

function runGenerateManifest(flags) {
  const releaseDir = flags['release-dir'];
  const outDir = flags['out-dir'];
  const version = stripLeadingV(flags.version);
  const repo = (flags.repo || DEFAULT_REPO).trim();
  if (!releaseDir || !outDir || !version) {
    throw new Error('Usage: generate-manifest --release-dir <dir> --out-dir <dir> --version <ver> [--repo <owner/repo>]');
  }

  let runtimeHash = '';
  const versionJsonPath = path.join(releaseDir, 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      if (typeof parsed.runtimeHash === 'string') {
        runtimeHash = parsed.runtimeHash;
      }
    } catch {
      runtimeHash = '';
    }
  }
  if (!runtimeHash) {
    runtimeHash = computeRuntimeHash(releaseDir);
  }

  const candidateAssets = {
    appBundle: `TeacherAssistant-v${version}-AppBundle.zip`,
    portable: `TeacherAssistant-v${version}-Windows-Portable.zip`,
    installer: 'TeacherAssistant-Setup.exe',
  };

  const assets = {};
  for (const [key, filename] of Object.entries(candidateAssets)) {
    const filePath = path.join(outDir, filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      assets[key] = {
        filename,
        url: `https://github.com/${repo}/releases/download/v${version}/${filename}`,
        sha256: sha256File(filePath),
        size: fs.statSync(filePath).size,
      };
    }
  }

  const manifest = {
    schemaVersion: 1,
    version,
    publishedAt: new Date().toISOString(),
    runtimeHash,
    releaseNotesUrl: `https://github.com/${repo}/releases/tag/v${version}`,
    assets,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'update-manifest.json');
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(manifestPath, manifestText, 'utf8');
  console.log(`[update-manifest] Wrote ${manifestPath} (${Object.keys(assets).length} asset(s))`);

  const rawPrivateKey = process.env.UPDATE_SIGNING_PRIVATE_KEY || '';
  if (rawPrivateKey.trim()) {
    const privatePem = normalizePrivateKeyPem(rawPrivateKey);
    const manifestBytes = fs.readFileSync(manifestPath);
    const signature = signBufferRsaSha256(manifestBytes, privatePem);

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(scriptDir, '..');
    const publicKeyXmlPath = path.join(repoRoot, 'installer', 'update-public-key.xml');
    if (fs.existsSync(publicKeyXmlPath)) {
      const publicXml = fs.readFileSync(publicKeyXmlPath, 'utf8');
      const publicPem = dotNetRsaXmlToPem(publicXml);
      if (!verifyBufferRsaSha256(manifestBytes, signature, publicPem)) {
        throw new Error('Generated signature failed verification against installer/update-public-key.xml (keypair mismatch)');
      }
      console.log('[update-manifest] Verified manifest signature against installer/update-public-key.xml');
    }

    const sigPath = path.join(outDir, 'update-manifest.json.sig');
    fs.writeFileSync(sigPath, `${signature}\n`, 'utf8');
    console.log(`[update-manifest] Wrote signature ${sigPath}`);
  }
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  if (command === 'write-version') {
    runWriteVersion(flags);
  } else if (command === 'generate-manifest') {
    runGenerateManifest(flags);
  } else {
    throw new Error(`Unknown command "${command || ''}". Expected "write-version" or "generate-manifest".`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error('[update-manifest] Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { jwkToDotNetRsaPublicKeyXml } from './update-manifest.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const publicXmlPath = path.join(repoRoot, 'installer', 'update-public-key.xml');
const secretsDir = path.join(repoRoot, '.secrets');
const privatePemPath = path.join(secretsDir, 'update-signing-key.pem');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const publicKeyXml = jwkToDotNetRsaPublicKeyXml(publicKey);
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

fs.mkdirSync(path.dirname(publicXmlPath), { recursive: true });
fs.writeFileSync(publicXmlPath, `${publicKeyXml}\n`, 'utf8');

fs.mkdirSync(secretsDir, { recursive: true });
fs.writeFileSync(privatePemPath, privateKeyPem, { encoding: 'utf8', mode: 0o600 });

console.log('Generated RSA-2048 update signing keypair:');
console.log(`- Public XML (commit to git): ${publicXmlPath}`);
console.log(`- Private PEM (NEVER commit, gitignored): ${privatePemPath}`);
console.log('');
console.log('Next step: copy the contents of .secrets/update-signing-key.pem (or its base64)');
console.log('into GitHub Actions repository secret: UPDATE_SIGNING_PRIVATE_KEY');

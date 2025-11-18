/**
 * Script to generate Apple Sign-In JWT secret key for Supabase
 * 
 * Usage: node scripts/generate-apple-jwt.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TEAM_ID = '38NFF5BY78';
const KEY_ID = 'XJVD7Z4V23';
const SERVICE_ID = 'com.jarydhermann.goodtimes.signin';

const possiblePaths = [
  path.join(__dirname, '..', 'AuthKey_XJVD7Z4V23.p8'),
  path.join(process.env.HOME, 'Documents', 'APPLE AUTH', 'AuthKey_XJVD7Z4V23.p8'),
];

let KEY_PATH = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    KEY_PATH = p;
    break;
  }
}

if (!KEY_PATH) {
  console.error('Error: Could not find AuthKey_XJVD7Z4V23.p8 file');
  possiblePaths.forEach(p => console.error('  -', p));
  process.exit(1);
}

const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
console.log(`✓ Found key file at: ${KEY_PATH}`);

const header = { alg: 'ES256', kid: KEY_ID };
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + (6 * 30 * 24 * 60 * 60),
  aud: 'https://appleid.apple.com',
  sub: SERVICE_ID,
};

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const encodedHeader = base64UrlEncode(JSON.stringify(header));
const encodedPayload = base64UrlEncode(JSON.stringify(payload));
const signatureInput = `${encodedHeader}.${encodedPayload}`;

const sign = crypto.createSign('SHA256');
sign.update(signatureInput);
sign.end();

let signature;
try {
  const sigBuffer = sign.sign(privateKey, 'base64');
  signature = sigBuffer.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} catch (error) {
  console.error('Error signing JWT:', error.message);
  process.exit(1);
}

const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

console.log('\n✅ Apple Sign-In JWT Secret Key Generated!\n');
console.log('Copy this JWT token and paste it into Supabase as the "Secret Key":\n');
console.log(jwt);
console.log('\n');


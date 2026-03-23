/**
 * Generate an Apple Client Secret JWT for Supabase Apple OAuth.
 *
 * Usage:
 *   npx tsx scripts/generate-apple-secret.ts /path/to/AuthKey_XJVD7Z4V23.p8
 *
 * The generated JWT should be pasted into Supabase Dashboard →
 * Authentication → Providers → Apple → Secret Key (for OAuth).
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

const TEAM_ID = "38NFF5BY78"
const KEY_ID = "7K46M53Y5P"
const SERVICE_ID = "com.jarydhermann.goodtimes.signin"

const keyPath = process.argv[2]
if (!keyPath) {
  console.error("Usage: npx tsx scripts/generate-apple-secret.ts /path/to/AuthKey.p8")
  console.error("\nDownload your .p8 key from Apple Developer Console →")
  console.error("  Certificates, Identifiers & Profiles → Keys → Your Key → Download")
  process.exit(1)
}

const resolvedPath = path.resolve(keyPath)
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`)
  process.exit(1)
}

const privateKey = fs.readFileSync(resolvedPath, "utf8").trim()
if (!privateKey.includes("BEGIN PRIVATE KEY")) {
  console.error("Error: File does not look like a valid .p8 private key")
  console.error("Expected file to contain '-----BEGIN PRIVATE KEY-----'")
  process.exit(1)
}

function base64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const now = Math.floor(Date.now() / 1000)
const exp = now + 15776000 // ~6 months

const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" }
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: SERVICE_ID,
}

const encodedHeader = base64url(JSON.stringify(header))
const encodedPayload = base64url(JSON.stringify(payload))
const signingInput = `${encodedHeader}.${encodedPayload}`

const sign = crypto.createSign("SHA256")
sign.update(signingInput)
const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
const encodedSignature = base64url(signature)

const jwt = `${signingInput}.${encodedSignature}`

console.log("\n=== Apple Client Secret JWT ===\n")
console.log(jwt)
console.log("\n=== JWT Details ===")
console.log(`  Team ID:    ${TEAM_ID}`)
console.log(`  Key ID:     ${KEY_ID}`)
console.log(`  Service ID: ${SERVICE_ID}`)
console.log(`  Issued:     ${new Date(now * 1000).toISOString()}`)
console.log(`  Expires:    ${new Date(exp * 1000).toISOString()}`)
console.log(`\nPaste this JWT into Supabase Dashboard →`)
console.log(`  Authentication → Providers → Apple → Secret Key (for OAuth)\n`)

import crypto from 'node:crypto';

const TOTP_INTERVAL_SECONDS = 30;
const TOTP_CODE_LENGTH = 6;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 10;

export interface MfaSetupResult {
  secret: string;
  otpauth_url: string;
  recovery_codes: string[];
}

export interface MfaRecord {
  secret_hash: string;
  recovery_hashes: string[];
  enabled_at: string;
}

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f]!;
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 0x1f]!;
  }
  return output;
}

function generateTOTP(secret: Buffer, timestamp: number): string {
  const counter = Math.floor(timestamp / 1000 / TOTP_INTERVAL_SECONDS);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binaryCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const code = binaryCode % 10 ** TOTP_CODE_LENGTH;
  return code.toString().padStart(TOTP_CODE_LENGTH, '0');
}

function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex');
    codes.push(code);
    hashes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }
  return { codes, hashes };
}

export function setupMfa(issuer: string, accountName: string): MfaSetupResult {
  const secret = crypto.randomBytes(20);
  const secretBase32 = base32Encode(secret);
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_CODE_LENGTH}&period=${TOTP_INTERVAL_SECONDS}`;

  const { codes } = generateRecoveryCodes();

  return {
    secret: secretBase32,
    otpauth_url: otpauthUrl,
    recovery_codes: codes,
  };
}

export function verifyTotp(secretBase32: string, code: string): boolean {
  if (code.length !== TOTP_CODE_LENGTH || !/^\d+$/.test(code)) return false;

  let buf: Buffer;
  try {
    const decoded = Buffer.from(secretBase32, 'base64');
    if (decoded.length === 20) {
      buf = decoded;
    } else {
      const cleaned = secretBase32.replace(/[^A-Za-z2-7]/g, '').toUpperCase();
      const bits: number[] = [];
      for (const ch of cleaned) {
        const idx = BASE32_CHARS.indexOf(ch);
        if (idx === -1) return false;
        bits.push(idx);
      }
      let byteIdx = 0;
      let bitIdx = 0;
      buf = Buffer.alloc(20);
      for (const b of bits) {
        for (let i = 4; i >= 0; i--) {
          if (byteIdx >= 20) break;
          const bitVal = (b >> i) & 1;
          buf[byteIdx] = ((buf[byteIdx] ?? 0) << 1) | bitVal;
          bitIdx++;
          if (bitIdx === 8) {
            bitIdx = 0;
            byteIdx++;
          }
        }
      }
    }
  } catch {
    return false;
  }

  const now = Date.now();
  for (let skew = -1; skew <= 1; skew++) {
    const expected = generateTOTP(buf, now + skew * TOTP_INTERVAL_SECONDS * 1000);
    if (expected === code) return true;
  }
  return false;
}

export function verifyRecoveryCode(
  code: string,
  recoveryHashes: string[],
): { valid: boolean; remainingHashes: string[] } {
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const idx = recoveryHashes.indexOf(codeHash);
  if (idx === -1) return { valid: false, remainingHashes: recoveryHashes };
  const remaining = [...recoveryHashes];
  remaining.splice(idx, 1);
  return { valid: true, remainingHashes: remaining };
}

import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-me-in-production',
);

const ISSUER = 'soz-api';
const AUDIENCE = 'soz-mobile';
const EXPIRY = '30d';

export interface JwtPayload {
  userId: string;
  email: string;
  /**
   * Anonymous trial token. Absent on tokens issued before guest accounts existed
   * (and on every real account), so read it as `=== true`, never as truthy-ish.
   */
  isGuest?: boolean;
  /**
   * Session generation. Absent on tokens minted before revocation existed, and
   * those must keep working — so a missing value reads as 0, which is what every
   * existing user row also holds. See auth/tokenVersion.ts.
   */
  tv?: number;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload as unknown as JwtPayload;
}

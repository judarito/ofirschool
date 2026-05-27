import { SignJWT, jwtVerify } from 'jose'
import type { SessionUser } from '@ofir/shared'

const encoder = new TextEncoder()

const getSecretKey = (secret: string) => encoder.encode(secret)

export const signAccessToken = async (payload: SessionUser, secret: string) =>
  new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecretKey(secret))

export const verifyAccessToken = async (token: string, secret: string) => {
  const { payload } = await jwtVerify(token, getSecretKey(secret))
  return payload as unknown as SessionUser
}

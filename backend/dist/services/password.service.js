import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
const KEY_LENGTH = 64;
export function hashPassword(password) {
    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, passwordSalt, KEY_LENGTH).toString('hex');
    return { passwordHash, passwordSalt };
}
export function verifyPassword(password, passwordHash, passwordSalt) {
    const candidate = scryptSync(password, passwordSalt, KEY_LENGTH);
    const expected = Buffer.from(passwordHash, 'hex');
    if (candidate.length !== expected.length) {
        return false;
    }
    return timingSafeEqual(candidate, expected);
}

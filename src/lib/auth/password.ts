import "server-only";
import bcrypt from "bcryptjs";

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Used to keep login timing constant when the email doesn't exist.
export const DUMMY_HASH = "$2b$12$ZtcVGUMDmV/JwLumIhlR8uLci3sAaZsNFocUzkytHVJaI6Uy2gw/m";

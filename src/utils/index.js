// ─── Shared utilities ───────────────────────────────────────────────────────

/**
 * Calculates live remaining days from valid_until in real-time.
 * Always preferred over the stale days_remaining field in the DB.
 */
export function getLiveDays(client) {
  if (client.license_type === 'permanent') return Infinity;
  if (!client.valid_until) return client.days_remaining || 0;
  return Math.max(0, Math.ceil((new Date(client.valid_until) - new Date()) / 86400000));
}

/**
 * Format a date string to a short locale-aware string.
 */
export function formatDate(dateStr, locale = 'es-MX') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Build a WhatsApp link with a contextual message based on license status.
 */
export function getWhatsAppLink(client, customMsg) {
  if (!client.phone) return null;
  const cleanPhone = client.phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7) return null;
  const name = client.business_name || 'Cliente';
  let msg = customMsg;
  if (!msg) {
    const days = getLiveDays(client);
    if (client.license_type !== 'permanent' && days <= 0) {
      msg = `Hola *${name}*, tu licencia de Abasto ha vencido. Contáctanos para renovar.`;
    } else if (client.license_type !== 'permanent' && days <= 3) {
      msg = `Hola *${name}*, tu licencia de Abasto vence en ${days} día(s). ¿Deseas renovarla?`;
    } else {
      msg = `Hola *${name}*, somos del equipo de Abasto. ¡Gracias por usar nuestra plataforma!`;
    }
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}

// ─── PIN Hashing (PBKDF2 + salt) ────────────────────────────────────────────
const PBKDF2_ITERATIONS = 100_000;
const HASH_KEY = 'abasto_station_pin_v2';
const LEGACY_HASH_KEY = 'abasto_station_pin_hash';

function buf2hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hex2buf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Hash a PIN with PBKDF2 + random salt.
 * Returns a string: `salt_hex:hash_hex`
 */
export async function hashPinSecure(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return `${buf2hex(salt.buffer)}:${buf2hex(derived)}`;
}

/**
 * Verify a PIN against a stored PBKDF2 hash (salt:hash format).
 */
export async function verifyPinSecure(pin, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(hex2buf(saltHex));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return buf2hex(derived) === hashHex;
}

/** Returns true if a v2 (PBKDF2) PIN hash is stored. */
export function hasPinV2() {
  return !!localStorage.getItem(HASH_KEY);
}

/** Returns true if only a legacy SHA-256 PIN hash exists (needs migration). */
export function hasLegacyPinOnly() {
  return !localStorage.getItem(HASH_KEY) && !!localStorage.getItem(LEGACY_HASH_KEY);
}

/** Save a PBKDF2 hash and remove any legacy hash. */
export function savePinHash(hash) {
  localStorage.setItem(HASH_KEY, hash);
  localStorage.removeItem(LEGACY_HASH_KEY);
}

/** Retrieve the stored PBKDF2 hash. */
export function getPinHash() {
  return localStorage.getItem(HASH_KEY);
}

/** Clear all stored PIN hashes (forces re-setup). */
export function clearPin() {
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(LEGACY_HASH_KEY);
}

export { HASH_KEY };

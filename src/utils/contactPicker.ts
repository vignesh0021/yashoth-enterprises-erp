/**
 * YASHOTH ENTERPRISES ERP — CONTACT PICKER UTILITY
 *
 * Utilizes the native Web Contacts Manager API available in Android Chrome & Android WebViews.
 * Allows 1-tap extraction of Contact Name, Phone Number, and Email directly from the device's phonebook.
 */

export interface PickedContact {
  name: string;
  phone: string;
  email?: string;
}

export function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && typeof (navigator as any).contacts?.select === 'function';
}

export async function pickContactFromPhonebook(): Promise<PickedContact | null> {
  if (!isContactPickerSupported()) {
    return null;
  }

  try {
    const props = ['name', 'tel', 'email'];
    const results = await (navigator as any).contacts.select(props, { multiple: false });
    if (results && results.length > 0) {
      const contact = results[0];
      const rawName = Array.isArray(contact.name) ? contact.name[0] : (contact.name || '');
      const rawTel = Array.isArray(contact.tel) ? contact.tel[0] : (contact.tel || '');
      const rawEmail = Array.isArray(contact.email) ? contact.email[0] : (contact.email || '');

      // Clean telephone formatting if needed (preserve standard 10 digits or cleaned format)
      const cleanPhone = cleanPhoneNumber(rawTel || '');

      return {
        name: (rawName || '').trim(),
        phone: cleanPhone,
        email: (rawEmail || '').trim(),
      };
    }
  } catch (err: any) {
    // User cancelled or permission dismissed
    console.info('Contact picker closed or cancelled:', err?.message);
  }

  return null;
}

export function cleanPhoneNumber(rawTel: string): string {
  if (!rawTel) return '';
  let cleaned = rawTel.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Parses any pasted or shared contact string (e.g. from WhatsApp, Truecaller, or Phone contacts)
 * into a structured PickedContact with sanitized phone number, name, and email.
 */
export function parseContactText(text: string): PickedContact | null {
  if (!text || !text.trim()) return null;
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

  let phone = '';
  let email = '';
  let name = '';

  // 1. Try to find email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0].trim();
  }

  // 2. Try to find Indian phone numbers (10 digits, +91 prefix, or spaces/dashes)
  const phoneMatches = text.match(/(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}/g) ||
                       text.match(/(?:\+91[\-\s]?)?[6-9]\d{9}/g) ||
                       text.match(/\b\d{10}\b/g);

  if (phoneMatches && phoneMatches.length > 0) {
    phone = cleanPhoneNumber(phoneMatches[0]);
  }

  // 3. Extract name: line that doesn't contain the phone number or email
  for (const line of lines) {
    const isPhoneLine = phone && line.replace(/[^\d]/g, '').includes(phone);
    const isEmailLine = email && line.includes(email);
    if (!isPhoneLine && !isEmailLine && line.length >= 2 && line.length <= 60) {
      // Remove labels like "Name:", "Contact:", etc.
      const cleanName = line.replace(/^(name|contact|driver|employee|person)\s*[:\-]\s*/i, '').trim();
      if (cleanName) {
        name = cleanName;
        break;
      }
    }
  }

  if (phone || name || email) {
    return { name, phone, email };
  }
  return null;
}

export function isClipboardSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';
}

/**
 * 1-Tap reads copied contact text from device clipboard and auto-parses Name and Phone.
 */
export async function readContactFromClipboard(): Promise<PickedContact | null> {
  if (!isClipboardSupported()) return null;
  try {
    const text = await navigator.clipboard.readText();
    return parseContactText(text);
  } catch (err: any) {
    console.info('Clipboard read permission denied or unavailable:', err?.message);
    return null;
  }
}


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

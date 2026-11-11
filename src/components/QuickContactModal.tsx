import React, { useState, useMemo } from 'react';
import {
  X,
  Clipboard,
  Search,
  BookUser,
  UserCheck,
  Phone,
  CheckCircle2,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import {
  type PickedContact,
  isContactPickerSupported,
  pickContactFromPhonebook,
  readContactFromClipboard,
  parseContactText,
  cleanPhoneNumber,
} from '../utils/contactPicker.ts';
import { useERP } from '../context/ERPContext.tsx';

interface QuickContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: PickedContact) => void;
  title?: string;
  defaultName?: string;
}

export const QuickContactModal: React.FC<QuickContactModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Fetch or Pick Contact',
  defaultName = '',
}) => {
  const { employees, parties, vehicles } = useERP();
  const [searchTerm, setSearchTerm] = useState('');
  const [manualPasteText, setManualPasteText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compile combined contacts list from ERP (Employees, Parties, Drivers)
  const existingContacts = useMemo(() => {
    const list: Array<{ name: string; phone: string; email?: string; role: string }> = [];

    // Employees
    employees.forEach((emp) => {
      if (emp.phone) {
        list.push({
          name: emp.fullName,
          phone: cleanPhoneNumber(emp.phone),
          role: `Staff • ${emp.designation}`,
        });
      }
    });

    // Parties
    parties.forEach((p) => {
      if (p.phone) {
        list.push({
          name: p.contactPerson || p.tradeName || p.legalName,
          phone: cleanPhoneNumber(p.phone),
          email: p.email,
          role: `${p.partyType === 'SUPPLIER' ? 'Supplier' : 'Customer'} • ${p.tradeName || p.legalName}`,
        });
      }
    });

    // Vehicle Drivers
    vehicles.forEach((v) => {
      if (v.driverPhone && v.driverName) {
        list.push({
          name: v.driverName,
          phone: cleanPhoneNumber(v.driverPhone),
          role: `Driver • ${v.registrationNo}`,
        });
      }
    });

    // Deduplicate by phone
    const seen = new Set<string>();
    return list.filter((item) => {
      if (!item.phone || seen.has(item.phone)) return false;
      seen.add(item.phone);
      return true;
    });
  }, [employees, parties, vehicles]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return existingContacts;
    const q = searchTerm.toLowerCase();
    return existingContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.role.toLowerCase().includes(q)
    );
  }, [existingContacts, searchTerm]);

  if (!isOpen) return null;

  // 1-Tap Read from Device Clipboard
  const handleReadClipboard = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const contact = await readContactFromClipboard();
      if (contact && (contact.phone || contact.name)) {
        setSuccessMsg(`Extracted: ${contact.name || 'Contact'} (${contact.phone})`);
        setTimeout(() => {
          onSelect(contact);
          onClose();
        }, 300);
      } else {
        // Fallback: prompt user to paste text directly
        setErrorMsg('Could not auto-read clipboard. Please paste the text in the box below.');
      }
    } catch {
      setErrorMsg('Clipboard access not allowed. Please paste directly below.');
    }
  };

  // Parse Manually Pasted Text
  const handleParseManualText = () => {
    setErrorMsg(null);
    if (!manualPasteText.trim()) {
      setErrorMsg('Please paste contact or WhatsApp text first.');
      return;
    }
    const contact = parseContactText(manualPasteText);
    if (contact && (contact.phone || contact.name)) {
      onSelect(contact);
      onClose();
    } else {
      setErrorMsg('No valid phone number or name found in the pasted text.');
    }
  };

  // Try Native Web Phonebook (Chrome/Android when available)
  const handleNativeSelect = async () => {
    setErrorMsg(null);
    const c = await pickContactFromPhonebook();
    if (c) {
      onSelect(c);
      onClose();
    } else {
      setErrorMsg('Native phonebook not supported on this device/view. Use Clipboard Paste or Select below.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookUser className="w-5 h-5 text-blue-200" />
            <h3 className="font-black text-sm tracking-tight">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Notifications */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleReadClipboard}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border-2 border-blue-200 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <Clipboard className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Paste Clipboard</span>
            </button>

            {isContactPickerSupported() ? (
              <button
                type="button"
                onClick={handleNativeSelect}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-2 border-indigo-200 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer min-h-[44px]"
              >
                <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Phone Contacts</span>
              </button>
            ) : (
              <div className="flex items-center justify-center px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 font-medium text-center">
                <span>Copy number from WhatsApp & tap Paste</span>
              </div>
            )}
          </div>

          {/* Manual Text Paste Fallback Box */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <label className="text-[11px] font-bold text-slate-700 block">
              Paste Contact / Message Text (Auto-detects 10-digit mobile & name)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualPasteText}
                onChange={(e) => setManualPasteText(e.target.value)}
                placeholder="e.g. Ramesh Kumar 9600910944"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={handleParseManualText}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Extract
              </button>
            </div>
          </div>

          {/* Search Existing ERP Contacts */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Select from Saved Contacts ({existingContacts.length})
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff, customer, supplier, driver..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-blue-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
              {filteredContacts.map((contact, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelect({
                      name: contact.name,
                      phone: contact.phone,
                      email: contact.email,
                    });
                    onClose();
                  }}
                  className="pt-1.5 first:pt-0 pb-1.5 flex items-center justify-between p-2 rounded-xl hover:bg-blue-50/70 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 group-hover:bg-blue-600 group-hover:text-white text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-900">
                        {contact.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{contact.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="text-xs font-mono font-bold text-slate-700 group-hover:text-blue-700">
                      {contact.phone}
                    </span>
                    <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              ))}

              {filteredContacts.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No matching contacts found.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

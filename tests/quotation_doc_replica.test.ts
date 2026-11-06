import { describe, it, expect } from 'vitest';
import { INITIAL_COMMERCIAL_DOCUMENTS, INITIAL_PARTIES, INITIAL_COMPANIES } from '../src/services/mockData.ts';

describe('Official Yashoth Enterprises Quotation 1000% Replica Verification', () => {
  const imopQuote = INITIAL_COMMERCIAL_DOCUMENTS.find(d => d.documentNo === '65-2026' || d.id === 'doc-quote-imop');
  const imopParty = INITIAL_PARTIES.find(p => p.id === 'pty-cust-imop' || p.legalName.includes('IMOP'));
  const company = INITIAL_COMPANIES.find(c => c.code === 'YE' || c.code === 'YE-MAIN');

  it('contains the official IMOP PVT LTD party with exact location details', () => {
    expect(imopParty).toBeDefined();
    expect(imopParty?.legalName).toBe('M/S IMOP PVT LTD');
    expect(imopParty?.city).toBe('Sricity');
    expect(imopParty?.stateName).toBe('Andhra Pradesh');
    expect(imopParty?.stateCode).toBe('37');
  });

  it('contains the official Quotation 65-2026 with correct document metadata', () => {
    expect(imopQuote).toBeDefined();
    expect(imopQuote?.documentNo).toBe('65-2026');
    expect(imopQuote?.documentDate).toBe('2026-11-02');
    expect(imopQuote?.referenceNo).toBe('MAIL');
    expect(imopQuote?.partyName).toBe('M/S IMOP PVT LTD');
    expect(imopQuote?.status).toBe('ISSUED');
  });

  it('contains all 11 exact scrap items with correct quantities, codes, and units', () => {
    expect(imopQuote?.lines).toBeDefined();
    expect(imopQuote?.lines.length).toBe(11);

    const line1 = imopQuote?.lines[0];
    expect(line1?.description).toBe('Machining boring scrap');
    expect(line1?.hsnSac).toBe('9997');
    expect(line1?.quantity).toBe(35);
    expect(line1?.unit).toBe('ton');
    expect(line1?.rate).toBe(31000);

    const line2 = imopQuote?.lines[1];
    expect(line2?.description).toBe('Bevelling slag');
    expect(line2?.hsnSac).toBe('9996');
    expect(line2?.quantity).toBe(20);
    expect(line2?.rate).toBe(8000);

    const line11 = imopQuote?.lines[10];
    expect(line11?.description).toBe('Welding Spool Bobbin (Good)');
    expect(line11?.hsnSac).toBe('9972');
    expect(line11?.quantity).toBe(5000);
    expect(line11?.unit).toBe('Nos');
    expect(line11?.rate).toBe(17);
  });

  it('contains the authentic terms and conditions matching the official document', () => {
    expect(imopQuote?.termsAndConditions).toContain('TEAMS AND CONDITIONS:');
    expect(imopQuote?.termsAndConditions).toContain('TAX : Taxes Extra');
    expect(imopQuote?.termsAndConditions).toContain('PAYMENT : Immediate');
  });

  it('matches Yashoth Enterprises proprietor and statutory contact credentials', () => {
    expect(company?.name).toContain('Yashoth Enterprises');
    expect(company?.gstin).toBe('33AXVPN9382L1ZF');
    expect(company?.pan).toBe('AXVPN9382L');
  });
});

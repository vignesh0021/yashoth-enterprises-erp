import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeVehicleRegistration,
  calculateDaysRemaining,
  classifyComplianceSeverity,
  evaluateFleetCompliance,
  lookupVehicleRtoDetails,
  calculateNextRenewalDate,
} from '../backend/business-rules/vehicleComplianceEngine.ts';
import {
  computeGstinCheckDigit,
  verifyGstin,
  estimateRoadDistanceKm,
  calculateEwayBillValidity,
  generateEwayBillForInvoice,
  exportNicEwayBillJson,
} from '../backend/business-rules/ewayBillEngine.ts';
import {
  createCommercialDocument,
  convertDocument,
  STANDARD_SCRAP_PRESETS,
} from '../backend/business-rules/commercialDocumentEngine.ts';
import {
  INITIAL_COMPANY_SETTINGS,
  INITIAL_PARTIES,
  INITIAL_VEHICLES,
  INITIAL_VEHICLE_DOCS,
  INITIAL_INVOICES,
  INITIAL_COMMERCIAL_DOCUMENTS,
} from '../src/services/mockData.ts';

describe('Suite 12: Vehicle Insurance Alert Engine, Free Vahan RTO Lookup, GST E-Way Bill NIC v1.03 & Purchase Orders', () => {
  describe('12.1 Vehicle Registration Normalization & Expiry Severity Engine', () => {
    it('normalizes Indian vehicle registration numbers to standard RTO spacing', () => {
      const r1 = normalizeVehicleRegistration('tn05y1936');
      expect(r1.formatted).toBe('TN 05 Y 1936');
      expect(r1.clean).toBe('TN05Y1936');
      expect(r1.isValid).toBe(true);
      expect(r1.stateCode).toBe('TN');

      const r2 = normalizeVehicleRegistration('TN-18-AB-4420');
      expect(r2.formatted).toBe('TN 18 AB 4420');
      expect(r2.isValid).toBe(true);

      const r3 = normalizeVehicleRegistration('ap 03 tc 9012');
      expect(r3.formatted).toBe('AP 03 TC 9012');
      expect(r3.stateCode).toBe('AP');
    });

    it('accurately computes days remaining and classifies severity (EXPIRED, CRITICAL, WARNING, VALID)', () => {
      const refDate = '2026-11-09';
      expect(calculateDaysRemaining('2026-11-01', refDate)).toBe(-8);
      expect(classifyComplianceSeverity(-8, 30).severity).toBe('EXPIRED');

      expect(calculateDaysRemaining('2026-11-14', refDate)).toBe(5);
      expect(classifyComplianceSeverity(5, 30).severity).toBe('CRITICAL');

      expect(calculateDaysRemaining('2026-11-25', refDate)).toBe(16);
      expect(classifyComplianceSeverity(16, 30).severity).toBe('WARNING');

      expect(calculateDaysRemaining('2027-03-15', refDate)).toBeGreaterThan(90);
      expect(classifyComplianceSeverity(126, 30).severity).toBe('VALID');
    });

    it('evaluates full fleet compliance and generates actionable alerts sorted by urgency', () => {
      const summary = evaluateFleetCompliance(
        INITIAL_VEHICLES,
        INITIAL_VEHICLE_DOCS,
        '2026-03-20'
      );
      expect(summary.totalVehicles).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(summary.alerts)).toBe(true);
      expect(summary.alerts.length).toBeGreaterThanOrEqual(5);
      // Verify alerts are sorted by daysRemaining ascending
      for (let i = 1; i < summary.alerts.length; i++) {
        expect(summary.alerts[i].daysRemaining).toBeGreaterThanOrEqual(
          summary.alerts[i - 1].daysRemaining
        );
      }
    });

    it('connects to Vahan RTO verification service with instant deterministic fallback', async () => {
      const rto1 = await lookupVehicleRtoDetails('tn05y1936');
      expect(rto1.success).toBe(true);
      expect(rto1.registrationNo).toBe('TN 05 Y 1936');
      expect(rto1.rcStatus).toBe('ACTIVE');
      expect(rto1.insuranceCompany).toBeTruthy();

      const rtoCustom = await lookupVehicleRtoDetails('AP 39 Z 9988');
      expect(rtoCustom.registrationNo).toBe('AP 39 Z 9988');
      expect(rtoCustom.stateName).toBe('Andhra Pradesh');
      expect(rtoCustom.rcStatus).toBe('ACTIVE');
    });

    it('calculates next statutory renewal date (+180 days for POLLUTION, +365 days for INSURANCE/FITNESS/PERMIT)', () => {
      const insRenew = calculateNextRenewalDate('INSURANCE', '2029-01-01');
      expect(insRenew.newExpiryDate).toBe('2030-01-01');

      const puccRenew = calculateNextRenewalDate('POLLUTION', '2029-01-01');
      expect(puccRenew.newExpiryDate).toBe('2029-06-30');
    });
  });

  describe('12.2 GSTIN Modulo-36 Verification & NIC E-Way Bill Engine (v1.03)', () => {
    it('verifies GSTIN format, state code, entity type, and Modulo-36 check digit', () => {
      const base14 = '33BDDPN2022K1Z';
      const checkChar = computeGstinCheckDigit(base14);
      expect(checkChar).toHaveLength(1);

      const validGstin = base14 + checkChar;
      const verified = verifyGstin(validGstin);
      expect(verified.isValidFormat).toBe(true);
      expect(verified.isChecksumValid).toBe(true);
      expect(verified.stateCode).toBe('33');
      expect(verified.stateName).toBe('Tamil Nadu');
      expect(verified.pan).toBe('BDDPN2022K');
    });

    it('estimates road distance and statutory CGST Rule 138 validity (1 day per 200 KM)', () => {
      // Gummidipoondi (601206) to Sri City (517646) -> 28 KM -> 1 day validity
      const distSriCity = estimateRoadDistanceKm('601206', '517646');
      expect(distSriCity).toBe(28);
      const val1 = calculateEwayBillValidity(distSriCity, '2026-11-09');
      expect(val1.validityDays).toBe(1);

      // Long distance 450 KM -> ceil(450/200) = 3 days validity
      const valLong = calculateEwayBillValidity(450, '2026-11-09');
      expect(valLong.validityDays).toBe(3);
    });

    it('generates Form GST EWB-01 data with vehicle compliance cross-check and exports NIC v1.03 JSON', () => {
      const sampleInvoice = INITIAL_INVOICES[0];
      const ewb = generateEwayBillForInvoice({
        invoice: sampleInvoice,
        company: INITIAL_COMPANY_SETTINGS,
        vehicles: INITIAL_VEHICLES,
        vehicleDocuments: INITIAL_VEHICLE_DOCS,
      });

      expect(ewb.ewbNo).toBeTruthy();
      expect(ewb.vehicleNo).toBe('TN 05 Y 1936');
      expect(ewb.fromGstin).toBe(INITIAL_COMPANY_SETTINGS.gstin);
      expect(ewb.totalInvoiceValue).toBe(sampleInvoice.grandTotal);
      expect(ewb.qrPayload).toContain('EWB:');

      const nicParsed = exportNicEwayBillJson(ewb, sampleInvoice);
      expect(nicParsed.version).toBe('1.03');
      expect(Array.isArray(nicParsed.billLists)).toBe(true);
      expect(nicParsed.billLists[0].supplyType).toBe('O');
      expect(nicParsed.billLists[0].docType).toBe('INV');
      expect(nicParsed.billLists[0].vehicleNo).toBe('TN05Y1936');
      expect(nicParsed.billLists[0].totInvValue).toBe(sampleInvoice.grandTotal);
    });
  });

  describe('12.3 Easy Quotations & Purchase Orders (PO) Engine', () => {
    it('provides 11 standard IMOP scrap presets for 1-tap Quotation and PO creation', () => {
      expect(STANDARD_SCRAP_PRESETS.length).toBe(11);
      expect(STANDARD_SCRAP_PRESETS[0].description).toBe('Machining boring scrap');
      expect(STANDARD_SCRAP_PRESETS[0].rate).toBe(31000);
    });

    it('creates a Purchase Order (PO) and converts it to a Purchase Invoice seamlessly', () => {
      const supplier = INITIAL_PARTIES.find((p) => p.partyType === 'SUPPLIER') || INITIAL_PARTIES[0];
      const poDoc = createCommercialDocument({
        company: INITIAL_COMPANY_SETTINGS,
        party: supplier,
        documentType: 'PURCHASE_ORDER',
        sequenceIndex: 2,
        documentDate: '2026-11-09',
        referenceNo: 'YARD-PO-02',
        lines: [
          { description: 'Heavy Melting Steel Scrap (HMS-1)', quantity: 10, unit: 'TON', rate: 32000, gstRate: 18 },
        ],
        createdBy: 'P. NANDHA KUMAR',
      });

      expect(poDoc.documentType).toBe('PURCHASE_ORDER');
      expect(poDoc.documentNo).toBe('PO/26-27/0002');
      expect(poDoc.subtotalTaxable).toBe(320000);
      expect(poDoc.grandTotal).toBe(377600);

      const convertedBill = convertDocument(
        poDoc,
        'PURCHASE_INVOICE',
        INITIAL_COMPANY_SETTINGS,
        15,
        '26-27',
        'P. NANDHA KUMAR'
      );
      expect(convertedBill.documentNo).toContain('0015');
      expect(convertedBill.grandTotal).toBe(377600);
      expect(convertedBill.referenceNo).toContain('PO/26-27/0002');
    });

    it('includes seeded Purchase Order doc-po-01 in INITIAL_COMMERCIAL_DOCUMENTS', () => {
      const seededPo = INITIAL_COMMERCIAL_DOCUMENTS.find((d) => d.documentType === 'PURCHASE_ORDER');
      expect(seededPo).toBeDefined();
      expect(seededPo?.documentNo).toBe('PO/26-27/0001');
    });
  });

  describe('12.4 Zero-Lag Print & Mobile Responsive Card Integrity', () => {
    it('verifies QuotationRenderer, InvoiceRenderer, and EwayBillRenderer have zero-lag print CSS', () => {
      const root = process.cwd();
      const qCode = fs.readFileSync(path.join(root, 'src/components/documents/QuotationRenderer.tsx'), 'utf-8');
      const iCode = fs.readFileSync(path.join(root, 'src/components/invoice/InvoiceRenderer.tsx'), 'utf-8');
      const eCode = fs.readFileSync(path.join(root, 'src/components/invoice/EwayBillRenderer.tsx'), 'utf-8');

      expect(qCode).toContain('transform: none !important');
      expect(qCode).toContain('decoding="sync"');
      expect(iCode).toContain('transform: none !important');
      expect(iCode).toContain('decoding="sync"');
      expect(eCode).toContain('@media print');
      expect(eCode).toContain('#eway-bill-print-sheet');
    });

    it('enforces light color-scheme and high-contrast white inputs so Android System Dark Mode never hides form fields', () => {
      const root = process.cwd();
      const htmlCode = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
      const cssCode = fs.readFileSync(path.join(root, 'src/index.css'), 'utf-8');
      const docsViewCode = fs.readFileSync(path.join(root, 'src/modules/documents/CommercialDocumentsView.tsx'), 'utf-8');

      expect(htmlCode).toContain('name="color-scheme" content="light"');
      expect(htmlCode).toContain('color-scheme: light !important');
      expect(cssCode).toContain('color-scheme: light');
      expect(docsViewCode).toContain('bg-white text-slate-900');
    });

    it('implements Android native back-gesture navigation stack, modal close interception, and native PrintManager bridge', () => {
      const root = process.cwd();
      const mainActivityCode = fs.readFileSync(
        path.join(root, 'android/app/src/main/java/com/yashothenterprises/erp/MainActivity.java'),
        'utf-8'
      );
      const appLayoutCode = fs.readFileSync(path.join(root, 'src/components/layout/AppLayout.tsx'), 'utf-8');

      expect(mainActivityCode).toContain('OnBackPressedCallback');
      expect(mainActivityCode).toContain('window.__handleAndroidBack');
      expect(mainActivityCode).toContain('PrintManager');
      expect(mainActivityCode).toContain('shareText');
      expect(appLayoutCode).toContain('__handleAndroidBack');
      expect(appLayoutCode).toContain('routeHistoryRef');
      expect(appLayoutCode).toContain('Swipe back again to exit Yashoth Enterprises');
    });

    it('replicates 1000% of the official IMOP_PURCHASE_ORDER_FORMAT (059-2024) distinctly from Quotation format', () => {
      const root = process.cwd();
      const poCode = fs.readFileSync(path.join(root, 'src/components/documents/PurchaseOrderRenderer.tsx'), 'utf-8');
      const docsViewCode = fs.readFileSync(path.join(root, 'src/modules/documents/CommercialDocumentsView.tsx'), 'utf-8');

      // Verify exact Purchase Order layout headers, columns, formulas, and terms
      expect(poCode).toContain('Kindly find the purchase order request.');
      expect(poCode).toContain('PURCHASE ORDER');
      expect(poCode).toContain('PO NO');
      expect(poCode).toContain('YOUR REF');
      expect(poCode).toContain('DATED');
      expect(poCode).toContain('PART NAME / MODEL');
      expect(poCode).toContain('PRICE(INR)');
      expect(poCode).toContain('TOTAL VALUE');
      expect(poCode).toContain('AMOUNT IN WORDS:');
      expect(poCode).toContain('TERMS AND CONDITIONS :');
      expect(poCode).toContain('TAX             : Taxes Extra');
      expect(poCode).toContain('PAYMENT : Immediate');
      expect(poCode).toContain('For YASHOTH ENTERPRISES');
      expect(poCode).toContain('Authorised Signature');
      expect(poCode).toContain('PO_HEADER_BANNER');
      expect(poCode).toContain('PO_STAMP_SIGNATURE');
      expect(docsViewCode).toContain('<PurchaseOrderRenderer');

      // Verify seeded official IMOP Purchase Order 059-2024
      const imopPo = INITIAL_COMMERCIAL_DOCUMENTS.find((d) => d.id === 'doc-po-imop');
      expect(imopPo).toBeDefined();
      expect(imopPo?.documentNo).toBe('059-2024');
      expect(imopPo?.partyName).toBe('M/S IMOP PVT LTD');
      expect(imopPo?.grandTotal).toBe(10180000);
    });
  });
});

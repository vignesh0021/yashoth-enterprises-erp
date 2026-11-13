/**
 * YASHOTH ENTERPRISES ERP — SCRAP BUYER & AGENT CRM ENGINE (PHASE 7)
 * 
 * Enforces business logic for:
 * 1. Scrap Buyer, Agent & Broker Classification & Pipeline (LEAD -> CONTACTED -> QUOTED -> NEGOTIATING -> ACTIVE)
 * 2. 1-Tap WhatsApp Communication Dispatch
 * 3. Stock-to-Buyer Matching: Physical vs Reserved vs Available vs Sold Stock
 * 4. Quotation & Reservation stock integrity: Quotations never reduce physical stock, Reservations never remove inventory
 * 5. Prevention of sales exceeding available quantity
 */

import type { Party, Material, InventoryLot, CommercialDocument } from '../types/index.ts';

export interface BuyerStockMatch {
  materialId: string;
  materialName: string;
  hsnCode: string;
  physicalStockKg: number;
  reservedStockKg: number;
  availableStockKg: number;
  soldStockKg: number;
  matchScore: number; // 0 to 100
  recommendedSellingRate: number;
  isAvailable: boolean;
}

export interface BuyerFollowUpAlert {
  buyerId: string;
  partyCode: string;
  legalName: string;
  buyerType: string;
  phone: string;
  whatsApp?: string;
  nextFollowUpDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  crmStatus: string;
}

/**
 * Calculates accurate multi-tier stock levels for a given material:
 * Physical Stock = Total remaining inventory in yard lots
 * Reserved Stock = Quantities in confirmed sales orders or pending dispatches
 * Sold Stock = Quantities fully invoiced and dispatched
 * Available Stock = Physical Stock - Reserved Stock
 */
export function calculateMaterialStockTiers(
  material: Material,
  lots: InventoryLot[] = [],
  documents: CommercialDocument[] = []
): { physicalStockKg: number; reservedStockKg: number; availableStockKg: number; soldStockKg: number } {
  // 1. Physical Stock in yard from open lots
  const materialLots = lots.filter((l) => l.materialId === material.id);
  const physicalStockKg = materialLots.reduce((sum, l) => sum + (l.remainingQuantity || 0), 0);

  // 2. Reserved Stock: Confirmed Purchase Orders or Sales Orders awaiting dispatch
  // Quotations DO NOT reserve stock. Only confirmed orders reserve stock.
  const confirmedReservations = documents.filter(
    (d) => d.documentType === 'PURCHASE_ORDER' && (d.status === 'ISSUED' || d.status === 'PARTIALLY_PAID')
  );
  let reservedStockKg = 0;
  for (const doc of confirmedReservations) {
    if (doc.lines) {
      for (const line of doc.lines) {
        if (line.materialId === material.id) {
          reservedStockKg += line.quantity || 0;
        }
      }
    }
  }

  // 3. Available Stock = Physical - Reserved (clamped at 0)
  const availableStockKg = Math.max(0, physicalStockKg - reservedStockKg);

  // 4. Sold Stock from fulfilled invoices / orders
  const fulfilledOrders = documents.filter((d) => d.status === 'PAID');
  let soldStockKg = 0;
  for (const doc of fulfilledOrders) {
    if (doc.lines) {
      for (const line of doc.lines) {
        if (line.materialId === material.id) {
          soldStockKg += line.quantity || 0;
        }
      }
    }
  }

  return { physicalStockKg, reservedStockKg, availableStockKg, soldStockKg };
}

/**
 * Matches available yard stock to a buyer's preferred materials and buying parameters
 */
export function matchStockToBuyer(
  buyer: Party,
  materials: Material[] = [],
  lots: InventoryLot[] = [],
  documents: CommercialDocument[] = []
): BuyerStockMatch[] {
  const matches: BuyerStockMatch[] = [];

  for (const mat of materials) {
    const tiers = calculateMaterialStockTiers(mat, lots, documents);
    const isInterested = buyer.interestedMaterials?.includes(mat.id) || buyer.interestedMaterials?.includes(mat.name);
    
    let matchScore = 0;
    if (isInterested) matchScore += 50;
    if (tiers.availableStockKg > 0) matchScore += 30;
    if (buyer.preferredQuantity && tiers.availableStockKg >= buyer.preferredQuantity) matchScore += 20;

    matches.push({
      materialId: mat.id,
      materialName: mat.name,
      hsnCode: mat.hsnCode,
      physicalStockKg: tiers.physicalStockKg,
      reservedStockKg: tiers.reservedStockKg,
      availableStockKg: tiers.availableStockKg,
      soldStockKg: tiers.soldStockKg,
      matchScore,
      recommendedSellingRate: mat.defaultSalesRate || 0,
      isAvailable: tiers.availableStockKg > 0,
    });
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Validates that an outward sale does not exceed currently available stock
 */
export function validateSaleQuantityAgainstAvailableStock(
  materialId: string,
  requestedQuantityKg: number,
  materials: Material[],
  lots: InventoryLot[],
  documents: CommercialDocument[]
): { allowed: boolean; availableStockKg: number; error?: string } {
  const material = materials.find((m) => m.id === materialId);
  if (!material) {
    return { allowed: false, availableStockKg: 0, error: 'Material not found in catalog' };
  }

  const { availableStockKg } = calculateMaterialStockTiers(material, lots, documents);

  if (requestedQuantityKg <= 0) {
    return { allowed: false, availableStockKg, error: 'Sale quantity must be greater than zero' };
  }

  if (requestedQuantityKg > availableStockKg) {
    return {
      allowed: false,
      availableStockKg,
      error: `Insufficient available stock for ${material.name}. Requested: ${requestedQuantityKg} KG, Available: ${availableStockKg} KG`,
    };
  }

  return { allowed: true, availableStockKg };
}

/**
 * Evaluates pending follow-ups across scrap buyers and agents
 */
export function getBuyerFollowUpAlerts(parties: Party[], currentDate: Date = new Date()): BuyerFollowUpAlert[] {
  const alerts: BuyerFollowUpAlert[] = [];
  const todayStr = currentDate.toISOString().split('T')[0];
  const todayMs = new Date(todayStr).getTime();

  const buyerParties = parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');

  for (const buyer of buyerParties) {
    if (buyer.nextFollowUpDate) {
      const followUpMs = new Date(buyer.nextFollowUpDate).getTime();
      const diffDays = Math.round((followUpMs - todayMs) / (1000 * 60 * 60 * 24));

      alerts.push({
        buyerId: buyer.id,
        partyCode: buyer.partyCode,
        legalName: buyer.legalName,
        buyerType: buyer.buyerType || 'SCRAP_BUYER',
        phone: buyer.phone,
        whatsApp: buyer.whatsApp || buyer.phone,
        nextFollowUpDate: buyer.nextFollowUpDate,
        daysRemaining: diffDays,
        isOverdue: diffDays < 0,
        crmStatus: buyer.crmStatus || 'ACTIVE',
      });
    }
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Generates a pre-filled WhatsApp click-to-chat URL for instant quotation dispatch
 */
export function generateWhatsAppQuoteLink(buyer: Party, materialName: string, ratePerKg: number, quantityKg: number): string {
  const rawPhone = (buyer.whatsApp || buyer.phone || '').replace(/[^0-9]/g, '');
  const phoneWithCountry = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

  const text = encodeURIComponent(
    `Vanakkam ${buyer.contactPerson || buyer.legalName},\n\n` +
    `Yashoth Enterprises quotation for ${materialName}:\n` +
    `• Quantity: ${quantityKg.toLocaleString('en-IN')} KG\n` +
    `• Rate: ₹${ratePerKg.toFixed(2)}/KG\n` +
    `• Total: ₹${(ratePerKg * quantityKg).toLocaleString('en-IN')}\n\n` +
    `Yard Location: Gummidipoondi, Tamil Nadu.\n` +
    `Official IMOP Verified Yard Delivery.`
  );

  return `https://wa.me/${phoneWithCountry}?text=${text}`;
}

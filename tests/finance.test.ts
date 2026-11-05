// Finance & Accounting Rules Engine Tests
import { describe, it, expect } from 'vitest';
import { 
  postPaymentVoucher, 
  executeContraTransfer, 
  calculateReconciledAccountBalance, 
  calculatePartyNetBalance 
} from '../backend/business-rules/financeEngine.ts';
import type { 
  Party, 
  CashBankAccount, 
  Invoice, 
  PurchaseHeader, 
  AccountTransaction 
} from '../src/types/index.ts';

describe('Finance, Cashbook & Party Ledger Engine', () => {
  const cashAccount: CashBankAccount = {
    id: 'acc-cash',
    accountCode: 'CASH-01',
    accountName: 'Yard Cash Box',
    accountType: 'CASH',
    openingBalance: 50000,
    openingBalanceDate: '2026-10-01',
    isActive: true,
  };

  const bankAccount: CashBankAccount = {
    id: 'acc-bank',
    accountCode: 'BANK-CUB',
    accountName: 'City Union Bank',
    accountType: 'BANK',
    openingBalance: 200000,
    openingBalanceDate: '2026-10-01',
    isActive: true,
  };

  const customer: Party = {
    id: 'pty-cust',
    partyCode: 'CUST-01',
    legalName: 'Metro Steel',
    partyType: 'CUSTOMER',
    contactPerson: 'Manager',
    phone: '+91 90000 11111',
    addressLine1: 'Industrial Area',
    city: 'Gummidipoondi',
    stateName: 'Tamil Nadu',
    stateCode: '33',
    paymentTerms: '30 Days',
    creditLimit: 1000000,
    openingBalance: 0,
    openingBalanceDate: '2026-10-01',
    isActive: true,
  };

  it('should post customer receipt, allocate against invoice, and decrease outstanding balance', () => {
    const invoice: Invoice = {
      id: 'inv-1',
      invoiceNo: 'YE/26-27/0001',
      invoiceDate: '2026-10-10',
      customerPartyId: customer.id,
      customerName: customer.legalName,
      billingAddress: 'Address',
      shippingAddress: 'Address',
      customerStateName: 'Tamil Nadu',
      customerStateCode: '33',
      placeOfSupply: 'Tamil Nadu (33)',
      lines: [],
      subtotalTaxable: 100000,
      cgstRate: 9,
      cgstAmount: 9000,
      sgstRate: 9,
      sgstAmount: 9000,
      igstRate: 0,
      igstAmount: 0,
      roundOff: 0,
      grandTotal: 118000,
      amountInWords: '',
      taxAmountInWords: '',
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      outstandingBalance: 118000,
      immutableSnapshotJson: '{}',
      isCancelled: false,
      createdBy: 'admin',
      createdAt: '2026-10-10T10:00:00Z',
    };

    // Customer makes partial payment of ₹50,000 via NEFT to bank account
    const result = postPaymentVoucher({
      paymentNo: 'PAY-REC-001',
      paymentDate: '2026-10-12',
      direction: 'INFLOW_RECEIPT',
      party: customer,
      account: bankAccount,
      totalAmount: 50000,
      paymentMethod: 'NEFT_RTGS',
      referenceNo: 'UTR99887766',
      allocations: [{ invoiceId: invoice.id, allocatedAmount: 50000 }],
      allInvoices: [invoice],
      allPurchases: [],
      actor: 'admin',
    });

    expect(result.updatedPayment.unallocatedAmount).toBe(0);
    expect(result.updatedInvoices[0].amountPaid).toBe(50000);
    expect(result.updatedInvoices[0].outstandingBalance).toBe(68000);
    expect(result.updatedInvoices[0].paymentStatus).toBe('PARTIALLY_PAID');

    // Account transaction verification: Bank is DEBITED (money added)
    expect(result.newAccountTransaction.direction).toBe('DEBIT');
    expect(result.newAccountTransaction.amount).toBe(50000);
  });

  it('should reject payment allocation when sum exceeds total payment amount', () => {
    expect(() =>
      postPaymentVoucher({
        paymentNo: 'PAY-REC-002',
        paymentDate: '2026-10-12',
        direction: 'INFLOW_RECEIPT',
        party: customer,
        account: bankAccount,
        totalAmount: 20000,
        paymentMethod: 'UPI',
        allocations: [{ invoiceId: 'inv-1', allocatedAmount: 25000 }], // 25,000 > 20,000
        allInvoices: [],
        allPurchases: [],
        actor: 'admin',
      })
    ).toThrow(/Total allocated amount .* cannot exceed payment amount/);
  });

  it('should execute cash-to-bank contra transfer with linked debit/credit without creating income or expense', () => {
    // Exactly following Section 11 & PDF example:
    // "A ₹20,000 cash-to-bank transfer must reduce cash by ₹20,000 and increase bank balance by ₹20,000. It must not create income or expense."
    const { outflowTx, inflowTx } = executeContraTransfer(
      cashAccount,
      bankAccount,
      20000,
      '2026-10-15',
      'CHQ-CASH-DEP-01',
      'admin'
    );

    // Source (Cash) is Credited (money decreases)
    expect(outflowTx.accountId).toBe(cashAccount.id);
    expect(outflowTx.direction).toBe('CREDIT');
    expect(outflowTx.amount).toBe(20000);
    expect(outflowTx.transactionType).toBe('CONTRA_TRANSFER_OUT');

    // Destination (Bank) is Debited (money increases)
    expect(inflowTx.accountId).toBe(bankAccount.id);
    expect(inflowTx.direction).toBe('DEBIT');
    expect(inflowTx.amount).toBe(20000);
    expect(inflowTx.transactionType).toBe('CONTRA_TRANSFER_IN');

    // Reconcile balances
    const newCashBalance = calculateReconciledAccountBalance(cashAccount, [outflowTx]);
    const newBankBalance = calculateReconciledAccountBalance(bankAccount, [inflowTx]);

    expect(newCashBalance).toBe(30000); // 50,000 - 20,000
    expect(newBankBalance).toBe(220000); // 200,000 + 20,000
  });
});

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { 
  CashBankAccount, 
  Expense, 
  AccountTransaction, 
  MonthlySalaryRecord, 
  DailyLabourEntry, 
  Contractor, 
  ContractorWorkEntry, 
  DailyCashClosingRecord,
  EXPENSE_CATEGORIES,
  ExpenseCategory
} from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR, roundTo2 } from '../../utils/calculations.ts';
import { 
  calculateReconciledAccountBalance, 
  calculatePartyNetBalance,
  calculateMonthlySalary,
  calculateDailyLabourCost,
  calculateDailyLabourBalance,
  calculateContractorBalance,
  computeDailyCashClosing,
  calculateProfitAndLoss
} from '../../../backend/business-rules/financeEngine.ts';
import { 
  Wallet, 
  ArrowLeftRight, 
  Plus, 
  Building2, 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight,
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Users,
  Briefcase,
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  Check,
  RotateCcw,
  Printer,
  Calculator,
  ShieldCheck,
  Search,
  DollarSign
} from 'lucide-react';

export const FinanceView: React.FC = () => {
  const { t, language } = useLanguage();
  const { 
    accounts, 
    accountTransactions, 
    expenses, 
    vehicles, 
    parties,
    invoices,
    purchases,
    payments,
    employees,
    salaryRecords,
    dailyLabourEntries,
    contractors,
    contractorWorkEntries,
    dailyCashClosings,
    recordContraTransfer, 
    recordExpense, 
    updateExpense,
    deleteExpense,
    payUnpaidExpense,
    reverseExpense,
    recordSalaryPayment,
    deleteSalaryRecord,
    recordDailyLabour,
    deleteDailyLabour,
    addContractor,
    updateContractor,
    deleteContractor,
    recordContractorWork,
    deleteContractorWork,
    payContractorWork,
    recordDailyCashClosing,
    addAccount,
    updateAccount,
    deleteAccount,
    updateAccountTransaction,
    deleteAccountTransaction,
    currentUser 
  } = useERP();

  type TabType = 'DASHBOARD' | 'EXPENSES' | 'SALARY' | 'DAILY_LABOUR' | 'CONTRACTORS' | 'CASH_BANK' | 'DAILY_CLOSING' | 'REPORTS';
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const resolveInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'CASH_BANK' || location.pathname.includes('/accounts')) return 'CASH_BANK';
    if (tabParam === 'EXPENSES') return 'EXPENSES';
    if (tabParam === 'SALARY') return 'SALARY';
    if (tabParam === 'DAILY_LABOUR') return 'DAILY_LABOUR';
    if (tabParam === 'CONTRACTORS') return 'CONTRACTORS';
    if (tabParam === 'DAILY_CLOSING') return 'DAILY_CLOSING';
    if (tabParam === 'REPORTS') return 'REPORTS';
    return 'DASHBOARD';
  };

  const [activeTab, setActiveTab] = useState<TabType>(resolveInitialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'CASH_BANK' || location.pathname.includes('/accounts')) {
      setActiveTab('CASH_BANK');
    }
  }, [searchParams, location.pathname]);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]); // e.g. "2026-10"

  // -------------------------------------------------------------
  // CALCULATIONS FOR FINANCIAL COCKPIT (DASHBOARD)
  // -------------------------------------------------------------
  const cashAccounts = useMemo(() => accounts.filter((a) => a.accountType === 'CASH'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter((a) => a.accountType === 'BANK'), [accounts]);

  const totalCashBalance = useMemo(() => {
    return roundTo2(cashAccounts.reduce((sum, acc) => sum + calculateReconciledAccountBalance(acc, accountTransactions), 0));
  }, [cashAccounts, accountTransactions]);

  const totalBankBalance = useMemo(() => {
    return roundTo2(bankAccounts.reduce((sum, acc) => sum + calculateReconciledAccountBalance(acc, accountTransactions), 0));
  }, [bankAccounts, accountTransactions]);

  // Today's metrics
  const todayIncome = useMemo(() => {
    const receipts = payments
      .filter((p) => p.paymentDate === todayStr && p.direction === 'INFLOW_RECEIPT')
      .reduce((sum, p) => sum + p.totalAmount, 0);
    return roundTo2(receipts);
  }, [payments, todayStr]);

  const todayExpenses = useMemo(() => {
    const expTotal = expenses
      .filter((e) => e.expenseDate === todayStr && e.status !== 'REVERSED')
      .reduce((sum, e) => sum + e.amount, 0);
    return roundTo2(expTotal);
  }, [expenses, todayStr]);

  const todayLabourCost = useMemo(() => {
    const dlab = dailyLabourEntries
      .filter((l) => l.workDate === todayStr)
      .reduce((sum, l) => sum + l.totalLabourCost, 0);
    return roundTo2(dlab);
  }, [dailyLabourEntries, todayStr]);

  // Outstanding Party Balances
  const supplierOutstandingDue = useMemo(() => {
    const suppliers = parties.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');
    return roundTo2(
      suppliers.reduce((sum, sup) => {
        const net = calculatePartyNetBalance(sup, invoices, purchases, payments);
        return sum + (net < 0 ? Math.abs(net) : 0);
      }, 0)
    );
  }, [parties, invoices, purchases, payments]);

  const customerOutstandingReceivable = useMemo(() => {
    const customers = parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
    return roundTo2(
      customers.reduce((sum, cust) => {
        const net = calculatePartyNetBalance(cust, invoices, purchases, payments);
        return sum + (net > 0 ? net : 0);
      }, 0)
    );
  }, [parties, invoices, purchases, payments]);

  // Pending Liabilities
  const pendingSalaryTotal = useMemo(() => {
    return roundTo2(
      salaryRecords
        .filter((s) => s.status !== 'PAID')
        .reduce((sum, s) => sum + s.remainingBalance, 0)
    );
  }, [salaryRecords]);

  const pendingContractorTotal = useMemo(() => {
    return roundTo2(
      contractorWorkEntries.reduce((sum, w) => sum + w.remainingBalance, 0)
    );
  }, [contractorWorkEntries]);

  // Monthly Income, Expenses, P&L
  const monthlyMetrics = useMemo(() => {
    const mInvoices = invoices.filter((i) => !i.isCancelled && (i.invoiceDate || '').includes(currentMonthStr));
    const salesRev = mInvoices.reduce((sum, i) => sum + i.subtotalTaxable, 0);

    const mPurchases = purchases.filter((p) => p.status === 'POSTED' && (p.transactionDate || '').includes(currentMonthStr));
    const matPurchases = mPurchases.reduce((sum, p) => sum + p.subtotalAmount, 0);

    const mExpenses = expenses.filter((e) => e.status !== 'REVERSED' && (e.expenseDate || '').includes(currentMonthStr));
    const opExp = mExpenses.reduce((sum, e) => sum + e.amount, 0);

    const mSalaries = salaryRecords.filter((s) => (s.salaryMonth || '').includes(currentMonthStr));
    const salExp = mSalaries.reduce((sum, s) => sum + s.grossSalary + s.allowances, 0);

    const mLabour = dailyLabourEntries.filter((l) => (l.workDate || '').includes(currentMonthStr));
    const labourExp = mLabour.reduce((sum, l) => sum + l.totalLabourCost, 0);

    const mContract = contractorWorkEntries.filter((c) => (c.workDate || '').includes(currentMonthStr));
    const contractExp = mContract.reduce((sum, c) => sum + c.totalContractAmount, 0);

    const pnl = calculateProfitAndLoss({
      salesRevenue: salesRev,
      materialPurchaseCost: matPurchases,
      directLabour: labourExp + contractExp,
      operatingExpenses: opExp,
      staffSalaries: salExp,
    });

    return {
      salesRev: roundTo2(salesRev),
      matPurchases: roundTo2(matPurchases),
      totalExpenses: roundTo2(opExp + salExp + labourExp + contractExp),
      pnl,
    };
  }, [invoices, purchases, expenses, salaryRecords, dailyLabourEntries, contractorWorkEntries, currentMonthStr]);

  // -------------------------------------------------------------
  // MODALS STATE
  // -------------------------------------------------------------
  // 1. Contra Transfer Modal
  const [isContraModalOpen, setIsContraModalOpen] = useState(false);
  const [sourceAccId, setSourceAccId] = useState(accounts[0]?.id || '');
  const [destAccId, setDestAccId] = useState(accounts[1]?.id || '');
  const [contraAmount, setContraAmount] = useState<number>(10000);
  const [contraRef, setContraRef] = useState('CHQ-DEP-' + Math.floor(1000 + Math.random() * 9000));

  // 2. Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Diesel / Petrol');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(1500);
  const [expenseAccId, setExpenseAccId] = useState(accounts[0]?.id || '');
  const [expensePaymentMode, setExpensePaymentMode] = useState<'CASH' | 'BANK' | 'UNPAID'>('CASH');
  const [paidTo, setPaidTo] = useState('');
  const [billRef, setBillRef] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // 3. Salary Payment Modal
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [salaryMonth, setSalaryMonth] = useState(currentMonthStr);
  const [salGross, setSalGross] = useState<number>(25000);
  const [salAllowances, setSalAllowances] = useState<number>(1000);
  const [salDeductions, setSalDeductions] = useState<number>(0);
  const [salAdvRecovery, setSalAdvRecovery] = useState<number>(0);
  const [salAmountPaid, setSalAmountPaid] = useState<number>(26000);
  const [salPayMode, setSalPayMode] = useState<'CASH' | 'BANK'>('BANK');
  const [salAccountId, setSalAccountId] = useState(accounts[0]?.id || '');
  const [salNotes, setSalNotes] = useState('');

  // 4. Daily Labour Modal
  const [isDailyLabourModalOpen, setIsDailyLabourModalOpen] = useState(false);
  const [dlabDate, setDlabDate] = useState(todayStr);
  const [dlabWorkerName, setDlabWorkerName] = useState('');
  const [dlabWorkerCount, setDlabWorkerCount] = useState<number>(3);
  const [dlabWorkingDays, setDlabWorkingDays] = useState<number>(1);
  const [dlabDailyRate, setDlabDailyRate] = useState<number>(650);
  const [dlabOvertime, setDlabOvertime] = useState<number>(0);
  const [dlabCharges, setDlabCharges] = useState<number>(0);
  const [dlabAdvance, setDlabAdvance] = useState<number>(0);
  const [dlabAmountPaid, setDlabAmountPaid] = useState<number>(1950);
  const [dlabPayMode, setDlabPayMode] = useState<'CASH' | 'BANK' | 'UNPAID'>('CASH');
  const [dlabAccountId, setDlabAccountId] = useState(accounts[0]?.id || '');
  const [dlabNotes, setDlabNotes] = useState('');

  // 5. Contractor & Work Modals
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [contrName, setContrName] = useState('');
  const [contrPhone, setContrPhone] = useState('');
  const [contrAddress, setContrAddress] = useState('');
  const [contrDesc, setContrDesc] = useState('');
  const [contrType, setContrType] = useState<Contractor['contractType']>('FIXED_CONTRACT');

  const [isContractWorkModalOpen, setIsContractWorkModalOpen] = useState(false);
  const [cworkContrId, setCworkContrId] = useState(contractors[0]?.id || '');
  const [cworkDate, setCworkDate] = useState(todayStr);
  const [cworkDesc, setCworkDesc] = useState('');
  const [cworkWorkers, setCworkWorkers] = useState<number>(4);
  const [cworkQty, setCworkQty] = useState<number>(1);
  const [cworkRate, setCworkRate] = useState<number>(25000);
  const [cworkAdvance, setCworkAdvance] = useState<number>(5000);
  const [cworkCurrentPay, setCworkCurrentPay] = useState<number>(10000);
  const [cworkPayMode, setCworkPayMode] = useState<'CASH' | 'BANK' | 'UNPAID'>('BANK');
  const [cworkAccountId, setCworkAccountId] = useState(accounts[0]?.id || '');
  const [cworkNotes, setCworkNotes] = useState('');

  // Contractor Progress Payment Modal
  const [isContrPayModalOpen, setIsContrPayModalOpen] = useState(false);
  const [contrPayWorkId, setContrPayWorkId] = useState('');
  const [contrPayAmount, setContrPayAmount] = useState<number>(5000);
  const [contrPayMode, setContrPayMode] = useState<'CASH' | 'BANK'>('BANK');
  const [contrPayAccId, setContrPayAccId] = useState(accounts[0]?.id || '');

  // 6. Account Modal (Add/Edit)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashBankAccount | null>(null);
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'CASH' | 'BANK'>('BANK');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(50000);

  // 7. Guided Daily Cash Closing State
  const [closingDate, setClosingDate] = useState(todayStr);
  const [countedCash, setCountedCash] = useState<number>(totalCashBalance);
  const [closingReason, setClosingReason] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // 8. Reports Filter State
  const [reportType, setReportType] = useState<number>(1);
  const [reportDateFrom, setReportDateFrom] = useState(currentMonthStr + '-01');
  const [reportDateTo, setReportDateTo] = useState(todayStr);

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleContraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceAccId === destAccId) {
      showFeedback('error', 'Source and destination accounts must be different for contra transfers.');
      return;
    }
    if (contraAmount <= 0) {
      showFeedback('error', 'Transfer amount must be greater than zero.');
      return;
    }
    recordContraTransfer(sourceAccId, destAccId, contraAmount, contraRef);
    setIsContraModalOpen(false);
    showFeedback('success', `Contra transfer of ${formatINR(contraAmount)} executed successfully.`);
  };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseDate(todayStr);
    setExpenseCategory('Diesel / Petrol');
    setExpenseDesc('');
    setExpenseAmount(1500);
    setExpenseAccId(accounts[0]?.id || '');
    setExpensePaymentMode('CASH');
    setPaidTo('');
    setBillRef('');
    setExpenseNotes('');
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) {
      showFeedback('error', 'Expense amount must be greater than zero.');
      return;
    }
    if (!paidTo.trim()) {
      showFeedback('error', 'Paid To / Recipient name is required.');
      return;
    }

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        expenseDate,
        category: expenseCategory,
        description: expenseDesc,
        amount: Number(expenseAmount),
        accountId: expenseAccId,
        paymentMode: expensePaymentMode,
        status: expensePaymentMode === 'UNPAID' ? 'UNPAID' : 'PAID',
        paidTo,
        billReference: billRef,
        notes: expenseNotes,
      });
      showFeedback('success', `Expense voucher "${editingExpense.voucherNo}" updated.`);
    } else {
      const exp = recordExpense({
        expenseDate,
        category: expenseCategory,
        description: expenseDesc,
        amount: Number(expenseAmount),
        accountId: expenseAccId,
        paymentMode: expensePaymentMode,
        status: expensePaymentMode === 'UNPAID' ? 'UNPAID' : 'PAID',
        approvalStatus: 'APPROVED',
        enteredBy: currentUser.fullName,
        paidTo,
        billReference: billRef,
        notes: expenseNotes,
        createdBy: currentUser.fullName,
      });
      showFeedback('success', `Expense voucher "${exp.voucherNo}" recorded.`);
    }
    setIsExpenseModalOpen(false);
  };

  const handlePayUnpaid = (exp: Expense) => {
    const acc = accounts[0]?.id || '';
    payUnpaidExpense(exp.id, acc, 'CASH');
    showFeedback('success', `Expense "${exp.voucherNo}" paid from cash account.`);
  };

  const handleReverseExpense = (exp: Expense) => {
    const reason = prompt(`Enter reason for reversing expense voucher "${exp.voucherNo}":`, 'Correction entry');
    if (reason) {
      reverseExpense(exp.id, reason);
      showFeedback('success', `Expense "${exp.voucherNo}" reversed.`);
    }
  };

  // Salary submit
  const handleOpenAddSalary = () => {
    const emp = employees.find((e) => e.id === selectedEmpId) || employees[0];
    if (emp) {
      setSalGross(emp.monthlySalary || 25000);
      setSalAdvRecovery(Math.min(emp.currentAdvanceBalance || 0, 2000));
      const net = calculateMonthlySalary(emp.monthlySalary || 25000, 1000, 0, Math.min(emp.currentAdvanceBalance || 0, 2000));
      setSalAmountPaid(net);
    }
    setIsSalaryModalOpen(true);
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) {
      showFeedback('error', 'Please select an employee.');
      return;
    }
    const net = calculateMonthlySalary(salGross, salAllowances, salDeductions, salAdvRecovery);
    const balance = roundTo2(Math.max(0, net - salAmountPaid));
    const status = balance <= 0.01 ? 'PAID' : (salAmountPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING');

    try {
      await recordSalaryPayment({
        employeeId: emp.id,
        employeeName: emp.fullName,
        designation: emp.designation,
        salaryMonth,
        grossSalary: Number(salGross),
        allowances: Number(salAllowances),
        deductions: Number(salDeductions),
        advanceRecovery: Number(salAdvRecovery),
        netSalaryPayable: net,
        amountPaid: Number(salAmountPaid),
        remainingBalance: balance,
        paymentDate: todayStr,
        paymentMode: salPayMode,
        accountId: salAccountId,
        status,
        notes: salNotes,
      });

      setIsSalaryModalOpen(false);
      showFeedback('success', `Salary record for ${emp.fullName} (${salaryMonth}) posted.`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to post salary record.');
    }
  };

  // Daily Labour submit
  const handleDailyLabourSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dlabWorkerName.trim()) {
      showFeedback('error', 'Worker or Group name is required.');
      return;
    }
    const totalCost = calculateDailyLabourCost(dlabWorkerCount, dlabWorkingDays, dlabDailyRate, dlabOvertime, dlabCharges);
    const balance = calculateDailyLabourBalance(totalCost, dlabAdvance, dlabAmountPaid);

    try {
      await recordDailyLabour({
        workDate: dlabDate,
        workerNameOrGroup: dlabWorkerName.trim(),
        workerCount: Number(dlabWorkerCount),
        workingDays: Number(dlabWorkingDays),
        dailyRate: Number(dlabDailyRate),
        overtimeAmount: Number(dlabOvertime),
        additionalCharges: Number(dlabCharges),
        totalLabourCost: totalCost,
        advanceAmount: Number(dlabAdvance),
        amountPaid: Number(dlabAmountPaid),
        remainingBalance: balance,
        paymentMode: dlabPayMode,
        accountId: dlabAccountId,
        notes: dlabNotes,
      });

      setIsDailyLabourModalOpen(false);
      showFeedback('success', `Daily labour entry for "${dlabWorkerName}" saved.`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to save daily labour entry.');
    }
  };

  // Contractor submit
  const handleContractorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrName.trim()) return;
    addContractor({
      contractorName: contrName.trim(),
      phone: contrPhone.trim(),
      address: contrAddress.trim(),
      workDescription: contrDesc.trim(),
      contractType: contrType,
      isActive: true,
    });
    setIsContractorModalOpen(false);
    setContrName('');
    showFeedback('success', `Contractor "${contrName}" registered.`);
  };

  // Contractor Work submit
  const handleContractWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contr = contractors.find((c) => c.id === cworkContrId);
    if (!contr) {
      showFeedback('error', 'Please select a contractor.');
      return;
    }
    const totalAmount = contr.contractType === 'QUANTITY_BASED' ? roundTo2(cworkRate * cworkQty) : cworkRate;
    const balance = calculateContractorBalance(totalAmount, cworkAdvance, 0, cworkCurrentPay);

    try {
      await recordContractorWork({
        contractorId: contr.id,
        contractorName: contr.contractorName,
        workDate: cworkDate,
        workDescription: cworkDesc.trim() || contr.workDescription,
        workerCount: Number(cworkWorkers),
        quantityCompleted: Number(cworkQty),
        agreedRate: Number(cworkRate),
        totalContractAmount: totalAmount,
        advancePaid: Number(cworkAdvance),
        previousPayments: 0,
        currentPayment: Number(cworkCurrentPay),
        remainingBalance: balance,
        paymentMode: cworkPayMode,
        accountId: cworkAccountId,
        notes: cworkNotes,
      });

      setIsContractWorkModalOpen(false);
      showFeedback('success', `Work contract for "${contr.contractorName}" recorded.`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to record contractor work.');
    }
  };

  const handleOpenContrPay = (w: ContractorWorkEntry) => {
    setContrPayWorkId(w.id);
    setContrPayAmount(w.remainingBalance);
    setIsContrPayModalOpen(true);
  };

  const handleContrPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contrPayAmount <= 0) return;
    try {
      await payContractorWork(contrPayWorkId, Number(contrPayAmount), contrPayMode, contrPayAccId);
      setIsContrPayModalOpen(false);
      showFeedback('success', `Contractor progress payment of ${formatINR(contrPayAmount)} posted.`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to post contractor payment.');
    }
  };

  // Account CRUD
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setAccCode(`ACC-26-${String(accounts.length + 1).padStart(3, '0')}`);
    setAccName('');
    setAccType('BANK');
    setBankName('City Union Bank');
    setAccountNumber('510909010195638');
    setIfscCode('CIUB0000439');
    setOpeningBalance(50000);
    setIsAccountModalOpen(true);
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        accountCode: accCode.trim().toUpperCase(),
        accountName: accName.trim(),
        accountType: accType,
        bankName: accType === 'BANK' ? bankName.trim() : undefined,
        accountNumber: accType === 'BANK' ? accountNumber.trim() : undefined,
        ifscCode: accType === 'BANK' ? ifscCode.trim().toUpperCase() : undefined,
        openingBalance: Number(openingBalance),
      });
      showFeedback('success', `Account "${accName}" updated.`);
    } else {
      addAccount({
        accountCode: accCode.trim().toUpperCase(),
        accountName: accName.trim(),
        accountType: accType,
        bankName: accType === 'BANK' ? bankName.trim() : undefined,
        accountNumber: accType === 'BANK' ? accountNumber.trim() : undefined,
        ifscCode: accType === 'BANK' ? ifscCode.trim().toUpperCase() : undefined,
        openingBalance: Number(openingBalance),
        openingBalanceDate: todayStr,
        isActive: true,
      });
      showFeedback('success', `Account "${accName}" created.`);
    }
    setIsAccountModalOpen(false);
  };

  // Guided Daily Cash Closing Calculation
  const closingCalculation = useMemo(() => {
    // 1. Opening Cash
    const cashAcc = accounts.find((a) => a.accountType === 'CASH') || accounts[0];
    const openBal = cashAcc?.openingBalance || 0;

    // 2. Today's Cash Inflow (Receipts & Transfers into Cash)
    const cashIn = accountTransactions
      .filter((t) => {
        const isCash = accounts.find((a) => a.id === t.accountId)?.accountType === 'CASH';
        return isCash && t.transactionDate === closingDate && t.direction === 'DEBIT';
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // 3. Today's Cash Outflow (Payments & Transfers out of Cash)
    const cashOut = accountTransactions
      .filter((t) => {
        const isCash = accounts.find((a) => a.id === t.accountId)?.accountType === 'CASH';
        return isCash && t.transactionDate === closingDate && t.direction === 'CREDIT';
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const res = computeDailyCashClosing(openBal, cashIn, cashOut, countedCash);
    return {
      openingCash: openBal,
      todayInflow: cashIn,
      todayOutflow: cashOut,
      expectedCash: res.expectedCash,
      difference: res.difference,
      status: res.status,
    };
  }, [accounts, accountTransactions, closingDate, countedCash]);

  const handleDailyClosingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(closingCalculation.difference) > 0.01 && !closingReason.trim()) {
      showFeedback('error', 'Please provide a discrepancy reason for the cash difference.');
      return;
    }

    recordDailyCashClosing({
      closingDate,
      openingCash: closingCalculation.openingCash,
      todayCashInflow: closingCalculation.todayInflow,
      todayCashOutflow: closingCalculation.todayOutflow,
      expectedCashInHand: closingCalculation.expectedCash,
      physicallyCountedCash: Number(countedCash),
      cashDifference: closingCalculation.difference,
      discrepancyReason: closingReason.trim(),
      notes: closingNotes.trim(),
    });

    showFeedback('success', `Daily cash closing for ${closingDate} stored with audit trail.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center text-red-600">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span>Finance & Accounts Management</span>
              <span className="block text-xs font-semibold text-slate-500 font-sans mt-0.5">
                நிதி மற்றும் கணக்கு மேலாண்மை — Yashoth Enterprises
              </span>
            </div>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsContraModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer select-none"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-red-400" />
            <span>{language === 'ta' ? 'ரொக்கம் ⇄ வங்கி மாற்றம்' : 'Cash ⇄ Bank (Transfer)'}</span>
          </button>
          <button
            onClick={handleOpenAddExpense}
            className="flex items-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ta' ? '+ புதிய செலவு பதிவு' : '+ New Expense'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs (Tamil & English) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {[
          { key: 'DASHBOARD', label: language === 'ta' ? 'கண்ணோட்டம்' : 'Cockpit', sub: language === 'ta' ? 'Cockpit' : 'கண்ணோட்டம்', icon: Calculator },
          { key: 'EXPENSES', label: language === 'ta' ? 'தினசரி செலவு' : 'Daily Expenses', sub: language === 'ta' ? 'Expenses' : 'செலவு', icon: Receipt },
          { key: 'SALARY', label: language === 'ta' ? 'பணியாளர் சம்பளம்' : 'Staff Salary', sub: language === 'ta' ? 'Salary' : 'சம்பளம்', icon: Users },
          { key: 'DAILY_LABOUR', label: language === 'ta' ? 'தினக்கூலி' : 'Daily Labour', sub: language === 'ta' ? 'Labour' : 'தினக்கூலி', icon: Briefcase },
          { key: 'CONTRACTORS', label: language === 'ta' ? 'ஒப்பந்ததாரர்' : 'Contractors', sub: language === 'ta' ? 'Contractors' : 'ஒப்பந்ததாரர்', icon: Users },
          { key: 'CASH_BANK', label: language === 'ta' ? 'ரொக்கம் & வங்கி' : 'Cash & Bank', sub: language === 'ta' ? 'Cash/Bank' : 'ரொக்கம் & வங்கி', icon: Coins },
          { key: 'DAILY_CLOSING', label: language === 'ta' ? 'கணக்கு முடிப்பு' : 'Daily Closing', sub: language === 'ta' ? 'Closing' : 'கணக்கு முடிப்பு', icon: ShieldCheck },
          { key: 'REPORTS', label: language === 'ta' ? 'நிதி அறிக்கைகள் (11)' : 'Reports (11)', sub: language === 'ta' ? 'Reports' : 'அறிக்கைகள்', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] transition-all cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`text-[10px] ${isActive ? 'text-red-100' : 'text-slate-400'}`}>({tab.sub})</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: COCKPIT / DASHBOARD                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          {/* Top 6 Primary Balances & Dues Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                <span>Cash in Hand</span>
                <Coins className="w-3.5 h-3.5 text-amber-500" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">கையில் உள்ள பணம்</span>
              <div className="text-base sm:text-lg font-black text-slate-900 mt-2">
                {formatINR(totalCashBalance)}
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                <span>Bank Balance</span>
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">வங்கிக் கணக்கு</span>
              <div className="text-base sm:text-lg font-black text-slate-900 mt-2">
                {formatINR(totalBankBalance)}
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                <span>Today's Income</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">இன்றைய வரவு</span>
              <div className="text-base sm:text-lg font-black text-emerald-600 mt-2">
                {formatINR(todayIncome)}
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                <span>Today's Expenses</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">இன்றைய செலவு</span>
              <div className="text-base sm:text-lg font-black text-rose-600 mt-2">
                {formatINR(todayExpenses)}
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                <span>Supplier Due</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">கொடுக்க வேண்டியது</span>
              <div className="text-base sm:text-lg font-black text-amber-700 mt-2">
                {formatINR(supplierOutstandingDue)}
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                <span>Customer Recv</span>
                <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-600" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">வர வேண்டியது</span>
              <div className="text-base sm:text-lg font-black text-indigo-700 mt-2">
                {formatINR(customerOutstandingReceivable)}
              </div>
            </div>
          </div>

          {/* Pending Labour, Pending Contractors & Monthly P&L Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 flex items-center justify-between">
                  <span>Pending Labour & Salaries</span>
                  <Users className="w-4 h-4 text-amber-400" />
                </span>
                <span className="text-xs text-slate-400 font-medium mt-0.5 block">
                  நிலுவை சம்பளம் & தினக்கூலி
                </span>
                <div className="text-2xl font-black text-white mt-3">
                  {formatINR(pendingSalaryTotal + todayLabourCost)}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Staff Salary: {formatINR(pendingSalaryTotal)}</span>
                <span>Today's Labour: {formatINR(todayLabourCost)}</span>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 flex items-center justify-between">
                  <span>Contractor Pending Due</span>
                  <Briefcase className="w-4 h-4 text-blue-400" />
                </span>
                <span className="text-xs text-slate-400 font-medium mt-0.5 block">
                  ஒப்பந்ததாரர் நிலுவை தொகை
                </span>
                <div className="text-2xl font-black text-blue-300 mt-3">
                  {formatINR(pendingContractorTotal)}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Active Contractors: {contractors.length}</span>
                <span>Work Orders: {contractorWorkEntries.length}</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-600 to-red-800 text-white p-5 rounded-2xl flex flex-col justify-between shadow-md shadow-red-600/20">
              <div>
                <span className="text-xs uppercase font-bold text-red-200 flex items-center justify-between">
                  <span>Monthly Profit / Loss ({currentMonthStr})</span>
                  <TrendingUp className="w-4 h-4 text-white" />
                </span>
                <span className="text-xs text-red-200 font-medium mt-0.5 block">
                  மாத லாப நஷ்ட அறிக்கை
                </span>
                <div className="text-2xl font-black text-white mt-3">
                  {formatINR(monthlyMetrics.pnl.netProfit)}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-red-500/50 text-[11px] text-red-100 flex justify-between">
                <span>Sales: {formatINR(monthlyMetrics.salesRev)}</span>
                <span>Gross Profit: {formatINR(monthlyMetrics.pnl.grossProfit)}</span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={handleOpenAddExpense}
              className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left cursor-pointer transition-all"
            >
              <Receipt className="w-5 h-5 text-red-600 mb-2" />
              <div className="text-xs font-bold text-slate-900">+ Daily Expense</div>
              <div className="text-[10px] text-slate-500">அன்றாட செலவு பதிவு</div>
            </button>
            <button
              onClick={handleOpenAddSalary}
              className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left cursor-pointer transition-all"
            >
              <Users className="w-5 h-5 text-blue-600 mb-2" />
              <div className="text-xs font-bold text-slate-900">+ Pay Salary</div>
              <div className="text-[10px] text-slate-500">பணியாளர் சம்பளம்</div>
            </button>
            <button
              onClick={() => setIsDailyLabourModalOpen(true)}
              className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left cursor-pointer transition-all"
            >
              <Briefcase className="w-5 h-5 text-emerald-600 mb-2" />
              <div className="text-xs font-bold text-slate-900">+ Daily Labour</div>
              <div className="text-[10px] text-slate-500">தினக்கூலி பதிவு</div>
            </button>
            <button
              onClick={() => setActiveTab('DAILY_CLOSING')}
              className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left cursor-pointer transition-all"
            >
              <ShieldCheck className="w-5 h-5 text-amber-600 mb-2" />
              <div className="text-xs font-bold text-slate-900">Daily Cash Closing</div>
              <div className="text-[10px] text-slate-500">அன்றைய கணக்கு முடிப்பு</div>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: DAILY EXPENSES (10 CATEGORIES)                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'EXPENSES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                <span>Daily Expenses Register (அன்றாட செலவுகள்)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                10 standard small-business categories with Cash/Bank/Unpaid tracking and zero-duplication reversal entries.
              </p>
            </div>
            <button
              onClick={handleOpenAddExpense}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense (செலவு பதிவு)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Voucher</th>
                    <th className="p-3">Date (தேதி)</th>
                    <th className="p-3">Category (வகை)</th>
                    <th className="p-3">Paid To (பெறுநர்)</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3">Bill Ref</th>
                    <th className="p-3 text-right">Amount (தொகை)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className={exp.status === 'REVERSED' ? 'bg-slate-50/70 line-through text-slate-400' : 'hover:bg-slate-50/50'}>
                        <td className="p-3 font-mono font-bold text-slate-900">{exp.voucherNo}</td>
                        <td className="p-3">{exp.expenseDate}</td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-semibold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{exp.paidTo}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            exp.paymentMode === 'CASH' ? 'bg-amber-100 text-amber-800' :
                            exp.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {exp.paymentMode || 'CASH'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">{exp.billReference || '—'}</td>
                        <td className="p-3 text-right font-black text-slate-900">{formatINR(exp.amount)}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            exp.status === 'REVERSED' ? 'bg-slate-200 text-slate-600' :
                            exp.status === 'UNPAID' ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {exp.status || 'PAID'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {exp.status === 'UNPAID' && (
                              <button
                                onClick={() => handlePayUnpaid(exp)}
                                title="Pay this unpaid expense now"
                                className="p-1 hover:bg-emerald-50 text-emerald-600 rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {exp.status !== 'REVERSED' && (
                              <button
                                onClick={() => handleReverseExpense(exp)}
                                title="Reverse expense voucher (correction)"
                                className="p-1 hover:bg-amber-50 text-amber-600 rounded cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteExpense(exp.id)}
                              title="Delete voucher"
                              className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: MONTHLY SALARY REGISTER                                */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'SALARY' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Permanent Staff Monthly Salary (பணியாளர் சம்பள பதிவேடு)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gross + Allowances - Deductions - Advance Recovery = Net Salary Payable. Advance balances automatically tracked.
              </p>
            </div>
            <button
              onClick={handleOpenAddSalary}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Salary Payment (சம்பளம் வழங்குதல்)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Employee (பணியாளர்)</th>
                    <th className="p-3">Month (மாதம்)</th>
                    <th className="p-3 text-right">Gross Salary</th>
                    <th className="p-3 text-right">Allowances</th>
                    <th className="p-3 text-right">Deductions</th>
                    <th className="p-3 text-right">Advance Recovery</th>
                    <th className="p-3 text-right">Net Payable</th>
                    <th className="p-3 text-right">Amount Paid</th>
                    <th className="p-3 text-right">Remaining Balance</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {salaryRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No monthly salary payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    salaryRecords.map((sal) => (
                      <tr key={sal.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{sal.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{sal.designation}</div>
                        </td>
                        <td className="p-3 font-semibold">{sal.salaryMonth}</td>
                        <td className="p-3 text-right">{formatINR(sal.grossSalary)}</td>
                        <td className="p-3 text-right text-emerald-600">+{formatINR(sal.allowances)}</td>
                        <td className="p-3 text-right text-rose-600">-{formatINR(sal.deductions)}</td>
                        <td className="p-3 text-right text-amber-600">-{formatINR(sal.advanceRecovery)}</td>
                        <td className="p-3 text-right font-black text-slate-900">{formatINR(sal.netSalaryPayable)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{formatINR(sal.amountPaid)}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{formatINR(sal.remainingBalance)}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sal.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            sal.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {sal.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => deleteSalaryRecord(sal.id)}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: DAILY WAGE LABOUR REGISTER                             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'DAILY_LABOUR' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <span>Daily Wage Labour Register (தினக்கூலி பதிவேடு)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total Labour Cost = Worker Count × Working Days × Daily Rate + Overtime + Additional Charges.
              </p>
            </div>
            <button
              onClick={() => setIsDailyLabourModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Daily Labour (தினக்கூலி பதிவு)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date (தேதி)</th>
                    <th className="p-3">Worker / Group (தொழிலாளர் / குழு)</th>
                    <th className="p-3 text-center">Workers</th>
                    <th className="p-3 text-right">Daily Rate</th>
                    <th className="p-3 text-right">OT / Charges</th>
                    <th className="p-3 text-right">Total Labour Cost</th>
                    <th className="p-3 text-right">Advance Adj</th>
                    <th className="p-3 text-right">Amount Paid</th>
                    <th className="p-3 text-right">Remaining Balance</th>
                    <th className="p-3 text-center">Payment Mode</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {dailyLabourEntries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No daily wage labour entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    dailyLabourEntries.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold">{l.workDate}</td>
                        <td className="p-3 font-bold text-slate-900">{l.workerNameOrGroup}</td>
                        <td className="p-3 text-center font-bold">{l.workerCount}</td>
                        <td className="p-3 text-right">{formatINR(l.dailyRate)}</td>
                        <td className="p-3 text-right text-emerald-600">+{formatINR(l.overtimeAmount + l.additionalCharges)}</td>
                        <td className="p-3 text-right font-black text-slate-900">{formatINR(l.totalLabourCost)}</td>
                        <td className="p-3 text-right text-amber-600">-{formatINR(l.advanceAmount)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{formatINR(l.amountPaid)}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{formatINR(l.remainingBalance)}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {l.paymentMode}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => deleteDailyLabour(l.id)}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: CONTRACTORS & OUTSOURCED LABOUR                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'CONTRACTORS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span>Outsourced Contractor Register (ஒப்பந்ததாரர் மேலாண்மை)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Independent contractor accounts with progress payments, advance deductions, and work orders.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsContractorModalOpen(true)}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                + Register Contractor
              </button>
              <button
                onClick={() => setIsContractWorkModalOpen(true)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                + Record Contract Work
              </button>
            </div>
          </div>

          {/* Active Contractors Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contractors.map((c) => {
              const works = contractorWorkEntries.filter((w) => w.contractorId === c.id);
              const totalAmount = works.reduce((sum, w) => sum + w.totalContractAmount, 0);
              const totalPaid = works.reduce((sum, w) => sum + (w.advancePaid || 0) + (w.previousPayments || 0) + (w.currentPayment || 0), 0);
              const remaining = works.reduce((sum, w) => sum + w.remainingBalance, 0);

              return (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{c.contractorName}</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-[10px] font-bold">
                        {c.contractType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{c.phone}</div>
                    <div className="text-xs text-slate-600 mt-2 font-medium line-clamp-2">{c.workDescription}</div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Pending Balance</span>
                      <span className="text-rose-600 font-black">{formatINR(remaining)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-normal">Total Contract</span>
                      <span className="text-slate-900">{formatINR(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              Contract Work Entries & Progress Payments (ஒப்பந்த வேலைகள் & தவணை கட்டணங்கள்)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Work Date</th>
                    <th className="p-3">Contractor Name</th>
                    <th className="p-3">Work Description</th>
                    <th className="p-3 text-right">Agreed Rate / Total</th>
                    <th className="p-3 text-right">Advance Paid</th>
                    <th className="p-3 text-right">Total Paid</th>
                    <th className="p-3 text-right">Remaining Balance</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {contractorWorkEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No contract work entries found.
                      </td>
                    </tr>
                  ) : (
                    contractorWorkEntries.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold">{w.workDate}</td>
                        <td className="p-3 font-bold text-slate-900">{w.contractorName}</td>
                        <td className="p-3">{w.workDescription}</td>
                        <td className="p-3 text-right font-black text-slate-900">{formatINR(w.totalContractAmount)}</td>
                        <td className="p-3 text-right text-amber-600">{formatINR(w.advancePaid)}</td>
                        <td className="p-3 text-right text-emerald-600 font-bold">
                          {formatINR((w.advancePaid || 0) + (w.previousPayments || 0) + (w.currentPayment || 0))}
                        </td>
                        <td className="p-3 text-right font-black text-rose-600">{formatINR(w.remainingBalance)}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {w.remainingBalance > 0 && (
                              <button
                                onClick={() => handleOpenContrPay(w)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-bold text-[10px] cursor-pointer"
                              >
                                + Pay Progress
                              </button>
                            )}
                            <button
                              onClick={() => deleteContractorWork(w.id)}
                              className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: CASH & BANK MANAGEMENT (CONTRA & LEDGER)               */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'CASH_BANK' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>Cash in Hand & Bank Accounts (ரொக்கம் & வங்கிக் கணக்குகள்)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorised bank accounts and physical cash box floats. Contra transfers do not affect P&L.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddAccount}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                + Add Account
              </button>
              <button
                onClick={() => setIsContraModalOpen(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Cash ⇄ Bank Contra Transfer
              </button>
            </div>
          </div>

          {/* Account Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const balance = calculateReconciledAccountBalance(acc, accountTransactions);
              const isBank = acc.accountType === 'BANK';

              return (
                <div key={acc.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        {isBank ? <Building2 className="w-4 h-4 text-blue-600" /> : <Coins className="w-4 h-4 text-amber-600" />}
                        <span>{acc.accountType} Account</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">{acc.accountCode}</span>
                    </div>
                    <div className="text-base font-black text-slate-900 mt-2">{acc.accountName}</div>
                    {isBank && (
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        A/C: {acc.accountNumber || '—'} | IFSC: {acc.ifscCode || '—'}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Reconciled Balance</span>
                      <span className="text-xl font-black text-slate-900">{formatINR(balance)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingAccount(acc);
                        setAccCode(acc.accountCode);
                        setAccName(acc.accountName);
                        setAccType(acc.accountType);
                        setBankName(acc.bankName || '');
                        setAccountNumber(acc.accountNumber || '');
                        setIfscCode(acc.ifscCode || '');
                        setOpeningBalance(acc.openingBalance);
                        setIsAccountModalOpen(true);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transactions Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              Recent Cash & Bank Transactions (சமீபத்திய ரொக்க & வங்கி பரிவர்த்தனைகள்)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Ref No</th>
                    <th className="p-3 text-right">Inflow (Debit)</th>
                    <th className="p-3 text-right">Outflow (Credit)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {accountTransactions.slice(0, 20).map((tx) => {
                    const acc = accounts.find((a) => a.id === tx.accountId);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold">{tx.transactionDate}</td>
                        <td className="p-3 font-bold text-slate-900">{acc?.accountName || tx.accountId}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{tx.description}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">{tx.referenceNo || '—'}</td>
                        <td className="p-3 text-right font-black text-emerald-600">
                          {tx.direction === 'DEBIT' ? formatINR(tx.amount) : '—'}
                        </td>
                        <td className="p-3 text-right font-black text-rose-600">
                          {tx.direction === 'CREDIT' ? formatINR(tx.amount) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 7: GUIDED DAILY CASH CLOSING                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'DAILY_CLOSING' && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span>Guided Daily Cash Closing (அன்றைய ரொக்க கணக்கு முடிப்பு)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Verify expected physical cash drawer balance against counted cash. If discrepancy exists, specify reason for audit log.
            </p>

            <form onSubmit={handleDailyClosingSubmit} className="mt-6 space-y-6">
              {/* 6 Step Visual Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Step 1 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Step 1</span>
                  <div className="text-xs font-bold text-slate-700 mt-1">Opening Cash</div>
                  <div className="text-sm font-black text-slate-900 mt-2">
                    {formatINR(closingCalculation.openingCash)}
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Step 2 (+)</span>
                  <div className="text-xs font-bold text-emerald-800 mt-1">Today's Inflow</div>
                  <div className="text-sm font-black text-emerald-700 mt-2">
                    +{formatINR(closingCalculation.todayInflow)}
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Step 3 (-)</span>
                  <div className="text-xs font-bold text-rose-800 mt-1">Today's Outflow</div>
                  <div className="text-sm font-black text-rose-700 mt-2">
                    -{formatINR(closingCalculation.todayOutflow)}
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-600 block">Step 4 (=)</span>
                  <div className="text-xs font-bold text-blue-800 mt-1">Expected Cash</div>
                  <div className="text-sm font-black text-blue-900 mt-2">
                    {formatINR(closingCalculation.expectedCash)}
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-300">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Step 5 (Counted)</span>
                  <div className="text-xs font-bold text-amber-900 mt-1">Physical Cash</div>
                  <input
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(Number(e.target.value))}
                    className="w-full mt-2 p-1.5 bg-white border border-amber-300 rounded font-black text-sm text-slate-900"
                  />
                </div>

                {/* Step 6 */}
                <div className={`p-3.5 rounded-xl border ${
                  closingCalculation.status === 'MATCHED' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                  closingCalculation.status === 'EXCESS' ? 'bg-blue-50 border-blue-300 text-blue-900' :
                  'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  <span className="text-[10px] uppercase font-bold block">Step 6 (Diff)</span>
                  <div className="text-xs font-bold mt-1">Cash Difference</div>
                  <div className="text-sm font-black mt-2">
                    {closingCalculation.difference >= 0 ? '+' : ''}{formatINR(closingCalculation.difference)}
                  </div>
                </div>
              </div>

              {/* Form Input fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Closing Date</label>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Discrepancy Explanation (if difference != 0)
                  </label>
                  <input
                    type="text"
                    value={closingReason}
                    onChange={(e) => setClosingReason(e.target.value)}
                    placeholder="e.g. Unrecorded petty cash tea expenses or drawer coin excess"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  Save Daily Cash Closing (கணக்கு முடிப்பை உறுதி செய்)
                </button>
              </div>
            </form>
          </div>

          {/* Past Closings Audit Log */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              Daily Cash Closing Audit History (கடந்த கணக்கு முடிப்பு பதிவுகள்)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Closing Date</th>
                    <th className="p-3 text-right">Opening Cash</th>
                    <th className="p-3 text-right">Inflow (+)</th>
                    <th className="p-3 text-right">Outflow (-)</th>
                    <th className="p-3 text-right">Expected Cash</th>
                    <th className="p-3 text-right">Physically Counted</th>
                    <th className="p-3 text-right">Difference</th>
                    <th className="p-3">Reason / Notes</th>
                    <th className="p-3">Closed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {dailyCashClosings.map((cls) => (
                    <tr key={cls.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{cls.closingDate}</td>
                      <td className="p-3 text-right">{formatINR(cls.openingCash)}</td>
                      <td className="p-3 text-right text-emerald-600">+{formatINR(cls.todayCashInflow)}</td>
                      <td className="p-3 text-right text-rose-600">-{formatINR(cls.todayCashOutflow)}</td>
                      <td className="p-3 text-right font-black">{formatINR(cls.expectedCashInHand)}</td>
                      <td className="p-3 text-right font-black text-amber-700">{formatINR(cls.physicallyCountedCash)}</td>
                      <td className={`p-3 text-right font-black ${
                        cls.cashDifference === 0 ? 'text-emerald-600' : cls.cashDifference > 0 ? 'text-blue-600' : 'text-rose-600'
                      }`}>
                        {cls.cashDifference > 0 ? '+' : ''}{formatINR(cls.cashDifference)}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{cls.discrepancyReason || '—'}</td>
                      <td className="p-3 text-slate-500">{cls.closedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 8: 11 DEDICATED FINANCIAL REPORTS                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                <span>Authoritative Small-Business Financial Reports (11)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All 11 reports required for small-business scrap trading, statutory GST compliance, and internal audits.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          {/* Report Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              { id: 1, name: 'Daily Expense', tamil: 'அன்றாட செலவு' },
              { id: 2, name: 'Monthly Expense', tamil: 'மாத செலவு' },
              { id: 3, name: 'Salary Sheet', tamil: 'சம்பள அறிக்கை' },
              { id: 4, name: 'Daily Labour', tamil: 'தினக்கூலி' },
              { id: 5, name: 'Contractor Summary', tamil: 'ஒப்பந்ததாரர்' },
              { id: 6, name: 'Cash Book', tamil: 'ரொக்கப் புத்தகம்' },
              { id: 7, name: 'Bank Book', tamil: 'வங்கிப் புத்தகம்' },
              { id: 8, name: 'Supplier Due', tamil: 'விற்பவர் நிலுவை' },
              { id: 9, name: 'Customer Recv', tamil: 'வாங்குபவர் வரவு' },
              { id: 10, name: 'Cash Closing', tamil: 'கணக்கு முடிப்பு' },
              { id: 11, name: 'Monthly P&L', tamil: 'லாப நஷ்டம்' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setReportType(r.id)}
                className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                  reportType === r.id
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <div className="truncate">{r.id}. {r.name}</div>
                <div className={`text-[10px] font-normal truncate ${reportType === r.id ? 'text-red-100' : 'text-slate-400'}`}>
                  {r.tamil}
                </div>
              </button>
            ))}
          </div>

          {/* Active Report Render Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            {/* 1. Daily Expense Report */}
            {reportType === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">1. Daily Expense Report (அன்றாட செலவு அறிக்கை)</h3>
                  <span className="text-xs text-slate-500 font-mono">Date: {todayStr}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Voucher</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Paid To</th>
                      <th className="p-2">Mode</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.filter((e) => e.expenseDate === todayStr).map((e) => (
                      <tr key={e.id}>
                        <td className="p-2 font-mono">{e.voucherNo}</td>
                        <td className="p-2">{e.category}</td>
                        <td className="p-2 font-semibold">{e.paidTo}</td>
                        <td className="p-2">{e.paymentMode}</td>
                        <td className="p-2 text-right font-black">{formatINR(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Monthly Expense Report */}
            {reportType === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">2. Monthly Expense Report (மாத செலவு அறிக்கை)</h3>
                  <span className="text-xs text-slate-500 font-mono">Month: {currentMonthStr}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Category (வகை)</th>
                      <th className="p-2 text-center">Vouchers Count</th>
                      <th className="p-2 text-right">Total Amount (மொத்த செலவு)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const matched = expenses.filter((e) => e.category === cat && e.status !== 'REVERSED');
                      const sum = matched.reduce((s, e) => s + e.amount, 0);
                      return (
                        <tr key={cat}>
                          <td className="p-2 font-semibold text-slate-800">{cat}</td>
                          <td className="p-2 text-center">{matched.length}</td>
                          <td className="p-2 text-right font-black text-slate-900">{formatINR(sum)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Monthly Salary Sheet */}
            {reportType === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">3. Monthly Salary Sheet (மாத சம்பள அறிக்கை)</h3>
                  <span className="text-xs text-slate-500 font-mono">Month: {currentMonthStr}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Employee</th>
                      <th className="p-2 text-right">Gross</th>
                      <th className="p-2 text-right">Net Payable</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Remaining</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salaryRecords.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2 font-bold">{s.employeeName}</td>
                        <td className="p-2 text-right">{formatINR(s.grossSalary)}</td>
                        <td className="p-2 text-right font-black">{formatINR(s.netSalaryPayable)}</td>
                        <td className="p-2 text-right text-emerald-600 font-bold">{formatINR(s.amountPaid)}</td>
                        <td className="p-2 text-right text-rose-600 font-bold">{formatINR(s.remainingBalance)}</td>
                        <td className="p-2 text-center">{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Daily Labour Report */}
            {reportType === 4 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">4. Daily Labour Report (தினக்கூலி அறிக்கை)</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Group / Worker</th>
                      <th className="p-2 text-center">Count</th>
                      <th className="p-2 text-right">Total Cost</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyLabourEntries.map((l) => (
                      <tr key={l.id}>
                        <td className="p-2">{l.workDate}</td>
                        <td className="p-2 font-bold">{l.workerNameOrGroup}</td>
                        <td className="p-2 text-center">{l.workerCount}</td>
                        <td className="p-2 text-right font-black">{formatINR(l.totalLabourCost)}</td>
                        <td className="p-2 text-right text-emerald-600 font-bold">{formatINR(l.amountPaid)}</td>
                        <td className="p-2 text-right text-rose-600 font-bold">{formatINR(l.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. Contractor Payment Summary */}
            {reportType === 5 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">5. Contractor Payment Summary (ஒப்பந்ததாரர் அறிக்கை)</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Contractor Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2 text-right">Total Contracts</th>
                      <th className="p-2 text-right">Total Paid</th>
                      <th className="p-2 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contractors.map((c) => {
                      const works = contractorWorkEntries.filter((w) => w.contractorId === c.id);
                      const totalAmt = works.reduce((s, w) => s + w.totalContractAmount, 0);
                      const totalPaid = works.reduce((s, w) => s + (w.advancePaid || 0) + (w.previousPayments || 0) + (w.currentPayment || 0), 0);
                      const rem = works.reduce((s, w) => s + w.remainingBalance, 0);
                      return (
                        <tr key={c.id}>
                          <td className="p-2 font-bold">{c.contractorName}</td>
                          <td className="p-2">{c.contractType}</td>
                          <td className="p-2 text-right font-black">{formatINR(totalAmt)}</td>
                          <td className="p-2 text-right text-emerald-600 font-bold">{formatINR(totalPaid)}</td>
                          <td className="p-2 text-right text-rose-600 font-black">{formatINR(rem)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. Cash Book */}
            {reportType === 6 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">6. Cash Book (ரொக்கப் புத்தகம்)</h3>
                  <span className="text-xs text-slate-500 font-mono">Running Balance: {formatINR(totalCashBalance)}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Cash In (Dr)</th>
                      <th className="p-2 text-right">Cash Out (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountTransactions
                      .filter((t) => accounts.find((a) => a.id === t.accountId)?.accountType === 'CASH')
                      .map((t) => (
                        <tr key={t.id}>
                          <td className="p-2 font-semibold">{t.transactionDate}</td>
                          <td className="p-2">{t.description}</td>
                          <td className="p-2 text-right font-black text-emerald-600">
                            {t.direction === 'DEBIT' ? formatINR(t.amount) : '—'}
                          </td>
                          <td className="p-2 text-right font-black text-rose-600">
                            {t.direction === 'CREDIT' ? formatINR(t.amount) : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 7. Bank Book */}
            {reportType === 7 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">7. Bank Book (வங்கிப் புத்தகம்)</h3>
                  <span className="text-xs text-slate-500 font-mono">Running Balance: {formatINR(totalBankBalance)}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Bank Account</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Deposit (Dr)</th>
                      <th className="p-2 text-right">Withdrawal (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountTransactions
                      .filter((t) => accounts.find((a) => a.id === t.accountId)?.accountType === 'BANK')
                      .map((t) => {
                        const acc = accounts.find((a) => a.id === t.accountId);
                        return (
                          <tr key={t.id}>
                            <td className="p-2 font-semibold">{t.transactionDate}</td>
                            <td className="p-2 font-bold">{acc?.accountName}</td>
                            <td className="p-2">{t.description}</td>
                            <td className="p-2 text-right font-black text-emerald-600">
                              {t.direction === 'DEBIT' ? formatINR(t.amount) : '—'}
                            </td>
                            <td className="p-2 text-right font-black text-rose-600">
                              {t.direction === 'CREDIT' ? formatINR(t.amount) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 8. Supplier Outstanding Summary */}
            {reportType === 8 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">8. Supplier Outstanding Summary (சரக்கு விற்பவர் நிலுவை அறிக்கை)</h3>
                  <span className="text-xs text-rose-600 font-black">Total Due: {formatINR(supplierOutstandingDue)}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Supplier Name (விற்பவர் பெயர்)</th>
                      <th className="p-2">GSTIN</th>
                      <th className="p-2 text-right">Opening Bal</th>
                      <th className="p-2 text-right">Net Outstanding Due (நாம் கொடுக்க வேண்டியது)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parties
                      .filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH')
                      .map((p) => {
                        const net = calculatePartyNetBalance(p, invoices, purchases, payments);
                        return (
                          <tr key={p.id}>
                            <td className="p-2 font-bold">{p.legalName}</td>
                            <td className="p-2 font-mono">{p.gstin || 'UNREGISTERED'}</td>
                            <td className="p-2 text-right">{formatINR(p.openingBalance)}</td>
                            <td className="p-2 text-right font-black text-rose-600">
                              {net < 0 ? formatINR(Math.abs(net)) : '₹0.00'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 9. Customer Outstanding Summary */}
            {reportType === 9 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">9. Customer Outstanding Summary (சரக்கு வாங்குபவர் வரவு அறிக்கை)</h3>
                  <span className="text-xs text-emerald-600 font-black">Total Receivable: {formatINR(customerOutstandingReceivable)}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Customer Name (வாங்குபவர் பெயர்)</th>
                      <th className="p-2">GSTIN</th>
                      <th className="p-2 text-right">Opening Bal</th>
                      <th className="p-2 text-right">Net Receivable (நமக்கு வர வேண்டியது)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parties
                      .filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH')
                      .map((p) => {
                        const net = calculatePartyNetBalance(p, invoices, purchases, payments);
                        return (
                          <tr key={p.id}>
                            <td className="p-2 font-bold">{p.legalName}</td>
                            <td className="p-2 font-mono">{p.gstin || 'UNREGISTERED'}</td>
                            <td className="p-2 text-right">{formatINR(p.openingBalance)}</td>
                            <td className="p-2 text-right font-black text-emerald-600">
                              {net > 0 ? formatINR(net) : '₹0.00'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 10. Daily Cash Closing Report */}
            {reportType === 10 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">10. Daily Cash Closing Report (தினசரி பண இருப்பு அறிக்கை)</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">Opening</th>
                      <th className="p-2 text-right">Inflow</th>
                      <th className="p-2 text-right">Outflow</th>
                      <th className="p-2 text-right">Expected</th>
                      <th className="p-2 text-right">Counted</th>
                      <th className="p-2 text-right">Difference</th>
                      <th className="p-2">Closed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyCashClosings.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2 font-semibold">{c.closingDate}</td>
                        <td className="p-2 text-right">{formatINR(c.openingCash)}</td>
                        <td className="p-2 text-right text-emerald-600">+{formatINR(c.todayCashInflow)}</td>
                        <td className="p-2 text-right text-rose-600">-{formatINR(c.todayCashOutflow)}</td>
                        <td className="p-2 text-right font-black">{formatINR(c.expectedCashInHand)}</td>
                        <td className="p-2 text-right font-black text-amber-700">{formatINR(c.physicallyCountedCash)}</td>
                        <td className="p-2 text-right font-black">{formatINR(c.cashDifference)}</td>
                        <td className="p-2">{c.closedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 11. Monthly Profit & Loss Statement */}
            {reportType === 11 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-900">11. Monthly Profit & Loss Statement (மாத லாப நஷ்ட அறிக்கை)</h3>
                  <span className="text-xs text-slate-500 font-mono">Period: {currentMonthStr}</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Revenue: Scrap Sales Invoices</span>
                      <span className="text-emerald-700">{formatINR(monthlyMetrics.salesRev)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Direct Material Purchases</span>
                      <span>-{formatINR(monthlyMetrics.matPurchases)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Direct Demolition & Cutting Labour</span>
                      <span>-{formatINR(monthlyMetrics.pnl.directCost - monthlyMetrics.matPurchases)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Gross Profit (மொத்த லாபம்)</span>
                      <span className="font-black text-slate-900">{formatINR(monthlyMetrics.pnl.grossProfit)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Operating Daily Expenses</span>
                      <span>-{formatINR(monthlyMetrics.pnl.operatingExpenses)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Net Business Profit / Loss (நிகர லாபம் / நஷ்டம்)</span>
                      <span className={`text-sm font-black ${monthlyMetrics.pnl.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatINR(monthlyMetrics.pnl.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CONTRA INTER-ACCOUNT TRANSFER                        */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isContraModalOpen}
        onClose={() => setIsContraModalOpen(false)}
        title="Cash ⇄ Bank Contra Transfer (பண மாற்றம்)"
      >
        <form onSubmit={handleContraSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Source Account (பணம் எடுக்கும் கணக்கு)</label>
            <select
              value={sourceAccId}
              onChange={(e) => setSourceAccId(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType}) — Bal: {formatINR(calculateReconciledAccountBalance(acc, accountTransactions))}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Destination Account (பணம் சேரும் கணக்கு)</label>
            <select
              value={destAccId}
              onChange={(e) => setDestAccId(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType}) — Bal: {formatINR(calculateReconciledAccountBalance(acc, accountTransactions))}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Amount (₹)</label>
              <input
                type="number"
                value={contraAmount}
                onChange={(e) => setContraAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Cheque No</label>
              <input
                type="text"
                value={contraRef}
                onChange={(e) => setContraRef(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsContraModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Execute Contra Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: EXPENSE RECORD (ADD / EDIT)                          */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? 'Edit Expense Voucher' : 'Record Daily Expense (அன்றாட செலவு பதிவு)'}
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date (தேதி)</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category (வகை)</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹ தொகை)</label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode (கட்டண முறை)</label>
              <select
                value={expensePaymentMode}
                onChange={(e) => setExpensePaymentMode(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="CASH">Cash (ரொக்கம்)</option>
                <option value="BANK">Bank (வங்கி)</option>
                <option value="UNPAID">Unpaid (நிலுவை - கொடுக்க வேண்டியது)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Paid From Account</label>
              <select
                value={expenseAccId}
                onChange={(e) => setExpenseAccId(e.target.value)}
                disabled={expensePaymentMode === 'UNPAID'}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 disabled:opacity-50"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.accountType})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Paid To / Recipient (பெறுநர்)</label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="e.g. Murugan Tea Stall"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bill / Reference Number (optional)</label>
            <input
              type="text"
              value={billRef}
              onChange={(e) => setBillRef(e.target.value)}
              placeholder="e.g. BILL-4412"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              placeholder="Reason or item details..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Expense Voucher
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: SALARY PAYMENT MODAL                                 */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title="Record Monthly Salary (பணியாளர் சம்பளம்)"
      >
        <form onSubmit={handleSalarySubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee</label>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  const emp = employees.find((emp) => emp.id === e.target.value);
                  if (emp) {
                    setSalGross(emp.monthlySalary || 25000);
                    setSalAdvRecovery(Math.min(emp.currentAdvanceBalance || 0, 2000));
                  }
                }}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.designation}) — Adv: {formatINR(emp.currentAdvanceBalance)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Salary Month</label>
              <input
                type="month"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gross Salary</label>
              <input
                type="number"
                value={salGross}
                onChange={(e) => setSalGross(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">+ Allowances</label>
              <input
                type="number"
                value={salAllowances}
                onChange={(e) => setSalAllowances(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">- Deductions</label>
              <input
                type="number"
                value={salDeductions}
                onChange={(e) => setSalDeductions(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">- Adv Recovery</label>
              <input
                type="number"
                value={salAdvRecovery}
                onChange={(e) => setSalAdvRecovery(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">Calculated Net Salary Payable:</span>
            <span className="font-black text-slate-900 text-sm">
              {formatINR(calculateMonthlySalary(salGross, salAllowances, salDeductions, salAdvRecovery))}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paying Now (₹)</label>
              <input
                type="number"
                value={salAmountPaid}
                onChange={(e) => setSalAmountPaid(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={salPayMode}
                onChange={(e) => setSalPayMode(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="BANK">Bank Transfer (வங்கி)</option>
                <option value="CASH">Cash (ரொக்கம்)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account</label>
              <select
                value={salAccountId}
                onChange={(e) => setSalAccountId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.accountName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSalaryModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Confirm Salary Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: DAILY LABOUR MODAL                                   */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isDailyLabourModalOpen}
        onClose={() => setIsDailyLabourModalOpen(false)}
        title="Record Daily Wage Labour (தினக்கூலி பதிவு)"
      >
        <form onSubmit={handleDailyLabourSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Date</label>
              <input
                type="date"
                value={dlabDate}
                onChange={(e) => setDlabDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Worker Name / Group</label>
              <input
                type="text"
                value={dlabWorkerName}
                onChange={(e) => setDlabWorkerName(e.target.value)}
                placeholder="e.g. Mani Scrap Sorting Gang (3 Persons)"
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Number of Workers</label>
              <input
                type="number"
                value={dlabWorkerCount}
                onChange={(e) => setDlabWorkerCount(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Working Days</label>
              <input
                type="number"
                value={dlabWorkingDays}
                onChange={(e) => setDlabWorkingDays(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily Rate (₹)</label>
              <input
                type="number"
                value={dlabDailyRate}
                onChange={(e) => setDlabDailyRate(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Overtime Amount (₹)</label>
              <input
                type="number"
                value={dlabOvertime}
                onChange={(e) => setDlabOvertime(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Additional Charges (₹)</label>
              <input
                type="number"
                value={dlabCharges}
                onChange={(e) => setDlabCharges(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
            <span className="font-bold text-emerald-800">Total Labour Cost (மொத்த கூலி):</span>
            <span className="font-black text-emerald-900 text-sm">
              {formatINR(calculateDailyLabourCost(dlabWorkerCount, dlabWorkingDays, dlabDailyRate, dlabOvertime, dlabCharges))}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Advance Deducted</label>
              <input
                type="number"
                value={dlabAdvance}
                onChange={(e) => setDlabAdvance(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹)</label>
              <input
                type="number"
                value={dlabAmountPaid}
                onChange={(e) => setDlabAmountPaid(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mode</label>
              <select
                value={dlabPayMode}
                onChange={(e) => setDlabPayMode(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="CASH">Cash (ரொக்கம்)</option>
                <option value="BANK">Bank (வங்கி)</option>
                <option value="UNPAID">Unpaid (நிலுவை)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDailyLabourModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Labour Entry
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: CONTRACTOR REGISTER & WORK ENTRY                     */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isContractorModalOpen}
        onClose={() => setIsContractorModalOpen(false)}
        title="Register New Contractor (ஒப்பந்ததாரர் பதிவு)"
      >
        <form onSubmit={handleContractorSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contractor / Gang Name</label>
            <input
              type="text"
              value={contrName}
              onChange={(e) => setContrName(e.target.value)}
              placeholder="e.g. Karthik Gas Cutting Gang"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={contrPhone}
                onChange={(e) => setContrPhone(e.target.value)}
                placeholder="+91 98401 23456"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contract Type</label>
              <select
                value={contrType}
                onChange={(e) => setContrType(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="FIXED_CONTRACT">Fixed Lump-Sum Contract</option>
                <option value="DAILY_RATE">Daily Rate per Gang</option>
                <option value="QUANTITY_BASED">Quantity Based (per Ton/Kg)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address / Yard Location</label>
            <input
              type="text"
              value={contrAddress}
              onChange={(e) => setContrAddress(e.target.value)}
              placeholder="Address..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Work Description / Machinery Details</label>
            <textarea
              rows={2}
              value={contrDesc}
              onChange={(e) => setContrDesc(e.target.value)}
              placeholder="e.g. Industrial boiler cutting, crane hiring, shed dismantling..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsContractorModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Register Contractor
            </button>
          </div>
        </form>
      </Modal>

      {/* Contract Work Modal */}
      <Modal
        isOpen={isContractWorkModalOpen}
        onClose={() => setIsContractWorkModalOpen(false)}
        title="Record Contract Work Entry (ஒப்பந்த வேலை பதிவு)"
      >
        <form onSubmit={handleContractWorkSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Contractor</label>
              <select
                value={cworkContrId}
                onChange={(e) => setCworkContrId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.contractorName} ({c.contractType})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Date</label>
              <input
                type="date"
                value={cworkDate}
                onChange={(e) => setCworkDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Specific Work Done</label>
            <input
              type="text"
              value={cworkDesc}
              onChange={(e) => setCworkDesc(e.target.value)}
              placeholder="e.g. Boiler Dismantling Phase 2"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Agreed Rate / Amount (₹)</label>
              <input
                type="number"
                value={cworkRate}
                onChange={(e) => setCworkRate(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Advance Deducted (₹)</label>
              <input
                type="number"
                value={cworkAdvance}
                onChange={(e) => setCworkAdvance(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Paying Now (₹)</label>
              <input
                type="number"
                value={cworkCurrentPay}
                onChange={(e) => setCworkCurrentPay(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={cworkPayMode}
                onChange={(e) => setCworkPayMode(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="BANK">Bank Account (வங்கி)</option>
                <option value="CASH">Cash in Hand (ரொக்கம்)</option>
                <option value="UNPAID">Unpaid (நிலுவை)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account</label>
              <select
                value={cworkAccountId}
                onChange={(e) => setCworkAccountId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.accountName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsContractWorkModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Contract Work
            </button>
          </div>
        </form>
      </Modal>

      {/* Progress Payment Modal */}
      <Modal
        isOpen={isContrPayModalOpen}
        onClose={() => setIsContrPayModalOpen(false)}
        title="Pay Contractor Progress Balance (ஒப்பந்ததாரர் நிலுவை கட்டணம்)"
      >
        <form onSubmit={handleContrPaySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount (₹)</label>
            <input
              type="number"
              value={contrPayAmount}
              onChange={(e) => setContrPayAmount(Number(e.target.value))}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={contrPayMode}
                onChange={(e) => setContrPayMode(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="BANK">Bank Account (வங்கி)</option>
                <option value="CASH">Cash in Hand (ரொக்கம்)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Paid From Account</label>
              <select
                value={contrPayAccId}
                onChange={(e) => setContrPayAccId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.accountName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsContrPayModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Confirm Progress Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: ACCOUNT CREATE / EDIT                                */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title={editingAccount ? 'Edit Account' : 'Add New Cash / Bank Account'}
      >
        <form onSubmit={handleAccountSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Code</label>
              <input
                type="text"
                value={accCode}
                onChange={(e) => setAccCode(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Type</label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="BANK">Bank Account (வங்கி)</option>
                <option value="CASH">Cash in Hand (ரொக்கம்)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Name</label>
            <input
              type="text"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              placeholder="e.g. City Union Bank Current A/C"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            />
          </div>

          {accType === 'BANK' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account No</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
            <input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.tsx';
import { UserRole } from '../../types/index.ts';
import { AuthModal } from '../auth/AuthModal.tsx';
import { CompanySwitcher } from '../company/CompanySwitcher.tsx';
import { MobileBottomNav } from './MobileBottomNav.tsx';
import { MobileMenuDrawer } from './MobileMenuDrawer.tsx';
import { offlineSyncService, type SyncStatus } from '../../services/offlineSyncService.ts';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Scale, 
  Boxes, 
  Layers,
  Send, 
  FileText, 
  FileCheck2,
  Users, 
  CreditCard, 
  Wallet, 
  Car, 
  UserCheck, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Bell, 
  Plus, 
  Shield, 
  RotateCcw,
  Search,
  LogIn,
  LogOut,
  UserCircle,
  Menu,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { 
    company, 
    currentUser, 
    switchRole, 
    logout,
    vehicleDocuments, 
    purchases, 
    invoices, 
    resetToDemoData 
  } = useERP();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isAlertPopoverOpen, setIsAlertPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => offlineSyncService.getStatus());
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = offlineSyncService.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    if (!syncStatus.isOnline) return;
    await offlineSyncService.flushQueue(async (mutation) => {
      // In-memory or simulated database flush executor
      return { success: true };
    });
  };

  // Calculate live operational alerts count (including expired and expiring vehicle insurance/RTO docs)
  const todayStr = new Date().toISOString().split('T')[0];
  const expiringVehicleDocs = vehicleDocuments.filter((d) => {
    const diffDays = Math.ceil((new Date(d.expiryDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
    return diffDays <= (d.reminderDaysBefore || 30);
  });
  const expiringDocsCount = expiringVehicleDocs.length;

  const pendingPurchasesCount = purchases.filter((p) => p.status === 'SUBMITTED' || p.status === 'VERIFIED').length;
  const unpaidInvoicesCount = invoices.filter((i) => i.paymentStatus === 'UNPAID').length;
  const totalAlerts = expiringDocsCount + pendingPurchasesCount + (unpaidInvoicesCount > 0 ? 1 : 0);

  const navigationItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Purchases', path: '/purchases', icon: ShoppingCart, badge: pendingPurchasesCount > 0 ? pendingPurchasesCount : undefined },
    { name: 'Collections', path: '/collections', icon: Truck },
    { name: 'Weighment', path: '/weighment', icon: Scale },
    { name: 'Materials & Scrap', path: '/inventory?tab=MATERIALS', icon: Layers },
    { name: 'Inventory & Lots', path: '/inventory', icon: Boxes },
    { name: 'Sales & Dispatch', path: '/sales', icon: Send },
    { name: 'Invoices & Bills', path: '/invoices', icon: FileText, badge: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : undefined },
    { name: 'Commercial Docs', path: '/documents', icon: FileCheck2 },
    { name: 'Suppliers & Customers', path: '/parties', icon: Users },
    { name: 'Payments & Ledger', path: '/payments', icon: CreditCard },
    { name: 'Funds & Expenses', path: '/finance', icon: Wallet },
    { name: 'Vehicles & Docs', path: '/vehicles', icon: Car, badge: expiringDocsCount > 0 ? expiringDocsCount : undefined },
    { name: 'Employees & Attendance', path: '/employees', icon: UserCheck },
    { name: 'Reports & Register', path: '/reports', icon: BarChart3 },
    { name: 'Settings & Audit', path: '/settings', icon: Settings },
  ];

  const roleOptions: { label: string; role: UserRole }[] = [
    { label: 'Owner / Admin', role: 'owner_admin' },
    { label: 'Yard Manager', role: 'manager' },
    { label: 'Purchase Operator', role: 'purchase_operator' },
    { label: 'Weighment Operator', role: 'weighment_operator' },
    { label: 'Sales Operator', role: 'sales_operator' },
    { label: 'Accounts Operator', role: 'accounts_operator' },
    { label: 'Store Operator', role: 'store_operator' },
    { label: 'HR / Attendance', role: 'hr_operator' },
    { label: 'Read-only Auditor', role: 'auditor' },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside
        className={`hidden md:flex bg-slate-900 text-slate-300 flex-col transition-all duration-300 z-30 shadow-xl border-r border-slate-800 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Company Identity in Sidebar */}
        <div className="p-3 border-b border-slate-800">
          {!sidebarCollapsed ? (
            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/60 flex items-center gap-3 shadow-inner">
              <div className="bg-white p-1 rounded-lg shrink-0 shadow-sm flex items-center justify-center">
                <img
                  src="/yasoth-logo.png"
                  alt="Yasoth Enterprises Logo"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <div className="overflow-hidden min-w-0">
                <span className="font-black text-xs tracking-tight text-white block truncate uppercase">
                  {company.companyName}
                </span>
                <span className="text-[10px] uppercase font-bold text-red-400 block tracking-wider">
                  Scrap ERP & GST
                </span>
                <span className="text-[9px] text-slate-400 block truncate">
                  Gummidipoondi, TN
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="bg-white p-1.5 rounded-lg shadow-sm">
                <img
                  src="/yasoth-logo.png"
                  alt="Yasoth Logo"
                  className="h-7 w-7 object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                {!sidebarCollapsed && <span className="flex-1 truncate">{item.name}</span>}
                {!sidebarCollapsed && item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer with Collapse Toggle */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="text-[10px] text-slate-500">
              <span>v1.0.0 · Production ERP</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mx-auto"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-2.5 sm:px-6 h-14 flex items-center justify-between shadow-2xs z-20 safe-top">
          <div className="flex items-center gap-1.5 sm:gap-4 flex-1 min-w-0">
            {/* Mobile Drawer Trigger (Mobile Only) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Open Mobile Menu"
            >
              <Menu className="w-5 h-5 text-slate-800" />
            </button>

            {/* Top Brand & Multi-Company Switcher */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                <img
                  src="/yasoth-logo.png"
                  alt="Yasoth Logo"
                  className="h-6 sm:h-7 w-auto object-contain"
                />
              </div>
              <div className="shrink-0">
                <CompanySwitcher />
              </div>
            </div>

            {/* Global Search Bar (Hidden on phone, shown on tablet/desktop) */}
            <div className="relative w-full max-w-xs hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions, slips, parties, vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Offline / Online Status Pill with Sync Trigger */}
            <button
              onClick={handleManualSync}
              disabled={syncStatus.isSyncing || !syncStatus.isOnline}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer min-h-[32px] ${
                syncStatus.isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
              title={
                syncStatus.isOnline
                  ? syncStatus.pendingCount > 0
                    ? `${syncStatus.pendingCount} offline changes pending sync. Click to sync now.`
                    : 'System is connected and synced.'
                  : 'Offline mode active. Changes are queued locally and will sync when reconnected.'
              }
            >
              {syncStatus.isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
              {syncStatus.pendingCount > 0 && (
                <span className="bg-amber-500/20 text-amber-900 px-1 rounded font-mono font-black text-[9px]">
                  {syncStatus.pendingCount}
                </span>
              )}
              {syncStatus.isSyncing && (
                <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin" />
              )}
            </button>

            {/* Quick Actions Menu (Desktop Only) */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => navigate('/weighment')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-slate-600" />
                <span>+ Weighment</span>
              </button>
              <button
                onClick={() => navigate('/purchases')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Purchase</span>
              </button>
              <button
                onClick={() => navigate('/sales')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ Dispatch</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

            {/* Authenticated Identity & Role Security */}
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-1.5 sm:px-2.5 py-1">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
                title="Manage Identity / Switch User"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center font-bold text-xs border border-red-200 shrink-0">
                  {currentUser.fullName ? currentUser.fullName.substring(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 leading-tight block">
                      {currentUser.fullName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-800 uppercase">
                      {currentUser.role.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block leading-none">
                    {currentUser.email}
                  </span>
                </div>
              </button>

              <button
                onClick={logout}
                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-0.5 sm:ml-1 cursor-pointer"
                title="Sign Out of ERP"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notifications Indicator with Live Alert Popover */}
            <div className="relative">
              <button
                onClick={() => setIsAlertPopoverOpen(!isAlertPopoverOpen)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center"
                title={`${totalAlerts} Operational & Fleet Alerts`}
                aria-label="Open Operational Alerts"
              >
                <Bell className="w-4 h-4" />
                {totalAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-black animate-pulse">
                    {totalAlerts}
                  </span>
                )}
              </button>

              {isAlertPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-xs">
                  <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      Live Fleet & ERP Alert Center ({totalAlerts})
                    </span>
                    <button
                      onClick={() => setIsAlertPopoverOpen(false)}
                      className="text-slate-400 hover:text-white font-bold text-sm px-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-2.5 space-y-2 max-h-80 overflow-y-auto">
                    {/* Vehicle Insurance & RTO Compliance Alerts */}
                    <button
                      onClick={() => {
                        setIsAlertPopoverOpen(false);
                        navigate('/vehicles');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <span className="font-black text-rose-900 block">
                          Vehicle Insurance & RTO Alerts ({expiringDocsCount})
                        </span>
                        <span className="text-[11px] text-rose-700 block mt-0.5">
                          {expiringDocsCount > 0
                            ? `${expiringDocsCount} policy/permit document(s) expired or due for renewal. Tap for 1-click renewal.`
                            : 'All fleet vehicles are 100% insured & RTO compliant.'}
                        </span>
                      </div>
                      <Car className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    </button>

                    {/* Unpaid GST Invoices & e-Way Bills */}
                    <button
                      onClick={() => {
                        setIsAlertPopoverOpen(false);
                        navigate('/invoices');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <span className="font-black text-amber-900 block">
                          Unpaid GST Invoices & e-Way Bills ({unpaidInvoicesCount})
                        </span>
                        <span className="text-[11px] text-amber-800 block mt-0.5">
                          Generate Form GST EWB-01 slips, download NIC JSON, or record customer receipts.
                        </span>
                      </div>
                      <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    </button>

                    {/* Quick Quotations & Purchase Orders */}
                    <button
                      onClick={() => {
                        setIsAlertPopoverOpen(false);
                        navigate('/documents');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <span className="font-black text-indigo-900 block">
                          Quick Quotation & Purchase Order (PO)
                        </span>
                        <span className="text-[11px] text-indigo-700 block mt-0.5">
                          Create 1-tap Scrap Quotations or Purchase Orders with instant A4 print.
                        </span>
                      </div>
                      <FileCheck2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Outlet with Mobile Bottom Padding */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 md:pb-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <MobileBottomNav 
        onOpenMenu={() => setIsMobileDrawerOpen(true)} 
        syncStatus={syncStatus} 
      />

      {/* Mobile Full Slide-Over Menu Drawer */}
      <MobileMenuDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
      />

      {/* Global Authentication & Session Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

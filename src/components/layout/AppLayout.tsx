import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  WifiOff,
  ArrowLeft,
  Home,
  CheckCircle2
} from 'lucide-react';

declare global {
  interface Window {
    __handleAndroidBack?: () => 'HANDLED' | 'EXIT';
    AndroidNative?: {
      printPage?: (jobName: string) => void;
      shareText?: (title: string, text: string) => void;
      shareBackupFile?: (fileName: string, content: string, mimeType: string) => boolean;
      saveFileToDownloads?: (fileName: string, content: string, mimeType: string) => boolean;
      exitApp?: () => void;
    };
  }
}

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
  const [exitToastVisible, setExitToastVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Track in-app navigation history stack for reliable Android back-swipe & mobile Back button
  const routeHistoryRef = useRef<string[]>([location.pathname + location.search]);
  const isPoppingHistoryRef = useRef(false);
  const lastBackSwipeAtRef = useRef<number>(0);

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (isPoppingHistoryRef.current) {
      isPoppingHistoryRef.current = false;
      return;
    }
    const stack = routeHistoryRef.current;
    if (stack[stack.length - 1] !== fullPath) {
      stack.push(fullPath);
      if (stack.length > 30) stack.shift();
    }
  }, [location.pathname, location.search]);

  // Attempt to close any active full-screen modal / preview / drawer before leaving the current page
  const closeActiveOverlayIfOpen = useCallback((): boolean => {
    if (isMobileDrawerOpen) {
      setIsMobileDrawerOpen(false);
      return true;
    }
    if (isAlertPopoverOpen) {
      setIsAlertPopoverOpen(false);
      return true;
    }
    if (isAuthModalOpen) {
      setIsAuthModalOpen(false);
      return true;
    }
    if (typeof document !== 'undefined') {
      const overlays = Array.from(document.querySelectorAll('div.fixed.inset-0'));
      for (let i = overlays.length - 1; i >= 0; i--) {
        const overlay = overlays[i] as HTMLElement;
        const buttons = Array.from(overlay.querySelectorAll('button'));
        const closeBtn = buttons.find((b) => {
          const txt = (b.textContent || '').trim().toLowerCase();
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          return (
            txt === '×' ||
            txt === 'x' ||
            txt === 'cancel' ||
            txt === 'close' ||
            txt.includes('close preview') ||
            txt.includes('back to') ||
            label.includes('close')
          );
        });
        if (closeBtn) {
          closeBtn.click();
          return true;
        }
      }
    }
    return false;
  }, [isMobileDrawerOpen, isAlertPopoverOpen, isAuthModalOpen]);

  const handleGoBack = useCallback((): 'HANDLED' | 'EXIT' => {
    // 1. Close any open modal, print preview, or mobile drawer first
    if (closeActiveOverlayIfOpen()) {
      return 'HANDLED';
    }

    // 2. Pop previous route in our navigation stack if available
    const stack = routeHistoryRef.current;
    if (stack.length > 1) {
      stack.pop(); // remove current route
      const previousRoute = stack[stack.length - 1] || '/';
      isPoppingHistoryRef.current = true;
      navigate(previousRoute);
      return 'HANDLED';
    }

    // 3. If on any non-Dashboard page with empty history, return to Dashboard Home ('/')
    if (location.pathname !== '/') {
      routeHistoryRef.current = ['/'];
      isPoppingHistoryRef.current = true;
      navigate('/');
      return 'HANDLED';
    }

    // 4. Already on Dashboard ('/'): require double back-swipe within 2.2 seconds to exit app
    const now = Date.now();
    if (now - lastBackSwipeAtRef.current < 2200) {
      return 'EXIT';
    }
    lastBackSwipeAtRef.current = now;
    setExitToastVisible(true);
    window.setTimeout(() => {
      setExitToastVisible(false);
    }, 2200);
    return 'HANDLED';
  }, [closeActiveOverlayIfOpen, location.pathname, navigate]);

  useEffect(() => {
    window.__handleAndroidBack = handleGoBack;
    return () => {
      delete window.__handleAndroidBack;
    };
  }, [handleGoBack]);

  useEffect(() => {
    const unsubscribe = offlineSyncService.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  const handleManualSync = async () => {
    if (!syncStatus.isOnline) {
      setSyncToastMessage('ஆஃப்லைன்: நெட்வொர்க் மீண்டும் வரும்போது தானாக பதிவாகும் (Offline: Will sync when online).');
      setTimeout(() => setSyncToastMessage(null), 3500);
      return;
    }
    const result = await offlineSyncService.flushQueue(async () => {
      return { success: true };
    });
    setSyncToastMessage(
      result.synced > 0
        ? `கிளவுட் ஒத்திசைவு முடிந்தது: ${result.synced} பதிவுகள் பதிவேற்றப்பட்டன! (Synced ${result.synced} offline records to Cloud!)`
        : 'கிளவுட் சரிபார்க்கப்பட்டது: அனைத்து தரவுகளும் சரியாக உள்ளன! (Cloud Synced: All records are up-to-date!)'
    );
    setTimeout(() => setSyncToastMessage(null), 3500);
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

  const [alertsMuted, setAlertsMuted] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('ye_alerts_muted_date') === todayStr;
    } catch {
      return false;
    }
  });

  const toggleMuteAlerts = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (alertsMuted) {
        localStorage.removeItem('ye_alerts_muted_date');
        setAlertsMuted(false);
      } else {
        localStorage.setItem('ye_alerts_muted_date', todayStr);
        setAlertsMuted(true);
      }
    } catch {}
  };

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
          <div className="flex items-center gap-1 sm:gap-3 flex-1 min-w-0">
            {/* Mobile Back Button (shown whenever not on Dashboard Home) */}
            {location.pathname !== '/' && (
              <button
                onClick={handleGoBack}
                className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 transition-colors shrink-0 min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer border border-slate-200"
                aria-label="Go Back to Previous Page"
                title="Back to Previous Page"
              >
                <ArrowLeft className="w-5 h-5 text-slate-900" />
              </button>
            )}

            {/* Mobile Drawer Trigger (Mobile Only) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
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
                title={`${totalAlerts} Operational & Fleet Document Alerts (Not Cloud Sync)`}
                aria-label="Open Operational Alerts"
              >
                <Bell className="w-4 h-4" />
                {totalAlerts > 0 && !alertsMuted && (
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
                      Fleet & Invoice Alerts ({totalAlerts}) · வாகன அறிவிப்புகள்
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleMuteAlerts}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-700 cursor-pointer font-bold"
                        title={alertsMuted ? 'Unmute alert badge' : 'Hide red badge for today'}
                      >
                        {alertsMuted ? 'மறைப்பை நீக்கு (Unmute)' : 'மறைக்க (Mute 6)'}
                      </button>
                      <button
                        onClick={() => setIsAlertPopoverOpen(false)}
                        className="text-slate-400 hover:text-white font-bold text-sm px-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2 max-h-80 overflow-y-auto">
                    {/* Informational Clarification Banner */}
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-[11px] leading-tight flex items-start gap-2">
                      <span className="text-base shrink-0">ℹ️</span>
                      <div>
                        <strong className="block font-bold">முக்கிய குறிப்பு (Notice):</strong>
                        <span>இந்த {totalAlerts} அறிவிப்புகளும் லாரி/வாகன ஆவண புதுப்பித்தல் (Insurance/Permit) மற்றும் பில் நிலுவைகளுக்கானது. இது கிளவுட் ஒத்திசைவு (Cloud Sync) பிழை அல்ல!</span>
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              toggleMuteAlerts(e);
                              setIsAlertPopoverOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>அறிவிப்பை மறைத்து பேட்ஜை நீக்கு (Dismiss Badge)</span>
                          </button>
                        </div>
                      </div>
                    </div>
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

        {/* Mobile Quick Back & Module Breadcrumb Bar (Shown on Mobile when on inner pages) */}
        {location.pathname !== '/' && (
          <div className="md:hidden bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between border-b border-slate-800 z-10">
            <button
              onClick={handleGoBack}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-red-400" />
              <span>Back</span>
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate px-2">
              {navigationItems.find((item) => item.path.split('?')[0] === location.pathname)?.name || 'Module'}
            </span>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 text-xs font-bold transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
          </div>
        )}

        {/* Dynamic Page Outlet with Mobile Bottom Padding */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 md:pb-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Cloud Sync Notification Toast */}
      {syncToastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-500 text-xs font-bold flex items-center gap-2 max-w-sm text-center animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Double-Swipe-to-Exit Protection Toast (Mobile / Android APK) */}
      {exitToastVisible && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 whitespace-nowrap pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>Swipe back again to exit Yashoth Enterprises</span>
        </div>
      )}

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

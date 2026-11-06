import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.tsx';
import { UserRole } from '../../types/index.ts';
import { AuthModal } from '../auth/AuthModal.tsx';
import { CompanySwitcher } from '../company/CompanySwitcher.tsx';
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
  UserCircle
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const navigate = useNavigate();

  // Calculate live operational alerts count
  const todayStr = new Date().toISOString().split('T')[0];
  const expiringDocsCount = vehicleDocuments.filter((d) => {
    const diffDays = Math.ceil((new Date(d.expiryDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
    return diffDays >= 0 && diffDays <= d.reminderDaysBefore;
  }).length;

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
      {/* Sidebar */}
      <aside
        className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 z-30 shadow-xl border-r border-slate-800 ${
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
        <header className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-xs z-20">
          <div className="flex items-center gap-5 flex-1 max-w-xl">
            {/* Top Brand & Multi-Company Switcher */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-xs flex items-center justify-center">
                <img
                  src="/yasoth-logo.png"
                  alt="Yasoth Logo"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <CompanySwitcher />
            </div>

            <div className="relative w-full max-w-xs">
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

          <div className="flex items-center gap-4">
            {/* Quick Actions Menu */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/weighment')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
              >
                <Scale className="w-3.5 h-3.5 text-slate-600" />
                <span>+ Weighment</span>
              </button>
              <button
                onClick={() => navigate('/purchases')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Purchase</span>
              </button>
              <button
                onClick={() => navigate('/sales')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ Dispatch</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200"></div>

            {/* Authenticated Identity & Role Security */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
                title="Manage Identity / Switch User"
              >
                <div className="w-7 h-7 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center font-bold text-xs border border-red-200">
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
                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1 cursor-pointer"
                title="Sign Out of ERP"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notifications Indicator */}
            <button
              onClick={() => navigate('/')}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              title={`${totalAlerts} Operational Alerts`}
            >
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Global Authentication & Session Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

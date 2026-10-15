import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.tsx';
import { UserRole } from '../../types/index.ts';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Scale, 
  Boxes, 
  Send, 
  FileText, 
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
  Search
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { 
    company, 
    currentUser, 
    switchRole, 
    vehicleDocuments, 
    purchases, 
    invoices, 
    resetToDemoData 
  } = useERP();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    { name: 'Inventory & Lots', path: '/inventory', icon: Boxes },
    { name: 'Sales & Dispatch', path: '/sales', icon: Send },
    { name: 'Invoices & Bills', path: '/invoices', icon: FileText, badge: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : undefined },
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
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          <img
            src="/yasoth-logo.png"
            alt="Yasoth Logo"
            className="w-9 h-9 object-contain bg-white rounded-lg p-0.5 shadow-sm shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <span className="font-extrabold text-sm tracking-wide text-white block truncate">
                {company.companyName}
              </span>
              <span className="text-[10px] uppercase font-semibold text-red-400 block tracking-widest">
                Scrap ERP
              </span>
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
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-20">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
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

            {/* Role Switcher Dropdown (Essential for testing all roles) */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
              <Shield className="w-3.5 h-3.5 text-red-600" />
              <div className="text-left">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block leading-none">
                  Active Role
                </span>
                <select
                  value={currentUser.role}
                  onChange={(e) => switchRole(e.target.value as UserRole)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.role} value={opt.role}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notifications Indicator */}
            <button
              onClick={() => navigate('/')}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
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
    </div>
  );
};

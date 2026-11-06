import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  X,
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
  RefreshCw,
  Wifi,
  WifiOff,
  LogOut,
  Building2,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { useERP } from '../../context/ERPContext.tsx';
import { CompanySwitcher } from '../company/CompanySwitcher.tsx';
import type { SyncStatus } from '../../services/offlineSyncService.ts';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onManualSync: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onManualSync,
}) => {
  const { currentUser, company, logout } = useERP();

  if (!isOpen) return null;

  const modules = [
    {
      category: 'Operations & Yard',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Weighment Entry', path: '/weighment', icon: Scale },
        { name: 'Inward Purchases', path: '/purchases', icon: ShoppingCart },
        { name: 'Collections & Site Jobs', path: '/collections', icon: Truck },
        { name: 'Inventory & Lots (FIFO)', path: '/inventory', icon: Boxes },
        { name: 'Material Grades & HSN', path: '/inventory?tab=MATERIALS', icon: Layers },
        { name: 'Sales & Outbound Dispatch', path: '/sales', icon: Send },
      ],
    },
    {
      category: 'Accounting & Commercial',
      items: [
        { name: 'GST Tax Invoices', path: '/invoices', icon: FileText },
        { name: 'Commercial Docs (DN/CN/Quote)', path: '/documents', icon: FileCheck2 },
        { name: 'Suppliers & Customers', path: '/parties', icon: Users },
        { name: 'Payments & Ledgers', path: '/payments', icon: CreditCard },
        { name: 'Cash, Bank & Expenses', path: '/finance', icon: Wallet },
      ],
    },
    {
      category: 'Fleet, HR & Admin',
      items: [
        { name: 'Vehicles & Compliance', path: '/vehicles', icon: Car },
        { name: 'Employees & Attendance', path: '/employees', icon: UserCheck },
        { name: 'Financial Statements & Excel', path: '/reports', icon: BarChart3 },
        { name: 'Backup & Restore Manager', path: '/settings', icon: Database },
      ],
    },
  ];

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-200 shadow-2xl safe-top safe-bottom z-50">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white p-1 rounded-lg">
              <img src="/yasoth-logo.png" alt="YE Logo" className="h-6 w-auto" />
            </div>
            <div>
              <span className="text-xs font-black tracking-tight text-white block uppercase">
                {company.companyName}
              </span>
              <span className="text-[9px] text-red-400 font-bold block uppercase tracking-wider">
                Mobile ERP
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Switcher inside mobile drawer */}
        <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">
            Active Entity
          </span>
          <CompanySwitcher />
        </div>

        {/* Offline Sync Status Banner */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {syncStatus.isOnline ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                  <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Offline Mode</span>
                </div>
              )}
              {syncStatus.pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {syncStatus.pendingCount} queued
                </span>
              )}
            </div>

            <button
              onClick={onManualSync}
              disabled={syncStatus.isSyncing || !syncStatus.isOnline}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                syncStatus.isSyncing
                  ? 'text-slate-500 animate-spin'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40'
              }`}
              title="Synchronize offline queue with server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Sync</span>
            </button>
          </div>
          {syncStatus.lastSyncAt && (
            <p className="text-[9px] text-slate-500 font-mono mt-1">
              Last synced: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Scrollable Navigation Modules */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
          {modules.map((group) => (
            <div key={group.category} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 block">
                {group.category}
              </span>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-red-600 text-white font-bold shadow-md shadow-red-600/20'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:scale-98'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Drawer Footer with User Credentials & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-black text-xs shrink-0">
              {currentUser.fullName ? currentUser.fullName.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="overflow-hidden min-w-0">
              <span className="text-xs font-bold text-white block truncate leading-tight">
                {currentUser.fullName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block truncate">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

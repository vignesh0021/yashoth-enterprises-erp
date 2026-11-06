import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Scale, 
  Send, 
  Wallet, 
  Menu,
  FileCheck2,
  CloudOff
} from 'lucide-react';
import { useERP } from '../../context/ERPContext.tsx';
import type { SyncStatus } from '../../services/offlineSyncService.ts';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  syncStatus?: SyncStatus;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu, syncStatus }) => {
  const { purchases, invoices, commercialDocuments } = useERP();

  const pendingPurchases = purchases.filter((p) => p.status === 'SUBMITTED' || p.status === 'VERIFIED').length;
  const unpaidInvoices = invoices.filter((i) => i.paymentStatus === 'UNPAID').length;
  const quoteCount = commercialDocuments.filter(d => d.documentType === 'QUOTATION').length;
  const pendingOffline = syncStatus?.pendingCount || 0;

  const navItems = [
    { label: 'Home', path: '/', icon: LayoutDashboard },
    { label: 'Weighment', path: '/weighment', icon: Scale },
    { 
      label: 'Quotes/Docs', 
      path: '/documents', 
      icon: FileCheck2,
      badge: quoteCount > 0 ? quoteCount : undefined
    },
    { 
      label: 'Sales', 
      path: '/sales', 
      icon: Send, 
      badge: unpaidInvoices > 0 ? unpaidInvoices : undefined 
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 select-none safe-bottom shadow-2xl"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full min-w-[56px] py-1 transition-all relative group ${
                  isActive
                    ? 'text-red-500 font-bold'
                    : 'hover:text-slate-200 text-slate-400 active:scale-95'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {item.badge !== undefined && (
                      <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-900">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5 block truncate max-w-[64px]">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 w-1 h-1 bg-red-500 rounded-full"></span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* More Menu Drawer Trigger */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center flex-1 h-full min-w-[56px] py-1 text-slate-400 hover:text-white active:scale-95 transition-all relative"
          aria-label="Open Full Navigation Menu"
        >
          <div className="relative">
            <Menu className="w-5 h-5" />
            {pendingOffline > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 bg-amber-500 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center border border-slate-900">
                {pendingOffline}
              </span>
            )}
            {!syncStatus?.isOnline && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 block">Menu</span>
        </button>
      </div>
    </nav>
  );
};

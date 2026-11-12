/**
 * YASHOTH ENTERPRISES ERP — BILINGUAL TRANSLATION ENGINE (TAMIL & ENGLISH)
 * 
 * Provides complete linguistic coverage for:
 * 1. Navigation & App Chrome
 * 2. Weighbridge & Gate Ledger
 * 3. Finance, Double-Entry & Cash Closing
 * 4. Daily Labour, Advances & Payroll
 * 5. Quotations, Invoices & e-Way Bills
 * 6. Inventory & Scrap Lots
 * 7. Fleet Compliance & Settings
 */

export type AppLanguage = 'en' | 'ta';

export const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.purchases': 'Purchases',
    'nav.collections': 'Collections',
    'nav.weighment': 'Weighment',
    'nav.materials': 'Materials & Scrap',
    'nav.inventory': 'Inventory & Lots',
    'nav.sales': 'Sales & Dispatch',
    'nav.invoices': 'Invoices & Bills',
    'nav.documents': 'Commercial Docs',
    'nav.parties': 'Suppliers & Customers',
    'nav.payments': 'Payments & Receipts',
    'nav.finance': 'Finance & Accounts',
    'nav.vehicles': 'Vehicles & Fleet',
    'nav.employees': 'Staff & Workers',
    'nav.reports': 'Financial Reports',
    'nav.settings': 'Settings & Backup',
    'nav.home': 'Home',
    'nav.menu': 'Menu',
    'nav.back': 'Back',
    'nav.search_placeholder': 'Search transactions, slips, parties, vehicles...',

    // System Status
    'status.online': 'Online',
    'status.offline': 'Offline',
    'status.sync_now': 'Sync Now',
    'status.synced': 'Cloud Synced',
    'status.syncing': 'Syncing...',
    'status.pending_sync': 'offline changes pending sync',
    'status.alerts': 'Fleet & Invoice Alerts',
    'status.dismiss_badge': 'Dismiss Badge',
    'status.mute_badge': 'Mute Badge',
    'status.unmute': 'Unmute',

    // Common Actions
    'action.save': 'Save',
    'action.save_changes': 'Save Changes',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.confirm': 'Confirm',
    'action.record': 'Record Entry',
    'action.add': 'Add New',
    'action.filter': 'Filter',
    'action.search': 'Search',
    'action.download': 'Download',
    'action.upload': 'Upload',
    'action.print': 'Print A4',
    'action.share': 'Share',
    'action.export_csv': 'Export CSV',
    'action.view': 'View',
    'action.close': 'Close',

    // Weighment
    'weigh.title': 'Weighment Engine & Slip Register',
    'weigh.subtitle': 'Full CRUD operations for recording gate weighments, tare deductions, duplicate checks, and payable weights.',
    'weigh.record_slip': 'Record Weighment Slip',
    'weigh.edit_slip': 'Edit Weighment Slip',
    'weigh.method': 'Weighing Method',
    'weigh.slip_ref': 'Weighbridge Slip Ref #',
    'weigh.vehicle_reg': 'Vehicle Registration #',
    'weigh.gross_weight': 'Gross Weight (Loaded) KG',
    'weigh.tare_weight': 'Tare Weight (Empty) KG',
    'weigh.deductions': 'Approved Deductions (Dirt/Water) KG',
    'weigh.net_weight': 'Net Weight (KG)',
    'weigh.payable_weight': 'Payable Weight (KG)',
    'weigh.remarks': 'Inspector / Yard Remarks',
    'weigh.duplicate_warning': 'Warning: Slip reference already exists!',
    'weigh.slip_number': 'Weighment #',
    'weigh.time': 'Time',
    'weigh.status': 'Status',
    'weigh.actions': 'Actions',
    'weigh.no_records': 'No weighment records entered. Click "Record Weighment Slip" to register truck weight.',

    // Finance & Accounts
    'fin.title': 'Finance & Accounts Management',
    'fin.subtitle': 'Yashoth Enterprises Small-Business Finance Ledger',
    'fin.cash_bank_transfer': 'Cash ⇄ Bank',
    'fin.new_expense': '+ New Expense',
    'fin.tab_cockpit': 'Cockpit',
    'fin.tab_expenses': 'Daily Expenses',
    'fin.tab_salary': 'Staff Salary',
    'fin.tab_labour': 'Daily Labour',
    'fin.tab_contractors': 'Contractors',
    'fin.tab_cash_bank': 'Cash & Bank',
    'fin.tab_daily_closing': 'Daily Closing',
    'fin.tab_reports': 'Reports (11)',
    'fin.cash_in_hand': 'Cash in Hand',
    'fin.bank_balance': 'Bank Balance',
    'fin.today_income': "Today's Income",
    'fin.today_expense': "Today's Expense",
    'fin.net_balance': 'Net Liquidity',
    'fin.advance_balance': 'Outstanding Advance',
    'fin.record_advance': 'Issue Advance',
    'fin.advance_recovery': 'Advance Recovered',
    'fin.net_payable': 'Net Payable Wage',
    'fin.daily_wage': 'Daily Wage',
    'fin.overtime': 'Overtime Pay',
    'fin.double_shift': 'Double Shift',
    'fin.close_day': 'Perform Day Closing',

    // Commercial Documents & Invoices
    'doc.quotes_and_pos': 'Scrap Quotations & Purchase Orders',
    'doc.tax_invoice': 'GST Tax Invoice',
    'doc.eway_bill': 'e-Way Bill Form GST EWB-01',
    'doc.new_quote': 'Create Quotation',
    'doc.new_po': 'Create Purchase Order',
    'doc.proprietor': 'Prop. P. Nandha Kumar',
    'doc.seal_verified': 'Authentic Letterhead & Seal Ready',
    'doc.gstin': 'GSTIN: 33AXVPN9382L1ZF',

    // Backup & Settings
    'settings.title': 'System Settings & Data Migration',
    'settings.tab_profile': 'Company & Tax Profile',
    'settings.tab_roles': 'Role-Based Access Control',
    'settings.tab_migration': 'Data Migration Wizard',
    'settings.tab_backup': 'Backup & Restore',
    'settings.backup_title': 'Create System Backup Archive',
    'settings.save_drive': 'Save to Google Drive / Share Sheet',
    'settings.email_backup': '1-Tap Email Backup to yashothenterprises44@gmail.com',
    'settings.download_backup': 'Download Backup to Device',

    // Dashboard & Cockpit
    'dash.title': 'Yard Cockpit & Operations',
    'dash.subtitle': 'Real-Time Scrap Balances, Weighment Throughput & Inward/Outward Flux',
    'dash.total_stock': 'Total Yard Stock (MT)',
    'dash.today_purchases': "Today's Purchases",
    'dash.today_dispatches': "Today's Dispatches",
    'dash.receivables': 'Pending Receivables',
    'dash.quick_actions': 'Quick Actions',
    'dash.weigh_truck': '+ Weigh Truck',
    'dash.inward_po': '+ Inward Purchase',
    'dash.outward_sale': '+ Outward Dispatch',
    'dash.gen_invoice': '+ Create GST Invoice',
    'dash.new_quote': '+ Create Quotation',
    'dash.recent_tx': 'Recent Yard Transactions',

    // Purchases & Inward
    'purchases.title': 'Inward Purchases & Material Receiving',
    'purchases.subtitle': 'Log gate entries, assign FIFO lots, grade deductions, and supplier bill liabilities.',
    'purchases.new_entry': 'New Inward Purchase',
    'purchases.supplier': 'Supplier / Vendor',
    'purchases.gross_amount': 'Gross Amount',
    'purchases.net_payable': 'Net Payable',

    // Sales & Outbound
    'sales.title': 'Outbound Sales & Yard Dispatch',
    'sales.subtitle': 'Dispatches, weighment reconciliation, loading slips, and buyer invoicing.',
    'sales.new_dispatch': 'New Sales Dispatch',
    'sales.buyer': 'Buyer / Customer',
    'sales.destination': 'Delivery Destination',

    // Inventory & FIFO Lots
    'inv.title': 'Inventory Ledger & FIFO Stock Lots',
    'inv.subtitle': 'Strict first-in-first-out cost layers, grade balances, and scrap valuation.',
    'inv.stock_value': 'Total Stock Valuation',
    'inv.available_mt': 'Available Metric Tonnes',
    'inv.materials_master': 'Material Grades & HSN Master',

    // Parties & Ledgers
    'parties.title': 'Parties (Suppliers & Buyers)',
    'parties.subtitle': 'KYC, GSTIN verification, credit limits, and running balance ledgers.',
    'parties.add_party': 'Add New Party',
    'parties.vendor_count': 'Active Suppliers',
    'parties.customer_count': 'Active Buyers',

    // Vehicles & Fleet Compliance
    'vehicles.title': 'Fleet Management & Statutory Compliance',
    'vehicles.subtitle': 'Track RC, Insurance, Fitness, Pollution, and National Permits for all trucks.',
    'vehicles.add_vehicle': 'Register Vehicle',
    'vehicles.compliance_score': 'Compliance Score',
    'vehicles.expired_docs': 'Expired Documents',
    'vehicles.vahan_lookup': 'Free Vahan RTO Lookup',

    // Employees & Daily Labour
    'emp.title': 'Staff, Operators & Daily Labour',
    'emp.subtitle': 'Attendance tracking, shift allowances, cash advances, and payroll vouchers.',
    'emp.add_employee': 'Add Employee / Worker',
    'emp.daily_attendance': 'Daily Attendance',
    'emp.active_staff': 'Active Staff Members',

    // Language Toggle
    'lang.switch': 'தமிழ்',
    'lang.current': 'English',
  },
  ta: {
    // Navigation
    'nav.dashboard': 'முகப்பு (கண்ணோட்டம்)',
    'nav.purchases': 'கொள்முதல் (Purchases)',
    'nav.collections': 'சேகரிப்பு (Collections)',
    'nav.weighment': 'எடை மேடை (Weighment)',
    'nav.materials': 'இரும்பு வகைகள் (Materials)',
    'nav.inventory': 'கையிருப்பு & லாட்கள் (Stock)',
    'nav.sales': 'விற்பனை & அனுப்புதல் (Sales)',
    'nav.invoices': 'ஜிஎஸ்டி பில்கள் (Invoices)',
    'nav.documents': 'கொட்டேஷன் & ஆணைகள் (Docs)',
    'nav.parties': 'வாடிக்கையாளர் & சப்ளையர்',
    'nav.payments': 'வரவு & செலவு (Payments)',
    'nav.finance': 'நிதி & கணக்குகள் (Finance)',
    'nav.vehicles': 'லாரிகள் & வாகனங்கள் (Fleet)',
    'nav.employees': 'பணியாளர்கள் & தொழிலாளர்',
    'nav.reports': 'கணக்கு அறிக்கைகள் (Reports)',
    'nav.settings': 'அமைப்புகள் & பேக்கப் (Settings)',
    'nav.home': 'முகப்பு',
    'nav.menu': 'பட்டியல்',
    'nav.back': 'பின்செல்',
    'nav.search_placeholder': 'ரசீது, வண்டி எண், பார்ட்டி, கணக்குகளைத் தேடுக...',

    // System Status
    'status.online': 'ஆன்லைன் (இணைக்கப்பட்டது)',
    'status.offline': 'ஆஃப்லைன் (இணைப்பில்லை)',
    'status.sync_now': 'இப்போதே ஒத்திசை',
    'status.synced': 'கிளவுட் ஒத்திசைக்கப்பட்டது',
    'status.syncing': 'ஒத்திசைக்கப்படுகிறது...',
    'status.pending_sync': 'பதிவுகள் கிளவுடில் பதிய நிலுவை',
    'status.alerts': 'வாகன & கட்டண நிலுவை அறிவிப்புகள்',
    'status.dismiss_badge': 'அறிவிப்பை மறைக்க',
    'status.mute_badge': 'பேட்ஜை மறைக்க',
    'status.unmute': 'மீண்டும் காட்டுக',

    // Common Actions
    'action.save': 'சேமிக்க',
    'action.save_changes': 'மாற்றங்களைச் சேமிக்க',
    'action.cancel': 'ரத்து செய்க',
    'action.delete': 'நீக்குக',
    'action.edit': 'திருத்துக',
    'action.confirm': 'உறுதி செய்க',
    'action.record': 'பதிவு செய்க',
    'action.add': 'புதிய பதிவு',
    'action.filter': 'வடிகட்டுக',
    'action.search': 'தேடுக',
    'action.download': 'பதிவிறக்கு',
    'action.upload': 'பதிவேற்று',
    'action.print': 'A4 அச்சிடுக (Print)',
    'action.share': 'பகிர்ந்திடுக (Share)',
    'action.export_csv': 'எக்செல் CSV பதிவிறக்கு',
    'action.view': 'காண்க',
    'action.close': 'மூடுக',

    // Weighment
    'weigh.title': 'எடை மேடை & ரசீது பதிவேடு',
    'weigh.subtitle': 'வண்டி எடை பதிவு, வெற்று எடை கழிவு, நிகர எடை மற்றும் கொள்முதல் எடை தானியங்கி கணக்கீடு.',
    'weigh.record_slip': 'எடை ரசீது பதிவு செய்க',
    'weigh.edit_slip': 'எடை ரசீதை திருத்துக',
    'weigh.method': 'எடை முறை (Weighing Method)',
    'weigh.slip_ref': 'வேபிரிட்ஜ் ரசீது எண் (Slip #)',
    'weigh.vehicle_reg': 'வண்டி பதிவு எண் (Vehicle Reg)',
    'weigh.gross_weight': 'மொத்த எடை (வண்டியுடன்) KG',
    'weigh.tare_weight': 'வெற்று வண்டி எடை KG',
    'weigh.deductions': 'அங்கீகரிக்கப்பட்ட கழிவு KG',
    'weigh.net_weight': 'நிகர எடை (Net Weight) KG',
    'weigh.payable_weight': 'கொள்முதல் எடை (Payable) KG',
    'weigh.remarks': 'யார்டு மேற்பார்வையாளர் குறிப்பு',
    'weigh.duplicate_warning': 'எச்சரிக்கை: இந்த ரசீது எண் ஏற்கனவே பதிவாகியுள்ளது!',
    'weigh.slip_number': 'எடை ரசீது #',
    'weigh.time': 'நேரம்',
    'weigh.status': 'நிலை (Status)',
    'weigh.actions': 'செயல்கள்',
    'weigh.no_records': 'எடை பதிவுகள் ஏதுமில்லை. எடை ரசீது பதிவு செய்ய மேலே உள்ள பட்டனை அழுத்தவும்.',

    // Finance & Accounts
    'fin.title': 'நிதி மற்றும் கணக்கு மேலாண்மை',
    'fin.subtitle': 'யசோத் எண்டர்பிரைசஸ் அதிகாரப்பூர்வ இரட்டைப் பதிவு கணக்கு ஏடு',
    'fin.cash_bank_transfer': 'ரொக்கம் ⇄ வங்கி மாற்றம்',
    'fin.new_expense': '+ புதிய செலவு பதிவு',
    'fin.tab_cockpit': 'கண்ணோட்டம்',
    'fin.tab_expenses': 'தினசரி செலவு',
    'fin.tab_salary': 'பணியாளர் சம்பளம்',
    'fin.tab_labour': 'தினக்கூலி',
    'fin.tab_contractors': 'ஒப்பந்ததாரர்',
    'fin.tab_cash_bank': 'ரொக்கம் & வங்கி',
    'fin.tab_daily_closing': 'கணக்கு முடிப்பு',
    'fin.tab_reports': 'நிதி அறிக்கைகள் (11)',
    'fin.cash_in_hand': 'கையிருப்பு ரொக்கம்',
    'fin.bank_balance': 'வங்கி இருப்பு',
    'fin.today_income': 'இன்றைய வரவு',
    'fin.today_expense': 'இன்றைய செலவு',
    'fin.net_balance': 'நிகர நிதி இருப்பு',
    'fin.advance_balance': 'வழங்கப்பட்ட முன்பண நிலுவை',
    'fin.record_advance': 'முன்பணம் வழங்கல்',
    'fin.advance_recovery': 'முன்பணம் பிடித்தம்',
    'fin.net_payable': 'நிகர சம்பள வழங்கல்',
    'fin.daily_wage': 'தினக்கூலி வீதம்',
    'fin.overtime': 'கூடுதல் நேர ஊதியம் (OT)',
    'fin.double_shift': 'இரட்டை ஷிப்ட் (Double Shift)',
    'fin.close_day': 'தினசரி கணக்கு முடிக்க',

    // Commercial Documents & Invoices
    'doc.quotes_and_pos': 'விலைப்புள்ளி & கொள்முதல் ஆணைகள்',
    'doc.tax_invoice': 'ஜிஎஸ்டி வரி விலைப்பட்டியல் (Invoice)',
    'doc.eway_bill': 'ஈ-வே பில் படிவம் GST EWB-01',
    'doc.new_quote': 'விலைப்புள்ளி (Quotation) உருவாக்குக',
    'doc.new_po': 'கொள்முதல் ஆணை (PO) உருவாக்குக',
    'doc.proprietor': 'உரிமையாளர்: P. நந்தா குமார்',
    'doc.seal_verified': 'அதிகாரப்பூர்வ லெட்டர்ஹெட் & முத்திரையுடன் தயார்',
    'doc.gstin': 'ஜிஎஸ்டி எண்: 33AXVPN9382L1ZF',

    // Backup & Settings
    'settings.title': 'கணினி அமைப்புகள் & தரவு பாதுகாப்பு',
    'settings.tab_profile': 'நிறுவன சுயவிவரம்',
    'settings.tab_roles': 'பயனர் அனுமதி மேலாண்மை (RBAC)',
    'settings.tab_migration': 'எக்செல் தரவு இறக்குமதி',
    'settings.tab_backup': 'பேக்கப் & ரீஸ்டோர்',
    'settings.backup_title': 'முழு கணினி காப்பகம் (Backup) உருவாக்குக',
    'settings.save_drive': 'கூகிள் டிரைவில் சேமிக்க (Save to Drive)',
    'settings.email_backup': 'மின்னஞ்சலுக்கு அனுப்ப (yashothenterprises44@gmail.com)',
    'settings.download_backup': 'மொபைல் நினைவகத்தில் சேமிக்க',

    // Dashboard & Cockpit
    'dash.title': 'யார்டு மேலாண்மை & நேரடி கண்ணோட்டம்',
    'dash.subtitle': 'கையிருப்பு டன், எடை மேடை வரவு-செலவு, மற்றும் ஆலை இயக்க நிலவரம்',
    'dash.total_stock': 'மொத்த கையிருப்பு (டன்)',
    'dash.today_purchases': 'இன்றைய கொள்முதல்',
    'dash.today_dispatches': 'இன்றைய விற்பனை / அனுப்புதல்',
    'dash.receivables': 'வரவேண்டிய பாக்கி தொகை',
    'dash.quick_actions': 'விரைவு செயல்பாடுகள்',
    'dash.weigh_truck': '+ எடை பதிவு',
    'dash.inward_po': '+ கொள்முதல் பதிவு',
    'dash.outward_sale': '+ விற்பனை பதிவு',
    'dash.gen_invoice': '+ ஜிஎஸ்டி பில்',
    'dash.new_quote': '+ கொட்டேஷன்',
    'dash.recent_tx': 'சமீபத்திய பரிவர்த்தனைகள்',

    // Purchases & Inward
    'purchases.title': 'உள்வரும் கொள்முதல் & எடை சரிபார்ப்பு',
    'purchases.subtitle': 'கேட் எடை பதிவு, FIFO லாட் ஒதுக்கீடு, தரம் கழிவு, மற்றும் சப்ளையர் கணக்கு.',
    'purchases.new_entry': 'புதிய கொள்முதல் பதிவு',
    'purchases.supplier': 'சப்ளையர் / விற்பனையாளர்',
    'purchases.gross_amount': 'மொத்த மதிப்பு',
    'purchases.net_payable': 'வழங்க வேண்டிய தொகை',

    // Sales & Outbound
    'sales.title': 'விற்பனை மற்றும் ஆலை அனுப்புதல்',
    'sales.subtitle': 'லாரி ஏற்றுதல், எடை ரசீது சரிபார்ப்பு, மற்றும் வாடிக்கையாளர் பில்.',
    'sales.new_dispatch': 'புதிய விற்பனை அனுப்புதல்',
    'sales.buyer': 'வாடிக்கையாளர் / வாங்குபவர்',
    'sales.destination': 'சேருமிடம் / ஆலை',

    // Inventory & FIFO Lots
    'inv.title': 'கையிருப்பு மற்றும் FIFO சரக்கு லாட்கள்',
    'inv.subtitle': 'வரிசைக்கிரம கொள்முதல் விலை, பொருள் வகை இருப்பு, மற்றும் ஸ்கிராப் மதிப்பு.',
    'inv.stock_value': 'மொத்த சரக்கு மதிப்பு',
    'inv.available_mt': 'கையிருப்பு (மெட்ரிக் டன்)',
    'inv.materials_master': 'பொருள் வகைகள் & HSN குறியீடுகள்',

    // Parties & Ledgers
    'parties.title': 'வாடிக்கையாளர் மற்றும் சப்ளையர்கள்',
    'parties.subtitle': 'GST எண் சரிபார்ப்பு, கடன் வரம்பு, மற்றும் கணக்கு பேரேடு.',
    'parties.add_party': 'புதிய பார்ட்டி சேர்க்க',
    'parties.vendor_count': 'சப்ளையர்கள்',
    'parties.customer_count': 'வாங்குபவர்கள்',

    // Vehicles & Fleet Compliance
    'vehicles.title': 'லாரிகள் மற்றும் வாகன ஆவணங்கள்',
    'vehicles.subtitle': 'இன்சூரன்ஸ், எப்சி, பொல்யூஷன், மற்றும் பர்மிட் காலாவதி கண்காணிப்பு.',
    'vehicles.add_vehicle': 'புதிய வாகனம் பதிவு',
    'vehicles.compliance_score': 'ஆவண தகுதி நிலை',
    'vehicles.expired_docs': 'காலாவதியான ஆவணங்கள்',
    'vehicles.vahan_lookup': 'வாகன் RTO இலவச சரிபார்ப்பு',

    // Employees & Daily Labour
    'emp.title': 'பணியாளர்கள் & தினக்கூலி தொழிலாளர்கள்',
    'emp.subtitle': 'தினசரி வருகை, கூடுதல் பணி நேரம் (OT), முன்பணம் மற்றும் சம்பள ரசீதுகள்.',
    'emp.add_employee': 'புதிய பணியாளர் சேர்க்க',
    'emp.daily_attendance': 'தினசரி வருகை பதிவு',
    'emp.active_staff': 'மொத்த பணியாளர்கள்',

    // Language Toggle
    'lang.switch': 'English',
    'lang.current': 'தமிழ்',
  },
};

import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Employee, AttendanceStatus, AttendanceEntry } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
import { getLocalDateStr } from '../../utils/visualReportExporter.ts';
import { calculateEmployeeMonthlyAttendancePay } from '../../../backend/business-rules/financeEngine.ts';
import { 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  TrendingUp,
  DollarSign,
  Printer,
  History,
  Zap,
  BookUser,
  ChevronLeft,
  ChevronRight,
  Power,
  CheckCheck,
  CalendarRange
} from 'lucide-react';
import { QuickContactModal } from '../../components/QuickContactModal.tsx';

const shiftIsoDate = (isoDate: string, deltaDays: number): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
};

const shiftYearMonth = (ym: string, deltaMonths: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return dt.toISOString().slice(0, 7);
};

const getDatesInMonth = (ym: string): string[] => {
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const res: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    res.push(`${ym}-${String(day).padStart(2, '0')}`);
  }
  return res;
};

const getDatesInRange = (fromDate: string, toDate: string, skipSundays: boolean): string[] => {
  if (!fromDate || !toDate || fromDate > toDate) return [];
  const res: string[] = [];
  let cur = fromDate;
  let guard = 0;
  while (cur <= toDate && guard < 366) {
    const [y, m, d] = cur.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (!skipSundays || dow !== 0) {
      res.push(cur);
    }
    cur = shiftIsoDate(cur, 1);
    guard++;
  }
  return res;
};

export const EmployeesView: React.FC = () => {
  const { 
    employees, 
    attendance, 
    markAttendance, 
    updateAttendanceEntry, 
    deleteAttendanceEntry, 
    addAttendanceRecord,
    batchMarkAttendance,
    clearAttendanceDates,
    addEmployee, 
    updateEmployee, 
    deleteEmployee, 
    company, 
    currentUser 
  } = useERP();

  const todayIso = getLocalDateStr();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Individual Employee Performance, Calendar & Salary Tracking State
  const [trackingEmployee, setTrackingEmployee] = useState<Employee | null>(null);
  const [activeTrackingTab, setActiveTrackingTab] = useState<'calendar' | 'overview' | 'history' | 'payslip'>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(todayIso.slice(0, 7));
  const [calendarBrush, setCalendarBrush] = useState<'CYCLE' | AttendanceStatus | 'CLEAR'>('CYCLE');

  // Bulk Range Attendance Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetEmpId, setBulkTargetEmpId] = useState<string>('ALL_ACTIVE');
  const [bulkFromDate, setBulkFromDate] = useState(todayIso.slice(0, 8) + '01');
  const [bulkToDate, setBulkToDate] = useState(todayIso);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('PRESENT');
  const [bulkSkipSundays, setBulkSkipSundays] = useState(true);

  // Form State for Employee Add / Edit
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Yard Staff');
  const [department, setDepartment] = useState('Yard Operations');
  const [phone, setPhone] = useState('');
  const [dailyWage, setDailyWage] = useState<number>(650);
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Form State for Custom Shift & Overtime Modal
  const [isOtModalOpen, setIsOtModalOpen] = useState(false);
  const [editingAttendanceEntry, setEditingAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [otEmployeeId, setOtEmployeeId] = useState('');
  const [otDate, setOtDate] = useState(selectedDate);
  const [otStatus, setOtStatus] = useState<AttendanceStatus>('OVERTIME');
  const [otHours, setOtHours] = useState<number>(4);
  const [otRemarks, setOtRemarks] = useState('Extended yard shift / double duty');

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleStatusChange = (empId: string, status: AttendanceStatus, hours: number = 0, remarks?: string) => {
    markAttendance(empId, selectedDate, status, hours, remarks);
    showToast('success', `Status updated to ${status.replace('_', ' ')}${hours > 0 ? ` (+${hours}h OT)` : ''} for ${selectedDate}.`);
  };

  const handleMarkAllPresentForDate = () => {
    const activeEmps = employees.filter((e) => e.isActive !== false);
    if (activeEmps.length === 0) {
      showToast('error', 'No active employees in roster.');
      return;
    }
    batchMarkAttendance(
      activeEmps.map((e) => ({
        employeeId: e.id,
        date: selectedDate,
        status: 'PRESENT',
        overtimeHours: 0,
        remarks: 'Marked All Present',
      }))
    );
    showToast('success', `Marked ${activeEmps.length} active staff Present for ${selectedDate}.`);
  };

  const handleBulkRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dates = getDatesInRange(bulkFromDate, bulkToDate, bulkSkipSundays);
    if (dates.length === 0) {
      showToast('error', 'Select a valid date range (From Date <= To Date).');
      return;
    }
    const targetEmps =
      bulkTargetEmpId === 'ALL_ACTIVE'
        ? employees.filter((emp) => emp.isActive !== false)
        : employees.filter((emp) => emp.id === bulkTargetEmpId);

    if (targetEmps.length === 0) {
      showToast('error', 'No matching employees selected.');
      return;
    }

    const entries: { employeeId: string; date: string; status: AttendanceStatus; overtimeHours?: number; remarks?: string }[] = [];
    for (const emp of targetEmps) {
      for (const dt of dates) {
        entries.push({
          employeeId: emp.id,
          date: dt,
          status: bulkStatus,
          overtimeHours: bulkStatus === 'DOUBLE_SHIFT' ? 8 : 0,
          remarks: `Bulk ${bulkStatus.replace('_', ' ')}`,
        });
      }
    }
    batchMarkAttendance(entries);
    setIsBulkModalOpen(false);
    showToast('success', `Marked ${targetEmps.length} staff × ${dates.length} days as ${bulkStatus.replace('_', ' ')}.`);
  };

  const handleCalendarDayTap = (emp: Employee, dateStr: string, existing?: AttendanceEntry) => {
    if (calendarBrush === 'CLEAR') {
      if (existing) {
        clearAttendanceDates(emp.id, [dateStr]);
      }
      return;
    }
    if (calendarBrush !== 'CYCLE') {
      const remarkLabel =
        calendarBrush === 'LEAVE'
          ? 'Paid Leave'
          : calendarBrush === 'WEEK_OFF'
          ? 'Weekly Off'
          : `Calendar mark (${calendarBrush.replace('_', ' ')})`;
      markAttendance(
        emp.id,
        dateStr,
        calendarBrush,
        calendarBrush === 'DOUBLE_SHIFT' ? 8 : 0,
        remarkLabel
      );
      return;
    }
    // Cycle: Unmarked -> PRESENT -> HALF_DAY -> DOUBLE_SHIFT -> LEAVE (Paid) -> WEEK_OFF -> ABSENT -> Clear
    if (!existing) {
      markAttendance(emp.id, dateStr, 'PRESENT', 0, 'Standard 8h shift');
    } else if (existing.status === 'PRESENT' || existing.status === 'OVERTIME') {
      markAttendance(emp.id, dateStr, 'HALF_DAY', 0, 'Half day 4h shift');
    } else if (existing.status === 'HALF_DAY') {
      markAttendance(emp.id, dateStr, 'DOUBLE_SHIFT', 8, 'Double shift 16h duty');
    } else if (existing.status === 'DOUBLE_SHIFT') {
      markAttendance(emp.id, dateStr, 'LEAVE', 0, 'Paid Leave');
    } else if (existing.status === 'LEAVE') {
      markAttendance(emp.id, dateStr, 'WEEK_OFF', 0, 'Weekly Off');
    } else if (existing.status === 'WEEK_OFF') {
      markAttendance(emp.id, dateStr, 'ABSENT', 0, 'Absent');
    } else {
      clearAttendanceDates(emp.id, [dateStr]);
    }
  };

  const handleMarkMonthForEmployee = (emp: Employee, skipSundays: boolean) => {
    const allDates = getDatesInMonth(selectedMonth);
    const entries = allDates.map((dt) => {
      const [y, m, d] = dt.split('-').map(Number);
      const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
      if (skipSundays && isSunday) {
        return {
          employeeId: emp.id,
          date: dt,
          status: 'WEEK_OFF' as AttendanceStatus,
          overtimeHours: 0,
          remarks: 'Sunday Week Off',
        };
      }
      return {
        employeeId: emp.id,
        date: dt,
        status: 'PRESENT' as AttendanceStatus,
        overtimeHours: 0,
        remarks: skipSundays ? 'Month Mon-Sat Present' : 'Full Month Present',
      };
    });
    batchMarkAttendance(entries);
    showToast(
      'success',
      skipSundays
        ? `Marked Mon–Sat Present & Sundays Week Off for ${emp.fullName} (${selectedMonth}).`
        : `Marked all ${entries.length} days Present for ${emp.fullName} (${selectedMonth}).`
    );
  };

  const handleMarkSundaysWeekOff = (emp: Employee) => {
    const existingDates = new Set(
      attendance
        .filter((a) => a.employeeId === emp.id && a.attendanceDate.startsWith(selectedMonth))
        .map((a) => a.attendanceDate)
    );
    const unmarkedSundays = getDatesInMonth(selectedMonth).filter((dt) => {
      const [y, m, d] = dt.split('-').map(Number);
      const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
      return isSunday && !existingDates.has(dt);
    });
    if (unmarkedSundays.length === 0) {
      showToast('success', `All Sundays in ${selectedMonth} are already marked for ${emp.fullName}.`);
      return;
    }
    batchMarkAttendance(
      unmarkedSundays.map((dt) => ({
        employeeId: emp.id,
        date: dt,
        status: 'WEEK_OFF' as AttendanceStatus,
        overtimeHours: 0,
        remarks: 'Sunday Week Off',
      }))
    );
    showToast('success', `Marked ${unmarkedSundays.length} unmarked Sunday(s) as Week Off (WO) for ${emp.fullName}.`);
  };

  const handleToggleEmployeeActive = (emp: Employee) => {
    const nextActive = emp.isActive === false;
    updateEmployee(emp.id, { isActive: nextActive });
    showToast('success', `${emp.fullName} marked ${nextActive ? 'Active' : 'Inactive'}.`);
  };

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    const nextSeq = employees.length + 1;
    setCode(`EMP-26-${String(nextSeq).padStart(3, '0')}`);
    setName('');
    setDesignation('Yard Material Sorter');
    setDepartment('Yard Operations');
    setPhone('');
    setDailyWage(650);
    setMonthlySalary(0);
    setAdvanceBalance(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setCode(emp.employeeCode);
    setName(emp.fullName);
    setDesignation(emp.designation);
    setDepartment(emp.department);
    setPhone(emp.phone);
    setDailyWage(emp.dailyWageRate);
    setMonthlySalary(emp.monthlySalary);
    setAdvanceBalance(emp.currentAdvanceBalance || 0);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingEmployee) {
      updateEmployee(editingEmployee.id, {
        employeeCode: code.trim().toUpperCase(),
        fullName: name.trim(),
        designation,
        department,
        phone,
        dailyWageRate: Number(dailyWage),
        monthlySalary: Number(monthlySalary),
        currentAdvanceBalance: Number(advanceBalance),
      });
      setFeedbackMsg({ type: 'success', text: `Employee "${name}" profile updated successfully.` });
    } else {
      addEmployee({
        employeeCode: code.trim().toUpperCase(),
        fullName: name.trim(),
        designation,
        department,
        phone,
        joiningDate: new Date().toISOString().split('T')[0],
        dailyWageRate: Number(dailyWage),
        monthlySalary: Number(monthlySalary),
        currentAdvanceBalance: Number(advanceBalance),
        isActive: true,
      });
      setFeedbackMsg({ type: 'success', text: `Employee "${name}" added to roster.` });
    }

    setIsModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleDelete = (emp: Employee) => {
    if (confirm(`Are you sure you want to remove employee "${emp.fullName}"?`)) {
      const res = deleteEmployee(emp.id);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || 'Employee removed.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || 'Failed to remove employee.' });
      }
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  // Open Custom Overtime / Shift Modal
  const handleOpenCustomShiftModal = (empId: string, existingRecord?: AttendanceEntry | null) => {
    setOtEmployeeId(empId);
    if (existingRecord) {
      setEditingAttendanceEntry(existingRecord);
      setOtDate(existingRecord.attendanceDate);
      setOtStatus(existingRecord.status);
      setOtHours(existingRecord.overtimeHours || 0);
      setOtRemarks(existingRecord.remarks || '');
    } else {
      setEditingAttendanceEntry(null);
      setOtDate(selectedDate);
      setOtStatus('DOUBLE_SHIFT');
      setOtHours(8);
      setOtRemarks('Continuous double shift duty');
    }
    setIsOtModalOpen(true);
  };

  const handleSaveCustomShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otEmployeeId) return;

    const emp = employees.find((e) => e.id === otEmployeeId);
    if (editingAttendanceEntry) {
      updateAttendanceEntry(editingAttendanceEntry.id, {
        attendanceDate: otDate,
        status: otStatus,
        overtimeHours: Number(otHours),
        remarks: otRemarks,
      });
      setFeedbackMsg({
        type: 'success',
        text: `Shift entry for ${emp?.fullName || 'employee'} on ${otDate} updated to ${otStatus.replace('_', ' ')} (${otHours}h OT).`,
      });
    } else {
      addAttendanceRecord({
        employeeId: otEmployeeId,
        attendanceDate: otDate,
        status: otStatus,
        overtimeHours: Number(otHours),
        remarks: otRemarks,
        markedBy: currentUser.fullName,
        isCorrected: false,
      });
      setFeedbackMsg({
        type: 'success',
        text: `Recorded shift for ${emp?.fullName || 'employee'} on ${otDate}: ${otStatus.replace('_', ' ')} (${otHours}h OT).`,
      });
    }

    setIsOtModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleDeleteShiftRecord = (rec: AttendanceEntry) => {
    if (confirm(`Delete attendance record for ${rec.attendanceDate}?`)) {
      const res = deleteAttendanceEntry(rec.id);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: 'Shift record deleted.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || 'Failed to delete record.' });
      }
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Performance & Salary metrics calculation for selected employee (whole-month calendar days + Paid Week Off + Paid Leave)
  const getEmployeeStats = (emp: Employee) => {
    const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
    const monthFiltered = empAttendance.filter((a) => a.attendanceDate.startsWith(selectedMonth));
    const pay = calculateEmployeeMonthlyAttendancePay(emp, monthFiltered, selectedMonth);

    return {
      allRecords: empAttendance,
      monthRecords: monthFiltered.sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
      ...pay,
    };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-red-600 shrink-0" />
            <span>Staff Roster, Attendance &amp; Salary Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            1-tap daily marking, individual monthly calendars, bulk date-range fill, overtime tracking, and automated wage slips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Daily Date Stepper */}
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftIsoDate(selectedDate, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent px-1"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayIso)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                selectedDate === todayIso ? 'bg-red-50 text-red-700' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(shiftIsoDate(selectedDate, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleMarkAllPresentForDate}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
            title="Mark all active employees Present for selected date"
          >
            <CheckCheck className="w-4 h-4 shrink-0" />
            <span>Mark All Present</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
            title="Mark attendance across a date range without changing date one by one"
          >
            <CalendarRange className="w-4 h-4 shrink-0" />
            <span>Bulk Range</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
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

      {/* Staff & Attendance Roster */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
              Daily Shift &amp; Attendance Roster ({selectedDate})
            </span>
            <span className="text-[11px] text-slate-500">
              Tap any employee or Calendar icon to mark their whole month on an interactive calendar.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Present</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Paid Leave</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">Week Off</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Half Day</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Double Shift</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">Unmarked</span>
          </div>
        </div>

        {/* Mobile Cards (< 768px) */}
        <div className="md:hidden divide-y divide-slate-200">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No employees added yet. Tap <strong>Add Employee</strong> above to register your staff.
            </div>
          ) : (
            employees.map((emp) => {
              const record = attendance.find(
                (a) => a.employeeId === emp.id && a.attendanceDate === selectedDate
              );
              const currentStatus = record?.status;
              const currentOt = record?.overtimeHours || 0;
              const stats = getEmployeeStats(emp);
              const isInactive = emp.isActive === false;

              return (
                <div key={emp.id} className={`p-3.5 space-y-3 ${isInactive ? 'bg-slate-50/80 opacity-75' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingEmployee(emp);
                        setActiveTrackingTab('calendar');
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-slate-500">{emp.employeeCode}</span>
                        {isInactive && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold uppercase">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-black text-slate-900 truncate">{emp.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {emp.designation} · {emp.monthlySalary > 0 ? `${formatINR(emp.monthlySalary)}/mo` : `${formatINR(emp.dailyWageRate)}/day`}
                      </div>
                    </button>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {currentStatus ? (
                        <StatusBadge status={currentStatus} />
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          UNMARKED
                        </span>
                      )}
                      {currentOt > 0 && (
                        <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          +{currentOt}h OT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick 1-Tap Status Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(emp.id, 'PRESENT', 0, 'Standard 8h shift')}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentStatus === 'PRESENT' && currentOt === 0
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(emp.id, 'LEAVE', 0, 'Paid Leave')}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentStatus === 'LEAVE'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Leave
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(emp.id, 'WEEK_OFF', 0, 'Weekly Off')}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentStatus === 'WEEK_OFF'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}
                    >
                      Week Off
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(emp.id, 'HALF_DAY', 0, 'Half day 4h shift')}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentStatus === 'HALF_DAY' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Half
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(emp.id, 'DOUBLE_SHIFT', 8, 'Full 16h double shift duty')}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentStatus === 'DOUBLE_SHIFT'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      2x
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomShiftModal(emp.id, record)}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentOt > 0 && currentStatus !== 'DOUBLE_SHIFT'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {currentOt > 0 ? `${currentOt}h` : 'OT'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(emp.id, 'ABSENT', 0, 'Unexcused / Absent')}
                      className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold cursor-pointer ${
                        currentStatus === 'ABSENT' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Absent
                    </button>
                  </div>

                  {/* Mobile Actions Footer */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingEmployee(emp);
                        setActiveTrackingTab('calendar');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Calendar &amp; Pay ({formatINR(stats.netSalaryPayable)})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleEmployeeActive(emp)}
                      className={`p-2 rounded-lg cursor-pointer ${
                        isInactive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                      title={isInactive ? 'Mark Active' : 'Mark Inactive'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(emp)}
                      className="p-2 rounded-lg bg-slate-100 text-slate-700 cursor-pointer"
                      title="Edit Employee"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(emp)}
                      className="p-2 rounded-lg bg-rose-50 text-rose-600 cursor-pointer"
                      title="Delete Employee"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Employee Details</th>
                <th className="py-3 px-4">Designation &amp; Dept</th>
                <th className="py-3 px-4">Wage Structure</th>
                <th className="py-3 px-4 text-center">Status on {selectedDate}</th>
                <th className="py-3 px-4 text-center">Shift &amp; Overtime Controls</th>
                <th className="py-3 px-4 text-center">Calendar &amp; Net Wages</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    No employees registered yet. Click &quot;Add Employee&quot; to get started.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const record = attendance.find(
                    (a) => a.employeeId === emp.id && a.attendanceDate === selectedDate
                  );
                  const currentStatus = record?.status;
                  const currentOt = record?.overtimeHours || 0;
                  const stats = getEmployeeStats(emp);
                  const isInactive = emp.isActive === false;

                  return (
                    <tr key={emp.id} className={`hover:bg-slate-50/60 transition-colors ${isInactive ? 'opacity-65 bg-slate-50/40' : ''}`}>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {emp.employeeCode}
                        {isInactive && (
                          <span className="block mt-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold w-fit">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setTrackingEmployee(emp);
                            setActiveTrackingTab('calendar');
                          }}
                          className="font-bold text-slate-900 block hover:text-red-600 text-left transition-colors cursor-pointer"
                          title="Open Individual Attendance Calendar & Salary"
                        >
                          {emp.fullName}
                        </button>
                        <span className="text-[10px] text-slate-500 font-mono">{emp.phone}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">{emp.designation}</span>
                        <span className="text-[10px] text-slate-500">{emp.department}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {emp.monthlySalary > 0
                          ? `${formatINR(emp.monthlySalary)}/mo`
                          : `${formatINR(emp.dailyWageRate)}/day`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {currentStatus ? (
                            <StatusBadge status={currentStatus} />
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              UNMARKED
                            </span>
                          )}
                          {currentOt > 0 && (
                            <span className="text-[9.5px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              +{currentOt}h OT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, 'PRESENT', 0, 'Standard 8h shift')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              currentStatus === 'PRESENT' && currentOt === 0
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Mark Standard Full Day (8 hrs)"
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, 'HALF_DAY', 0, 'Half day 4h shift')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              currentStatus === 'HALF_DAY'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Mark Half Day (4 hrs)"
                          >
                            Half Day
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, 'DOUBLE_SHIFT', 8, 'Full 16h double shift duty')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-0.5 ${
                              currentStatus === 'DOUBLE_SHIFT'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                            }`}
                            title="Mark Double Shift (16 hrs / 2 full shifts)"
                          >
                            <Zap className="w-3 h-3 text-amber-300" />
                            <span>Double Shift</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCustomShiftModal(emp.id, record)}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                              currentOt > 0 && currentStatus !== 'DOUBLE_SHIFT'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                            }`}
                            title="Edit Custom Overtime Hours"
                          >
                            <Clock className="w-3 h-3 text-indigo-500" />
                            <span>{currentOt > 0 ? `OT: ${currentOt}h` : 'Custom OT'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, 'LEAVE', 0, 'Paid Leave')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              currentStatus === 'LEAVE'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Mark Paid Leave (Full Day Paid)"
                          >
                            Leave
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, 'WEEK_OFF', 0, 'Weekly Off')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              currentStatus === 'WEEK_OFF'
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
                            }`}
                            title="Mark Paid Week Off"
                          >
                            WO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, 'ABSENT', 0, 'Unexcused / Absent')}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              currentStatus === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Mark Absent"
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setTrackingEmployee(emp);
                            setActiveTrackingTab('calendar');
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 border border-slate-300 shadow-xs cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-red-600" />
                          <span>Calendar · {stats.attendancePercentage}%</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-emerald-700 font-bold">{formatINR(stats.netSalaryPayable)}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleEmployeeActive(emp)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isInactive
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                            title={isInactive ? 'Mark Active' : 'Mark Inactive'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Employee Profile & Wage"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(emp)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CUSTOM OVERTIME & SHIFT EDIT MODAL                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isOtModalOpen}
        onClose={() => setIsOtModalOpen(false)}
        title={editingAttendanceEntry ? 'Edit Attendance & Overtime Record' : 'Record Shift & Custom Overtime'}
        subtitle="Specify exact overtime hours, double shift duty, check-in details, and operational notes."
      >
        <form onSubmit={handleSaveCustomShift} className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-[11px] flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Employees can work continuous double shifts (e.g., 16 hours) or logged custom overtime hours. Overtime is compensated at 1.5× the base hourly rate.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Employee *</label>
              <select
                value={otEmployeeId}
                onChange={(e) => setOtEmployeeId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-semibold"
                required
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Shift Date *</label>
              <input
                type="date"
                value={otDate}
                onChange={(e) => setOtDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Shift Status *</label>
              <select
                value={otStatus}
                onChange={(e) => {
                  const s = e.target.value as AttendanceStatus;
                  setOtStatus(s);
                  if (s === 'DOUBLE_SHIFT') {
                    setOtHours(8);
                    setOtRemarks('Continuous double shift duty');
                  } else if (s === 'HALF_DAY') {
                    setOtHours(0);
                    setOtRemarks('Half day 4h duty');
                  } else if (s === 'PRESENT') {
                    setOtHours(0);
                    setOtRemarks('Standard shift');
                  }
                }}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold"
                required
              >
                <option value="PRESENT">Present (Standard 8h Shift)</option>
                <option value="LEAVE">Paid Leave (Full Day Paid)</option>
                <option value="WEEK_OFF">Week Off (Paid Weekly Off)</option>
                <option value="DOUBLE_SHIFT">Double Shift (Continuous 16h Duty - 2x Pay)</option>
                <option value="OVERTIME">Overtime (Custom OT Hours)</option>
                <option value="HALF_DAY">Half Day (4h Shift)</option>
                <option value="ABSENT">Absent (Unpaid)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Overtime Hours (OT) *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={otHours}
                onChange={(e) => setOtHours(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-black text-sm text-purple-700"
                placeholder="e.g. 2, 4, 8, 12 hrs"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {otHours > 0 ? `Adds ${otHours} hours of overtime at 1.5× hourly rate.` : 'Zero extra overtime hours.'}
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Shift Notes / Duty Remarks</label>
              <input
                type="text"
                value={otRemarks}
                onChange={(e) => setOtRemarks(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                placeholder="e.g. Furnace scrap sorting night shift, loading lorry consignment"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOtModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-sm cursor-pointer"
            >
              Save Shift Record
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* BULK DATE-RANGE ATTENDANCE MODAL                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Mark Attendance (Date Range)"
        subtitle="Mark multiple days at once without changing dates one by one."
      >
        <form onSubmit={handleBulkRangeSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-[11px] flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Select a date range and apply Present, Half Day, Double Shift, or Absent to all active staff or a single employee in one tap.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Apply To *</label>
              <select
                value={bulkTargetEmpId}
                onChange={(e) => setBulkTargetEmpId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-900"
              >
                <option value="ALL_ACTIVE">All Active Staff ({employees.filter((e) => e.isActive !== false).length})</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">From Date *</label>
              <input
                type="date"
                value={bulkFromDate}
                onChange={(e) => setBulkFromDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">To Date *</label>
              <input
                type="date"
                value={bulkToDate}
                onChange={(e) => setBulkToDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono font-bold"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Attendance Status *</label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white font-bold"
              >
                <option value="PRESENT">Present (Standard 8h Shift)</option>
                <option value="LEAVE">Paid Leave (Full Day Paid)</option>
                <option value="WEEK_OFF">Week Off (Paid Weekly Off)</option>
                <option value="HALF_DAY">Half Day (4h Shift)</option>
                <option value="DOUBLE_SHIFT">Double Shift (16h / 2x Pay)</option>
                <option value="ABSENT">Absent (Unpaid)</option>
              </select>
            </div>

            <label className="sm:col-span-2 flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkSkipSundays}
                onChange={(e) => setBulkSkipSundays(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="font-semibold text-slate-800">Skip Sundays (Mon–Sat working days only)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
            >
              Apply Bulk Attendance
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* INDIVIDUAL EMPLOYEE CALENDAR, PERFORMANCE & SALARY TRACKING MODAL         */}
      {/* ========================================================================= */}
      {trackingEmployee && (
        <Modal
          isOpen={!!trackingEmployee}
          onClose={() => setTrackingEmployee(null)}
          title={`${trackingEmployee.fullName} (${trackingEmployee.employeeCode})`}
          subtitle={`${trackingEmployee.department} · ${trackingEmployee.designation}`}
          maxWidth="6xl"
        >
          {(() => {
            const stats = getEmployeeStats(trackingEmployee);
            const monthDates = getDatesInMonth(selectedMonth);
            const [yr, mo] = selectedMonth.split('-').map(Number);
            // Monday-first offset (Mon=0..Sun=6)
            const firstDow = (new Date(Date.UTC(yr, mo - 1, 1)).getUTCDay() + 6) % 7;
            const entryByDate = new Map(stats.monthRecords.map((r) => [r.attendanceDate, r]));

            return (
              <div className="space-y-4 text-xs">
                {/* Navigation Tabs inside Employee Modal */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5 pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setActiveTrackingTab('calendar')}
                      className={`shrink-0 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'calendar'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Calendar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTrackingTab('overview')}
                      className={`shrink-0 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'overview'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Salary &amp; Stats</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTrackingTab('history')}
                      className={`shrink-0 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'history'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Shift Log ({stats.monthRecords.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTrackingTab('payslip')}
                      className={`shrink-0 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'payslip'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Pay Slip</span>
                    </button>
                  </div>

                  {/* Month Stepper */}
                  <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedMonth(shiftYearMonth(selectedMonth, -1))}
                      className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-1 py-0.5 bg-transparent font-bold text-slate-800 text-xs cursor-pointer outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedMonth(shiftYearMonth(selectedMonth, 1))}
                      className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 0. INTERACTIVE MONTHLY CALENDAR TAB */}
                {activeTrackingTab === 'calendar' && (
                  <div className="space-y-4">
                    {/* Quick Brush & 1-Tap Month Actions */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Tap Mode (Click any day below):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              { id: 'CYCLE', label: 'Cycle', cls: 'bg-slate-900 text-white' },
                              { id: 'PRESENT', label: 'Present (P)', cls: 'bg-emerald-600 text-white' },
                              { id: 'LEAVE', label: 'Paid Leave (PL)', cls: 'bg-amber-500 text-white' },
                              { id: 'WEEK_OFF', label: 'Week Off (WO)', cls: 'bg-sky-600 text-white' },
                              { id: 'HALF_DAY', label: 'Half (H)', cls: 'bg-blue-600 text-white' },
                              { id: 'DOUBLE_SHIFT', label: '2x Shift', cls: 'bg-purple-600 text-white' },
                              { id: 'ABSENT', label: 'Absent (A)', cls: 'bg-rose-600 text-white' },
                              { id: 'CLEAR', label: 'Erase', cls: 'bg-slate-600 text-white' },
                            ] as const
                          ).map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setCalendarBrush(b.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                calendarBrush === b.id
                                  ? `${b.cls} shadow-xs`
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
                        <button
                          type="button"
                          onClick={() => handleMarkMonthForEmployee(trackingEmployee, true)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          Mark Mon–Sat Present (+ Sun WO)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkSundaysWeekOff(trackingEmployee)}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          Mark Sundays Week Off
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkMonthForEmployee(trackingEmployee, false)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          Mark All Days Present
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearAttendanceDates(trackingEmployee.id, monthDates);
                            showToast('success', `Cleared attendance for ${selectedMonth}.`);
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          Clear Month
                        </button>
                      </div>
                    </div>

                    {/* Mon-Sun Monthly Calendar Grid */}
                    <div className="border border-slate-200 rounded-xl p-2.5 sm:p-4 bg-white">
                      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] font-bold uppercase text-slate-500 pb-2">
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                        <div className="text-rose-500">Sun</div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {Array.from({ length: firstDow }).map((_, i) => (
                          <div key={`pad-${i}`} className="h-12 sm:h-14 rounded-lg bg-slate-50/40" />
                        ))}

                        {monthDates.map((dateStr) => {
                          const dayNum = Number(dateStr.slice(8, 10));
                          const rec = entryByDate.get(dateStr);
                          const isToday = dateStr === todayIso;
                          const st = rec?.status;

                          let cellStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
                          let shortCode = '·';
                          if (st === 'PRESENT' || st === 'OVERTIME') {
                            cellStyle = 'bg-emerald-50 border-emerald-400 text-emerald-900 hover:bg-emerald-100';
                            shortCode = rec?.overtimeHours ? `P+${rec.overtimeHours}h` : 'P';
                          } else if (st === 'LEAVE') {
                            cellStyle = 'bg-amber-50 border-amber-400 text-amber-900 hover:bg-amber-100';
                            shortCode = 'PL';
                          } else if (st === 'WEEK_OFF') {
                            cellStyle = 'bg-sky-50 border-sky-400 text-sky-900 hover:bg-sky-100';
                            shortCode = 'WO';
                          } else if (st === 'HALF_DAY') {
                            cellStyle = 'bg-blue-50 border-blue-400 text-blue-900 hover:bg-blue-100';
                            shortCode = 'H';
                          } else if (st === 'DOUBLE_SHIFT') {
                            cellStyle = 'bg-purple-50 border-purple-400 text-purple-900 hover:bg-purple-100';
                            shortCode = '2x';
                          } else if (st === 'ABSENT') {
                            cellStyle = 'bg-rose-50 border-rose-400 text-rose-900 hover:bg-rose-100';
                            shortCode = 'A';
                          }

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => handleCalendarDayTap(trackingEmployee, dateStr, rec)}
                              className={`h-12 sm:h-14 rounded-lg border flex flex-col items-center justify-center p-1 transition-all cursor-pointer ${cellStyle} ${
                                isToday ? 'ring-2 ring-red-500 ring-offset-1' : ''
                              }`}
                              title={`${dateStr}: ${st || 'Unmarked'} (tap to mark)`}
                            >
                              <span className="text-[11px] font-black leading-none">{dayNum}</span>
                              <span className="text-[10px] font-bold mt-1 leading-none">{shortCode}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Live Month Summary Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-[10px] text-emerald-700 block font-bold">Present</span>
                        <span className="text-sm font-black text-emerald-900">{stats.presentDays}</span>
                      </div>
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-[10px] text-amber-800 block font-bold">Paid Leave</span>
                        <span className="text-sm font-black text-amber-900">{stats.paidLeaveDays}</span>
                      </div>
                      <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg">
                        <span className="text-[10px] text-sky-800 block font-bold">Week Off</span>
                        <span className="text-sm font-black text-sky-900">{stats.weekOffDays}</span>
                      </div>
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-[10px] text-blue-700 block font-bold">Half Day</span>
                        <span className="text-sm font-black text-blue-900">{stats.halfDays}</span>
                      </div>
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                        <span className="text-[10px] text-purple-700 block font-bold">2x Shift</span>
                        <span className="text-sm font-black text-purple-900">{stats.doubleShiftDays}</span>
                      </div>
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                        <span className="text-[10px] text-rose-700 block font-bold">Absent</span>
                        <span className="text-sm font-black text-rose-900">{stats.absentDays}</span>
                      </div>
                      <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <span className="text-[10px] text-indigo-700 block font-bold">OT Hours</span>
                        <span className="text-sm font-black text-indigo-900">{stats.totalOtHours}h</span>
                      </div>
                      <div className="p-2 bg-slate-900 text-white rounded-lg">
                        <span className="text-[10px] text-slate-300 block font-bold">
                          Net Pay ({stats.effectivePaidDays}/{stats.daysInMonth}d)
                        </span>
                        <span className="text-sm font-black text-emerald-400 font-mono">{formatINR(stats.netSalaryPayable)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. OVERVIEW & SALARY ENGINE TAB */}
                {activeTrackingTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Performance Cards Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Attendance Score</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-slate-900">{stats.attendancePercentage}%</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            stats.attendancePercentage >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {stats.attendancePercentage >= 90 ? 'Grade A' : 'Standard'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {stats.presentDays} P · {stats.paidLeaveDays} PL · {stats.weekOffDays} WO · {stats.doubleShiftDays} 2x · {stats.halfDays} H
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Overtime Logged</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-purple-700">{stats.totalOtHours}</span>
                          <span className="text-xs font-bold text-slate-600">Hours</span>
                        </div>
                        <span className="text-[10px] text-purple-600 block mt-1 font-semibold">
                          OT Pay: {formatINR(stats.otPay)}
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Gross Earned Wages</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-black text-slate-900">{formatINR(stats.grossEarnings)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Base {formatINR(stats.basePay)} + OT {formatINR(stats.otPay)}
                        </span>
                      </div>

                      <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold block">Net Payable Salary</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-emerald-700 font-mono">
                            {formatINR(stats.netSalaryPayable)}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-600 block mt-1">
                          After advance ded. of {formatINR(stats.advanceDeduction)}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Salary & Wage Formula Breakdown */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <span>Detailed Salary & Wage Breakdown ({selectedMonth})</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Wage Basis: {trackingEmployee.monthlySalary > 0 ? `₹${trackingEmployee.monthlySalary}/mo ÷ ${stats.daysInMonth} days = ₹${stats.perDayRate}/day` : `₹${trackingEmployee.dailyWageRate}/day Daily Wage`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                            <span>Standard Full Days Worked:</span>
                            <span className="font-mono font-semibold">{stats.presentDays} days × ₹{stats.perDayRate}</span>
                          </div>
                          {stats.paidLeaveDays > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-amber-800 font-semibold">
                              <span>Paid Leave Days (PL):</span>
                              <span className="font-mono">{stats.paidLeaveDays} days × ₹{stats.perDayRate} = {formatINR(Math.round(stats.paidLeaveDays * stats.perDayRate))}</span>
                            </div>
                          )}
                          {stats.weekOffDays > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-sky-800 font-semibold">
                              <span>Week Off Days (WO{trackingEmployee.monthlySalary > 0 ? ' · Paid' : ' · Rest'}):</span>
                              <span className="font-mono">
                                {trackingEmployee.monthlySalary > 0
                                  ? `${stats.weekOffDays} days × ₹${stats.perDayRate} = ${formatINR(Math.round(stats.weekOffDays * stats.perDayRate))}`
                                  : `${stats.weekOffDays} rest days (₹0)`}
                              </span>
                            </div>
                          )}
                          {stats.doubleShiftDays > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-purple-700 font-semibold">
                              <span>Double Shifts Worked (2x Pay):</span>
                              <span className="font-mono">{stats.doubleShiftDays} shifts × ₹{(stats.perDayRate * 2).toFixed(2)} = {formatINR(Math.round(stats.doubleShiftDays * stats.perDayRate * 2))}</span>
                            </div>
                          )}
                          {stats.halfDays > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                              <span>Half Days Worked:</span>
                              <span className="font-mono font-semibold">{stats.halfDays} days × ₹{(stats.perDayRate / 2).toFixed(2)}</span>
                            </div>
                          )}
                          {stats.totalOtHours > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-purple-700 font-medium">
                              <span>Overtime Pay (1.5x Normal Hourly Rate):</span>
                              <span className="font-mono font-bold">+{formatINR(stats.otPay)}</span>
                            </div>
                          )}
                          <div className="flex justify-between py-1.5 border-b border-slate-200 font-bold text-slate-900">
                            <span>Total Gross Earnings:</span>
                            <span className="font-mono">{formatINR(stats.grossEarnings)}</span>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700 font-medium">
                            <span>Employee Advance Deduction:</span>
                            <span className="font-mono font-semibold">-{formatINR(stats.advanceDeduction)}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                            <span>TDS / Professional Tax Deductions:</span>
                            <span className="font-mono">₹ 0.00</span>
                          </div>
                          <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-lg border border-emerald-200 font-black text-sm text-emerald-900">
                            <span>NET PAYABLE TO EMPLOYEE:</span>
                            <span className="font-mono text-base">{formatINR(stats.netSalaryPayable)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ATTENDANCE HISTORY LOG TAB WITH FULL CRUD */}
                {activeTrackingTab === 'history' && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800 block">
                          Recorded Shifts for {selectedMonth}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {stats.monthRecords.length} recorded shift entries. You can edit any shift date, status, OT hours, or delete entries.
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenCustomShiftModal(trackingEmployee.id)}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add / Log Shift</span>
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">OT Hours</th>
                            <th className="py-2.5 px-3">Remarks / Yard Duty Notes</th>
                            <th className="py-2.5 px-3 text-right">Marked By</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.monthRecords.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                No attendance records found for this employee in {selectedMonth}. Click "+ Add / Log Shift" above to add one.
                              </td>
                            </tr>
                          ) : (
                            stats.monthRecords.map((rec) => (
                              <tr key={rec.id} className="hover:bg-slate-50/80">
                                <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                  {rec.attendanceDate}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <StatusBadge status={rec.status} />
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-purple-700">
                                  {rec.overtimeHours ? `${rec.overtimeHours} hrs` : '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-700">
                                  {rec.remarks || 'Standard shift completed'}
                                  {rec.isCorrected && (
                                    <span className="text-[9.5px] text-amber-600 block italic">
                                      ({rec.correctionReason || 'Amended'})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400 text-[10px]">
                                  {rec.markedBy || 'Supervisor'}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleOpenCustomShiftModal(trackingEmployee.id, rec)}
                                      className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded cursor-pointer"
                                      title="Edit shift details or OT hours"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteShiftRecord(rec)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                      title="Delete shift entry"
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
                )}

                {/* 3. PRINTABLE PAY SLIP TAB */}
                {activeTrackingTab === 'payslip' && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Official Pay Slip (A4)</span>
                      </button>
                    </div>

                    <div className="p-8 bg-white border border-slate-300 rounded-xl max-w-2xl mx-auto text-black font-sans shadow-md">
                      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                        <div>
                          <h2 className="text-xl font-black uppercase text-slate-900 tracking-wide">{company.companyName}</h2>
                          <p className="text-[10px] text-slate-600 leading-tight mt-1">{company.addressLine1}, {company.city}, {company.stateName} - {company.pincode}</p>
                          <p className="text-[10px] text-slate-600 font-mono">GSTIN: {company.gstin} · State: {company.stateName} (33)</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black uppercase bg-slate-900 text-white px-2.5 py-1 rounded">
                            MONTHLY PAY SLIP
                          </span>
                          <span className="font-mono text-xs font-bold block mt-2 text-slate-800">Period: {selectedMonth}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
                        <div>
                          <p><span className="text-slate-500">Employee Name:</span> <span className="font-bold">{trackingEmployee.fullName}</span></p>
                          <p><span className="text-slate-500">Employee Code:</span> <span className="font-mono font-bold">{trackingEmployee.employeeCode}</span></p>
                          <p><span className="text-slate-500">Designation:</span> {trackingEmployee.designation}</p>
                        </div>
                        <div>
                          <p><span className="text-slate-500">Department:</span> {trackingEmployee.department}</p>
                          <p><span className="text-slate-500">Effective Paid Days:</span> <span className="font-bold">{stats.effectivePaidDays} / {stats.daysInMonth} Days</span> <span className="text-[10px] text-slate-500">({stats.presentDays}P, {stats.paidLeaveDays}PL, {stats.weekOffDays}WO)</span></p>
                          <p><span className="text-slate-500">Overtime Logged:</span> <span className="font-bold text-purple-700">{stats.totalOtHours} Hours</span></p>
                        </div>
                      </div>

                      <div className="py-4 border-b border-slate-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 font-bold text-slate-600 text-[10px] uppercase">
                              <th className="py-1 text-left">Earnings Head</th>
                              <th className="py-1 text-right">Amount (₹)</th>
                              <th className="py-1 text-left pl-6">Deductions Head</th>
                              <th className="py-1 text-right">Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="py-1.5 text-slate-800">Basic Pay & Shift Wages</td>
                              <td className="py-1.5 text-right font-mono font-bold">{formatINR(stats.basePay)}</td>
                              <td className="py-1.5 pl-6 text-slate-800">Salary Advance Recovery</td>
                              <td className="py-1.5 text-right font-mono font-bold text-rose-700">-{formatINR(stats.advanceDeduction)}</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate-800">Overtime Pay ({stats.totalOtHours}h @ 1.5x)</td>
                              <td className="py-1.5 text-right font-mono font-bold text-purple-700">+{formatINR(stats.otPay)}</td>
                              <td className="py-1.5 pl-6 text-slate-800">TDS / Professional Tax</td>
                              <td className="py-1.5 text-right font-mono">₹ 0.00</td>
                            </tr>
                            <tr className="font-bold bg-slate-50">
                              <td className="py-2 text-slate-900">Gross Earnings:</td>
                              <td className="py-2 text-right font-mono text-emerald-800">{formatINR(stats.grossEarnings)}</td>
                              <td className="py-2 pl-6 text-slate-900">Total Deductions:</td>
                              <td className="py-2 text-right font-mono text-rose-800">-{formatINR(stats.advanceDeduction)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="py-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 mt-2 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-800 block">NET TAKE-HOME PAYABLE</span>
                          <span className="text-xl font-black font-mono text-emerald-900">{formatINR(stats.netSalaryPayable)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Disbursed via Yard Cash/Bank</span>
                          <span className="text-xs font-bold text-slate-700">Yasoth Enterprises Payroll</span>
                        </div>
                      </div>

                      <div className="mt-10 flex justify-between items-end pt-4 border-t border-slate-200 text-[10px] text-slate-500">
                        <div>
                          <div className="h-10 border-b border-black w-40 mb-1"></div>
                          <span>Employee Signature</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block mb-1">for {company.companyName}</span>
                          <div className="h-10 border-b border-black w-40 mb-1 inline-block"></div>
                          <span className="block">Authorised Signatory</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* EMPLOYEE ADD / EDIT PROFILE MODAL                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? `Edit Employee: ${editingEmployee.fullName}` : 'Add New Staff Member'}
        subtitle="Yard operators, weighbridge staff, drivers, and supervisory roster."
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Employee Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Full Legal Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Yard Operations">Yard Operations</option>
                <option value="Logistics & Transport">Logistics & Transport</option>
                <option value="Weighbridge">Weighbridge</option>
                <option value="Security & Gate">Security & Gate</option>
                <option value="Administration & Accounts">Administration & Accounts</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Phone Number</label>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                  title="Pick from contacts, clipboard, or team"
                >
                  <BookUser className="w-3.5 h-3.5" />
                  <span>Fetch from Contacts</span>
                </button>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Daily Wage Rate (₹)</label>
                {dailyWage > 0 && (
                  <button
                    type="button"
                    onClick={() => setDailyWage(0)}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    Clear (₹0)
                  </button>
                )}
              </div>
              <input
                type="number"
                value={dailyWage === 0 ? '' : dailyWage}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setDailyWage(val === '' ? 0 : parseFloat(val) || 0);
                }}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                min="0"
                placeholder="0"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Monthly Salary (₹) - If salaried</label>
                {monthlySalary > 0 && (
                  <button
                    type="button"
                    onClick={() => setMonthlySalary(0)}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    Clear (₹0)
                  </button>
                )}
              </div>
              <input
                type="number"
                value={monthlySalary === 0 ? '' : monthlySalary}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setMonthlySalary(val === '' ? 0 : parseFloat(val) || 0);
                }}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                min="0"
                placeholder="0 if daily wage earner"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Current Advance Balance (₹)</label>
                {advanceBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdvanceBalance(0)}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    Clear (₹0)
                  </button>
                )}
              </div>
              <input
                type="number"
                value={advanceBalance === 0 ? '' : advanceBalance}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setAdvanceBalance(val === '' ? 0 : parseFloat(val) || 0);
                }}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono text-rose-700 font-bold"
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
            >
              {editingEmployee ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </Modal>

      <QuickContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title="Fetch Staff Contact"
        onSelect={(c) => {
          if (c.phone) setPhone(c.phone);
          if (c.name && (!name || !name.trim())) setName(c.name);
          setFeedbackMsg({ type: 'success', text: `Fetched contact: ${c.name || c.phone}` });
          setTimeout(() => setFeedbackMsg(null), 3000);
        }}
      />
    </div>
  );
};

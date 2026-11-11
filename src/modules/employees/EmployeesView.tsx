import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Employee, AttendanceStatus, AttendanceEntry } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
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
  ShieldCheck,
  Zap,
  BookUser
} from 'lucide-react';
import { pickContactFromPhonebook, isContactPickerSupported } from '../../utils/contactPicker.ts';
import { QuickContactModal } from '../../components/QuickContactModal.tsx';

export const EmployeesView: React.FC = () => {
  const { 
    employees, 
    attendance, 
    markAttendance, 
    updateAttendanceEntry, 
    deleteAttendanceEntry, 
    addAttendanceRecord,
    addEmployee, 
    updateEmployee, 
    deleteEmployee, 
    company, 
    currentUser 
  } = useERP();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Individual Employee Performance & Salary Tracking State
  const [trackingEmployee, setTrackingEmployee] = useState<Employee | null>(null);
  const [activeTrackingTab, setActiveTrackingTab] = useState<'overview' | 'history' | 'payslip'>('overview');
  const [selectedMonth, setSelectedMonth] = useState('2026-10');

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

  const handleStatusChange = (empId: string, status: AttendanceStatus, hours: number = 0, remarks?: string) => {
    markAttendance(empId, selectedDate, status, hours, remarks);
    setFeedbackMsg({
      type: 'success',
      text: `Status updated to ${status.replace('_', ' ')}${hours > 0 ? ` (+${hours}h OT)` : ''} for selected date.`,
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
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

  // Performance & Salary metrics calculation for selected employee
  const getEmployeeStats = (emp: Employee) => {
    const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
    const monthFiltered = empAttendance.filter((a) => a.attendanceDate.startsWith(selectedMonth));

    const doubleShiftDays = monthFiltered.filter((a) => a.status === 'DOUBLE_SHIFT').length;
    const presentDays = monthFiltered.filter((a) => a.status === 'PRESENT' || a.status === 'OVERTIME').length;
    const halfDays = monthFiltered.filter((a) => a.status === 'HALF_DAY').length;
    const absentDays = monthFiltered.filter((a) => a.status === 'ABSENT').length;
    const totalDaysLogged = monthFiltered.length || 1;
    const totalOtHours = monthFiltered.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

    // Double shift awards 2 full effective shifts
    const effectiveDays = presentDays + (doubleShiftDays * 2) + (halfDays * 0.5);
    const attendancePercentage = Math.min(100, Math.round((effectiveDays / totalDaysLogged) * 100));

    // Wage Calculations
    let grossEarnings = 0;
    let basePay = 0;
    let otPay = 0;

    if (emp.monthlySalary > 0) {
      // Salaried staff
      const perDaySalary = emp.monthlySalary / 26;
      basePay = Math.round(perDaySalary * effectiveDays);
      otPay = Math.round(totalOtHours * (perDaySalary / 8) * 1.5);
      grossEarnings = basePay + otPay;
    } else {
      // Daily wage staff: base pay includes standard days + double shifts (2x) + half days (0.5x)
      basePay = Math.round(emp.dailyWageRate * presentDays + (emp.dailyWageRate * 2) * doubleShiftDays + (emp.dailyWageRate / 2) * halfDays);
      otPay = Math.round(totalOtHours * (emp.dailyWageRate / 8) * 1.5);
      grossEarnings = basePay + otPay;
    }

    const advanceDeduction = emp.currentAdvanceBalance || 0;
    const netSalaryPayable = Math.max(0, grossEarnings - advanceDeduction);

    return {
      allRecords: empAttendance,
      monthRecords: monthFiltered.sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
      doubleShiftDays,
      presentDays,
      halfDays,
      absentDays,
      totalOtHours,
      attendancePercentage,
      basePay,
      otPay,
      grossEarnings,
      advanceDeduction,
      netSalaryPayable,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-red-600" />
            <span>Staff Roster, Attendance & Salary Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD management for employees, flexible shift logging, editable overtime hours, double shift tracking, and automated wage calculations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Daily Date Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-600">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Employee</span>
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

      {/* Staff & Attendance Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
              Daily Shift & Attendance Roster ({selectedDate})
            </span>
            <span className="text-[11px] text-slate-500">
              Click individual employee name for full monthly attendance history, editable shift logs, and printable pay slips.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Quick Legend:</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Present</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Half Day</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Double Shift</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Employee Details</th>
                <th className="py-3 px-4">Designation & Dept</th>
                <th className="py-3 px-4">Wage Structure</th>
                <th className="py-3 px-4 text-center">Status on {selectedDate}</th>
                <th className="py-3 px-4 text-center">Shift & Overtime Controls</th>
                <th className="py-3 px-4 text-center">Performance & Net Wages</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const record = attendance.find(
                  (a) => a.employeeId === emp.id && a.attendanceDate === selectedDate
                );
                const currentStatus: AttendanceStatus = record?.status || 'PRESENT';
                const currentOt = record?.overtimeHours || 0;
                const stats = getEmployeeStats(emp);

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{emp.employeeCode}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          setTrackingEmployee(emp);
                          setActiveTrackingTab('overview');
                        }}
                        className="font-bold text-slate-900 block hover:text-red-600 text-left transition-colors cursor-pointer"
                        title="Click to view detailed performance & salary calculation"
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
                        <StatusBadge status={currentStatus} />
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
                          onClick={() => handleOpenCustomShiftModal(emp.id, record)}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                            currentOt > 0 && currentStatus !== 'DOUBLE_SHIFT'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                          }`}
                          title="Edit Custom Overtime Hours (e.g. 1h, 2h, 4h, 8h, 12h)"
                        >
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>{currentOt > 0 ? `OT: ${currentOt}h` : 'Custom OT'}</span>
                        </button>
                        <button
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
                        onClick={() => {
                          setTrackingEmployee(emp);
                          setActiveTrackingTab('overview');
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 border border-slate-300 shadow-xs cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{stats.attendancePercentage}% Score</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-emerald-700 font-bold">{formatINR(stats.netSalaryPayable)}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Employee Profile & Wage"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
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
              })}
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
                <option value="DOUBLE_SHIFT">Double Shift (Continuous 16h Duty - 2x Pay)</option>
                <option value="OVERTIME">Overtime (Custom OT Hours)</option>
                <option value="HALF_DAY">Half Day (4h Shift)</option>
                <option value="ABSENT">Absent</option>
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
      {/* INDIVIDUAL EMPLOYEE PERFORMANCE & SALARY TRACKING MODAL                   */}
      {/* ========================================================================= */}
      {trackingEmployee && (
        <Modal
          isOpen={!!trackingEmployee}
          onClose={() => setTrackingEmployee(null)}
          title={`Performance & Salary: ${trackingEmployee.fullName} (${trackingEmployee.employeeCode})`}
          subtitle={`Department: ${trackingEmployee.department} · Designation: ${trackingEmployee.designation}`}
          maxWidth="6xl"
        >
          {(() => {
            const stats = getEmployeeStats(trackingEmployee);

            return (
              <div className="space-y-5 text-xs">
                {/* Navigation Tabs inside Employee Modal */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTrackingTab('overview')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'overview'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Performance & Salary Details</span>
                    </button>
                    <button
                      onClick={() => setActiveTrackingTab('history')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'history'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Attendance History ({stats.monthRecords.length} shifts)</span>
                    </button>
                    <button
                      onClick={() => setActiveTrackingTab('payslip')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTrackingTab === 'payslip'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Monthly Pay Slip</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Period:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="p-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 text-xs cursor-pointer"
                    />
                  </div>
                </div>

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
                          {stats.presentDays} Full · {stats.doubleShiftDays} Double · {stats.halfDays} Half
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
                          Wage Basis: {trackingEmployee.monthlySalary > 0 ? `₹${trackingEmployee.monthlySalary}/mo Fixed` : `₹${trackingEmployee.dailyWageRate}/day Daily Wage`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                            <span>Standard Full Days Worked:</span>
                            <span className="font-mono font-semibold">{stats.presentDays} days × ₹{trackingEmployee.dailyWageRate || Math.round(trackingEmployee.monthlySalary / 26)}</span>
                          </div>
                          {stats.doubleShiftDays > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-purple-700 font-semibold">
                              <span>Double Shifts Worked (2x Pay):</span>
                              <span className="font-mono">{stats.doubleShiftDays} shifts × ₹{(trackingEmployee.dailyWageRate || Math.round(trackingEmployee.monthlySalary / 26)) * 2} = {formatINR(stats.doubleShiftDays * (trackingEmployee.dailyWageRate || Math.round(trackingEmployee.monthlySalary / 26)) * 2)}</span>
                            </div>
                          )}
                          {stats.halfDays > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                              <span>Half Days Worked:</span>
                              <span className="font-mono font-semibold">{stats.halfDays} days × ₹{(trackingEmployee.dailyWageRate || Math.round(trackingEmployee.monthlySalary / 26)) / 2}</span>
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

                      <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
                        <div>
                          <p><span className="text-slate-500">Employee Name:</span> <span className="font-bold">{trackingEmployee.fullName}</span></p>
                          <p><span className="text-slate-500">Employee Code:</span> <span className="font-mono font-bold">{trackingEmployee.employeeCode}</span></p>
                          <p><span className="text-slate-500">Designation:</span> {trackingEmployee.designation}</p>
                        </div>
                        <div>
                          <p><span className="text-slate-500">Department:</span> {trackingEmployee.department}</p>
                          <p><span className="text-slate-500">Effective Days:</span> <span className="font-bold">{stats.presentDays + (stats.doubleShiftDays * 2) + stats.halfDays * 0.5} Days</span></p>
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
          <div className="grid grid-cols-2 gap-3">
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

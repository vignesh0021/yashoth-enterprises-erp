import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { AttendanceStatus } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
import { 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';

export const EmployeesView: React.FC = () => {
  const { employees, attendance, markAttendance, currentUser } = useERP();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const handleStatusChange = (empId: string, status: AttendanceStatus, otHours: number = 0) => {
    markAttendance(empId, selectedDate, status, otHours);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Employees & Daily Attendance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Yard staff roster, wage bases, daily check-in attendance register, and overtime tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-transparent pr-2 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Staff & Attendance Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Designation & Dept</th>
                <th className="py-3 px-4">Wage Structure</th>
                <th className="py-3 px-4 text-center">Status on {selectedDate}</th>
                <th className="py-3 px-4 text-right">Overtime</th>
                <th className="py-3 px-4 text-right">Mark Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const record = attendance.find(
                  (a) => a.employeeId === emp.id && a.attendanceDate === selectedDate
                );
                const currentStatus: AttendanceStatus = record?.status || 'PRESENT';

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{emp.employeeCode}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{emp.fullName}</span>
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
                      <StatusBadge status={currentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {record?.overtimeHours ? `${record.overtimeHours} hrs` : '0 hrs'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleStatusChange(emp.id, 'PRESENT')}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            currentStatus === 'PRESENT'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(emp.id, 'HALF_DAY')}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            currentStatus === 'HALF_DAY'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Half Day
                        </button>
                        <button
                          onClick={() => handleStatusChange(emp.id, 'OVERTIME', 2)}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            currentStatus === 'OVERTIME'
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          +2h OT
                        </button>
                        <button
                          onClick={() => handleStatusChange(emp.id, 'ABSENT')}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            currentStatus === 'ABSENT'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Absent
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
    </div>
  );
};

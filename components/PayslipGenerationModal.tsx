'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Download, FileText, Calendar, User, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import jsPDF from 'jspdf';

interface Employee {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  empId?: string;
  designation?: string;
}

interface PayslipData {
  employee: {
    _id: string;
    name: string;
    email: string;
    empId?: string;
    designation?: string;
    dateOfJoining: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    panCardImage?: string;
    aadharCardImage?: string;
    location?: string;
    panNumber?: string;
    aadharNumber?: string;
  };
  finance: {
    baseSalary: number;
    allowances: number;
    deductions: number;
    bonus?: number;
    totalSalary: number;
  } | null;
  workDays: {
    effective: number;
    total: number;
    lop: number;
  };
}

interface PayslipGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PayslipGenerationModal({ isOpen, onClose }: PayslipGenerationModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payslipData, setPayslipData] = useState<PayslipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Fetch employees
  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };

    if (showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmployeeDropdown]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users?minimal=true');
      const data = await res.json();
      if (res.ok && data.users) {
        setEmployees(data.users.filter((u: Employee) => u.email));
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.empId && emp.empId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const fetchPayslipData = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/payslip/data?userId=${selectedEmployee._id}&month=${selectedMonth}&year=${selectedYear}`
      );
      const data = await res.json();
      if (res.ok) {
        setPayslipData(data);
      } else {
        toast.error(data.error || 'Failed to fetch payslip data');
      }
    } catch (err) {
      console.error('Failed to fetch payslip data:', err);
      toast.error('Failed to fetch payslip data');
    } finally {
      setLoading(false);
    }
  };

  const numberToWords = (num: number): string => {
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    if (num < 1000) {
      return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + numberToWords(num % 100) : '');
    }
    if (num < 100000) {
      return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '');
    }
    if (num < 10000000) {
      return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + numberToWords(num % 100000) : '');
    }
    return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + numberToWords(num % 10000000) : '');
  };

  const generatePayslip = async () => {
    if (!payslipData) {
      toast.error('Please fetch payslip data first');
      return;
    }

    if (!payslipData.finance) {
      toast.error('No finance data available for this employee. Please add salary information first.');
      return;
    }

    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;

      // Load and add company logo
      const logoPath = '/assets/paysliplogo.png';
      const logoWidth = 40; // Logo width in mm
      const logoX = (pageWidth - logoWidth) / 2; // Center horizontally
      const logoY = margin;
      let textStartY = margin + 10; // Default start position if logo fails

      // Load logo image and convert to base64
      try {
        const response = await fetch(logoPath);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          
          await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              try {
                const base64data = reader.result as string;
                // Load image to get dimensions for aspect ratio
                const img = new Image();
                img.onload = () => {
                  // Calculate height maintaining aspect ratio
                  const aspectRatio = img.height / img.width;
                  const logoHeight = logoWidth * aspectRatio;
                  // Add logo to PDF
                  doc.addImage(base64data, 'PNG', logoX, logoY, logoWidth, logoHeight);
                  textStartY = logoY + logoHeight + 8;
                  resolve(true);
                };
                img.onerror = () => reject(new Error('Failed to load image for dimensions'));
                img.src = base64data;
              } catch (error) {
                console.warn('Error adding logo to PDF:', error);
                reject(error);
              }
            };
            reader.onerror = () => reject(new Error('Failed to read logo file'));
            reader.readAsDataURL(blob);
          });
        }
      } catch (error) {
        console.warn('Could not load logo image:', error);
        // Continue without logo if image fails to load
        textStartY = margin + 10;
      }

      // Company Header (positioned below logo)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Mavericks and Musers Media Pvt. Ltd.', pageWidth / 2, textStartY, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('79A, B Block Shyam Nagar', pageWidth / 2, textStartY + 8, { align: 'center' });
      doc.text('Near Brahmakumaris center', pageWidth / 2, textStartY + 14, { align: 'center' });
      doc.text('Sujatganj, Kanpur -', pageWidth / 2, textStartY + 20, { align: 'center' });

      // Payslip Title
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Payslip for the month of ${monthNames[selectedMonth - 1]} ${selectedYear}`, pageWidth / 2, textStartY + 35, { align: 'center' });

      let yPos = textStartY + 50;

      // Employee Details Section (Left side)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const leftColX = margin;
      const rightColX = pageWidth / 2 + 20;
      
      doc.text(`Name: ${payslipData.employee.name}`, leftColX, yPos);
      doc.text(`Date of joining: ${payslipData.employee.dateOfJoining}`, leftColX, yPos + 6);
      doc.text(`Department: ${payslipData.employee.designation || 'N/A'}`, leftColX, yPos + 12);
      doc.text(`Location: ${payslipData.employee.location || 'N/A'}`, leftColX, yPos + 18);
      doc.text(`Effective work days: ${payslipData.workDays.effective}`, leftColX, yPos + 24);
      doc.text(`Days in month: ${payslipData.workDays.total}`, leftColX, yPos + 30);

      // Bank Details (Right side)
      doc.text(`Bank Name: ${payslipData.employee.bankName || 'N/A'}`, rightColX, yPos);
      doc.text(`Bank Account No: ${payslipData.employee.accountNumber || 'N/A'}`, rightColX, yPos + 6);
      doc.text(`PF No:`, rightColX, yPos + 12);
      doc.text(`PF UAN:`, rightColX, yPos + 18);
      doc.text(`ESI No:`, rightColX, yPos + 24);
      doc.text(`PAN No: ${payslipData.employee.panNumber || 'N/A'}`, rightColX, yPos + 30);

      yPos += 45;

      // Earnings Table Header
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const earningsCol1 = margin;
      const earningsCol2 = margin + 60;
      const earningsCol3 = margin + 100;
      const earningsCol4 = margin + 140;
      
      doc.text('Earnings', earningsCol1, yPos);
      doc.text('Full', earningsCol2, yPos);
      doc.text('Actual', earningsCol3, yPos);
      doc.text('LOP', earningsCol4, yPos);

      yPos += 8;

      // Earnings Data
      if (payslipData.finance) {
        const basicSalary = payslipData.finance.baseSalary || 0;
        const specialAllowance = payslipData.finance.allowances || 0;
        const totalEarnings = basicSalary + specialAllowance;
        const lopDeduction = payslipData.workDays.lop > 0 
          ? (basicSalary / payslipData.workDays.total) * payslipData.workDays.lop 
          : 0;
        const actualBasic = basicSalary - lopDeduction;
        const actualEarnings = totalEarnings - lopDeduction;

        doc.setFont('helvetica', 'normal');
        doc.text('Basic', earningsCol1, yPos);
        doc.text(`Rs. ${basicSalary.toFixed(2)}`, earningsCol2, yPos);
        doc.text(`Rs. ${actualBasic.toFixed(2)}`, earningsCol3, yPos);
        doc.text(payslipData.workDays.lop > 0 ? `Rs. ${lopDeduction.toFixed(2)}` : '-', earningsCol4, yPos);

        yPos += 6;
        doc.text('Special Allowance', earningsCol1, yPos);
        doc.text(`Rs. ${specialAllowance.toFixed(2)}`, earningsCol2, yPos);
        doc.text(`Rs. ${specialAllowance.toFixed(2)}`, earningsCol3, yPos);
        doc.text('-', earningsCol4, yPos);

        yPos += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('Total Earnings Rs.', earningsCol1, yPos);
        doc.text(`Rs. ${totalEarnings.toFixed(2)}`, earningsCol2, yPos);
        doc.text(`Rs. ${actualEarnings.toFixed(2)}`, earningsCol3, yPos);
        doc.text(payslipData.workDays.lop > 0 ? `Rs. ${lopDeduction.toFixed(2)}` : '-', earningsCol4, yPos);
      }

      yPos += 15;

      // Deductions Table Header
      doc.setFont('helvetica', 'bold');
      doc.text('Deductions', earningsCol1, yPos);
      doc.text('Actual', earningsCol3, yPos);

      yPos += 8;

      // Deductions Data
      if (payslipData.finance) {
        const totalDeductions = payslipData.finance.deductions || 0;
        doc.setFont('helvetica', 'normal');
        doc.text('Total Deductions', earningsCol1, yPos);
        doc.text(`Rs. ${totalDeductions.toFixed(2)}`, earningsCol3, yPos);
      }

      yPos += 15;

      // Net Pay
      if (payslipData.finance) {
        const basicSalary = payslipData.finance.baseSalary || 0;
        const specialAllowance = payslipData.finance.allowances || 0;
        const totalEarnings = basicSalary + specialAllowance;
        const lopDeduction = payslipData.workDays.lop > 0 
          ? (basicSalary / payslipData.workDays.total) * payslipData.workDays.lop 
          : 0;
        const actualEarnings = totalEarnings - lopDeduction;
        const totalDeductions = payslipData.finance.deductions || 0;
        const netPay = actualEarnings - totalDeductions;

        doc.setFont('helvetica', 'bold');
        doc.text('Net Pay for the month (Total Earnings - Total Deductions):', earningsCol1, yPos);
        doc.text(`Rs. ${netPay.toFixed(2)}`, earningsCol3, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(`(In rupees in words: ${numberToWords(Math.round(netPay))} Only)`, earningsCol1, yPos + 12);
      }

      // Generate filename
      const fileName = `Payslip_${payslipData.employee.name.replace(/\s+/g, '_')}_${monthNames[selectedMonth - 1]}_${selectedYear}.pdf`;

      // Save PDF
      doc.save(fileName);
      toast.success('Payslip generated successfully!');
    } catch (error) {
      console.error('Error generating payslip:', error);
      toast.error('Failed to generate payslip');
    } finally {
      setGenerating(false);
    }
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSearchTerm(employee.name);
    setShowEmployeeDropdown(false);
    setPayslipData(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-700" />
                  <h2 className="text-lg font-semibold text-gray-900 font-primary">Generate Payslip</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Employee Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                    Employee
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <div className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2 bg-white">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setShowEmployeeDropdown(true);
                        }}
                        onFocus={() => setShowEmployeeDropdown(true)}
                        placeholder="Search employee..."
                        className="flex-1 outline-none text-sm text-gray-900 font-secondary"
                      />
                    </div>

                    {showEmployeeDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredEmployees.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-500 font-secondary">
                            No employees found
                          </div>
                        ) : (
                          filteredEmployees.map((emp) => (
                            <button
                              key={emp._id}
                              onClick={() => handleEmployeeSelect(emp)}
                              className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 transition-colors text-left"
                            >
                              <UserAvatar
                                name={emp.name}
                                image={emp.profileImage}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 font-primary truncate">
                                  {emp.name}
                                </p>
                                <p className="text-xs text-gray-500 font-secondary truncate">
                                  {emp.email} {emp.empId && `• ${emp.empId}`}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {selectedEmployee && (
                    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md flex items-center gap-2.5">
                      <UserAvatar
                        name={selectedEmployee.name}
                        image={selectedEmployee.profileImage}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 font-primary truncate">
                          {selectedEmployee.name}
                        </p>
                        <p className="text-xs text-gray-600 font-secondary truncate">
                          {selectedEmployee.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Month and Year Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                      Month
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-secondary bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                        return (
                          <option key={month} value={month}>
                            {monthNames[month - 1]}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                      Year
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-secondary bg-white"
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fetch Data Button */}
                <button
                  onClick={fetchPayslipData}
                  disabled={!selectedEmployee || loading}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-secondary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Fetch Payslip Data
                    </>
                  )}
                </button>

                {/* Payslip Preview/Data */}
                {payslipData && (
                  <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
                    {!payslipData.finance ? (
                      <div className="p-3 bg-amber-50 border-b border-amber-200">
                        <p className="text-xs text-amber-800 font-secondary">
                          ⚠️ No finance data found. Please add salary information first.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto">
                        {/* Company Header */}
                        <div className="bg-gray-50 border-b border-gray-200 px-3.5 py-2.5">
                          <h3 className="text-sm font-semibold text-gray-900 font-primary">Mavericks and Musers Media Pvt. Ltd.</h3>
                          <p className="text-xs text-gray-600 font-secondary mt-0.5">79A, B Block Shyam Nagar, Near Brahmakumaris center, Sujatganj, Kanpur</p>
                          <p className="text-xs font-medium text-gray-700 font-secondary mt-1.5">
                            Payslip for the month of {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth - 1]} {selectedYear}
                          </p>
                        </div>

                        <div className="p-3.5 space-y-3.5">
                          {/* Employee & Bank Details */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Left Column - Employee Details */}
                            <div className="space-y-1.5 text-xs font-secondary">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Name:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Date of joining:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.dateOfJoining}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Department:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.designation || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Location:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.location || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Effective work days:</span>
                                <span className="font-medium text-gray-900">{payslipData.workDays.effective}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Days in month:</span>
                                <span className="font-medium text-gray-900">{payslipData.workDays.total}</span>
                              </div>
                            </div>

                            {/* Right Column - Bank Details */}
                            <div className="space-y-1.5 text-xs font-secondary">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Bank Name:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.bankName || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Bank Account No:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.accountNumber || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">PF No:</span>
                                <span className="font-medium text-gray-900">-</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">PF UAN:</span>
                                <span className="font-medium text-gray-900">-</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">ESI No:</span>
                                <span className="font-medium text-gray-900">-</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">PAN No:</span>
                                <span className="font-medium text-gray-900">{payslipData.employee.panNumber || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Earnings Table */}
                          {(() => {
                            const basicSalary = payslipData.finance.baseSalary || 0;
                            const specialAllowance = payslipData.finance.allowances || 0;
                            const totalEarnings = basicSalary + specialAllowance;
                            const lopDeduction = payslipData.workDays.lop > 0 
                              ? (basicSalary / payslipData.workDays.total) * payslipData.workDays.lop 
                              : 0;
                            const actualBasic = basicSalary - lopDeduction;
                            const actualEarnings = totalEarnings - lopDeduction;

                            return (
                              <div className="space-y-2">
                                <div className="border-b border-gray-200 pb-1.5">
                                  <h4 className="text-xs font-semibold text-gray-900 font-primary mb-1.5">Earnings</h4>
                                  <div className="grid grid-cols-4 gap-2 text-xs font-secondary">
                                    <span className="font-medium text-gray-700"></span>
                                    <span className="font-medium text-gray-700 text-center">Full</span>
                                    <span className="font-medium text-gray-700 text-center">Actual</span>
                                    <span className="font-medium text-gray-700 text-center">LOP</span>
                                  </div>
                                </div>
                                <div className="space-y-1.5 text-xs font-secondary">
                                  <div className="grid grid-cols-4 gap-2">
                                    <span className="text-gray-600">Basic</span>
                                    <span className="font-medium text-gray-900 text-center">₹{basicSalary.toFixed(2)}</span>
                                    <span className="font-medium text-gray-900 text-center">₹{actualBasic.toFixed(2)}</span>
                                    <span className="font-medium text-gray-900 text-center">{payslipData.workDays.lop > 0 ? `₹${lopDeduction.toFixed(2)}` : '-'}</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    <span className="text-gray-600">Special Allowance</span>
                                    <span className="font-medium text-gray-900 text-center">₹{specialAllowance.toFixed(2)}</span>
                                    <span className="font-medium text-gray-900 text-center">₹{specialAllowance.toFixed(2)}</span>
                                    <span className="font-medium text-gray-900 text-center">-</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 pt-1.5 border-t border-gray-100">
                                    <span className="font-semibold text-gray-900">Total Earnings Rs.</span>
                                    <span className="font-semibold text-gray-900 text-center">₹{totalEarnings.toFixed(2)}</span>
                                    <span className="font-semibold text-gray-900 text-center">₹{actualEarnings.toFixed(2)}</span>
                                    <span className="font-semibold text-gray-900 text-center">{payslipData.workDays.lop > 0 ? `₹${lopDeduction.toFixed(2)}` : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Deductions */}
                          <div className="space-y-1.5">
                            <div className="border-b border-gray-200 pb-1.5">
                              <h4 className="text-xs font-semibold text-gray-900 font-primary mb-1.5">Deductions</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs font-secondary">
                              <span className="text-gray-600">Total Deductions</span>
                              <span className="font-medium text-red-600 text-right">₹{payslipData.finance.deductions.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Net Pay */}
                          {(() => {
                            const basicSalary = payslipData.finance.baseSalary || 0;
                            const specialAllowance = payslipData.finance.allowances || 0;
                            const totalEarnings = basicSalary + specialAllowance;
                            const lopDeduction = payslipData.workDays.lop > 0 
                              ? (basicSalary / payslipData.workDays.total) * payslipData.workDays.lop 
                              : 0;
                            const actualEarnings = totalEarnings - lopDeduction;
                            const totalDeductions = payslipData.finance.deductions || 0;
                            const netPay = actualEarnings - totalDeductions;

                            return (
                              <div className="pt-2 border-t-2 border-gray-300 space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-900 font-primary">Net Pay for the month (Total Earnings - Total Deductions):</span>
                                  <span className="text-sm font-semibold text-green-600">₹{netPay.toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-gray-600 font-secondary italic">
                                  (In rupees in words: {numberToWords(Math.round(netPay))} Only)
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Generate Payslip Button */}
                {payslipData && (
                  <button
                    onClick={generatePayslip}
                    disabled={generating || !payslipData.finance}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-secondary"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Generate & Download Payslip
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

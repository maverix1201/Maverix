'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Calendar, Clock, Search, FileText, User, Laptop, Smartphone, CreditCard, Headphones, Monitor, Mouse, Trash2, Mail, Briefcase, MessageSquare, Package, Users, Wallet, Lock, CheckCircle, Download, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from './UserAvatar';
import Pagination from './Pagination';
import RejectResignationModal from './RejectResignationModal';
import ConfirmationModal from './ConfirmationModal';
import UpdateExitProcessModal from './UpdateExitProcessModal';
import LoadingDots from './LoadingDots';

interface Resignation {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
    empId?: string;
    designation?: string;
  };
  resignationDate: string | Date;
  reason: string;
  feedback?: string;
  assets?: string[];
  noticePeriodStartDate?: string | Date;
  noticePeriodEndDate?: string | Date;
  noticePeriodComplied?: boolean;
  knowledgeTransferCompleted?: boolean;
  handoverNotes?: string;
  handoverCompletedDate?: string | Date;
  assetsReturned?: boolean;
  assetsReturnDate?: string | Date;
  assetsReturnNotes?: string;
  clearances?: {
    design?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: string;
      approvedAt?: string | Date;
      notes?: string;
    };
    operation?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: string;
      approvedAt?: string | Date;
      notes?: string;
    };
    [key: string]: any; // Allow dynamic keys for backward compatibility
  };
  exitInterviewCompleted?: boolean;
  exitInterviewDate?: string | Date;
  exitInterviewFeedback?: string;
  fnfStatus?: 'pending' | 'processing' | 'completed';
  fnfAmount?: number;
  fnfProcessedDate?: string | Date;
  fnfNotes?: string;
  exitDocuments?: {
    experienceLetter?: string;
    relievingLetter?: string;
    otherDocuments?: string[];
    uploadedAt?: string | Date;
  };
  systemAccessDeactivated?: boolean;
  systemAccessDeactivatedDate?: string | Date;
  exitClosed?: boolean;
  exitClosedDate?: string | Date;
  exitClosedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'in-progress' | 'completed';
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  approvedAt?: string | Date;
  rejectionReason?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

interface ResignationManagementProps {
  initialResignations: Resignation[];
}

const companyAssets = [
  { id: 'laptop', label: 'Laptop', icon: Laptop },
  { id: 'mobile', label: 'Mobile Phone', icon: Smartphone },
  { id: 'id-card', label: 'ID Card', icon: CreditCard },
  { id: 'access-card', label: 'Access Card', icon: CreditCard },
  { id: 'headphones', label: 'Headphones', icon: Headphones },
  { id: 'monitor', label: 'Monitor', icon: Monitor },
  { id: 'mouse-keyboard', label: 'Mouse/Keyboard', icon: Mouse },
];

export default function ResignationManagement({ initialResignations }: ResignationManagementProps) {
  const [resignations, setResignations] = useState(initialResignations);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; resignation: Resignation | null }>({
    isOpen: false,
    resignation: null,
  });
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<{ isOpen: boolean; resignationId: string | null }>({
    isOpen: false,
    resignationId: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; resignationId: string | null }>({
    isOpen: false,
    resignationId: null,
  });
  const [exitProcessModal, setExitProcessModal] = useState<{ isOpen: boolean; resignation: Resignation | null; step: string; stepTitle: string }>({
    isOpen: false,
    resignation: null,
    step: '',
    stepTitle: '',
  });
  const [updatingProcess, setUpdatingProcess] = useState(false);
  const toast = useToast();

  // Update resignations when initialResignations changes
  useEffect(() => {
    // Process initial resignations to ensure all fields are properly formatted
    const processed = initialResignations.map((r: any) => {
      let assetsArray: string[] = [];
      if (r.assets !== undefined && r.assets !== null) {
        if (Array.isArray(r.assets)) {
          assetsArray = r.assets.filter((a: any) => a != null && a !== '' && String(a).trim() !== '');
        } else if (typeof r.assets === 'string' && r.assets.trim() !== '') {
          assetsArray = [r.assets.trim()];
        }
      }
      
      // Process notice period dates
      const noticePeriodStartDate = r.noticePeriodStartDate 
        ? (typeof r.noticePeriodStartDate === 'string' ? r.noticePeriodStartDate : new Date(r.noticePeriodStartDate).toISOString())
        : undefined;
      const noticePeriodEndDate = r.noticePeriodEndDate 
        ? (typeof r.noticePeriodEndDate === 'string' ? r.noticePeriodEndDate : new Date(r.noticePeriodEndDate).toISOString())
        : undefined;
      
      return {
        ...r,
        assets: assetsArray,
        noticePeriodStartDate,
        noticePeriodEndDate,
        noticePeriodComplied: r.noticePeriodComplied || false,
        clearances: r.clearances || undefined,
      };
    });
    
    setResignations(processed);
  }, [initialResignations]);

  const fetchResignations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/resignation', {
        cache: 'no-store',
      });
      const data = await res.json();

      if (res.ok) {
        // Ensure assets are arrays and notice period dates/clearances are properly formatted
        const processedResignations = (data.resignations || []).map((r: any) => {
          let assetsArray: string[] = [];
          if (r.assets !== undefined && r.assets !== null) {
            if (Array.isArray(r.assets)) {
              assetsArray = r.assets.filter((a: any) => a != null && a !== '' && String(a).trim() !== '');
            } else if (typeof r.assets === 'string' && r.assets.trim() !== '') {
              assetsArray = [r.assets.trim()];
            }
          }
          
          // Process notice period dates
          const noticePeriodStartDate = r.noticePeriodStartDate 
            ? (typeof r.noticePeriodStartDate === 'string' ? r.noticePeriodStartDate : new Date(r.noticePeriodStartDate).toISOString())
            : undefined;
          const noticePeriodEndDate = r.noticePeriodEndDate 
            ? (typeof r.noticePeriodEndDate === 'string' ? r.noticePeriodEndDate : new Date(r.noticePeriodEndDate).toISOString())
            : undefined;
          
          return {
            ...r,
            assets: assetsArray,
            noticePeriodStartDate,
            noticePeriodEndDate,
            noticePeriodComplied: r.noticePeriodComplied || false,
            clearances: r.clearances || undefined,
          };
        });
        
        setResignations(processedResignations);
      } else {
        toast.error(data.error || 'Failed to fetch resignations');
      }
    } catch (err: any) {
      console.error('Error fetching resignations:', err);
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (id: string) => {
    setApproveModal({ isOpen: true, resignationId: id });
  };

  const handleApproveConfirm = async () => {
    if (!approveModal.resignationId) return;

    try {
      setApproving(approveModal.resignationId);
      const res = await fetch(`/api/resignation/${approveModal.resignationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Resignation approved successfully');
        setApproveModal({ isOpen: false, resignationId: null });
        fetchResignations();
      } else {
        toast.error(data.error || 'Failed to approve resignation');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: string, rejectionReason: string) => {
    try {
      setRejecting(true);
      const res = await fetch(`/api/resignation/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Resignation rejected successfully');
        setRejectModal({ isOpen: false, resignation: null });
        fetchResignations();
      } else {
        toast.error(data.error || 'Failed to reject resignation');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteModal({ isOpen: true, resignationId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.resignationId) return;

    try {
      setDeleting(deleteModal.resignationId);
      const res = await fetch(`/api/resignation/${deleteModal.resignationId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Resignation deleted successfully');
        setDeleteModal({ isOpen: false, resignationId: null });
        fetchResignations();
      } else {
        toast.error(data.error || 'Failed to delete resignation');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateExitProcess = (resignation: Resignation, step: string, stepTitle: string) => {
    setExitProcessModal({ isOpen: true, resignation, step, stepTitle });
  };

  const handleExitProcessUpdate = async (data: any) => {
    if (!exitProcessModal.resignation) return;

    try {
      setUpdatingProcess(true);
      const { step } = exitProcessModal;
      
      // Prepare the request body based on step type
      let requestBody: any = { field: '' };

      switch (step) {
        case 'noticePeriod':
          requestBody.field = 'noticePeriodComplied';
          requestBody.value = data.completed || false;
          if (data.date) requestBody.date = data.date;
          break;
        case 'knowledgeTransfer':
          requestBody.field = 'knowledgeTransferCompleted';
          requestBody.value = data.completed || false;
          if (data.date) requestBody.date = data.date;
          break;
        case 'assetReturn':
          requestBody.field = 'assetsReturned';
          requestBody.value = data.completed || false;
          if (data.date) requestBody.date = data.date;
          if (data.notes) requestBody.notes = data.notes;
          break;
        case 'clearances':
          requestBody.field = 'clearance';
          requestBody.department = data.department;
          requestBody.status = data.status;
          if (data.notes) requestBody.notes = data.notes;
          break;
        case 'exitInterview':
          requestBody.field = 'exitInterviewCompleted';
          requestBody.value = data.completed || false;
          if (data.date) requestBody.date = data.date;
          if (data.notes) requestBody.notes = data.notes;
          break;
        case 'fnf':
          requestBody.field = 'fnfStatus';
          requestBody.status = data.status;
          if (data.date) requestBody.date = data.date;
          if (data.amount) requestBody.amount = parseFloat(data.amount);
          if (data.notes) requestBody.notes = data.notes;
          break;
        case 'documents':
          requestBody.field = 'exitDocuments';
          if (data.files) requestBody.files = data.files;
          break;
        case 'systemAccess':
          requestBody.field = 'systemAccessDeactivated';
          requestBody.value = data.completed || false;
          if (data.date) requestBody.date = data.date;
          break;
        case 'exitClosure':
          requestBody.field = 'exitClosed';
          requestBody.value = data.completed || false;
          if (data.date) requestBody.date = data.date;
          break;
        default:
          throw new Error('Invalid step');
      }

      const res = await fetch(`/api/resignation/${exitProcessModal.resignation._id}/process`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData = await res.json();

      if (res.ok) {
        toast.success('Exit process updated successfully');
        setExitProcessModal({ isOpen: false, resignation: null, step: '', stepTitle: '' });
        fetchResignations();
      } else {
        toast.error(responseData.error || 'Failed to update exit process');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setUpdatingProcess(false);
    }
  };

  // Filter resignations
  const filteredResignations = useMemo(() => {
    return resignations.filter((resignation) => {
      const matchesSearch =
        resignation.userId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resignation.userId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (resignation.userId.empId && resignation.userId.empId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        resignation.reason.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || resignation.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [resignations, searchTerm, filterStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredResignations.length / itemsPerPage);
  const paginatedResignations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredResignations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredResignations, currentPage, itemsPerPage]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <X className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = resignations.filter((r) => r.status === 'pending').length;
  const approvedCount = resignations.filter((r) => r.status === 'approved').length;
  const rejectedCount = resignations.filter((r) => r.status === 'rejected').length;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-yellow-50/80 backdrop-blur-sm rounded-xl shadow-lg border border-yellow-200/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-700 font-secondary">Pending</p>
              <p className="text-xl font-bold text-yellow-700 font-primary">{pendingCount}</p>
            </div>
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
        </div>
        <div className="bg-green-50/80 backdrop-blur-sm rounded-xl shadow-lg border border-green-200/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-secondary">Approved</p>
              <p className="text-xl font-bold text-green-700 font-primary">{approvedCount}</p>
            </div>
            <Check className="w-6 h-6 text-green-500" />
          </div>
        </div>
        <div className="bg-red-50/80 backdrop-blur-sm rounded-xl shadow-lg border border-red-200/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-700 font-secondary">Rejected</p>
              <p className="text-xl font-bold text-red-700 font-primary">{rejectedCount}</p>
            </div>
            <X className="w-6 h-6 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, email, employee ID, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-all ${
                filterStatus === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-all ${
                filterStatus === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-all ${
                filterStatus === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-all ${
                filterStatus === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Resignations List */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingDots size="lg" />
          </div>
        ) : paginatedResignations.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-secondary">No resignations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {paginatedResignations.map((resignation) => (
              <motion.div
                key={resignation._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-3 hover:shadow-lg transition-all flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start gap-2.5 mb-2.5 pb-2.5 border-b border-gray-200">
                  <UserAvatar
                    name={resignation.userId.name}
                    image={resignation.userId.profileImage}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-800 font-primary truncate">
                        {resignation.userId.name}
                      </h3>
                      {getStatusBadge(resignation.status)}
                    </div>
                    {resignation.userId.empId && (
                      <p className="text-xs text-gray-500 font-secondary">
                        ID: {resignation.userId.empId}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Details */}
                <div className="space-y-2 text-xs flex-1">
                  {/* Email */}
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 font-secondary truncate" title={resignation.userId.email}>
                      {resignation.userId.email}
                    </span>
                  </div>

                  {/* Designation */}
                  {resignation.userId.designation && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 font-secondary truncate" title={resignation.userId.designation}>
                        {resignation.userId.designation}
                      </span>
                    </div>
                  )}

                  {/* Resignation Date */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-secondary">Resignation Date</p>
                      <p className="text-xs font-semibold text-gray-700">
                        {format(new Date(resignation.resignationDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Notice Period Details */}
                  {(resignation.noticePeriodStartDate || resignation.noticePeriodEndDate) ? (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-secondary mb-0.5">Notice Period</p>
                        <div className="space-y-0.5">
                          {resignation.noticePeriodStartDate && resignation.noticePeriodEndDate ? (
                            <p className="text-xs font-semibold text-gray-700">
                              {format(new Date(resignation.noticePeriodStartDate), 'MMM dd, yyyy')} - {format(new Date(resignation.noticePeriodEndDate), 'MMM dd, yyyy')}
                            </p>
                          ) : (
                            <>
                              {resignation.noticePeriodStartDate && (
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">From:</span>{' '}
                                  {format(new Date(resignation.noticePeriodStartDate), 'MMM dd, yyyy')}
                                </p>
                              )}
                              {resignation.noticePeriodEndDate && (
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">To:</span>{' '}
                                  {format(new Date(resignation.noticePeriodEndDate), 'MMM dd, yyyy')}
                                </p>
                              )}
                            </>
                          )}
                          {(() => {
                            const isApproved = resignation.status === 'approved';
                            const hasDates = resignation.noticePeriodStartDate && resignation.noticePeriodEndDate;
                            
                            if (resignation.noticePeriodComplied) {
                              return (
                                <p className="text-xs">
                                  <span className="font-medium text-gray-700">Status:</span>{' '}
                                  <span className="text-green-600 font-semibold">Complied</span>
                                </p>
                              );
                            } else if (isApproved && hasDates) {
                              return (
                                <p className="text-xs">
                                  <span className="font-medium text-gray-700">Status:</span>{' '}
                                  <span className="text-blue-600 font-semibold">In Progress</span>
                                </p>
                              );
                            } else if (hasDates) {
                              return (
                                <p className="text-xs">
                                  <span className="font-medium text-gray-700">Status:</span>{' '}
                                  <span className="text-yellow-600 font-semibold">Pending</span>
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 font-secondary">Notice Period</p>
                        <p className="text-xs text-gray-400 italic">Not specified</p>
                      </div>
                    </div>
                  )}

                  {/* Submitted Date/Time */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-secondary">Submitted</p>
                      <p className="text-xs font-semibold text-gray-700">
                        {format(new Date(resignation.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="pt-1 border-t border-gray-100">
                    <p className="text-xs text-gray-500 font-secondary mb-1">Reason</p>
                    <p className="text-xs text-gray-700 line-clamp-2" title={resignation.reason}>
                      {resignation.reason}
                    </p>
                  </div>

                  {/* Company Assets */}
                  <div className="pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Package className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-gray-700">Company Assets</p>
                    </div>
                    {(() => {
                      const assets = resignation.assets;
                      
                      if (assets && Array.isArray(assets) && assets.length > 0) {
                        return (
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {assets.map((asset: string) => {
                              const assetInfo = companyAssets.find((a) => a.id === asset);
                              return assetInfo ? (
                                <span
                                  key={asset}
                                  className="px-2 py-1 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-md text-xs font-medium flex items-center gap-1 border border-blue-200"
                                >
                                  <assetInfo.icon className="w-3 h-3" />
                                  <span>{assetInfo.label}</span>
                                </span>
                              ) : (
                                <span key={asset} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                                  {asset}
                                </span>
                              );
                            })}
                          </div>
                        );
                      }
                      return <p className="text-xs text-gray-400 ml-5 italic">No assets assigned</p>;
                    })()}
                  </div>

                  {/* Department Clearances */}
                  <div className="pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-gray-700">Department Clearances</p>
                      {resignation.clearances ? (() => {
                        const clearances = resignation.clearances;
                        const isApproved = resignation.status === 'approved';
                        const allStatuses = [
                          clearances.reportingManager?.status,
                          clearances.it?.status,
                          clearances.admin?.status,
                          clearances.finance?.status,
                        ].filter(Boolean);
                        
                        let overallStatus = 'pending';
                        if (allStatuses.length === 2 && allStatuses.every(s => s === 'approved')) {
                          overallStatus = 'approved';
                        } else if (allStatuses.some(s => s === 'rejected')) {
                          overallStatus = 'rejected';
                        } else if (isApproved && allStatuses.length > 0) {
                          overallStatus = 'in-progress';
                        }
                        
                        return (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              overallStatus === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : overallStatus === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : overallStatus === 'in-progress'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {overallStatus === 'approved'
                              ? 'Approved'
                              : overallStatus === 'rejected'
                              ? 'Rejected'
                              : overallStatus === 'in-progress'
                              ? 'In Progress'
                              : 'Pending'}
                          </span>
                        );
                      })() : (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          resignation.status === 'approved'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {resignation.status === 'approved' ? 'In Progress' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Knowledge Transfer & Handover */}
                  <div className="pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-gray-700">Knowledge Transfer & Handover</p>
                      {(() => {
                        const isApproved = resignation.status === 'approved';
                        const hasNotes = resignation.handoverNotes && resignation.handoverNotes.trim() !== '';
                        
                        if (resignation.knowledgeTransferCompleted) {
                          return (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                              Completed
                            </span>
                          );
                        } else if (isApproved && hasNotes) {
                          return (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              In Progress
                            </span>
                          );
                        } else if (hasNotes || resignation.knowledgeTransferCompleted !== undefined) {
                          return (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                              Pending
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {resignation.handoverNotes && (
                      <div className="ml-5 mt-1">
                        <p className="text-xs text-gray-500 font-secondary mb-0.5">Handover Notes:</p>
                        <p className="text-xs text-gray-700 line-clamp-3" title={resignation.handoverNotes}>
                          {resignation.handoverNotes}
                        </p>
                      </div>
                    )}
                    {resignation.handoverCompletedDate && (
                      <div className="ml-5 mt-1">
                        <p className="text-xs text-gray-500 font-secondary">
                          Completed Date: {format(new Date(resignation.handoverCompletedDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                    {!resignation.handoverNotes && !resignation.handoverCompletedDate && resignation.knowledgeTransferCompleted === undefined && (
                      <p className="text-xs text-gray-400 ml-5 italic">Not specified</p>
                    )}
                  </div>

                  {/* Feedback */}
                  {resignation.feedback && (
                    <div className="pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-gray-700">Feedback</p>
                      </div>
                      <p className="text-xs text-gray-600 ml-5 line-clamp-2" title={resignation.feedback}>
                        {resignation.feedback}
                      </p>
                    </div>
                  )}

                  {/* Approval/Rejection Info */}
                  {resignation.status === 'approved' && resignation.approvedBy && (
                    <div className="flex items-center gap-2 pt-1 border-t border-green-100">
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <p className="text-xs text-green-600">
                        Approved by {resignation.approvedBy.name}
                      </p>
                    </div>
                  )}
                  {resignation.status === 'rejected' && resignation.rejectionReason && (
                    <div className="pt-1 border-t border-red-100">
                      <div className="flex items-center gap-2 mb-1">
                        <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-red-600">Rejection Reason</p>
                      </div>
                      <p className="text-xs text-red-600 ml-5 line-clamp-2" title={resignation.rejectionReason}>
                        {resignation.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Exit Process Actions - Only show for approved resignations */}
                {resignation.status === 'approved' && (
                  <div className="pt-2 border-t border-gray-200 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">Exit Process:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(() => {
                        const isCompleted = resignation.noticePeriodComplied === true;
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'noticePeriod', 'Notice Period Compliance')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                            title="Update Notice Period"
                          >
                            <Calendar className="w-3 h-3" />
                            Notice Period
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isCompleted = resignation.knowledgeTransferCompleted === true;
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'knowledgeTransfer', 'Knowledge Transfer & Handover')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                            title="Update Knowledge Transfer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Knowledge Transfer
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isCompleted = resignation.assetsReturned === true;
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'assetReturn', 'Company Asset Return')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                            }`}
                            title="Update Asset Return"
                          >
                            <Package className="w-3 h-3" />
                            Asset Return
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const clearances = resignation.clearances || {};
                        const allApproved = ['design', 'operation'].every(
                          (dept) => clearances[dept as keyof typeof clearances]?.status === 'approved'
                        );
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'clearances', 'Department Clearances')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              allApproved 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                            }`}
                            title="Update Clearances"
                          >
                            <Users className="w-3 h-3" />
                            Clearances
                            {allApproved && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isCompleted = resignation.exitInterviewCompleted === true;
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'exitInterview', 'Exit Interview / Feedback')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                            title="Update Exit Interview"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Exit Interview
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isCompleted = resignation.fnfStatus === 'completed';
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'fnf', 'Full & Final Settlement')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            }`}
                            title="Update FnF"
                          >
                            <Wallet className="w-3 h-3" />
                            FnF
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isCompleted = resignation.exitDocuments?.experienceLetter ? true : false;
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'documents', 'Release of Exit Documents')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                            }`}
                            title="Upload Documents"
                          >
                            <Download className="w-3 h-3" />
                            Documents
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isCompleted = resignation.systemAccessDeactivated === true;
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateExitProcess(resignation, 'systemAccess', 'System Access Deactivation')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                              isCompleted 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                            title="Update System Access"
                          >
                            <Lock className="w-3 h-3" />
                            System Access
                            {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                          </button>
                        );
                      })()}
                    </div>
                    {(() => {
                      const isCompleted = resignation.exitClosed === true;
                      return (
                        <button
                          type="button"
                          onClick={() => handleUpdateExitProcess(resignation, 'exitClosure', 'Exit Closure')}
                          className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer relative ${
                            isCompleted 
                              ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                          title="Close Exit"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Exit Closure
                          {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1" />}
                        </button>
                      );
                    })()}
                  </div>
                )}

                <div className="flex gap-1.5 mt-3 pt-2 border-t border-gray-200">
                  {resignation.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(resignation._id)}
                        disabled={approving === resignation._id}
                        className="flex-1 px-2 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        {approving === resignation._id ? (
                          <LoadingDots size="sm" />
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setRejectModal({ isOpen: true, resignation })}
                        className="flex-1 px-2 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(resignation._id)}
                    disabled={deleting === resignation._id}
                    className="px-2 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    title="Delete resignation"
                  >
                    {deleting === resignation._id ? (
                      <LoadingDots size="sm" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
              totalItems={filteredResignations.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <RejectResignationModal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, resignation: null })}
        onConfirm={(reason) => {
          if (rejectModal.resignation) {
            handleReject(rejectModal.resignation._id, reason);
          }
        }}
        rejecting={rejecting}
      />

      {/* Approve Confirmation Modal */}
      <ConfirmationModal
        isOpen={approveModal.isOpen}
        onClose={() => setApproveModal({ isOpen: false, resignationId: null })}
        onConfirm={handleApproveConfirm}
        title="Approve Resignation"
        message="Are you sure you want to approve this resignation?"
        type="approve"
        loading={approving !== null}
        confirmText="Approve"
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, resignationId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Resignation"
        message="Are you sure you want to delete this resignation? This action cannot be undone."
        type="delete"
        loading={deleting !== null}
      />

      {/* Exit Process Update Modal */}
      {exitProcessModal.resignation && (
        <UpdateExitProcessModal
          isOpen={exitProcessModal.isOpen}
          onClose={() => setExitProcessModal({ isOpen: false, resignation: null, step: '', stepTitle: '' })}
          onConfirm={handleExitProcessUpdate}
          step={exitProcessModal.step}
          stepTitle={exitProcessModal.stepTitle}
          resignation={exitProcessModal.resignation}
          loading={updatingProcess}
        />
      )}
    </div>
  );
}

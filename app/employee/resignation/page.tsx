'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingDots from '@/components/LoadingDots';
import { motion } from 'framer-motion';
import { FileText, Calendar, CheckCircle, XCircle, Clock, Trash2, Laptop, Smartphone, CreditCard, Headphones, Monitor, Mouse, Check, Mail, Briefcase, MessageSquare, Package, Plus, Users } from 'lucide-react';
import ResignationForm from '@/components/ResignationForm';
import ExitProcessTracker from '@/components/ExitProcessTracker';
import ConfirmationModal from '@/components/ConfirmationModal';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from '@/components/UserAvatar';

interface Resignation {
  _id: string;
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
  clearances?: {
    reportingManager?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: string;
      approvedAt?: string | Date;
      notes?: string;
    };
    it?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: string;
      approvedAt?: string | Date;
      notes?: string;
    };
    admin?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: string;
      approvedAt?: string | Date;
      notes?: string;
    };
    finance?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: string;
      approvedAt?: string | Date;
      notes?: string;
    };
  };
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  approvedAt?: string | Date;
  rejectionReason?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export default function EmployeeResignationPage() {
  const { data: session } = useSession();
  const [resignations, setResignations] = useState<Resignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; resignationId: string | null }>({
    isOpen: false,
    resignationId: null,
  });
  const [formData, setFormData] = useState({
    resignationDate: '',
    reason: '',
    feedback: '',
    assets: [] as string[],
  });

  const companyAssets = [
    { id: 'laptop', label: 'Laptop', icon: Laptop },
    { id: 'mobile', label: 'Mobile Phone', icon: Smartphone },
    { id: 'id-card', label: 'ID Card', icon: CreditCard },
    { id: 'access-card', label: 'Access Card', icon: CreditCard },
    { id: 'headphones', label: 'Headphones', icon: Headphones },
    { id: 'monitor', label: 'Monitor', icon: Monitor },
    { id: 'mouse-keyboard', label: 'Mouse/Keyboard', icon: Mouse },
  ];
  const toast = useToast();

  useEffect(() => {
    fetchResignations();
  }, []);

  const fetchResignations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/resignation', {
        cache: 'no-store',
      });
      const data = await res.json();

      if (res.ok) {
        // Ensure assets are arrays for all resignations
        const processedResignations = (data.resignations || []).map((r: any) => ({
          ...r,
          assets: Array.isArray(r.assets) ? r.assets : (r.assets ? [r.assets] : []),
        }));

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.resignationDate || !formData.reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const resignationDate = new Date(formData.resignationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (resignationDate < today) {
      toast.error('Resignation date cannot be in the past');
      return;
    }

    try {
      setSubmitting(true);
      // Ensure assets is a proper array - be very explicit
      const assetsToSend = Array.isArray(formData.assets) && formData.assets.length > 0
        ? formData.assets.filter((a: string) => a != null && a !== '' && a.trim() !== '')
        : [];

      const payload = {
        resignationDate: formData.resignationDate,
        reason: formData.reason,
        feedback: formData.feedback || '',
        assets: assetsToSend,
      };

      const res = await fetch('/api/resignation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Resignation submitted successfully');
        setShowForm(false);
        setFormData({ resignationDate: '', reason: '', feedback: '', assets: [] });
        // Small delay to ensure database is updated
        setTimeout(() => {
          fetchResignations();
        }, 500);
      } else {
        toast.error(data.error || 'Failed to submit resignation');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
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
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout role="employee">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-primary font-bold text-gray-800">Resignation</h1>
            <p className="text-xs text-gray-600 mt-0.5 font-secondary">
              Submit and manage your resignation requests
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Submit Resignation
            </button>
          )}
        </div>

        {/* Resignation Form */}
        {showForm && (
          <ResignationForm
            onClose={() => {
              setShowForm(false);
              setFormData({ resignationDate: '', reason: '', feedback: '', assets: [] });
            }}
            onSuccess={() => {
              fetchResignations();
            }}
          />
        )}

        {/* Old Form - Hidden for now, keeping for reference */}
        {false && showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-primary font-bold text-gray-800">Submit Resignation</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ resignationDate: '', reason: '', feedback: '', assets: [] });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                  Resignation Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.resignationDate}
                  onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1 font-secondary">
                  Your last working day
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                  Reason for Resignation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Please provide a reason for your resignation..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                  Company Assets
                </label>
                <p className="text-xs text-gray-500 mb-3 font-secondary">
                  Select all company assets currently in your possession
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {companyAssets.map((asset) => {
                    const Icon = asset.icon;
                    const isSelected = formData.assets.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`relative flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assets: [...formData.assets, asset.id] });
                            } else {
                              setFormData({
                                ...formData,
                                assets: formData.assets.filter((a) => a !== asset.id),
                              });
                            }
                          }}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected
                            ? 'border-primary bg-primary'
                            : 'border-gray-300 bg-white'
                            }`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-gray-500'}`} />
                        <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                          {asset.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                  Feedback (Optional)
                </label>
                <textarea
                  value={formData.feedback}
                  onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Any feedback or suggestions for improvement..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <LoadingDots size="sm" /> : 'Submit Resignation'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ resignationDate: '', reason: '', feedback: '', assets: [] });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Resignation History */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-4">
          <h2 className="text-base font-primary font-bold text-gray-800 mb-3">My Resignation Requests</h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingDots size="lg" />
            </div>
          ) : resignations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-secondary">No resignation requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resignations.map((resignation) => (
                <motion.div
                  key={resignation._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all space-y-4"
                >
                  {/* Basic Info Section */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-gray-200">
                        {getStatusBadge(resignation.status)}
                        <span className="text-xs text-gray-500 font-secondary">
                          Submitted: {format(new Date(resignation.createdAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-xs">
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
                        <div className="pt-1 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                            <p className="text-xs font-semibold text-gray-700">Notice Period</p>
                          </div>
                          {(resignation.noticePeriodStartDate || resignation.noticePeriodEndDate) ? (
                            <div className="ml-5 space-y-1">
                              {resignation.noticePeriodStartDate && resignation.noticePeriodEndDate ? (
                                <p className="text-xs font-semibold text-gray-700">
                                  {format(new Date(resignation.noticePeriodStartDate), 'MMM dd, yyyy')} - {format(new Date(resignation.noticePeriodEndDate), 'MMM dd, yyyy')}
                                </p>
                              ) : (
                                <>
                                  {resignation.noticePeriodStartDate && (
                                    <p className="text-xs text-gray-600">
                                      <span className="font-medium">From:</span>{' '}
                                      {format(new Date(resignation.noticePeriodStartDate), 'MMM dd, yyyy')}
                                    </p>
                                  )}
                                  {resignation.noticePeriodEndDate && (
                                    <p className="text-xs text-gray-600">
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
                          ) : (
                            <p className="text-xs text-gray-400 ml-5 italic">Not specified</p>
                          )}
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
                              if (allStatuses.length === 4 && allStatuses.every(s => s === 'approved')) {
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
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <p className="text-xs text-green-600">
                              Approved by {resignation.approvedBy.name} on {format(new Date(resignation.approvedAt!), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        )}

                        {resignation.status === 'rejected' && resignation.rejectionReason && (
                          <div className="pt-1 border-t border-red-100">
                            <div className="flex items-center gap-2 mb-1">
                              <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              <p className="text-xs font-semibold text-red-600">Rejection Reason</p>
                            </div>
                            <p className="text-xs text-red-600 ml-5 line-clamp-2" title={resignation.rejectionReason}>
                              {resignation.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(resignation._id)}
                      disabled={deleting === resignation._id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      title="Delete resignation"
                    >
                      {deleting === resignation._id ? (
                        <LoadingDots size="sm" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Exit Process Tracker */}
                  {resignation.status === 'approved' && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <ExitProcessTracker resignation={resignation} role="employee" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, resignationId: null })}
          onConfirm={handleDeleteConfirm}
          title="Delete Resignation"
          message="Are you sure you want to delete this resignation request?"
          type="delete"
          loading={deleting !== null}
        />
      </div>
    </DashboardLayout>
  );
}

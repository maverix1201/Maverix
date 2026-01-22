'use client';

import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  MessageSquare,
  Building2,
  Users,
  Computer,
  Wallet,
  FileCheck,
  Lock,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';

interface ExitProcessTrackerProps {
  resignation: any;
  role?: 'employee' | 'admin' | 'hr';
  onUpdate?: (field: string, value: any) => void;
}

const processSteps = [
  {
    id: 'resignation',
    title: 'Resignation Submission',
    icon: FileCheck,
    description: 'Resignation request submitted and approved',
  },
  {
    id: 'noticePeriod',
    title: 'Notice Period Compliance',
    icon: Calendar,
    description: 'Notice period start and end dates',
  },
  {
    id: 'knowledgeTransfer',
    title: 'Knowledge Transfer & Handover',
    icon: MessageSquare,
    description: 'Handover notes and knowledge transfer',
  },
  {
    id: 'assetReturn',
    title: 'Company Asset Return',
    icon: Building2,
    description: 'Return of company assets',
  },
  {
    id: 'clearances',
    title: 'Department Clearances',
    icon: Users,
    description: 'Clearance from all departments',
  },
  {
    id: 'exitInterview',
    title: 'Exit Interview / Feedback',
    icon: MessageSquare,
    description: 'Exit interview completion',
  },
  {
    id: 'fnf',
    title: 'Full & Final Settlement (FnF)',
    icon: Wallet,
    description: 'FnF processing and settlement',
  },
  {
    id: 'documents',
    title: 'Release of Exit Documents',
    icon: Download,
    description: 'Experience letter, relieving letter, etc.',
  },
  {
    id: 'systemAccess',
    title: 'System Access Deactivation',
    icon: Lock,
    description: 'Deactivation of system access',
  },
  {
    id: 'exitClosure',
    title: 'Exit Closure',
    icon: CheckCircle,
    description: 'Formal exit closure',
  },
];

export default function ExitProcessTracker({
  resignation,
  role = 'employee',
  onUpdate,
}: ExitProcessTrackerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepStatus = (stepId: string) => {
    const isApproved = resignation.status === 'approved';
    
    switch (stepId) {
      case 'resignation':
        if (resignation.status === 'approved') return 'completed';
        if (resignation.status === 'rejected') return 'rejected';
        return 'pending';
      case 'noticePeriod':
        if (resignation.noticePeriodComplied) return 'completed';
        // If resignation is approved and notice period dates exist, show in-progress
        if (isApproved && resignation.noticePeriodStartDate && resignation.noticePeriodEndDate) {
          return 'in-progress';
        }
        return 'pending';
      case 'knowledgeTransfer':
        if (resignation.knowledgeTransferCompleted) return 'completed';
        // If resignation is approved and handover notes exist, show in-progress
        if (isApproved && resignation.handoverNotes && resignation.handoverNotes.trim() !== '') {
          return 'in-progress';
        }
        return 'pending';
      case 'assetReturn':
        if (resignation.assetsReturned) return 'completed';
        // If resignation is approved and assets are listed, show in-progress
        if (isApproved && resignation.assets && resignation.assets.length > 0) {
          return 'in-progress';
        }
        return 'pending';
      case 'clearances':
        const clearances = resignation.clearances || {};
        const allApproved = ['design', 'operation'].every(
          (dept) => clearances[dept]?.status === 'approved'
        );
        const anyRejected = ['design', 'operation'].some(
          (dept) => clearances[dept]?.status === 'rejected'
        );
        if (allApproved) return 'completed';
        if (anyRejected) return 'rejected';
        // If resignation is approved, clearances are in-progress (waiting for department approvals)
        if (isApproved) return 'in-progress';
        return 'pending';
      case 'exitInterview':
        if (resignation.exitInterviewCompleted) return 'completed';
        // If resignation is approved, exit interview is in-progress
        if (isApproved) return 'in-progress';
        return 'pending';
      case 'fnf':
        if (resignation.fnfStatus === 'completed') return 'completed';
        if (resignation.fnfStatus === 'processing') return 'in-progress';
        // If resignation is approved, FnF is in-progress
        if (isApproved) return 'in-progress';
        return 'pending';
      case 'documents':
        if (resignation.exitDocuments?.experienceLetter) return 'completed';
        // If resignation is approved, documents are in-progress (waiting for upload)
        if (isApproved) return 'in-progress';
        return 'pending';
      case 'systemAccess':
        if (resignation.systemAccessDeactivated) return 'completed';
        // If resignation is approved, system access deactivation is in-progress
        if (isApproved) return 'in-progress';
        return 'pending';
      case 'exitClosure':
        if (resignation.exitClosed) return 'completed';
        // Exit closure is only in-progress when all other steps are completed
        // For now, if resignation is approved, it's pending until other steps complete
        return 'pending';
      default:
        return 'pending';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      case 'in-progress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const renderStepContent = (stepId: string) => {
    const status = getStepStatus(stepId);

    switch (stepId) {
      case 'resignation':
        return (
          <div className="space-y-2 text-sm">
            <p>
              <strong>Status:</strong> {resignation.status}
            </p>
            {resignation.approvedAt && (
              <p>
                <strong>Approved:</strong> {format(new Date(resignation.approvedAt), 'MMM dd, yyyy')}
              </p>
            )}
            {resignation.approvedBy && (
              <p>
                <strong>Approved By:</strong> {resignation.approvedBy.name}
              </p>
            )}
          </div>
        );

      case 'noticePeriod':
        return (
          <div className="space-y-2 text-sm">
            {resignation.noticePeriodStartDate && (
              <p>
                <strong>Start Date:</strong>{' '}
                {format(new Date(resignation.noticePeriodStartDate), 'MMM dd, yyyy')}
              </p>
            )}
            {resignation.noticePeriodEndDate && (
              <p>
                <strong>End Date:</strong>{' '}
                {format(new Date(resignation.noticePeriodEndDate), 'MMM dd, yyyy')}
              </p>
            )}
            <p>
              <strong>Complied:</strong> {resignation.noticePeriodComplied ? 'Yes' : 'No'}
            </p>
          </div>
        );

      case 'knowledgeTransfer':
        return (
          <div className="space-y-2 text-sm">
            {resignation.handoverNotes && (
              <div>
                <strong>Handover Notes:</strong>
                <p className="mt-1 text-gray-600 whitespace-pre-wrap">{resignation.handoverNotes}</p>
              </div>
            )}
            {resignation.handoverCompletedDate && (
              <p>
                <strong>Completed:</strong>{' '}
                {format(new Date(resignation.handoverCompletedDate), 'MMM dd, yyyy')}
              </p>
            )}
            <p>
              <strong>Status:</strong> {resignation.knowledgeTransferCompleted ? 'Completed' : 'Pending'}
            </p>
          </div>
        );

      case 'assetReturn':
        return (
          <div className="space-y-2 text-sm">
            {resignation.assets && resignation.assets.length > 0 && (
              <div>
                <strong>Assets to Return:</strong>
                <div className="flex flex-wrap gap-2 mt-1">
                  {resignation.assets.map((asset: string) => (
                    <span
                      key={asset}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {resignation.assetsReturnDate && (
              <p>
                <strong>Return Date:</strong>{' '}
                {format(new Date(resignation.assetsReturnDate), 'MMM dd, yyyy')}
              </p>
            )}
            {resignation.assetsReturnNotes && (
              <p>
                <strong>Notes:</strong> {resignation.assetsReturnNotes}
              </p>
            )}
            <p>
              <strong>Status:</strong> {resignation.assetsReturned ? 'Returned' : 'Pending Return'}
            </p>
          </div>
        );

      case 'clearances':
        const clearances = resignation.clearances || {};
        const departments = [
          { key: 'design', label: 'Design Department' },
          { key: 'operation', label: 'Operation Department' },
        ];
        return (
          <div className="space-y-3 text-sm">
            {departments.map((dept) => {
              const clearance = clearances[dept.key] || { status: 'pending' };
              return (
                <div key={dept.key} className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="font-medium">{dept.label}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      clearance.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : clearance.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {clearance.status}
                  </span>
                </div>
              );
            })}
          </div>
        );

      case 'exitInterview':
        return (
          <div className="space-y-2 text-sm">
            {resignation.exitInterviewDate && (
              <p>
                <strong>Interview Date:</strong>{' '}
                {format(new Date(resignation.exitInterviewDate), 'MMM dd, yyyy')}
              </p>
            )}
            {resignation.exitInterviewFeedback && (
              <div>
                <strong>Feedback:</strong>
                <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                  {resignation.exitInterviewFeedback}
                </p>
              </div>
            )}
            <p>
              <strong>Status:</strong>{' '}
              {resignation.exitInterviewCompleted ? 'Completed' : 'Pending'}
            </p>
          </div>
        );

      case 'fnf':
        return (
          <div className="space-y-2 text-sm">
            <p>
              <strong>Status:</strong> {resignation.fnfStatus || 'pending'}
            </p>
            {resignation.fnfAmount && (
              <p>
                <strong>Amount:</strong> ₹{resignation.fnfAmount.toLocaleString()}
              </p>
            )}
            {resignation.fnfProcessedDate && (
              <p>
                <strong>Processed:</strong>{' '}
                {format(new Date(resignation.fnfProcessedDate), 'MMM dd, yyyy')}
              </p>
            )}
            {resignation.fnfNotes && (
              <p>
                <strong>Notes:</strong> {resignation.fnfNotes}
              </p>
            )}
          </div>
        );

      case 'documents':
        const docs = resignation.exitDocuments || {};
        return (
          <div className="space-y-2 text-sm">
            {docs.experienceLetter && (
              <div className="flex items-center justify-between p-2 bg-white rounded border">
                <span>Experience Letter</span>
                <a
                  href={docs.experienceLetter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            )}
            {docs.relievingLetter && (
              <div className="flex items-center justify-between p-2 bg-white rounded border">
                <span>Relieving Letter</span>
                <a
                  href={docs.relievingLetter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            )}
            {(!docs.experienceLetter && !docs.relievingLetter) && (
              <p className="text-gray-500">Documents will be available after FnF completion</p>
            )}
          </div>
        );

      case 'systemAccess':
        return (
          <div className="space-y-2 text-sm">
            {resignation.systemAccessDeactivatedDate && (
              <p>
                <strong>Deactivated:</strong>{' '}
                {format(new Date(resignation.systemAccessDeactivatedDate), 'MMM dd, yyyy')}
              </p>
            )}
            <p>
              <strong>Status:</strong>{' '}
              {resignation.systemAccessDeactivated ? 'Deactivated' : 'Active'}
            </p>
          </div>
        );

      case 'exitClosure':
        return (
          <div className="space-y-2 text-sm">
            {resignation.exitClosedDate && (
              <p>
                <strong>Closed:</strong>{' '}
                {format(new Date(resignation.exitClosedDate), 'MMM dd, yyyy')}
              </p>
            )}
            {resignation.exitClosedBy && (
              <p>
                <strong>Closed By:</strong> {resignation.exitClosedBy.name}
              </p>
            )}
            <p>
              <strong>Status:</strong> {resignation.exitClosed ? 'Closed' : 'Open'}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (  
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-4">Exit Process Status</h3>
    <div className="space-y-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {processSteps.map((step, index) => {
        const StepIcon = step.icon;
        const status = getStepStatus(step.id);
        const isExpanded = expandedSteps.has(step.id);

        return (
          <div
            key={step.id}
            className={`border-2 rounded-lg transition-all ${getStatusColor(status)}`}
          >
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <StepIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-800">{step.title}</h4>
                  <p className="text-xs text-gray-600">{step.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : status === 'in-progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {status === 'completed'
                    ? 'Completed'
                    : status === 'rejected'
                    ? 'Rejected'
                    : status === 'in-progress'
                    ? 'In Progress'
                    : 'Pending'}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                {renderStepContent(step.id)}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

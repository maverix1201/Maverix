'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/contexts/ToastContext';
import LoadingDots from '@/components/LoadingDots';
import UserAvatar from '@/components/UserAvatar';
import DashboardLayout from '@/components/DashboardLayout';
import {
  IconGift,
  IconSearch,
  IconSend,
  IconCheck,
  IconUsers,
  IconMail,
  IconCode,
  IconEye,
  IconTrash,
  IconClock,
  IconChevronDown,
  IconChevronUp,
  IconX,
} from '@tabler/icons-react';

interface Employee {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  profileImage?: string;
}

interface EmailHistory {
  _id: string;
  subject: string;
  html?: string; // HTML content of the email
  userIds: Array<{ _id: string; name: string; email: string; profileImage?: string }>;
  openedBy?: Array<{ _id: string; name?: string; email?: string }> | string[];
  openedByIds?: string[]; // Array of user IDs who opened the email (for comparison)
  sentAt: string;
  createdAt: string;
}


export default function HrWishingPage() {
  const { data: session } = useSession();
  const toast = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [htmlTab, setHtmlTab] = useState<'html' | 'preview'>('html');
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(true);
  const [viewEmail, setViewEmail] = useState<EmailHistory | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/users', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok) {
          // HR should be able to message employees (not admin)
          const filtered = (data.users || []).filter(
            (u: Employee & { role?: string }) => u && u.email && u.role !== 'admin'
          );
          setEmployees(filtered);
        } else {
          toast.error(data.error || 'Failed to load employees');
        }
      } catch (err) {
        console.error('Fetch employees error', err);
        toast.error('Could not load employees');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
    fetchEmailHistory();

    // Auto-refresh email history every 30 seconds to update open status
    const refreshInterval = setInterval(() => {
      fetchEmailHistory();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [toast]);

  const fetchEmailHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/hr/wishing', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok) {
        console.log('Email history response:', data);
        console.log('Email history count:', data.count || data.emailHistory?.length || 0);
        const history = data.emailHistory || [];
        console.log('Setting email history:', history.length, 'emails');
        setEmailHistory(history);
      } else {
        console.error('Failed to fetch email history:', data.error);
        toast.error(data.error || 'Failed to load email history');
      }
    } catch (err) {
      console.error('Fetch email history error', err);
      toast.error('Could not load email history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term) ||
        (emp.designation || '').toLowerCase().includes(term)
    );
  }, [employees, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(employees.map((e) => e._id)));
  };

  const clearAll = () => setSelectedIds(new Set());

  const allFilteredSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((emp) => selectedIds.has(emp._id));

  const toggleSelectFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredEmployees.forEach((emp) => next.delete(emp._id));
      } else {
        filteredEmployees.forEach((emp) => next.add(emp._id));
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one employee.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (!htmlBody.trim()) {
      toast.error('HTML body is required.');
      return;
    }

    try {
      setSending(true);
      const res = await fetch('/api/hr/wishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          subject,
          html: htmlBody,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Email sent to ${selectedIds.size} recipient(s).`);
        setSelectedIds(new Set());
        setSubject('');
        setHtmlBody('');
        // Refresh email history after a short delay to ensure it's saved
        setTimeout(() => {
          fetchEmailHistory();
        }, 500);
      } else {
        toast.error(data.error || 'Failed to send emails.');
      }
    } catch (err) {
      console.error('Send wishing email error', err);
      toast.error('Could not send emails.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email from history?')) {
      return;
    }

    try {
      const res = await fetch(`/api/hr/wishing/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Email deleted from history.');
        fetchEmailHistory();
      } else {
        toast.error(data.error || 'Failed to delete email.');
      }
    } catch (err) {
      console.error('Delete email error', err);
      toast.error('Could not delete email.');
    }
  };

  return (
    <DashboardLayout role="hr">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <IconGift className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Send Wishes</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Main Content - Email Form */}
          <div className="lg:col-span-2 space-y-4 flex flex-col">
            {/* Email Composition Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-2.5 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <IconMail className="w-4 h-4 text-primary" />
                  Compose Email
                </h2>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col">
                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <span>Subject</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Happy Diwali from HR!"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition bg-white hover:border-gray-300"
                  />
                </div>

                {/* HTML Body */}
                <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <span>HTML Body</span>
                      <span className="text-red-500">*</span>
                    </label>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b border-gray-200 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setHtmlTab('html')}
                      className={`px-3 py-1.5 text-xs font-semibold transition border-b-2 flex items-center gap-1.5 ${htmlTab === 'html'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      <IconCode className="w-3.5 h-3.5" />
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setHtmlTab('preview')}
                      disabled={!htmlBody.trim()}
                      className={`px-3 py-1.5 text-xs font-semibold transition border-b-2 flex items-center gap-1.5 ${htmlTab === 'preview'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <IconEye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                  </div>

                  {/* Tab Content */}
                  {htmlTab === 'html' ? (
                    <>
                      <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition min-h-[400px]">
                        <textarea
                          value={htmlBody}
                          onChange={(e) => setHtmlBody(e.target.value)}
                          placeholder='Paste your HTML content here...'
                          className="w-full h-full px-3 py-2 text-sm font-mono outline-none bg-white resize-none overflow-y-auto border-0"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 flex-shrink-0">
                        <IconCheck className="w-2.5 h-2.5" />
                        Supports HTML. Use <code className="bg-gray-100 px-1 rounded">${'{'}data.employeeName{'}'}</code> for personalized names
                      </p>
                    </>
                  ) : (
                    <div className="flex-1 border border-gray-200 rounded-lg bg-white overflow-y-auto min-h-[400px]">
                      {htmlBody.trim() ? (
                        <div
                          className="prose max-w-none text-sm text-gray-800 p-4"
                          dangerouslySetInnerHTML={{ __html: htmlBody }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          <div className="text-center">
                            <IconSend className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No HTML content to preview</p>
                            <p className="text-[10px] mt-1">Switch to HTML tab to add content</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Recipients Summary */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconUsers className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">
                        {selectedIds.size} {selectedIds.size === 1 ? 'recipient' : 'recipients'} selected
                      </div>
                      <div className="text-xs text-gray-600">Choose employees from the right panel</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-white transition text-gray-700"
                      disabled={employees.length === 0}
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAll}
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-white transition text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold transition shadow-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <LoadingDots size="sm" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <IconSend className="w-5 h-5" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Employee Selection Sidebar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-2 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <IconUsers className="w-4 h-4 text-primary" />
                Recipients
              </h2>
            </div>

            <div className="flex flex-col flex-1 min-h-0 p-3">
              {/* Search */}
              <div className="relative flex-shrink-0 mb-2">
                <IconSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 focus:ring-1 focus:ring-primary focus:border-primary outline-none text-xs bg-white"
                />
              </div>

              {/* Select All Toggle */}
              <label className="flex items-center gap-1.5 p-1.5 rounded hover:bg-gray-50 cursor-pointer transition flex-shrink-0 mb-2">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectFiltered}
                  className="w-3.5 h-3.5 text-primary border-gray-300 rounded focus:ring-1 focus:ring-primary"
                />
                <span className="text-xs font-medium text-gray-700">Select all</span>
              </label>

              {/* Employee List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 max-h-[700px]">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <LoadingDots size="md" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-10">
                    <IconUsers className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No employees found</p>
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const selected = selectedIds.has(emp._id);
                    return (
                      <label
                        key={emp._id}
                        className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-all flex-shrink-0 ${selected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(emp._id)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary cursor-pointer flex-shrink-0"
                        />
                        <UserAvatar name={emp.name} image={emp.profileImage} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{emp.name}</p>
                          {emp.designation && (
                            <p className="text-xs text-gray-600 mt-0.5 truncate">{emp.designation}</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Email History Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-2.5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded">
                  <IconMail className="w-4 h-4 text-indigo-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Email History</h2>
                {emailHistory.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                    {emailHistory.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setExpandedHistory(!expandedHistory)}
                className="p-1 hover:bg-white/50 rounded transition"
              >
                {expandedHistory ? (
                  <IconChevronUp className="w-3.5 h-3.5 text-gray-600" />
                ) : (
                  <IconChevronDown className="w-3.5 h-3.5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {expandedHistory && (
            <div className="p-4">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <LoadingDots size="md" />
                </div>
              ) : emailHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <IconSend className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-1">No email history</p>
                  <p className="text-[10px] text-gray-500">Sent emails will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailHistory.map((email) => {
                    const sentDate = new Date(email.sentAt || email.createdAt);
                    const recipientCount = email.userIds?.length || 0;

                    return (
                      <div
                        key={email._id}
                        className="border border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-lg p-2.5 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left side - Subject and Date */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-1 bg-green-100 rounded flex-shrink-0">
                              <IconCheck className="w-3 h-3 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xs font-bold text-gray-900 truncate mb-0.5">{email.subject}</h3>
                              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                                <div className="flex items-center gap-1">
                                  <IconClock className="w-3 h-3" />
                                  <span>
                                    {sentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {sentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <span>•</span>
                                <span>{recipientCount} {recipientCount === 1 ? 'recipient' : 'recipients'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right side - Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => setViewEmail(email)}
                              className="px-2.5 py-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded transition flex items-center gap-1"
                              title="View Details"
                            >
                              <IconEye className="w-3 h-3" />
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(email._id)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                              title="Delete"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email Details Modal */}
        {viewEmail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewEmail(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <IconMail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Email Details</h2>
                    <p className="text-xs text-gray-600">View complete email information</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewEmail(null)}
                  className="p-2 hover:bg-white/50 rounded-lg transition"
                >
                  <IconX className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Subject */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Subject</label>
                  <p className="text-sm font-semibold text-gray-900">{viewEmail.subject}</p>
                </div>

                {/* Sent Date */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Sent Date</label>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <IconClock className="w-4 h-4" />
                    <span>
                      {new Date(viewEmail.sentAt || viewEmail.createdAt).toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })} at {new Date(viewEmail.sentAt || viewEmail.createdAt).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </span>
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Recipients ({viewEmail.userIds?.length || 0})</label>
                  <div className="space-y-2">
                    {viewEmail.userIds && viewEmail.userIds.length > 0 ? (
                      viewEmail.userIds.map((user: any) => {
                        const userIdStr = String(user._id);
                        const openedByIds = viewEmail.openedByIds || [];
                        const openedByArray = viewEmail.openedBy || [];
                        
                        const isOpenedByIds = openedByIds.some((id: any) => String(id) === userIdStr);
                        const isOpenedByObjects = openedByArray.some((item: any) => {
                          const itemId = item._id ? String(item._id) : String(item);
                          return itemId === userIdStr;
                        });
                        
                        const isOpened = isOpenedByIds || isOpenedByObjects;

                        return (
                          <div key={user._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <UserAvatar name={user.name} image={user.profileImage} size="sm" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                                <p className="text-xs text-gray-600">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOpened ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                                  <span className="text-green-600 font-bold">✓✓</span>
                                  <span>Opened</span>
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold flex items-center gap-1">
                                  <span className="text-gray-400">✓</span>
                                  <span>Sent</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500">No recipients found</p>
                    )}
                  </div>
                </div>

                {/* HTML Content Preview */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Email Content</label>
                  <div className="border border-gray-200 rounded-lg bg-white p-4 max-h-96 overflow-y-auto">
                    <div
                      className="prose max-w-none text-sm text-gray-900"
                      dangerouslySetInnerHTML={{ __html: (viewEmail as any).html || '' }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setViewEmail(null)}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Trash2,
  MessageSquare,
  Loader2,
  X,
  AtSign,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from './UserAvatar';
import { useToast } from '@/contexts/ToastContext';
import { useSession } from 'next-auth/react';
import LoadingDots from './LoadingDots';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import MentionPopup from './MentionPopup';

interface MentionUser {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  mobileNumber?: string;
  role: string;
  designation?: string;
}

interface Post {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
    role: string;
    designation?: string;
  };
  content: string;
  mentions?: MentionUser[];
  createdAt: string;
  updatedAt: string;
}

export default function Feed() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [selectedMention, setSelectedMention] = useState<MentionUser | null>(null);
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | undefined>();
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/feed');
      const data = await res.json();

      if (res.ok) {
        const postsData = data.posts || [];
        // Ensure mentions are properly structured
        const postsWithMentions = postsData.map((post: any) => ({
          ...post,
          mentions: post.mentions || [],
        }));
        setPosts(postsWithMentions);
      } else {
        toast.error(data.error || 'Failed to fetch posts');
      }
    } catch (err: any) {
      toast.error('An error occurred while fetching posts');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPosts();
    fetchUsers();
  }, [fetchPosts]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/feed/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  // Filter users based on mention query
  const filteredUsers = users.filter((user) => {
    if (!mentionQuery) return true;
    const query = mentionQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // Handle textarea input for mention detection
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(value);

    // Find @ mention at cursor position (allow alphanumeric and spaces after @)
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([\w\s]*)$/);

    if (mentionMatch) {
      const startPos = cursorPos - mentionMatch[0].length;
      setMentionStartPos(startPos);
      setMentionQuery(mentionMatch[1]);
      setShowMentionDropdown(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  };

  // Handle mention selection
  const selectMention = (user: MentionUser) => {
    if (!textareaRef.current) return;

    const textBefore = content.substring(0, mentionStartPos);
    const textAfter = content.substring(mentionStartPos + 1 + mentionQuery.length);
    const newContent = `${textBefore}@${user.name} ${textAfter}`;

    setContent(newContent);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);

    // Set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartPos + user.name.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionDropdown || filteredUsers.length === 0) {
      // Allow normal typing if dropdown is not shown
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => {
        const newIndex = prev < filteredUsers.length - 1 ? prev + 1 : prev;
        // Scroll selected item into view
        setTimeout(() => {
          const selectedElement = mentionDropdownRef.current?.querySelector(
            `[data-mention-index="${newIndex}"]`
          );
          selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : 0;
        // Scroll selected item into view
        setTimeout(() => {
          const selectedElement = mentionDropdownRef.current?.querySelector(
            `[data-mention-index="${newIndex}"]`
          );
          selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return newIndex;
      });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredUsers[selectedMentionIndex]) {
        selectMention(filteredUsers[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionDropdown(false);
    }
  };

  // Close mention dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowMentionDropdown(false);
      }
    };

    if (showMentionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMentionDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setPosting(true);

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create post');
        setPosting(false);
        return;
      }

      toast.success('Post created successfully');
      setContent('');
      fetchPosts();
      setPosting(false);
    } catch (err: any) {
      toast.error('An error occurred');
      setPosting(false);
    }
  };

  const handleDelete = (post: Post) => {
    setDeletingPost(post);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingPost) return;

    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/feed/${deletingPost._id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete post');
        setDeleteLoading(false);
        return;
      }

      toast.success('Post deleted successfully');
      setShowDeleteModal(false);
      setDeletingPost(null);
      fetchPosts();
      setDeleteLoading(false);
    } catch (err: any) {
      toast.error('An error occurred');
      setDeleteLoading(false);
    }
  };

  const currentUserId = (session?.user as any)?.id;
  const userRole = (session?.user as any)?.role;
  const canDelete = (post: Post) => {
    return (
      post.userId._id === currentUserId ||
      userRole === 'admin' ||
      userRole === 'hr'
    );
  };


  // Parse mentions in content and make them clickable
  const parseContent = (content: string, mentions: MentionUser[] | undefined) => {
    if (!mentions || !Array.isArray(mentions)) {
      return [content];
    }

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    // Match @ followed by name (can include spaces) or email, until space or end
    const mentionRegex = /@([\w\s]+?)(?=\s|$|@)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Find the mentioned user - try exact match first, then partial match
      const mentionText = match[1].trim();
      let mentionedUser = mentions.find(
        (user) => user.name.toLowerCase() === mentionText.toLowerCase()
      );

      // If no exact match, try to find by first name or partial name match
      if (!mentionedUser) {
        mentionedUser = mentions.find(
          (user) => {
            const firstName = user.name.split(' ')[0].toLowerCase();
            return (
              firstName === mentionText.toLowerCase() ||
              user.name.toLowerCase().includes(mentionText.toLowerCase()) ||
              user.email.toLowerCase() === mentionText.toLowerCase()
            );
          }
        );
      }

      if (mentionedUser) {
        // Get first name from full name
        const firstName = mentionedUser.name.split(' ')[0];

        parts.push(
          <span
            key={`mention-${match.index}-${mentionedUser._id}`}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setMentionPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 10,
              });
              if (mentionedUser) {
                setSelectedMention(mentionedUser);
                setShowMentionPopup(true);
              }
            }}
            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer font-semibold align-middle"
            style={{ display: 'inline-flex', verticalAlign: 'middle' }}
          >
            {/* <UserAvatar
              name={mentionedUser.name}
              image={mentionedUser.profileImage}
              size="xs"
              className="flex-shrink-0 inline-block"
            /> */}
            <span className="mb-1 text-primary inline-block">
              {firstName}
            </span>
          </span>
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [content];
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-8 text-center">
        <LoadingDots size="lg" className="mb-3" />
        <p className="text-sm text-gray-500 font-secondary">Loading feed...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Create Post Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 relative z-10"
        >
          <div className="flex items-start gap-4 mb-5">
            <div className="relative">
              <UserAvatar
                name={session?.user?.name || ''}
                image={(session?.user as any)?.profileImage}
                size="md"
                className="ring-2 ring-primary/20"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-primary font-bold text-gray-900 mb-1 text-base">
                {session?.user?.name}
              </h3>
              <p className="text-xs text-gray-500 font-secondary">
                Share updates and connect with your team
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative z-50">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="What's on your mind? Type @ to mention someone..."
                rows={4}
                maxLength={5000}
                className="w-full px-4 py-3 text-sm text-gray-700 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none font-secondary bg-white/90 backdrop-blur-sm resize-none transition-all placeholder:text-gray-400"
              />
              {content.length > 0 && (
                <div className="absolute top-2 right-2 text-xs text-gray-400 font-secondary bg-white/80 px-2 py-1 rounded z-10">
                  {content.length}/5000
                </div>
              )}

              {/* Mention Autocomplete Dropdown */}
              <AnimatePresence>
                {showMentionDropdown && filteredUsers.length > 0 && (
                  <motion.div
                    ref={mentionDropdownRef}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] max-h-60 overflow-y-auto"
                  >
                    <div className="p-2">
                      <div className="text-xs text-gray-500 font-secondary px-2 py-1 mb-1">
                        Select a user to mention
                      </div>
                      {filteredUsers.map((user, index) => (
                        <button
                          key={user._id}
                          data-mention-index={index}
                          type="button"
                          onClick={() => selectMention(user)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${index === selectedMentionIndex
                              ? 'bg-primary/10 border-2 border-primary/30'
                              : 'hover:bg-gray-50 border-2 border-transparent'
                            }`}
                        >
                          <UserAvatar
                            name={user.name}
                            image={user.profileImage}
                            size="sm"
                          />
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-gray-900 font-secondary">
                              {user.name}
                            </div>
                            <div className="text-xs text-gray-500 font-secondary">
                              {user.email}
                            </div>
                          </div>
                          {user.designation && (
                            <div className={`text-xs px-2 py-0.5 rounded-full font-secondary ${user.role === 'admin'
                                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm'
                                : 'bg-primary/10 text-primary'
                              }`}>
                              {user.designation}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={posting || !content.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary via-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-secondary text-sm font-semibold"
              >
                {posting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Post</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Posts Feed */}
        {posts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md border border-gray-100 p-12 text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-full mb-4">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-primary font-bold text-gray-800 mb-2">
              No posts yet
            </h3>
            <p className="text-gray-500 font-secondary">
              Be the first to share something with your team!
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-0">
            {posts.map((post, index) => (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-3 hover:shadow-xl hover:border-gray-200 transition-all duration-300 relative z-0"
              >
                {/* Header Section */}
                <div className="flex items-start justify-between mb-4 pb-2 border-b border-gray-200">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Profile Image */}
                    <div className="relative flex-shrink-0">
                      <UserAvatar
                        name={post.userId.name}
                        image={post.userId.profileImage}
                        size="md"
                        className="ring-2 ring-gray-100"
                      />
                    </div>
                    
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0 flex-wrap">
                        <h3 className="font-sm font-bold text-gray-900 text-sm">
                          {post.userId.name}
                        </h3>
                        {post.userId.designation && (
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-secondary font-medium ${post.userId.role === 'admin'
                              ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                              : 'bg-gradient-to-r from-primary/10 to-purple-600/10 text-primary'
                            }`}>
                            {post.userId.designation}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-secondary">
                        {formatDistanceToNow(new Date(post.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  {canDelete(post) && (
                    <button
                      onClick={() => handleDelete(post)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex-shrink-0"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Post Content */}
                <div className="mt-4">
                  <div className="text-[12px] text-gray-800 font-secondary whitespace-pre-wrap break-words leading-relaxed">
                    {parseContent(post.content, post.mentions || [])}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPost && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeletingPost(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Post"
          message="Are you sure you want to delete this post? This action cannot be undone."
          details={
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Author:</span>
                <span className="font-medium text-gray-900">
                  {deletingPost.userId.name}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {deletingPost.content.substring(0, 200)}
                  {deletingPost.content.length > 200 ? '...' : ''}
                </p>
              </div>
            </div>
          }
          loading={deleteLoading}
        />
      )}

      {/* Mention Popup */}
      <MentionPopup
        isOpen={showMentionPopup}
        onClose={() => {
          setShowMentionPopup(false);
          setSelectedMention(null);
          setMentionPosition(undefined);
        }}
        user={selectedMention}
        position={mentionPosition}
      />
    </>
  );
}


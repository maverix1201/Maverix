'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { showBrowserNotification } from '@/lib/notificationTrigger';

export default function GlobalNotificationListener() {
  const { data: session } = useSession();
  const router = useRouter();
  const lastNotificationIdRef = useRef<string | null>(null);
  const lastCheckedAtRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fastPollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!session || typeof window === 'undefined') {
      return;
    }

    // Check if browser notifications are supported
    const notificationsSupported = 'Notification' in window;
    
    // Request permission if supported and not granted
    if (notificationsSupported && Notification.permission === 'default') {
      Notification.requestPermission().catch((error) => {
        console.error('Error requesting notification permission:', error);
      });
    }

    // Use faster polling when app is active for near-instant notifications
    // This works even without service worker (HTTP/iOS)
    const FAST_POLL_INTERVAL_MS = 3000; // 3 seconds when active
    const SLOW_POLL_INTERVAL_MS = 15000; // 15 seconds when in background

    // Helper to show notification (works on both desktop and mobile)
    const displayNotification = (notification: any) => {
      // Determine URL based on notification type
      let url = '/';
      const userRole = (session?.user as any)?.role || 'employee';
      
      if (notification.type === 'mention') {
        url = `/${userRole}/feed`;
      } else if (notification.type === 'leave_approved' || notification.type === 'leave_rejected') {
        url = `/${userRole}/leaves`;
      } else if (notification.type === 'leave_request') {
        url = '/hr/leave-request';
      }

      // Try browser notification first (works on desktop and some mobile browsers)
      if (notificationsSupported && Notification.permission === 'granted') {
        showBrowserNotification(notification.title, notification.message, {
          icon: '/assets/maverixicon.png',
          badge: '/assets/maverixicon.png',
          tag: `notification-${notification._id}`,
          data: {
            notificationId: notification._id,
            type: notification.type,
            url,
            leaveId: notification.leaveId?._id || notification.leaveId,
            feedId: notification.feedId?._id || notification.feedId,
          },
          requireInteraction: false,
        });
      }

      // Also dispatch a custom event for in-app toast notifications
      // This ensures notifications are shown even if browser notifications don't work
      window.dispatchEvent(new CustomEvent('showInAppNotification', {
        detail: {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          url,
        }
      }));
    };

    // Function to check for new notifications and show them
    const checkAndShowNotifications = async () => {
      try {
        // Build query to check for new notifications
        const queryParams = new URLSearchParams({
          limit: '5',
          includeDismissed: 'false',
        });
        
        // If we have a last checked time, only get newer notifications
        if (lastCheckedAtRef.current) {
          queryParams.set('since', lastCheckedAtRef.current);
        }

        const res = await fetch(`/api/notifications?${queryParams}`);
        const data = await res.json();

        if (res.ok && data.notifications && data.notifications.length > 0) {
          // Update last checked time
          lastCheckedAtRef.current = new Date().toISOString();

          // Process notifications (newest first, but show oldest first for better UX)
          const newNotifications = data.notifications
            .filter((n: any) => n._id !== lastNotificationIdRef.current && !n.read)
            .reverse(); // Show oldest first

          for (const notification of newNotifications) {
            lastNotificationIdRef.current = notification._id;
            displayNotification(notification);
            
            // Small delay between multiple notifications
            if (newNotifications.length > 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    // Initial check
    checkAndShowNotifications();

    // Start fast polling when visible
    const startFastPolling = () => {
      if (fastPollingRef.current) clearInterval(fastPollingRef.current);
      fastPollingRef.current = setInterval(checkAndShowNotifications, FAST_POLL_INTERVAL_MS);
    };

    // Switch to slow polling when hidden
    const startSlowPolling = () => {
      if (fastPollingRef.current) clearInterval(fastPollingRef.current);
      fastPollingRef.current = null;
    };

    // Start appropriate polling based on visibility
    if (document.visibilityState === 'visible') {
      startFastPolling();
    }

    // Slow background poll (always running as fallback)
    pollingIntervalRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        checkAndShowNotifications();
      }
    }, SLOW_POLL_INTERVAL_MS);

    // Also listen for custom events (when notifications are created in same tab)
    const handleNotificationCreated = (event: CustomEvent) => {
      const notification = event.detail;
      if (notification && notification._id !== lastNotificationIdRef.current) {
        lastNotificationIdRef.current = notification._id;
        displayNotification(notification);
      }
    };

    window.addEventListener('notificationCreated' as any, handleNotificationCreated as EventListener);

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Immediately check and start fast polling
        checkAndShowNotifications();
        startFastPolling();
      } else {
        // Stop fast polling when hidden
        startSlowPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (fastPollingRef.current) {
        clearInterval(fastPollingRef.current);
      }
      window.removeEventListener(
        'notificationCreated' as any,
        handleNotificationCreated as EventListener
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, router]);

  return null; // This component doesn't render anything
}


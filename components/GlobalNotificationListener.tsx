'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { showBrowserNotification } from '@/lib/notificationTrigger';

export default function GlobalNotificationListener() {
  const { data: session } = useSession();
  const router = useRouter();
  const lastNotificationIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!session || typeof window === 'undefined') {
      return;
    }

    // Check notification permission
    if (!('Notification' in window)) {
      return;
    }

    // Request permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch((error) => {
        console.error('Error requesting notification permission:', error);
      });
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    // Polling every 1s is extremely expensive for both client and server.
    // We rely on the custom in-tab event for immediate updates, and use
    // polling only as a fallback for cross-tab / remote updates.
    const POLL_INTERVAL_MS = 15000; // 15s

    // Function to check for new notifications and show them
    const checkAndShowNotifications = async () => {
      try {
        // Don't do background work when the tab is hidden
        if (document.visibilityState !== 'visible') return;

        const res = await fetch(`/api/notifications?limit=1&includeDismissed=false&t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await res.json();

        if (res.ok && data.notifications && data.notifications.length > 0) {
          const latestNotification = data.notifications[0];

          // Check if this is a new notification
          if (
            latestNotification._id !== lastNotificationIdRef.current &&
            !latestNotification.read
          ) {
            lastNotificationIdRef.current = latestNotification._id;

            // Determine URL based on notification type
            let url = '/';
            if (latestNotification.type === 'mention') {
              url = '/employee/feed';
            } else if (
              latestNotification.type === 'leave_approved' ||
              latestNotification.type === 'leave_rejected'
            ) {
              url = '/employee/leaves';
            } else if (latestNotification.type === 'leave_request') {
              url = '/hr/leave-request';
            }

            // Show browser notification immediately
            showBrowserNotification(latestNotification.title, latestNotification.message, {
              icon: '/assets/maverixicon.png',
              badge: '/assets/maverixicon.png',
              tag: `notification-${latestNotification._id}`,
              data: {
                notificationId: latestNotification._id,
                type: latestNotification.type,
                url,
                leaveId: latestNotification.leaveId?._id || latestNotification.leaveId,
                feedId: latestNotification.feedId?._id || latestNotification.feedId,
              },
              requireInteraction: false, // Don't require interaction - just show it
            });
          }
        }
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    // Initial check
    checkAndShowNotifications();

    // Poll for new notifications (fallback only)
    pollingIntervalRef.current = setInterval(checkAndShowNotifications, POLL_INTERVAL_MS);

    // Also listen for custom events (when notifications are created)
    const handleNotificationCreated = (event: CustomEvent) => {
      const notification = event.detail;
      if (notification && notification._id !== lastNotificationIdRef.current) {
        lastNotificationIdRef.current = notification._id;
        showBrowserNotification(notification.title, notification.message, {
          icon: '/assets/mobileicon.jpg',
          badge: '/assets/maverixicon.png',
          tag: `notification-${notification._id}`,
          data: {
            notificationId: notification._id,
            type: notification.type,
            url:
              notification.type === 'mention'
                ? '/employee/feed'
                : notification.type === 'leave_approved' || notification.type === 'leave_rejected'
                ? '/employee/leaves'
                : '/',
          },
        });
      }
    };

    window.addEventListener('notificationCreated' as any, handleNotificationCreated as EventListener);

    // Re-check immediately when returning to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndShowNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle notification clicks
    const handleNotificationClick = (event: Event) => {
      const notification = (event.target as Notification);
      const data = notification.data;
      if (data && data.url) {
        router.push(data.url);
      }
      notification.close();
    };

    // Listen for notification clicks
    if ('Notification' in window) {
      // Note: Notification click events are handled by the browser
      // We can add a click handler if needed in the future
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
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


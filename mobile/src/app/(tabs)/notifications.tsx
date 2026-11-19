import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { useNotificationCount } from '@/context/notification-count-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  canMarkRead: boolean;
  isDemo?: boolean;
  emailDeliveryStatus?: string;
  emailDeliveryError?: string;
  emailDeliveryRecipient?: string;
  emailDeliveryAttemptedAt?: string;
  emailDeliveryMessageId?: string;
  targetType?: string;
  targetId?: string;
  opportunityId?: string;
  isAnnouncement?: boolean;
};

export default function NotificationsScreen() {
  const { session } = useAuth();
  const { refreshUnreadCount } = useNotificationCount();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');

  const fetchNotifications = useCallback(
    () => apiFetch<{ notifications: NotificationItem[] }>('/notifications'),
    []
  );

  const loadNotifications = useCallback(async () => {
    try {
      const payload = await fetchNotifications();
      setItems(payload.notifications);
      await refreshUnreadCount();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, refreshUnreadCount]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchNotifications()
      .then(({ notifications }) => {
        if (active) {
          setItems(notifications);
          void refreshUnreadCount();
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchNotifications, refreshUnreadCount, session]);

  const markRead = async (item: NotificationItem) => {
    if (busyId || item.read || !item.canMarkRead) return;
    setBusyId(item.id);
    setError('');
    try {
      await apiFetch(`/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PATCH' });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      await refreshUnreadCount();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The notification could not be marked as read.');
    } finally {
      setBusyId('');
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (item.canMarkRead && !item.read) await markRead(item);

    const targetType = item.targetType;
    const targetId = item.targetId;
    if (targetType === 'application') {
      router.push(targetId
        ? { pathname: '/applications', params: { id: targetId } }
        : '/applications');
      return;
    }
    if (targetType === 'recruitment') {
      router.push('/opportunities');
      return;
    }
    if (targetType === 'opportunity') {
      if (['Opportunity awaiting approval', 'Opportunity resubmitted for approval', 'Opportunity review update'].includes(item.title)) {
        router.push('/opportunities');
      } else {
        const opportunityId = targetId || item.opportunityId;
        router.push(opportunityId
          ? { pathname: '/opportunity', params: { id: opportunityId } }
          : '/opportunities');
      }
      return;
    }
    if (targetType === 'mentor_request') {
      router.push(session?.activeRole === 'farmer' ? '/farmer-mentors' : '/admin');
      return;
    }

    const title = item.title.toLowerCase();
    const message = item.message.toLowerCase();
    if (title.includes('application') || message.includes('application')) {
      router.push('/applications');
    } else if (title.includes('opportunity') || message.includes('opportunity')) {
      router.push('/opportunities');
    } else if (title.includes('mentor') || message.includes('mentor')) {
      router.push(session?.activeRole === 'farmer' ? '/farmer-mentors' : '/admin');
    } else if (title.includes('role') || title.includes('account')) {
      router.push('/profile');
    } else if (item.isAnnouncement) {
      router.push('/services');
    } else {
      router.push('/home');
    }
  };

  const resendNotificationEmails = async () => {
    if (emailBusy) return;
    setEmailBusy(true);
    setEmailMessage('');
    setError('');
    try {
      const result = await apiFetch<{ sentCount: number; failedCount: number }>(
        '/notifications/resend-email',
        { method: 'POST' }
      );
      await loadNotifications();
      setEmailMessage(
        result.failedCount
          ? `Emailed ${result.sentCount} notification(s); ${result.failedCount} could not be sent.`
          : result.sentCount
            ? `Emailed ${result.sentCount} notification(s) to your registered email address.`
            : 'There are no existing notifications that need emailing.'
      );
    } catch (cause) {
      setEmailMessage(cause instanceof Error ? cause.message : 'Notifications could not be emailed.');
    } finally {
      setEmailBusy(false);
    }
  };

  const hasUnsentNotifications = items.some((item) =>
    !item.isDemo && !item.isAnnouncement &&
    (item.emailDeliveryStatus !== 'sent' || !item.emailDeliveryMessageId)
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton />
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          <Text style={styles.heading}>Notifications</Text>
        {hasUnsentNotifications ? (
          <View style={styles.emailPanel}>
            <Text style={styles.emailInfo}>Retry notifications without a Brevo message reference. A retry may duplicate a message if Brevo accepted the original.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={emailBusy}
              onPress={() => void resendNotificationEmails()}
              style={styles.readButton}
            >
              <Text style={styles.readButtonText}>{emailBusy ? 'Sending…' : 'Retry unconfirmed email'}</Text>
            </Pressable>
          </View>
        ) : null}
        {emailMessage ? <Text accessibilityRole="alert" style={styles.emailMessage}>{emailMessage}</Text> : null}
        {error ? (
            <View>
              <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadNotifications()} style={styles.readButton}>
                <Text style={styles.readButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {items.length === 0 ? (
            <Text style={styles.empty}>No notifications at the moment.</Text>
          ) : (
            items.map((item) => (
              <View key={item.id} style={[styles.card, item.read && styles.readCard]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  onPress={() => void openNotification(item)}
                  style={styles.notificationLink}
                >
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.openLink}>View related details</Text>
                </Pressable>
                <Text style={styles.readStatus}>{item.read ? 'Read' : 'Unread'}</Text>
                {item.isDemo ? (
                  <Text style={styles.emailStatus}>Sample notification; no email was sent.</Text>
                ) : item.emailDeliveryStatus === 'sent' ? (
                  <View>
                    <Text style={styles.emailStatus}>
                      Accepted by Brevo SMTP for {item.emailDeliveryRecipient || 'your registered account email'}{item.emailDeliveryAttemptedAt ? ` at ${item.emailDeliveryAttemptedAt}` : ''}; inbox delivery is not confirmed.
                    </Text>
                    {item.emailDeliveryMessageId ? (
                      <Text selectable style={styles.emailStatus}>Mailer-generated ID (not a Brevo delivery-log reference): {item.emailDeliveryMessageId}</Text>
                    ) : null}
                  </View>
                ) : item.emailDeliveryStatus === 'failed' ? (
                  <View>
                    <Text accessibilityRole="alert" style={styles.emailError}>
                      {item.emailDeliveryError || 'Email was not accepted by Brevo. Use the retry option above after checking its SMTP configuration.'}
                    </Text>
                    {item.emailDeliveryRecipient ? (
                      <Text style={styles.emailStatus}>Attempted recipient: {item.emailDeliveryRecipient}</Text>
                    ) : null}
                  </View>
                ) : item.emailDeliveryStatus === 'disabled' ? (
                  <Text style={styles.emailStatus}>Email delivery was disabled when this notice was created.</Text>
                ) : null}
                {item.canMarkRead && !item.read ? (
                  <Pressable accessibilityRole="button" disabled={Boolean(busyId)} onPress={() => void markRead(item)} style={styles.readButton}>
                    <Text style={styles.readButtonText}>{busyId === item.id ? 'Updating…' : 'Mark as read'}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1, padding: spacing.md },
  container: { padding: spacing.xl, paddingBottom: 120 },
  heading: { fontSize: 28, fontWeight: '800', color: palette.text },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 5,
    borderLeftColor: palette.primary,
  },
  notificationLink: { borderRadius: radius.sm },
  readCard: { borderLeftColor: palette.accent },
  title: { fontSize: 17, fontWeight: '800', color: palette.text },
  message: { marginTop: spacing.sm, color: palette.muted, lineHeight: 22 },
  openLink: { marginTop: spacing.sm, color: palette.primary, fontWeight: '700', fontSize: 12 },
  readStatus: { marginTop: spacing.sm, color: palette.primary, fontWeight: '700' },
  emailStatus: { marginTop: spacing.xs, color: palette.muted, fontSize: 11, lineHeight: 16 },
  emailError: { marginTop: spacing.xs, color: palette.danger, fontSize: 11, lineHeight: 16 },
  readButton: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm },
  readButtonText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  emailPanel: { marginTop: spacing.md, padding: spacing.md, backgroundColor: palette.surface, borderRadius: radius.md },
  emailInfo: { color: palette.muted, lineHeight: 20 },
  emailMessage: { color: palette.primaryDark, marginTop: spacing.sm, lineHeight: 20 },
  empty: { color: palette.muted, marginTop: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});

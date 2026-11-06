import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotificationCount } from '@/context/notification-count-context';
import { palette } from '@/theme';

type NotificationBellProps = {
  color: string;
  size?: number;
  style?: object;
  badgeColor?: string;
  onPress: () => void;
};

export function NotificationBell({
  color,
  size = 19,
  style,
  badgeColor = '#C73535',
  onPress,
}: NotificationBellProps) {
  const { unreadCount } = useNotificationCount();
  const accessibilityLabel = unreadCount
    ? `Open notifications, ${unreadCount} unread`
    : 'Open notifications';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.button, style]}
    >
      <Ionicons name="notifications-outline" size={size} color={color} />
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -7,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.surface,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '800' },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme';

type LearnerSidebarProps = {
  active: 'dashboard' | 'courses';
  firstName: string;
  lastName: string;
  role: string;
  onDashboard: () => void;
  onCourses: () => void;
};

type LearnerSidebarDrawerProps = LearnerSidebarProps & {
  visible: boolean;
  onClose: () => void;
};

const plannedItems: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Assignments', icon: 'document-text-outline' },
  { label: 'Quizzes', icon: 'flash-outline' },
  { label: 'Live Sessions', icon: 'videocam-outline' },
  { label: 'Certificates', icon: 'ribbon-outline' },
];

export function LearnerSidebar({
  active,
  firstName,
  lastName,
  role,
  onDashboard,
  onCourses,
}: LearnerSidebarProps) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>AgriConnect 360</Text>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'dashboard' }}
          onPress={onDashboard}
          style={[styles.item, active === 'dashboard' && styles.itemSelected]}
        >
          <Ionicons name="grid-outline" size={17} color="#D9E1DC" />
          <Text style={styles.itemText}>Dashboard</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'courses' }}
          onPress={onCourses}
          style={[styles.item, active === 'courses' && styles.itemSelected]}
        >
          <Ionicons name="book-outline" size={17} color="#D9E1DC" />
          <Text style={styles.itemText}>My Courses</Text>
        </Pressable>
        {plannedItems.map((item) => (
          <View key={item.label} style={styles.itemPlanned}>
            <Ionicons name={item.icon} size={17} color="#AAB8B0" />
            <Text style={styles.itemTextPlanned}>{item.label}</Text>
            <Text style={styles.plannedTag}>Planned</Text>
          </View>
        ))}
      </View>
      <View style={styles.user}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase() || 'L'}</Text>
        </View>
        <View style={styles.userCopy}>
          <Text numberOfLines={1} style={styles.userName}>{firstName} {lastName}</Text>
          <Text style={styles.userRole}>{role.replace('_', ' ')}</Text>
        </View>
      </View>
    </View>
  );
}

export function LearnerSidebarMenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open learner navigation"
      onPress={onPress}
      style={styles.menuButton}
    >
      <Ionicons name="menu-outline" size={22} color={palette.text} />
    </Pressable>
  );
}

export function LearnerSidebarDrawer({
  visible,
  onClose,
  ...sidebarProps
}: LearnerSidebarDrawerProps) {
  if (!visible) return null;

  return (
    <View style={styles.drawerOverlay}>
      <View style={styles.drawerPanel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close learner navigation"
          onPress={onClose}
          style={styles.drawerCloseButton}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <LearnerSidebar {...sidebarProps} />
      </View>
      <Pressable
        accessible={false}
        onPress={onClose}
        style={styles.drawerBackdrop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 228, flex: 1, backgroundColor: '#18211D', paddingHorizontal: 12, paddingTop: 20 },
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFFFFF' },
  drawerOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.38)' },
  drawerBackdrop: { flex: 1 },
  drawerPanel: { width: 268, maxWidth: '82%', flexDirection: 'row', backgroundColor: '#18211D', paddingTop: 8, paddingRight: 8 },
  drawerCloseButton: { width: 32, height: 42, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', paddingHorizontal: 12 },
  navigation: { gap: 3, marginTop: 30 },
  item: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 2, borderLeftColor: 'transparent', backgroundColor: 'transparent', paddingHorizontal: 10 },
  itemSelected: { borderLeftColor: palette.accent, backgroundColor: '#303936' },
  itemText: { color: '#D9E1DC', fontSize: 13, fontWeight: '600' },
  itemPlanned: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  itemTextPlanned: { flex: 1, color: '#AAB8B0', fontSize: 13 },
  plannedTag: { color: '#AAB8B0', fontSize: 8, textTransform: 'uppercase' },
  user: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#34413B', marginTop: 'auto', paddingHorizontal: 4 },
  avatar: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.primary },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  userCopy: { flex: 1, minWidth: 0 },
  userName: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  userRole: { color: '#AAB8B0', fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
});

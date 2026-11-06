import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { palette } from '@/theme';

export default function TabsLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  const tabs: {
    name: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { name: 'home', title: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { name: 'services', title: 'Services', icon: 'grid-outline', activeIcon: 'grid' },
    { name: 'passport', title: 'Passport', icon: 'id-card-outline', activeIcon: 'id-card' },
    { name: 'profile', title: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#7A8B80',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 62,
          paddingTop: 5,
          backgroundColor: '#F8FBF9',
          borderTopColor: '#E7ECE8',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', marginTop: 1 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 42, paddingTop: 3 }}>
                <View
                  style={{
                    position: 'absolute',
                    top: -7,
                    width: 18,
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: focused ? palette.accent : 'transparent',
                  }}
                />
                <Ionicons
                  name={focused ? tab.activeIcon : tab.icon}
                  size={size}
                  color={String(color ?? palette.primary)}
                />
              </View>
            ),
          }}
        />
      ))}
      <Tabs.Screen
        name="opportunities"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="admin"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="sdf-workforce"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}

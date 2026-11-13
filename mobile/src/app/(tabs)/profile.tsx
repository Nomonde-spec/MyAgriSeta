import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppRole, useAuth } from '@/context/auth-context';
import { NotificationBell } from '@/components/navigation/notification-bell';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone: string;
  organization: string;
  farmProfile?: { farmName: string; province: string };
  candidateProfile?: { visible: boolean; passportVisible: boolean; desiredRole: string; province: string; summary: string };
  activeRole: AppRole;
  roles: AppRole[];
  status: 'active' | 'inactive';
};

type ProfileLinkProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
};

function ProfileLink({ icon, title, description, onPress }: ProfileLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={17} color={palette.primary} />
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#8A9990" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, logout, updateProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [farmName, setFarmName] = useState('');
  const [province, setProvince] = useState('');
  const [candidateVisible, setCandidateVisible] = useState(false);
  const [candidatePassportVisible, setCandidatePassportVisible] = useState(false);
  const [candidateDesiredRole, setCandidateDesiredRole] = useState('');
  const [candidateProvince, setCandidateProvince] = useState('');
  const [candidateSummary, setCandidateSummary] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ user: Profile }>('/me')
      .then(({ user }) => {
        if (!active) return;
        setProfile(user);
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setPhone(user.phone || '');
        setOrganization(user.organization || '');
        setFarmName(user.farmProfile?.farmName || '');
        setProvince(user.farmProfile?.province || '');
        setCandidateVisible(user.candidateProfile?.visible || false);
        setCandidatePassportVisible(user.candidateProfile?.passportVisible || false);
        setCandidateDesiredRole(user.candidateProfile?.desiredRole || '');
        setCandidateProvince(user.candidateProfile?.province || '');
        setCandidateSummary(user.candidateProfile?.summary || '');
        setLoadError('');
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Your profile could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retry, session]);

  const handleLogout = async () => {
    let logoutError: unknown;
    try {
      await logout();
    } catch (error) {
      logoutError = error;
    } finally {
      router.replace('/');
    }
    if (logoutError) {
      Alert.alert(
        'Sign-out warning',
        'Sign-out could not be fully confirmed. The local session was cleared if storage was available, but the server may not have revoked the token. It may remain valid until it expires.'
      );
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setPhone(profile.phone || '');
      setOrganization(profile.organization || '');
      setFarmName(profile.farmProfile?.farmName || '');
      setProvince(profile.farmProfile?.province || '');
      setCandidateVisible(profile.candidateProfile?.visible || false);
      setCandidatePassportVisible(profile.candidateProfile?.passportVisible || false);
      setCandidateDesiredRole(profile.candidateProfile?.desiredRole || '');
      setCandidateProvince(profile.candidateProfile?.province || '');
      setCandidateSummary(profile.candidateProfile?.summary || '');
    }
    setEditing(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const payload = await apiFetch<{ user: Profile }>('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          organization,
          ...(profile.activeRole === 'farmer' ? { farmName, province } : {}),
          ...(['learner', 'farmer'].includes(profile.activeRole) ? {
            candidateVisible,
            candidatePassportVisible: candidateVisible && candidatePassportVisible,
            candidateDesiredRole,
            candidateProvince,
            candidateSummary,
          } : {}),
        }),
      });
      setProfile(payload.user);
      setFirstName(payload.user.firstName);
      setLastName(payload.user.lastName);
      setPhone(payload.user.phone || '');
      setOrganization(payload.user.organization || '');
      setFarmName(payload.user.farmProfile?.farmName || '');
      setProvince(payload.user.farmProfile?.province || '');
      setCandidateVisible(payload.user.candidateProfile?.visible || false);
      setCandidatePassportVisible(payload.user.candidateProfile?.passportVisible || false);
      setCandidateDesiredRole(payload.user.candidateProfile?.desiredRole || '');
      setCandidateProvince(payload.user.candidateProfile?.province || '');
      setCandidateSummary(payload.user.candidateProfile?.summary || '');
      updateProfile(payload.user);
      setEditing(false);
      Alert.alert('Profile updated', 'Your profile details have been saved.');
    } catch (error) {
      Alert.alert('Unable to update profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const showPrivacyInfo = () => {
    Alert.alert(
      'Privacy & security',
      'Your role and permissions come from your account and cannot be changed here. Password changes and self-service password reset are not configured in this prototype.'
    );
  };

  const showSupportInfo = () => {
    Alert.alert(
      'Help & support',
      'A support channel is not connected in this prototype. Contact your platform administrator for account assistance.'
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Ionicons name="person-circle-outline" size={34} color={palette.muted} />
          <Text style={styles.stateText}>{loadError || 'Your profile is unavailable.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLoading(true);
              setRetry((current) => current + 1);
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initials = `${profile.firstName.slice(0, 1)}${profile.lastName.slice(0, 1)}`.toUpperCase();
  const roleName = profile.activeRole.replaceAll('_', ' ');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator
        persistentScrollbar
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>MY AGRICONNECT ACCOUNT</Text>
            <Text style={styles.heading}>Profile</Text>
          </View>
          <NotificationBell
            onPress={() => router.push('/notifications')}
            style={styles.headerButton}
            color={palette.primaryDark}
            badgeColor={palette.danger}
          />
        </View>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={palette.primary} />
            <Text style={styles.roleText}>{roleName}</Text>
          </View>
        </View>

        <View style={styles.accountCard}>
          <View style={styles.accountCardTop}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-outline" size={16} color="#F1D581" />
            </View>
            <Text style={styles.accountCardLabel}>ACCOUNT STATUS</Text>
            <View style={styles.accountStatus}>
              <View style={[styles.statusDot, profile.status !== 'active' && styles.statusDotInactive]} />
              <Text style={styles.accountStatusText}>{profile.status === 'active' ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
          <Text style={styles.accountCardTitle}>Your account is {profile.status}</Text>
          <Text style={styles.accountCardDescription}>
            Access is based on the role assigned to your account.
          </Text>
        </View>

        {editing ? (
          <View style={styles.editCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Personal information</Text>
              <Pressable accessibilityRole="button" onPress={handleCancel} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>First name</Text>
            <TextInput
              accessibilityLabel="First name"
              autoCapitalize="words"
              maxLength={80}
              onChangeText={setFirstName}
              style={styles.input}
              value={firstName}
            />
            <Text style={styles.label}>Last name</Text>
            <TextInput
              accessibilityLabel="Last name"
              autoCapitalize="words"
              maxLength={80}
              onChangeText={setLastName}
              style={styles.input}
              value={lastName}
            />
            <Text style={styles.label}>Phone number (optional)</Text>
            <TextInput
              accessibilityLabel="Phone number"
              keyboardType="phone-pad"
              maxLength={20}
              onChangeText={setPhone}
              placeholder="+27..."
              style={styles.input}
              value={phone}
            />
            <Text style={styles.label}>Organisation (optional)</Text>
            <TextInput
              accessibilityLabel="Organisation"
              maxLength={160}
              onChangeText={setOrganization}
              style={styles.input}
              value={organization}
            />
            {profile.activeRole === 'farmer' && (
              <>
                <Text style={styles.label}>Farm or operation name (optional)</Text>
                <TextInput
                  accessibilityLabel="Farm or operation name"
                  autoCapitalize="words"
                  maxLength={120}
                  onChangeText={setFarmName}
                  placeholder="Farm or operation name"
                  style={styles.input}
                  value={farmName}
                />
                <Text style={styles.label}>Province (optional)</Text>
                <TextInput
                  accessibilityLabel="Province"
                  autoCapitalize="words"
                  maxLength={60}
                  onChangeText={setProvince}
                  placeholder="Province"
                  style={styles.input}
                  value={province}
                />
              </>
            )}
            {['learner', 'farmer'].includes(profile.activeRole) && (
              <>
                <View style={styles.candidateVisibilityRow}>
                  <View style={styles.candidateVisibilityCopy}>
                    <Text style={styles.label}>Allow employers to find my candidate profile</Text>
                    <Text style={styles.helpText}>
                      Employers may search this limited profile and send in-app invitations to apply. Only your first name, desired role, province, summary, and self-reported Skills Passport skills are shared; contact details and documents stay private. You can turn this off at any time.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Allow employers to find my candidate profile"
                    value={candidateVisible}
                    onValueChange={setCandidateVisible}
                    trackColor={{ false: '#C8D2CC', true: '#8AB89B' }}
                    thumbColor={candidateVisible ? palette.primary : '#F4F4F4'}
                  />
                </View>
                <View style={styles.candidateVisibilityRow}>
                  <View style={styles.candidateVisibilityCopy}>
                    <Text style={styles.label}>Allow employers to view my Passport on my applications</Text>
                    <Text style={styles.helpText}>
                      This is separate from candidate search. Only employers reviewing your submitted applications to their own eligible opportunities can view your recorded skills and credentials. Access is logged. Turn this off at any time.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Allow employers to view my Passport on my applications"
                    value={candidatePassportVisible}
                    onValueChange={setCandidatePassportVisible}
                    disabled={!candidateVisible}
                    trackColor={{ false: '#C8D2CC', true: '#8AB89B' }}
                    thumbColor={candidatePassportVisible ? palette.primary : '#F4F4F4'}
                  />
                </View>
                <Text style={styles.label}>Desired job or opportunity</Text>
                <TextInput
                  accessibilityLabel="Desired job or opportunity"
                  maxLength={120}
                  onChangeText={setCandidateDesiredRole}
                  placeholder="For example, agricultural assistant"
                  style={styles.input}
                  value={candidateDesiredRole}
                />
                <Text style={styles.label}>Preferred province (optional)</Text>
                <TextInput
                  accessibilityLabel="Preferred province"
                  maxLength={60}
                  onChangeText={setCandidateProvince}
                  placeholder="For example, Limpopo"
                  style={styles.input}
                  value={candidateProvince}
                />
                <Text style={styles.label}>Short experience summary (optional)</Text>
                <TextInput
                  accessibilityLabel="Short experience summary"
                  maxLength={500}
                  multiline
                  onChangeText={setCandidateSummary}
                  placeholder="Share relevant experience or the type of work you are seeking"
                  style={[styles.input, styles.multilineInput]}
                  value={candidateSummary}
                />
                <Text style={styles.helpText}>Add or update skills separately in your Skills Passport. Skills are labelled self-reported and are not independently verified.</Text>
              </>
            )}
            <Text style={styles.helpText}>Your login email, username, role and account status are managed separately.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void handleSave()}
              style={[styles.saveButton, saving && styles.disabledButton]}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>Save changes</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.linksCard}>
            <ProfileLink
              icon="person-outline"
              title={profile.activeRole === 'farmer' ? 'Farm and personal information' : 'Personal information'}
              description={profile.activeRole === 'farmer' ? 'Farm name, province, and contact details' : 'Contact details and organisation'}
              onPress={() => setEditing(true)}
            />
            <View style={styles.separator} />
            <ProfileLink
              icon="ribbon-outline"
              title="Skills Passport"
              description="Credentials and skills overview"
              onPress={() => router.push('/passport')}
            />
            <View style={styles.separator} />
            <ProfileLink
              icon="notifications-outline"
              title="Notifications"
              description="View your account updates"
              onPress={() => router.push('/notifications')}
            />
            <View style={styles.separator} />
            <ProfileLink
              icon="shield-checkmark-outline"
              title="Privacy & security"
              description="Account access and security information"
              onPress={showPrivacyInfo}
            />
            <View style={styles.separator} />
            <ProfileLink
              icon="heart-outline"
              title="Help & support"
              description="Account assistance information"
              onPress={showSupportInfo}
            />
            {profile.activeRole === 'administrator' && (
              <>
                <View style={styles.separator} />
                <ProfileLink
                  icon="settings-outline"
                  title="Administration"
                  description="Manage accounts and platform content"
                  onPress={() => router.push('/admin')}
                />
              </>
            )}
            {profile.activeRole === 'internal_staff' && (
              <>
                <View style={styles.separator} />
                <ProfileLink
                  icon="clipboard-outline"
                  title="Staff review queue"
                  description="Review assigned applications"
                  onPress={() => router.push('/review')}
                />
              </>
            )}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => void handleLogout()}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={17} color={palette.danger} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
        <Text style={styles.footer}>MyAgriSETA · AgriConnect 360</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  container: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 92 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  eyebrow: { color: palette.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: palette.text, fontSize: 24, lineHeight: 30, fontWeight: '800', marginTop: 3 },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#E6ECE8',
  },
  identity: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.md },
  avatar: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.primaryDark,
    borderWidth: 3,
    borderColor: palette.surface,
    shadowColor: '#163B2B',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  name: { color: palette.text, fontSize: 19, fontWeight: '800', marginTop: spacing.sm },
  email: { color: palette.muted, fontSize: 11, marginTop: 4 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E6F3EB',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  roleText: { color: palette.primaryDark, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  accountCard: { backgroundColor: '#064632', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  accountCardTop: { flexDirection: 'row', alignItems: 'center' },
  accountIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#17664C', alignItems: 'center', justifyContent: 'center' },
  accountCardLabel: { flex: 1, color: '#C9E2D4', fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginLeft: spacing.sm },
  accountStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#72D69B' },
  statusDotInactive: { backgroundColor: '#F0B26B' },
  accountStatusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  accountCardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  accountCardDescription: { color: '#D5E8DD', fontSize: 10, lineHeight: 15, marginTop: 4 },
  linksCard: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: '#E8EEEA', paddingHorizontal: spacing.sm },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  pressed: { opacity: 0.72 },
  linkIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#E8F4ED', alignItems: 'center', justifyContent: 'center' },
  linkCopy: { flex: 1 },
  linkTitle: { color: palette.text, fontSize: 11, fontWeight: '800' },
  linkDescription: { color: palette.muted, fontSize: 9, marginTop: 3 },
  separator: { height: 1, backgroundColor: '#EDF1EE', marginLeft: 38 },
  editCard: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: '#E8EEEA', padding: spacing.md },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  cancelText: { color: palette.primary, fontWeight: '700', fontSize: 11 },
  label: { color: palette.text, fontSize: 10, fontWeight: '700', marginTop: spacing.sm },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    color: palette.text,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: 5,
    fontSize: 12,
  },
  candidateVisibilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  candidateVisibilityCopy: { flex: 1 },
  multilineInput: { minHeight: 76, textAlignVertical: 'top', paddingTop: spacing.sm },
  helpText: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: spacing.sm },
  saveButton: { minHeight: 42, backgroundColor: palette.primaryDark, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  saveButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  disabledButton: { opacity: 0.6 },
  logoutButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#EEDBD7',
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  logoutText: { color: palette.danger, fontWeight: '800', fontSize: 11 },
  footer: { color: '#A1ADA5', textAlign: 'center', fontSize: 8, marginTop: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F8F5' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: '#F3F8F5' },
  stateText: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm },
  retryButton: { backgroundColor: palette.primaryDark, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.md },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
});

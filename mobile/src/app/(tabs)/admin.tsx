import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { AnnouncementManagement } from '@/components/admin/announcements';
import { FarmerCuratedDataManagement } from '@/components/admin/farmer-curated-data';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone: string;
  organization: string;
  roles: string[];
  activeRole: string;
  permissions: string[];
  status: string;
  roleVerificationStatus?: 'pending' | 'approved' | 'rejected';
};

const roleOptions = [
  'learner',
  'farmer',
  'employer',
  'sdf',
  'training_provider',
  'administrator',
  'internal_staff',
];

type RoleRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  submittedAt: string;
  verificationDetails: Record<string, string> | null;
};

export default function AdminScreen() {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [permissionsByRole, setPermissionsByRole] = useState<Record<string, string[]>>({});
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [reviewConfirmation, setReviewConfirmation] = useState<{
    roleRequest: RoleRequest;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [userDraft, setUserDraft] = useState<UserSummary | null>(null);
  const [userPassword, setUserPassword] = useState('');
  const [userEditError, setUserEditError] = useState('');
  const [createUser, setCreateUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    organization: '',
    roles: ['learner'],
  });
  const [createError, setCreateError] = useState('');
  const [createFeedback, setCreateFeedback] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadUsers = async () => {
    try {
      const [userPayload, requestPayload] = await Promise.all([
        apiFetch<{ users: UserSummary[]; permissionsByRole: Record<string, string[]> }>('/users'),
        apiFetch<{ requests: RoleRequest[] }>('/admin/role-requests'),
      ]);
      setUsers(userPayload.users);
      setPermissionsByRole(userPayload.permissionsByRole);
      setRoleRequests(requestPayload.requests);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session || session.activeRole !== 'administrator') {
      return;
    }

    const frame = requestAnimationFrame(() => {
      void loadUsers();
    });
    return () => cancelAnimationFrame(frame);
  }, [session]);

  if (session && session.activeRole !== 'administrator') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton />
          <View style={styles.center}>
            <Text style={styles.heading}>Access restricted</Text>
            <Text style={styles.meta}>Only an administrator can manage user accounts.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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

  const filtered = users.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const updateStatus = (user: UserSummary) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    Alert.alert(
      `${nextStatus === 'inactive' ? 'Deactivate' : 'Activate'} account?`,
      `${user.firstName} ${user.lastName} will ${nextStatus === 'inactive' ? 'lose' : 'regain'} access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextStatus === 'inactive' ? 'Deactivate' : 'Activate',
          style: nextStatus === 'inactive' ? 'destructive' : 'default',
          onPress: () => {
            apiFetch(`/users/${user.id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: nextStatus }),
            })
              .then(loadUsers)
              .catch((error) => Alert.alert('Update failed', error instanceof Error ? error.message : 'Unknown error'));
          },
        },
      ]
    );
  };

  const reviewRoleRequest = (roleRequest: RoleRequest, decision: 'approved' | 'rejected') => {
    setReviewConfirmation({ roleRequest, decision });
    setReviewError('');
  };

  const confirmRoleReview = async () => {
    if (!reviewConfirmation || isReviewing) return;
    const { roleRequest, decision } = reviewConfirmation;
    setIsReviewing(true);
    setReviewError('');
    try {
      await apiFetch(`/admin/role-requests/${roleRequest.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          ...(decision === 'approved' ? {} : { note: 'The submitted role references could not be verified. Please contact support.' }),
        }),
      });
      setReviewConfirmation(null);
      await loadUsers();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'The role request could not be reviewed.');
    } finally {
      setIsReviewing(false);
    }
  };

  const toggleRole = (role: string) => {
    if (!userDraft) return;
    const roles = userDraft.roles.includes(role)
      ? userDraft.roles.filter((item) => item !== role)
      : [...userDraft.roles, role];
    setUserDraft({
      ...userDraft,
      roles,
      activeRole: roles.includes(userDraft.activeRole) ? userDraft.activeRole : roles[0] || '',
    });
  };

  const saveUser = async () => {
    if (!userDraft || !editingUserId) return;
    setUserEditError('');
    try {
      await apiFetch(`/users/${encodeURIComponent(editingUserId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: userDraft.firstName,
          lastName: userDraft.lastName,
          email: userDraft.email,
          username: userDraft.username,
          phone: userDraft.phone,
          organization: userDraft.organization,
          roles: userDraft.roles,
          activeRole: userDraft.activeRole,
          ...(userPassword ? { password: userPassword } : {}),
        }),
      });
      setEditingUserId('');
      setUserDraft(null);
      setUserPassword('');
      await loadUsers();
    } catch (error) {
      setUserEditError(error instanceof Error ? error.message : 'Account could not be updated.');
    }
  };

  const createAccount = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError('');
    setCreateFeedback('');
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...createUser,
          activeRole: createUser.roles[0],
        }),
      });
      setCreateFeedback('Account created. The user can sign in with the assigned role and password.');
      setCreateUser({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        organization: '',
        roles: ['learner'],
      });
      await loadUsers();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Account could not be created.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          <Text style={styles.heading}>Administration</Text>
          <Text style={styles.meta}>
            Provision and maintain accounts, assign approved roles, review registration requests, and manage platform-wide information.
          </Text>

          <Text style={styles.sectionHeading}>Create user account</Text>
          <View style={styles.card}>
            {([
              ['firstName', 'First name'],
              ['lastName', 'Last name'],
              ['email', 'Email'],
              ['username', 'Username'],
              ['password', 'Temporary password'],
              ['phone', 'Phone (optional)'],
              ['organization', 'Organisation'],
            ] as const).map(([field, label]) => (
              <TextInput
                key={field}
                accessibilityLabel={label}
                value={createUser[field]}
                onChangeText={(value) => setCreateUser((current) => ({ ...current, [field]: value }))}
                placeholder={label}
                secureTextEntry={field === 'password'}
                autoCapitalize={field === 'email' || field === 'username' ? 'none' : 'words'}
                style={styles.search}
              />
            ))}
            <Text style={styles.meta}>Assigned roles (permissions follow these roles):</Text>
            <View style={styles.reviewActions}>
              {roleOptions.map((role) => {
                const checked = createUser.roles.includes(role);
                return (
                  <Pressable key={role} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setCreateUser((current) => ({
                    ...current,
                    roles: checked ? current.roles.filter((item) => item !== role) : [...current.roles, role],
                  }))} style={[styles.roleChip, checked && styles.selectedRoleChip]}>
                    <Text style={[styles.roleChipText, checked && styles.selectedRoleChipText]}>{role.replace('_', ' ')}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.reviewHint}>Administrator and internal-staff roles grant privileged access. Assign only when authorized.</Text>
            {createError ? <Text accessibilityRole="alert" style={styles.errorText}>{createError}</Text> : null}
            {createFeedback ? <Text accessibilityRole="alert" style={styles.feedback}>{createFeedback}</Text> : null}
            <Pressable accessibilityRole="button" disabled={isCreating} onPress={() => void createAccount()} style={[styles.action, isCreating && styles.disabled]}>
              <Text style={styles.actionText}>{isCreating ? 'Creating…' : 'Create account'}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionHeading}>Legacy role requests ({roleRequests.length})</Text>
          {roleRequests.length === 0 ? (
            <Text style={styles.meta}>No historical role requests need review. New accounts are provisioned directly by an administrator.</Text>
          ) : roleRequests.map((roleRequest) => (
            <View key={roleRequest.id} style={styles.card}>
              <Text style={styles.name}>{roleRequest.firstName} {roleRequest.lastName}</Text>
              <Text style={styles.meta}>{roleRequest.email}</Text>
              <Text style={styles.meta}>Requested role: {roleRequest.role.replace('_', ' ')}</Text>
              <Text style={styles.meta}>Submitted: {new Date(roleRequest.submittedAt).toLocaleDateString()}</Text>
              <View style={styles.evidence}>
                {Object.entries(roleRequest.verificationDetails || {}).map(([field, value]) => (
                  <Text key={field} style={styles.evidenceText}>
                    {field.replace(/([A-Z])/g, ' $1')}: {value}
                  </Text>
                ))}
                {!roleRequest.verificationDetails ? (
                  <Text style={styles.evidenceText}>No reference details were collected for this legacy account.</Text>
                ) : null}
              </View>
              <Text style={styles.reviewHint}>
                Verify these references independently. This app does not check official registries or uploaded documents.
              </Text>
              {reviewConfirmation?.roleRequest.id === roleRequest.id ? (
                <View style={styles.reviewConfirmation}>
                  <Text style={styles.reviewConfirmationText}>
                    Confirm {reviewConfirmation.decision === 'approved' ? 'approval' : 'rejection'} for {roleRequest.firstName} {roleRequest.lastName}?
                  </Text>
                  {reviewError ? <Text accessibilityRole="alert" style={styles.reviewError}>{reviewError}</Text> : null}
                  <View style={styles.reviewActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isReviewing}
                      onPress={() => {
                        setReviewConfirmation(null);
                        setReviewError('');
                      }}
                      style={[styles.action, styles.cancelAction, isReviewing && styles.disabled]}
                    >
                      <Text style={styles.cancelActionText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isReviewing}
                      onPress={() => void confirmRoleReview()}
                      style={[
                        styles.action,
                        reviewConfirmation.decision === 'approved' ? styles.approveAction : styles.rejectAction,
                        isReviewing && styles.disabled,
                      ]}
                    >
                      <Text style={styles.actionText}>
                        {isReviewing ? 'Saving…' : reviewConfirmation.decision === 'approved' ? 'Confirm approval' : 'Confirm rejection'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.reviewActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isReviewing}
                    onPress={() => reviewRoleRequest(roleRequest, 'approved')}
                    style={[styles.action, styles.approveAction, isReviewing && styles.disabled]}
                  >
                    <Text style={styles.actionText}>Approve role</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isReviewing}
                    onPress={() => reviewRoleRequest(roleRequest, 'rejected')}
                    style={[styles.action, styles.rejectAction, isReviewing && styles.disabled]}
                  >
                    <Text style={styles.actionText}>Reject request</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          <Text style={styles.sectionHeading}>Registered accounts</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search users by name or email"
          style={styles.search}
          accessibilityLabel="Search users"
        />

        {errorMessage ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => { setLoading(true); loadUsers(); }} style={styles.action}>
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={styles.meta}>No matching user accounts.</Text>
        ) : filtered.map((user) => (
          <View key={user.id} style={styles.card}>
            {editingUserId === user.id && userDraft ? (
              <>
                {([
                  ['firstName', 'First name'],
                  ['lastName', 'Last name'],
                  ['email', 'Email'],
                  ['username', 'Username'],
                  ['phone', 'Phone'],
                  ['organization', 'Organisation'],
                ] as const).map(([field, label]) => (
                  <TextInput key={field} accessibilityLabel={label} value={userDraft[field]} onChangeText={(value) => setUserDraft({ ...userDraft, [field]: value })} placeholder={label} style={styles.search} />
                ))}
                <TextInput accessibilityLabel="Set new password" value={userPassword} onChangeText={setUserPassword} placeholder="New password (leave blank to keep current)" secureTextEntry style={styles.search} />
                <Text style={styles.meta}>Assigned roles and associated permissions:</Text>
                <View style={styles.reviewActions}>
                  {roleOptions.map((role) => {
                    const checked = userDraft.roles.includes(role);
                    return (
                      <View key={role} style={styles.roleRow}>
                        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => toggleRole(role)} style={[styles.roleChip, checked && styles.selectedRoleChip]}>
                          <Text style={[styles.roleChipText, checked && styles.selectedRoleChipText]}>{role.replace('_', ' ')}</Text>
                        </Pressable>
                        {checked ? (
                          <Pressable accessibilityRole="button" onPress={() => setUserDraft({ ...userDraft, activeRole: role })} style={[styles.roleChip, userDraft.activeRole === role && styles.selectedRoleChip]}>
                            <Text style={[styles.roleChipText, userDraft.activeRole === role && styles.selectedRoleChipText]}>{userDraft.activeRole === role ? 'Active role' : 'Set active'}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.meta}>Permissions for active role: {(permissionsByRole[userDraft.activeRole] || []).join(', ')}</Text>
                {userEditError ? <Text accessibilityRole="alert" style={styles.errorText}>{userEditError}</Text> : null}
                <View style={styles.reviewActions}>
                  <Pressable accessibilityRole="button" onPress={() => void saveUser()} style={styles.action}><Text style={styles.actionText}>Save account</Text></Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { setEditingUserId(''); setUserDraft(null); setUserPassword(''); }} style={[styles.action, styles.cancelAction]}><Text style={styles.cancelActionText}>Cancel</Text></Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
                <Text style={styles.meta}>{user.email} · {user.username}</Text>
                <Text style={styles.meta}>Role: {user.roles.join(', ')}</Text>
                <Text style={styles.meta}>Permissions: {user.permissions.join(', ')}</Text>
              </>
            )}
            <Text style={styles.meta}>Status: {user.status}</Text>
            {user.roleVerificationStatus ? (
              <Text style={styles.meta}>Role verification: {user.roleVerificationStatus}</Text>
            ) : null}
            <Pressable
              style={[styles.action, (user.roleVerificationStatus === 'pending' || user.roleVerificationStatus === 'rejected') && styles.disabled]}
              disabled={user.roleVerificationStatus === 'pending' || user.roleVerificationStatus === 'rejected'}
              onPress={() => updateStatus(user)}
            >
              <Text style={styles.actionText}>
                {user.roleVerificationStatus === 'pending'
                  ? 'Waiting for role review'
                  : user.roleVerificationStatus === 'rejected'
                    ? 'Role request rejected'
                    : user.status === 'active' ? 'Deactivate account' : 'Activate account'}
              </Text>
            </Pressable>
            {editingUserId !== user.id ? (
              <Pressable accessibilityRole="button" onPress={() => {
                setEditingUserId(user.id);
                setUserDraft({ ...user, roles: [...user.roles] });
                setUserPassword('');
                setUserEditError('');
              }} style={[styles.action, styles.cancelAction]}>
                <Text style={styles.cancelActionText}>Edit account and roles</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <FarmerCuratedDataManagement />
        <AnnouncementManagement />
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
  sectionHeading: { fontSize: 19, fontWeight: '800', color: palette.text, marginTop: spacing.xl },
  search: {
    marginTop: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: palette.danger, lineHeight: 20 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  name: { fontSize: 18, fontWeight: '800', color: palette.text },
  meta: { color: palette.muted, marginTop: spacing.sm },
  evidence: { backgroundColor: palette.background, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  evidenceText: { color: palette.text, fontSize: 13, lineHeight: 20, textTransform: 'capitalize' },
  reviewHint: { color: palette.warning, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  reviewConfirmation: {
    backgroundColor: palette.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  reviewConfirmationText: { color: palette.text, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  reviewError: { color: palette.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  reviewActions: { flexDirection: 'row', gap: spacing.sm },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  roleChip: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  selectedRoleChip: { backgroundColor: palette.primary, borderColor: palette.primary },
  roleChipText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  selectedRoleChipText: { color: '#FFFFFF' },
  feedback: { color: palette.primary, marginTop: spacing.sm },
  action: {
    flex: 1,
    minHeight: 44,
    marginTop: spacing.md,
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  approveAction: { backgroundColor: palette.primary },
  rejectAction: { backgroundColor: palette.danger },
  cancelAction: { backgroundColor: palette.surfaceAlt },
  cancelActionText: { color: palette.text, fontWeight: '700' },
  actionText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});

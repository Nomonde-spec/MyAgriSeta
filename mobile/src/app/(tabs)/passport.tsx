import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

const passportRoles = ['learner', 'farmer', 'sdf'];
const skillLevels = ['Foundational', 'Developing', 'Practised', 'Advanced'] as const;

type PassportSkill = {
  id: string;
  name: string;
  category: string;
  level: typeof skillLevels[number];
  description: string;
  updatedAt: string;
  verificationStatus: string;
};

type PassportCredential = {
  id: string;
  courseId: string;
  issuedAt: string;
  issuer: string;
  verificationStatus: string;
};

export default function PassportScreen() {
  const { session } = useAuth();
  const user = session?.user;
  const role = session?.activeRole ?? 'learner';
  const isEligible = ['administrator', 'internal_staff'].includes(role) || passportRoles.includes(role);
  const [skills, setSkills] = useState<PassportSkill[]>([]);
  const [certificates, setCertificates] = useState<PassportCredential[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [skillError, setSkillError] = useState('');
  const [skillBusy, setSkillBusy] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState('');
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('');
  const [skillLevel, setSkillLevel] = useState<typeof skillLevels[number]>('Foundational');
  const [skillDescription, setSkillDescription] = useState('');
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your profile';
  const initials = `${user?.firstName?.slice(0, 1) ?? ''}${user?.lastName?.slice(0, 1) ?? ''}`.toUpperCase();
  const profileFields = [user?.firstName, user?.lastName, user?.email, user?.phone, user?.organization];
  const profileCompletion = Math.round((profileFields.filter((field) => Boolean(field?.trim())).length / profileFields.length) * 100);
  const loadPassport = useCallback(async () => {
    setLoadingSkills(true);
    setSkillError('');
    setSkills([]);
    setCertificates([]);
    try {
      const payload = await apiFetch<{ skills: PassportSkill[]; certificates: PassportCredential[] }>('/passport');
      setSkills(Array.isArray(payload.skills) ? payload.skills : []);
      setCertificates(Array.isArray(payload.certificates) ? payload.certificates : []);
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : 'Your skills passport could not be loaded.');
    } finally {
      setLoadingSkills(false);
    }
  }, []);

  useEffect(() => {
    if (!isEligible) return;
    const timer = setTimeout(() => void loadPassport(), 0);
    return () => clearTimeout(timer);
  }, [isEligible, loadPassport]);

  const passportText = [
    'MyAgriSETA Skills Passport',
    `Account holder: ${fullName}`,
    `Credentials recorded: ${certificates.length}`,
    'Self-reported skills (not verified):',
    ...(skills.length ? skills.map((skill) => `- ${skill.name} (${skill.level})`) : ['- None recorded']),
    'Credential issuer: not connected',
    'Self-reported skills and this document are not proof of qualifications or accreditation.',
  ].join('\n');

  const resetSkillForm = () => {
    setShowSkillForm(false);
    setEditingSkillId('');
    setSkillName('');
    setSkillCategory('');
    setSkillLevel('Foundational');
    setSkillDescription('');
  };

  const beginEditSkill = (skill: PassportSkill) => {
    setSkillError('');
    setConfirmingDeleteId('');
    setEditingSkillId(skill.id);
    setSkillName(skill.name);
    setSkillCategory(skill.category);
    setSkillLevel(skill.level);
    setSkillDescription(skill.description);
    setShowSkillForm(true);
  };

  const saveSkill = async () => {
    if (skillBusy) return;
    setSkillBusy(true);
    setSkillError('');
    try {
      const payload = await apiFetch<{ skill: PassportSkill }>(
        editingSkillId ? `/passport/skills/${encodeURIComponent(editingSkillId)}` : '/passport/skills',
        {
          method: editingSkillId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            name: skillName,
            category: skillCategory,
            level: skillLevel,
            description: skillDescription,
          }),
        }
      );
      setSkills((current) => editingSkillId
        ? current.map((skill) => skill.id === payload.skill.id ? payload.skill : skill)
        : [payload.skill, ...current]);
      resetSkillForm();
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : 'Your skill could not be saved.');
    } finally {
      setSkillBusy(false);
    }
  };

  const deleteSkill = async (id: string) => {
    if (confirmingDeleteId !== id || skillBusy) {
      setConfirmingDeleteId(id);
      return;
    }
    setSkillBusy(true);
    setSkillError('');
    try {
      await apiFetch(`/passport/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSkills((current) => current.filter((skill) => skill.id !== id));
      setConfirmingDeleteId('');
      if (editingSkillId === id) resetSkillForm();
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : 'The skill could not be removed.');
    } finally {
      setSkillBusy(false);
    }
  };

  const explainVerification = () => {
    Alert.alert(
      'QR verification unavailable',
      'A trusted credential issuer is not connected, so this passport cannot create a verification QR code yet.'
    );
  };

  const sharePassport = async () => {
    try {
      await Share.share({ message: passportText, title: 'My Skills Passport' });
    } catch (error) {
      Alert.alert(
        'Unable to share passport',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const downloadPassport = async () => {
    try {
      const safeName = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'account';
      const filename = `${safeName}-skills-passport.txt`;

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([passportText], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      if (!FileSystem.cacheDirectory) {
        throw new Error('Temporary file storage is unavailable on this device.');
      }
      if (!await Sharing.isAvailableAsync()) {
        throw new Error('This device cannot open or share downloaded documents.');
      }

      const uri = `${FileSystem.cacheDirectory}${Date.now()}-${filename}`;
      await FileSystem.writeAsStringAsync(uri, passportText);
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Save Skills Passport' });
    } catch (error) {
      Alert.alert(
        'Unable to download passport',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <View style={styles.hero}>
          <View style={styles.content}>
            <View style={styles.headingRow}>
              <View>
                <Text style={styles.eyebrow}>AGRISKILLS</Text>
                <Text style={styles.heading}>Skills Passport</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Learn about passport verification"
                onPress={explainVerification}
                style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
              >
                <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <LinearGradient
            colors={['#0D6849', '#064632', '#043B2D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.passportCard}
          >
            <View style={styles.cardGlow} />
            <View style={styles.cardHeader}>
              <View style={styles.brandMark}>
                <Ionicons name="leaf" size={13} color={palette.primaryDark} />
              </View>
              <Text style={styles.brandName}>MyAgriSETA</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>NOT VERIFIED</Text>
              </View>
            </View>

            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || 'U'}</Text>
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityLabel}>SKILLS PASSPORT</Text>
                <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
                <Text style={styles.role}>{role.replaceAll('_', ' ')}</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Credentials</Text>
                <Text style={styles.statValue}>{certificates.length}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Skills</Text>
                <Text style={styles.statValue}>{skills.length}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Profile</Text>
                <Text style={styles.statValue}>{profileCompletion}%</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void sharePassport()}
              style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            >
              <Text style={styles.shareText}>Share passport</Text>
              <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void downloadPassport()}
              style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}
            >
              <Text style={styles.downloadText}>Download</Text>
              <Ionicons name="download-outline" size={15} color={palette.primaryDark} />
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>CREDENTIAL RECORDS</Text>
              <Text style={styles.sectionTitle}>My credentials</Text>
            </View>
          </View>

          {certificates.length === 0 ? (
            <View style={styles.credentialCard}>
              <View style={styles.credentialIcon}>
                <Ionicons name="information-circle-outline" size={16} color={palette.primary} />
              </View>
              <View style={styles.credentialCopy}>
                <Text style={styles.credentialName}>No credentials issued</Text>
                <Text style={styles.credentialStatusText}>A trusted credential issuer is not connected.</Text>
              </View>
            </View>
          ) : certificates.map((credential) => (
            <View key={credential.id} style={styles.credentialCard}>
              <View style={styles.credentialIcon}>
                <Ionicons name="ribbon-outline" size={16} color={palette.primary} />
              </View>
              <View style={styles.credentialCopy}>
                <Text style={styles.credentialName}>{credential.issuer}</Text>
                <Text style={styles.credentialStatusText}>{credential.verificationStatus} · {credential.issuedAt}</Text>
              </View>
            </View>
          ))}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>YOUR CAPABILITIES</Text>
              <Text style={styles.sectionTitle}>My skills</Text>
            </View>
            {isEligible ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSkillError('');
                  setEditingSkillId('');
                  setSkillName('');
                  setSkillCategory('');
                  setSkillLevel('Foundational');
                  setSkillDescription('');
                  setShowSkillForm((current) => !current);
                }}
                style={styles.addSkillButton}
              >
                <Ionicons name={showSkillForm ? 'close' : 'add'} size={15} color="#FFFFFF" />
                <Text style={styles.addSkillText}>{showSkillForm ? 'Cancel' : 'Add skill'}</Text>
              </Pressable>
            ) : null}
          </View>

          {skillError ? (
            <View style={styles.skillError}>
              <Text accessibilityRole="alert" style={styles.skillErrorText}>{skillError}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadPassport()}>
                <Text style={styles.viewAll}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {showSkillForm ? (
            <View style={styles.skillForm}>
              <Text style={styles.formLabel}>Skill name *</Text>
              <TextInput accessibilityLabel="Skill name" value={skillName} onChangeText={setSkillName} maxLength={80} style={styles.skillInput} placeholder="e.g. Crop planning" />
              <Text style={styles.formLabel}>Category</Text>
              <TextInput accessibilityLabel="Skill category" value={skillCategory} onChangeText={setSkillCategory} maxLength={60} style={styles.skillInput} placeholder="e.g. Crop production" />
              <Text style={styles.formLabel}>Your self-assessed level</Text>
              <View style={styles.skillsRow}>
                {skillLevels.map((level) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: skillLevel === level }}
                    key={level}
                    onPress={() => setSkillLevel(level)}
                    style={[styles.skillChip, skillLevel === level && styles.skillChipSelected]}
                  >
                    <Text style={[styles.skillText, skillLevel === level && styles.skillTextSelected]}>{level}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                value={skillDescription}
                accessibilityLabel="Skill notes"
                onChangeText={setSkillDescription}
                maxLength={240}
                multiline
                style={[styles.skillInput, styles.skillNotesInput]}
                placeholder="Add a short note about your experience"
              />
              <Pressable accessibilityRole="button" disabled={skillBusy} onPress={() => void saveSkill()} style={[styles.saveSkillButton, skillBusy && styles.disabledButton]}>
                <Text style={styles.saveSkillText}>{skillBusy ? 'Saving...' : editingSkillId ? 'Save changes' : 'Add to passport'}</Text>
              </Pressable>
            </View>
          ) : null}

          {loadingSkills ? (
            <Text style={styles.skillEmpty}>Loading your skills...</Text>
          ) : skills.length === 0 ? (
            <View style={styles.credentialCard}>
              <View style={styles.credentialIcon}>
                <Ionicons name="leaf-outline" size={16} color={palette.primary} />
              </View>
              <View style={styles.credentialCopy}>
                <Text style={styles.credentialName}>No skills added yet</Text>
                <Text style={styles.credentialStatusText}>Add skills you want to keep on your passport.</Text>
              </View>
            </View>
          ) : skills.map((skill) => (
            <View key={skill.id} style={styles.skillCard}>
              <View style={styles.skillCardCopy}>
                <Text style={styles.credentialName}>{skill.name}</Text>
                <Text style={styles.credentialStatusText}>{[skill.category, skill.level].filter(Boolean).join(' · ')}</Text>
                {skill.description ? <Text style={styles.skillDescription}>{skill.description}</Text> : null}
                <Text style={styles.skillVerification}>{skill.verificationStatus}</Text>
              </View>
              {isEligible ? (
                <View style={styles.skillActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${skill.name}`} onPress={() => beginEditSkill(skill)} style={styles.iconButton}>
                    <Ionicons name="create-outline" size={17} color={palette.primary} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={confirmingDeleteId === skill.id ? `Confirm remove ${skill.name}` : `Remove ${skill.name}`} onPress={() => void deleteSkill(skill.id)} style={styles.iconButton}>
                    <Ionicons name={confirmingDeleteId === skill.id ? 'checkmark' : 'trash-outline'} size={17} color={palette.danger} />
                  </Pressable>
                </View>
              ) : null}
              {confirmingDeleteId === skill.id ? <Text style={styles.confirmText}>Tap check to remove</Text> : null}
            </View>
          ))}

          {!isEligible && (
            <View style={styles.notice}>
              <Ionicons name="lock-closed-outline" size={14} color={palette.warning} />
              <Text style={styles.noticeText}>
                Passport services are not currently assigned to the {role.replaceAll('_', ' ')} role.
              </Text>
            </View>
          )}

          <Text style={styles.disclaimer}>
            Skills are self-reported and are not independently verified. Profile completion reflects account information only; this passport is not proof of qualifications or accreditation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: 92 },
  content: { width: '100%', maxWidth: 560, paddingHorizontal: spacing.md },
  hero: { width: '100%', height: 190, alignItems: 'center', backgroundColor: '#064632', paddingTop: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  eyebrow: { color: '#E8C968', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heading: { color: '#FFFFFF', fontSize: 23, lineHeight: 29, fontWeight: '800', marginTop: 4 },
  qrButton: { width: 34, height: 34, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  passportCard: { overflow: 'hidden', borderRadius: radius.lg, padding: spacing.md, marginTop: -94, shadowColor: '#022814', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  cardGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 15, borderColor: 'rgba(255,255,255,0.035)', top: -90, right: -40 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 23, height: 23, borderRadius: 8, backgroundColor: '#F1D581', alignItems: 'center', justifyContent: 'center' },
  brandName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginLeft: spacing.xs },
  statusBadge: { borderWidth: 1, borderColor: 'rgba(241,213,129,0.7)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  statusText: { color: '#F1D581', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  identity: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1D581', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primaryDark, fontSize: 15, fontWeight: '900' },
  identityCopy: { flex: 1, marginLeft: spacing.sm },
  identityLabel: { color: '#C6DFD2', fontSize: 9, letterSpacing: 0.6, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: 3 },
  role: { color: '#C6DFD2', fontSize: 11, textTransform: 'capitalize', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: spacing.sm, marginBottom: spacing.xs },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1 },
  statLabel: { color: '#C6DFD2', fontSize: 9, fontWeight: '700' },
  statValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  shareButton: { flex: 1.2, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: palette.primaryDark, borderRadius: 11, shadowColor: '#022814', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  shareText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  downloadButton: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7ECE8', borderRadius: 11 },
  downloadText: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.xs },
  sectionEyebrow: { color: palette.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
  viewAll: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  credentialCard: { minHeight: 53, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8EEEA', paddingHorizontal: spacing.sm, paddingVertical: 7 },
  credentialIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2F2E9' },
  credentialCopy: { flex: 1, marginLeft: spacing.sm },
  credentialType: { color: '#829087', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  credentialName: { color: palette.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  credentialStatus: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  credentialStatusText: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  skillChip: { borderRadius: 999, borderWidth: 1, borderColor: '#DDEDE3', backgroundColor: '#EDF6F0', paddingHorizontal: 10, paddingVertical: 7 },
  skillChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  skillText: { color: palette.primaryDark, fontSize: 11, fontWeight: '700' },
  skillTextSelected: { color: '#FFFFFF' },
  addSkillButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 10, backgroundColor: palette.primary },
  addSkillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  skillForm: { gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EEEA', borderRadius: 13, padding: spacing.md, marginBottom: spacing.sm },
  formLabel: { color: palette.text, fontSize: 12, fontWeight: '700', marginTop: 3 },
  skillInput: { minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: '#D9E3DD', backgroundColor: '#FFFFFF', paddingHorizontal: 11, color: palette.text, fontSize: 13 },
  skillNotesInput: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' },
  saveSkillButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primary, marginTop: 5 },
  saveSkillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  skillError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 10, backgroundColor: '#FBE8E6', padding: 10, marginBottom: spacing.sm },
  skillErrorText: { flex: 1, color: palette.danger, fontSize: 12, lineHeight: 17 },
  skillEmpty: { color: palette.muted, fontSize: 12, paddingVertical: 12 },
  skillCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E8EEEA', backgroundColor: '#FFFFFF', padding: spacing.sm, marginBottom: 8 },
  skillCardCopy: { flex: 1, minWidth: 180 },
  skillDescription: { color: palette.text, fontSize: 12, lineHeight: 17, marginTop: 4 },
  skillVerification: { color: palette.warning, fontSize: 10, fontWeight: '700', marginTop: 5 },
  skillActions: { flexDirection: 'row', gap: 4 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#F3F8F5' },
  confirmText: { flexBasis: '100%', color: palette.danger, fontSize: 10 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, backgroundColor: '#FBF1D8', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md },
  noticeText: { flex: 1, color: palette.text, fontSize: 11, lineHeight: 16 },
  disclaimer: { color: palette.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: spacing.sm },
  pressed: { opacity: 0.75 },
});

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radius, spacing } from '@/theme';

export type ApplicationDocumentUpload = {
  requirement: string;
  filename: string;
  mimeType: string;
  size: number;
  data: string;
};

export type ApplicationSubmission = {
  applicationData: {
    fullName: string;
    email: string;
    phone: string;
    motivation: string;
    consent: true;
  };
  documents: ApplicationDocumentUpload[];
};

const maxFileSize = 2 * 1024 * 1024;
const maxTotalSize = 5 * 1024 * 1024;

export function ApplicationForm({
  initialName,
  initialEmail,
  initialPhone,
  requiredDocuments,
  busy,
  allowDraft = true,
  reviewerNotice = 'authorized platform reviewers',
  onSubmit,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone?: string;
  requiredDocuments: string[];
  busy: boolean;
  allowDraft?: boolean;
  reviewerNotice?: string;
  onSubmit: (draft: boolean, submission: ApplicationSubmission) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone || '');
  const [motivation, setMotivation] = useState('');
  const [documents, setDocuments] = useState<Record<string, ApplicationDocumentUpload>>({});
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState('');
  const [pickingRequirement, setPickingRequirement] = useState('');

  const selectDocument = async (requirement: string) => {
    if (pickingRequirement || busy) return;
    setPickingRequirement(requirement);
    setFormError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType?.toLowerCase() || mimeFromFilename(asset.name);
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)) {
        setFormError('Choose a PDF, JPG, or PNG file.');
        return;
      }
      if (asset.size !== undefined &&
          (!Number.isInteger(asset.size) || asset.size <= 0 || asset.size > maxFileSize)) {
        setFormError('Each file must be smaller than 2 MB.');
        return;
      }
      const selectedData = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const data = selectedData.includes(',')
        ? selectedData.slice(selectedData.indexOf(',') + 1)
        : selectedData;
      const size = Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
      const existingSize = Object.values(documents)
        .filter((document) => document.requirement !== requirement)
        .reduce((total, document) => total + document.size, 0);
      if (size <= 0 || size > maxFileSize || (asset.size !== undefined && asset.size !== size) ||
          existingSize + size > maxTotalSize) {
        setFormError('Files must be 2 MB or smaller each and 5 MB or smaller altogether.');
        return;
      }
      setDocuments((current) => ({
        ...current,
        [requirement]: {
          requirement,
          filename: asset.name,
          mimeType,
          size,
          data,
        },
      }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The document could not be selected.');
    } finally {
      setPickingRequirement('');
    }
  };

  const submit = async (draft: boolean) => {
    setFormError('');
    if (!fullName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        motivation.trim().length < 10 || !consent) {
      setFormError('Complete your name, valid email, motivation (at least 10 characters), and privacy confirmation.');
      return;
    }
    if (requiredDocuments.some((requirement) => !documents[requirement])) {
      setFormError('Upload a file for every required document before continuing.');
      return;
    }
    await onSubmit(draft, {
      applicationData: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        motivation: motivation.trim(),
        consent: true,
      },
      documents: requiredDocuments.map((requirement) => documents[requirement]),
    });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Application form</Text>
      <Text style={styles.helper}>Complete these details for this application. Your email must match your signed-in account.</Text>
      <TextInput
        accessibilityLabel="Applicant full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        maxLength={160}
        autoComplete="name"
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Application email"
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        maxLength={160}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Application phone number"
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number (optional)"
        maxLength={30}
        keyboardType="phone-pad"
        autoComplete="tel"
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Application motivation"
        value={motivation}
        onChangeText={setMotivation}
        placeholder="Why are you applying? (10–1,000 characters)"
        maxLength={1000}
        multiline
        textAlignVertical="top"
        style={[styles.input, styles.multiline]}
      />

      <Text style={styles.title}>Required documents</Text>
      {requiredDocuments.length ? requiredDocuments.map((requirement) => (
        <View key={requirement} style={styles.documentRow}>
          <View style={styles.documentText}>
            <Text style={styles.requirement}>{requirement}</Text>
            {documents[requirement] ? (
              <Text style={styles.filename}>{documents[requirement].filename}</Text>
            ) : <Text style={styles.filename}>No file selected</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy || Boolean(pickingRequirement)}
            onPress={() => void selectDocument(requirement)}
            style={[styles.pickButton, (busy || Boolean(pickingRequirement)) && styles.disabled]}
          >
            {pickingRequirement === requirement
              ? <ActivityIndicator size="small" color={palette.primary} />
              : <Text style={styles.pickText}>{documents[requirement] ? 'Replace' : 'Choose file'}</Text>}
          </Pressable>
        </View>
      )) : (
        <Text style={styles.helper}>No documents are required for this listing.</Text>
      )}
      <Text style={styles.privacy}>
        PDF, JPG, or PNG only; maximum 2 MB per file and 5 MB total. Files are stored with your application and made available only to you and authorized reviewers. Do not upload identity, passport, bank, health, or biometric documents.
      </Text>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((current) => !current)}
        style={styles.consent}
      >
        <Ionicons
          name={consent ? 'checkbox' : 'square-outline'}
          size={20}
          color={consent ? palette.primary : palette.muted}
        />
        <Text style={styles.consentText}>
          I confirm these details are accurate and consent to sharing this application and its files with {reviewerNotice}.
        </Text>
      </Pressable>
      {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <View style={styles.actions}>
        {allowDraft ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || Boolean(pickingRequirement)}
            onPress={() => void submit(true)}
            style={[styles.draftButton, (busy || Boolean(pickingRequirement)) && styles.disabled]}
          >
            <Text style={styles.draftText}>Save draft</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy || Boolean(pickingRequirement)}
          onPress={() => void submit(false)}
          style={[styles.submitButton, (busy || Boolean(pickingRequirement)) && styles.disabled]}
        >
          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitText}>Submit application</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function mimeFromFilename(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  return '';
}

const styles = StyleSheet.create({
  form: { backgroundColor: palette.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
  title: { color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.xs, marginTop: spacing.sm },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.text,
    marginTop: spacing.sm,
  },
  multiline: { minHeight: 96 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  documentText: { flex: 1 },
  requirement: { color: palette.text, fontSize: 13, fontWeight: '700' },
  filename: { color: palette.muted, fontSize: 11, marginTop: 3 },
  pickButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md },
  pickText: { color: palette.primaryDark, fontSize: 12, fontWeight: '700' },
  privacy: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.md },
  consentText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18 },
  error: { color: palette.danger, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  draftButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.md },
  draftText: { color: palette.primary, fontWeight: '700', fontSize: 12 },
  submitButton: { flex: 1.4, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.md },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  disabled: { opacity: 0.6 },
});
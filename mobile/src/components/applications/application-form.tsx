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
    answers: (string | string[])[];
    additionalInformation: Record<string, string>;
  };
  documents: ApplicationDocumentUpload[];
};

type CustomQuestion = {
  title: string;
  type: string;
  required: boolean;
  description: string;
  options: string[];
};

const maxFileSize = 2 * 1024 * 1024;
const maxTotalSize = 5 * 1024 * 1024;

export function ApplicationForm({
  initialName,
  initialEmail,
  initialPhone,
  requiredDocuments,
  customQuestions = [],
  requiredApplicantInformation = [],
  applicationTermsAndConditions = '',
  busy,
  allowDraft = true,
  reviewerNotice = 'authorized platform reviewers',
  onSubmit,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone?: string;
  requiredDocuments: string[];
  customQuestions?: CustomQuestion[];
  requiredApplicantInformation?: string[];
  applicationTermsAndConditions?: string;
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
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [additionalInformation, setAdditionalInformation] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState('');
  const [pickingRequirement, setPickingRequirement] = useState('');
  const hasAdditionalInformation = requiredApplicantInformation.some((field) =>
    !['Personal information', 'Contact information', 'Motivation statement'].includes(field)
  );
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const requiredInformationComplete = requiredApplicantInformation
    .filter((field) => !['Personal information', 'Contact information', 'Motivation statement'].includes(field))
    .every((field) => Boolean(additionalInformation[field]?.trim()));
  const requiredQuestionsComplete = customQuestions.every((question, index) => {
    if (!question.required) return true;
    const answer = answers[index];
    return Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim());
  });
  const requiredDocumentsComplete = requiredDocuments.every((requirement) => Boolean(documents[requirement]));
  const completionSteps = [
    Boolean(fullName.trim()) && validEmail,
    motivation.trim().length >= 10,
    requiredInformationComplete && requiredQuestionsComplete,
    requiredDocumentsComplete,
    consent,
  ];
  const completedSteps = completionSteps.filter(Boolean).length;
  const totalUploadSize = Object.values(documents).reduce((total, document) => total + document.size, 0);

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
    const errors: string[] = [];
    if (!fullName.trim()) errors.push('Enter your full name.');
    if (!email.trim() || !validEmail) errors.push('Enter a valid email address.');
    if (motivation.trim().length < 10) errors.push('Write a motivation of at least 10 characters.');
    if (!consent) errors.push('Confirm the accuracy and sharing consent to continue.');
    if (requiredDocuments.some((requirement) => !documents[requirement])) {
      errors.push('Upload a file for every required document.');
    }
    if (!requiredQuestionsComplete) errors.push('Answer each required opportunity question.');
    if (!requiredInformationComplete) errors.push('Complete each additional required information field.');
    if (errors.length) {
      setFormError(errors.join('\n'));
      return;
    }
    await onSubmit(draft, {
      applicationData: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        motivation: motivation.trim(),
        consent: true,
        answers: customQuestions.map((question, index) =>
          answers[index] ?? (question.type === 'Checkboxes' ? [] : '')
        ),
        additionalInformation: Object.fromEntries(requiredApplicantInformation
          .filter((field) => !['Personal information', 'Contact information', 'Motivation statement'].includes(field))
          .map((field) => [field, additionalInformation[field]?.trim() || ''])),
      },
      documents: requiredDocuments.map((requirement) => documents[requirement]),
    });
  };

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <View style={styles.formHeaderIcon}>
          <Ionicons name="document-text-outline" size={22} color={palette.primary} />
        </View>
        <View style={styles.formHeaderCopy}>
          <Text style={styles.formTitle}>Application form</Text>
          <Text style={styles.helper}>Complete the details below to submit your application. Your email must match your signed-in account.</Text>
        </View>
      </View>
      <View style={styles.progressCard}>
        <View style={styles.progressHeading}>
          <Text style={styles.progressTitle}>Application checklist</Text>
          <Text style={styles.progressCount}>{completedSteps} of {completionSteps.length} complete</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Application completion"
          accessibilityValue={{ min: 0, max: completionSteps.length, now: completedSteps }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${(completedSteps / completionSteps.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressHint}>Required sections are marked with <Text style={styles.required}>*</Text>.</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <SectionStatus number="1" complete={completionSteps[0]} />
          <Text style={styles.title}>Your details</Text>
        </View>
        <Text style={styles.fieldLabel}>Full name <Text style={styles.required}>*</Text></Text>
        <TextInput
          accessibilityLabel="Applicant full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          maxLength={160}
          autoComplete="name"
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Email address <Text style={styles.required}>*</Text></Text>
        <TextInput
          accessibilityLabel="Application email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.co.za"
          maxLength={160}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Phone number <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          accessibilityLabel="Application phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+27"
          maxLength={30}
          keyboardType="phone-pad"
          autoComplete="tel"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <SectionStatus number="2" complete={completionSteps[1]} />
          <Text style={styles.title}>Motivation</Text>
        </View>
        <Text style={styles.fieldLabel}>Why are you applying? <Text style={styles.required}>*</Text></Text>
        <Text style={styles.helper}>Tell us why this opportunity is right for you (10–1,000 characters).</Text>
        <TextInput
          accessibilityLabel="Application motivation"
          value={motivation}
          onChangeText={setMotivation}
          placeholder="Write your motivation"
          maxLength={1000}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.multiline]}
        />
        <Text style={styles.characterCount}>{motivation.length}/1,000 characters</Text>
      </View>

      {hasAdditionalInformation ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <SectionStatus number="3" complete={completionSteps[2]} />
            <Text style={styles.title}>Additional information</Text>
          </View>
          <Text style={styles.helper}>Please complete the following opportunity-specific fields.</Text>
          {requiredApplicantInformation
            .filter((field) => !['Personal information', 'Contact information', 'Motivation statement'].includes(field))
            .map((field) => (
              <View key={field}>
                <Text style={styles.fieldLabel}>{field} <Text style={styles.required}>*</Text></Text>
                <TextInput
                  accessibilityLabel={field}
                  value={additionalInformation[field] || ''}
                  onChangeText={(value) => setAdditionalInformation((current) => ({ ...current, [field]: value }))}
                  placeholder={`Enter ${field.toLowerCase()}`}
                  maxLength={2000}
                  multiline={['Project proposal', 'Funding budget', 'Agricultural experience'].includes(field)}
                  textAlignVertical="top"
                  style={[styles.input, ['Project proposal', 'Funding budget', 'Agricultural experience'].includes(field) && styles.multiline]}
                />
              </View>
            ))}
        </View>
      ) : null}

      {customQuestions.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <SectionStatus number={hasAdditionalInformation ? '4' : '3'} complete={requiredQuestionsComplete} />
            <Text style={styles.title}>Opportunity questions</Text>
          </View>
          <Text style={styles.helper}>Questions marked with * must be answered.</Text>
          {customQuestions.map((question, index) => {
            const answer = answers[index];
            const selectedOptions = Array.isArray(answer) ? answer : [];
            return (
              <View key={`${question.title}-${index}`} style={styles.question}>
                <Text style={styles.requirement}>{question.title}{question.required ? ' *' : ''}</Text>
                {question.description ? <Text style={styles.helper}>{question.description}</Text> : null}
                {['Dropdown', 'Multiple Choice', 'Checkboxes'].includes(question.type) ? (
                  <View style={styles.questionOptions}>
                    {question.options.map((option) => {
                      const selected = question.type === 'Checkboxes'
                        ? selectedOptions.includes(option)
                        : answer === option;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole={question.type === 'Checkboxes' ? 'checkbox' : 'radio'}
                          accessibilityState={{ checked: selected, selected }}
                          onPress={() => setAnswers((current) => ({
                            ...current,
                            [index]: question.type === 'Checkboxes'
                              ? selectedOptions.filter((value) => value !== option).concat(selected ? [] : [option])
                              : selected ? '' : option,
                          }))}
                          style={[styles.option, selected && styles.optionSelected]}
                        >
                          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    accessibilityLabel={question.title}
                    value={typeof answer === 'string' ? answer : ''}
                    onChangeText={(value) => setAnswers((current) => ({ ...current, [index]: value }))}
                    placeholder={question.type === 'Date' ? 'YYYY-MM-DD' : question.title}
                    keyboardType={question.type === 'Number' ? 'decimal-pad' : 'default'}
                    maxLength={2000}
                    multiline={question.type === 'Long Text'}
                    style={[styles.input, question.type === 'Long Text' && styles.multiline]}
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {applicationTermsAndConditions ? (
        <View style={styles.termsCard}>
          <Ionicons name="information-circle-outline" size={19} color={palette.primary} />
          <View style={styles.termsCopy}>
            <Text style={styles.termsTitle}>Application terms</Text>
            <Text style={styles.helper}>{applicationTermsAndConditions}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <SectionStatus number={String(3 + Number(hasAdditionalInformation) + Number(customQuestions.length > 0))} complete={completionSteps[3]} />
          <View style={styles.sectionTitleCopy}>
            <Text style={styles.title}>Supporting documents</Text>
            <Text style={styles.helper}>{requiredDocuments.length
              ? 'Upload each document requested for this opportunity.'
              : 'No documents are required for this application.'}</Text>
          </View>
        </View>
        {requiredDocuments.map((requirement) => (
          <View key={requirement} style={styles.documentCard}>
            <View style={styles.documentIcon}>
              <Ionicons name={documents[requirement] ? 'checkmark-circle-outline' : 'document-attach-outline'} size={21} color={documents[requirement] ? palette.success : palette.primary} />
            </View>
            <View style={styles.documentText}>
              <Text style={styles.requirement}>{requirement} <Text style={styles.required}>*</Text></Text>
              <Text numberOfLines={2} style={styles.filename}>
                {documents[requirement]
                  ? `${documents[requirement].filename} · ${formatFileSize(documents[requirement].size)}`
                  : 'PDF, JPG or PNG · 2 MB maximum'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy || Boolean(pickingRequirement)}
              onPress={() => void selectDocument(requirement)}
              style={[styles.pickButton, (busy || Boolean(pickingRequirement)) && styles.disabled]}
            >
              {pickingRequirement === requirement
                ? <ActivityIndicator size="small" color={palette.primary} />
                : <Text style={styles.pickText}>{documents[requirement] ? 'Replace' : 'Upload'}</Text>}
            </Pressable>
            {documents[requirement] ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${requirement}`}
                disabled={busy || Boolean(pickingRequirement)}
                onPress={() => setDocuments((current) => {
                  const next = { ...current };
                  delete next[requirement];
                  return next;
                })}
                style={styles.removeFileButton}
              >
                <Ionicons name="close-circle-outline" size={20} color={palette.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {requiredDocuments.length ? (
          <Text style={styles.uploadSummary}>Uploaded {formatFileSize(totalUploadSize)} of 5 MB total</Text>
        ) : null}
        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed-outline" size={17} color={palette.primaryDark} />
          <Text style={styles.privacy}>
            PDF, JPG, or PNG. Maximum 2 MB per file and 5 MB total. Files are shared only with you and {reviewerNotice}. Do not upload identity, passport, bank, health, or biometric documents.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((current) => !current)}
        style={styles.consent}
      >
        <View style={[styles.checkbox, consent && styles.checkboxSelected]}>
          {consent ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
        <Text style={styles.consentText}>
          I confirm these details are accurate and consent to sharing my application and its files with {reviewerNotice}. <Text style={styles.required}>*</Text>
        </Text>
      </Pressable>
      {formError ? (
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={19} color={palette.danger} />
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>Please check the following</Text>
            <Text style={styles.error}>{formError}</Text>
          </View>
        </View>
      ) : null}
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

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(0)} KB`;
}

function SectionStatus({ number, complete }: { number: string; complete: boolean }) {
  return (
    <View style={[styles.sectionNumber, complete && styles.sectionNumberComplete]}>
      {complete
        ? <Ionicons name="checkmark" size={14} color={palette.primaryDark} />
        : <Text style={styles.sectionNumberText}>{number}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: palette.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: palette.border },
  formHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border },
  formHeaderIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F3EB' },
  formHeaderCopy: { flex: 1 },
  formTitle: { color: palette.text, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  progressCard: { marginTop: spacing.md, padding: spacing.md, backgroundColor: palette.surfaceAlt, borderRadius: radius.md },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  progressTitle: { color: palette.text, fontSize: 12, fontWeight: '800' },
  progressCount: { color: palette.primaryDark, fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 7, overflow: 'hidden', backgroundColor: palette.border, borderRadius: 4, marginTop: spacing.sm },
  progressFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 4 },
  progressHint: { color: palette.muted, fontSize: 11, marginTop: spacing.xs },
  title: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  section: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionNumber: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F3EB' },
  sectionNumberComplete: { backgroundColor: '#CDE8D6' },
  sectionNumberText: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  sectionTitleCopy: { flex: 1 },
  fieldLabel: { color: palette.text, fontSize: 12, fontWeight: '700', marginTop: spacing.sm },
  required: { color: palette.danger, fontWeight: '800' },
  optional: { color: palette.muted, fontSize: 11, fontWeight: '400' },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.text,
    marginTop: spacing.xs,
    fontSize: 14,
  },
  multiline: { minHeight: 120 },
  characterCount: { color: palette.muted, fontSize: 11, textAlign: 'right', marginTop: spacing.xs },
  documentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.sm, marginTop: spacing.sm },
  documentIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  documentText: { flex: 1 },
  question: { gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.border },
  questionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  optionSelected: { borderColor: palette.primary, backgroundColor: '#E6F3EB' },
  optionText: { color: palette.text, fontSize: 12, fontWeight: '600' },
  optionTextSelected: { color: palette.primaryDark },
  requirement: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  filename: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  pickButton: { minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.surface, borderRadius: radius.md },
  pickText: { color: palette.primaryDark, fontSize: 12, fontWeight: '700' },
  removeFileButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  uploadSummary: { color: palette.primaryDark, fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: spacing.sm },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: '#F1F6F2', padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.md },
  privacy: { flex: 1, color: palette.muted, fontSize: 11, lineHeight: 16 },
  termsCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: '#F1F6F2', padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  termsCopy: { flex: 1 },
  termsTitle: { color: palette.text, fontSize: 12, fontWeight: '800' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, marginTop: spacing.md, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: palette.muted, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  checkboxSelected: { borderColor: palette.primary, backgroundColor: palette.primary },
  consentText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm, backgroundColor: '#F8E8E6', borderRadius: radius.md },
  errorCopy: { flex: 1 },
  errorTitle: { color: palette.danger, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  error: { color: palette.danger, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'column-reverse', gap: spacing.sm, marginTop: spacing.md },
  draftButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.md, backgroundColor: palette.surface },
  draftText: { color: palette.primary, fontWeight: '700', fontSize: 12 },
  submitButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: palette.primary, borderRadius: radius.md },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  disabled: { opacity: 0.6 },
});
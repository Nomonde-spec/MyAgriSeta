import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Service = {
  id: string;
};

type DirectoryService = {
  id: string;
  title: string;
  description: string;
  category: Exclude<ServiceFilter, 'All services'>;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  sourceId: string;
  status: string;
  searchTerms: string;
  destination:
    | { type: 'learning'; section?: string }
    | { type: 'farmer-funding' }
    | { type: 'opportunities'; category?: string; workspace?: 'review' | 'published' }
    | { type: 'employer-workspace'; workspace: 'manage' | 'applicants' | 'passports' | 'funding' }
    | { type: 'service'; id: string }
    | { type: 'passport' }
    | { type: 'workforce' }
    | { type: 'notifications' }
    | { type: 'market' }
    | { type: 'mentors' }
    | { type: 'applications' }
    | { type: 'profile' }
    | { type: 'provider-tools' }
    | { type: 'admin'; section?: 'accounts' | 'roles' | 'announcements' | 'agricultural-information' | 'permissions' }
    | { type: 'review' }
    | { type: 'audit'; section?: 'reports' | 'activity' }
    | { type: 'notice'; title: string; message: string };
};

const serviceFilters = ['All services', 'Learning', 'Funding', 'Work'] as const;
const learnerServiceFilters = ['All services', 'Learning', 'Funding & study', 'Work', 'My records', 'Updates'] as const;
const staffServiceFilters = ['All services', 'Application reviews', 'Documents & checks', 'Submissions', 'Tasks & records'] as const;
const sdfServiceFilters = ['All services', 'Workforce planning', 'Programmes', 'Resources', 'Updates'] as const;
const farmerServiceFilters = ['All services', 'Advice & resources', 'Skills & records', 'Markets', 'Mentorship', 'Funding & support', 'Updates'] as const;
const employerServiceFilters = ['All services', 'Employer profile', 'Jobs & placements', 'Recruitment', 'Funding & support', 'Updates'] as const;
const providerServiceFilters = ['All services', 'Provider profile', 'Programmes', 'Supporting documents', 'Funding & support', 'Updates'] as const;
const adminServiceFilters = ['All services', 'Accounts & roles', 'Opportunity review', 'Learning', 'Platform content', 'Reports & security'] as const;
type ServiceFilter =
  | typeof serviceFilters[number]
  | typeof learnerServiceFilters[number]
  | typeof staffServiceFilters[number]
  | typeof sdfServiceFilters[number]
  | typeof farmerServiceFilters[number]
  | typeof employerServiceFilters[number]
  | typeof providerServiceFilters[number]
  | typeof adminServiceFilters[number];

const staffDirectoryServices: DirectoryService[] = [
  {
    id: 'staff-review-queue',
    title: 'Application Review Queue',
    description: 'Review applications available to internal staff and track their current review status.',
    category: 'Application reviews',
    icon: 'clipboard-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-review',
    status: 'Staff access is role-protected; individual task assignment is not configured',
    searchTerms: 'assigned review queue applications tasks submissions',
    destination: { type: 'review' },
  },
  {
    id: 'staff-documents',
    title: 'Supporting Documents & Completeness',
    description: 'Inspect submitted supporting documents and check the information included with applications.',
    category: 'Documents & checks',
    icon: 'document-attach-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-review',
    status: 'Document access is limited to items in the staff review queue',
    searchTerms: 'documents evidence information completeness verify check',
    destination: { type: 'review' },
  },
  {
    id: 'staff-review-feedback',
    title: 'Review Feedback & Information Requests',
    description: 'Record review feedback and request additional information when needed.',
    category: 'Application reviews',
    icon: 'chatbox-ellipses-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-review',
    status: 'Feedback is visible to the applicant; private reviewer notes are not supported',
    searchTerms: 'review comments recommendations request additional information',
    destination: { type: 'review' },
  },
  {
    id: 'staff-opportunity-review',
    title: 'Opportunity & Programme Submissions',
    description: 'Opportunity and programme submissions are reviewed in the administrator workspace.',
    category: 'Submissions',
    icon: 'school-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-review',
    status: 'Internal staff submission-review access is not currently enabled',
    searchTerms: 'opportunity programme submission review forward administrator',
    destination: {
      type: 'notice',
      title: 'Submission review access',
      message: 'Opportunity and programme submission review and forwarding are not enabled for internal staff in this workspace. Contact an administrator for access.',
    },
  },
  {
    id: 'staff-review-tasks',
    title: 'Review Status & Tasks',
    description: 'Return to the staff review queue to check current application status and outstanding items.',
    category: 'Tasks & records',
    icon: 'time-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-review',
    status: 'The application queue is available; separate task assignment and tracking are not configured',
    searchTerms: 'review task assignment track status outstanding',
    destination: { type: 'review' },
  },
  {
    id: 'staff-permission-records',
    title: 'Permission-Scoped Records',
    description: 'Access application and applicant details exposed to the internal-staff review role.',
    category: 'Tasks & records',
    icon: 'shield-checkmark-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-review',
    status: 'Server permissions restrict access to authorised staff and administrators',
    searchTerms: 'records permissions access applicant review',
    destination: { type: 'review' },
  },
];

const learnerDirectoryServices: DirectoryService[] = [
  {
    id: 'learner-learning',
    title: 'Agricultural Learning & Study Materials',
    description: 'Browse agricultural courses, learning programmes, and study resources.',
    category: 'Learning',
    icon: 'book-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-learn',
    status: 'Listings may be samples · accreditation is not verified',
    searchTerms: 'courses training learning study materials resources',
    destination: { type: 'learning' },
  },
  {
    id: 'learner-bursaries',
    title: 'Bursaries',
    description: 'Search published agricultural bursary listings and check their eligibility requirements.',
    category: 'Funding & study',
    icon: 'wallet-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-opportunity',
    status: 'Listings may be samples · check each listing before applying',
    searchTerms: 'bursary bursaries study funding education application',
    destination: { type: 'opportunities', category: 'Bursary' },
  },
  {
    id: 'learner-learnerships',
    title: 'Learnerships',
    description: 'Search agricultural learnership opportunities and review application requirements.',
    category: 'Funding & study',
    icon: 'school-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-opportunity',
    status: 'Listings may be samples · availability and eligibility vary',
    searchTerms: 'learnership learnerships agricultural training opportunity',
    destination: { type: 'opportunities', category: 'Learnership' },
  },
  {
    id: 'learner-funding',
    title: 'Funding Opportunities',
    description: 'Explore eligible funding listings and apply through the available application process.',
    category: 'Funding & study',
    icon: 'cash-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-opportunity',
    status: 'In-app applications are available only for eligible published listings',
    searchTerms: 'funding grant financial support application opportunities',
    destination: { type: 'opportunities', category: 'Funding' },
  },
  {
    id: 'learner-jobs',
    title: 'Agricultural Jobs',
    description: 'Search agricultural job listings and review employer-provided application details.',
    category: 'Work',
    icon: 'briefcase-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-opportunity',
    status: 'Sample entries are not real vacancies',
    searchTerms: 'agricultural jobs employment vacancies work',
    destination: { type: 'opportunities', category: 'Employment' },
  },
  {
    id: 'learner-internships',
    title: 'Internships',
    description: 'Search agricultural internship opportunities and check the listed requirements.',
    category: 'Work',
    icon: 'search-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-opportunity',
    status: 'Availability and eligibility vary by listing',
    searchTerms: 'internships internship workplace experience placements',
    destination: { type: 'opportunities', category: 'Internship' },
  },
  {
    id: 'learner-passport',
    title: 'AgriSkills Passport',
    description: 'View and manage your skills and credential records.',
    category: 'My records',
    icon: 'id-card-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-passport',
    status: 'Skills may be self-reported · no trusted issuer is connected',
    searchTerms: 'AgriSkills passport skills credentials qualifications',
    destination: { type: 'passport' },
  },
  {
    id: 'learner-applications',
    title: 'Applications & Outcomes',
    description: 'Track submitted applications, progress, and review outcomes.',
    category: 'My records',
    icon: 'document-text-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-opportunity',
    status: 'Application status and available feedback are shown in MyAgriSETA',
    searchTerms: 'applications progress status outcomes submitted',
    destination: { type: 'applications' },
  },
  {
    id: 'learner-notifications',
    title: 'Opportunity & Application Notifications',
    description: 'Review in-app notices about opportunities and application updates.',
    category: 'Updates',
    icon: 'notifications-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-intel',
    status: 'In-app notifications',
    searchTerms: 'notifications new opportunities applications updates',
    destination: { type: 'notifications' },
  },
];

const directoryServices: DirectoryService[] = [
  {
    id: 'learning-programmes',
    title: 'Learning Programmes',
    description: 'Browse agricultural learning and course listings.',
    category: 'Learning',
    icon: 'book-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-learn',
    status: 'Demo listings · accreditation not verified',
    searchTerms: 'courses training accredited',
    destination: { type: 'learning' },
  },
  {
    id: 'bursaries-funding',
    title: 'Bursaries & Funding',
    description: 'Search agricultural funding listings and track an application within the app.',
    category: 'Funding',
    icon: 'wallet-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-2',
    status: 'Sample listings · in-app tracking only',
    searchTerms: 'bursary funding learnership',
    destination: { type: 'opportunities', category: 'Funding' },
  },
  {
    id: 'workplace-experience',
    title: 'Workplace Experience',
    description: 'Explore work placement and internship opportunities.',
    category: 'Work',
    icon: 'briefcase-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-opportunity',
    status: 'Browse published listings · availability varies',
    searchTerms: 'internship placement workplace experience',
    destination: { type: 'opportunities', category: 'Employment' },
  },
  {
    id: 'agrijobs',
    title: 'AgriJobs',
    description: 'Explore sample and published agricultural job opportunities.',
    category: 'Work',
    icon: 'search-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-opportunity',
    status: 'Sample entries are not real vacancies',
    searchTerms: 'jobs employment work',
    destination: { type: 'opportunities', category: 'Employment' },
  },
  {
    id: 'provider-directory',
    title: 'Provider Directory',
    description: 'Browse training-provider records and programme listings.',
    category: 'Learning',
    icon: 'business-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-provider',
    status: 'Demo records · providers are not verified',
    searchTerms: 'provider directory accredited training',
    destination: { type: 'learning', section: 'Providers' },
  },
  {
    id: 'career-pathways',
    title: 'Career Pathways',
    description: 'Explore career and mentorship information for agriculture.',
    category: 'Learning',
    icon: 'map-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-mentor',
    status: 'Prototype information · no mentor matching',
    searchTerms: 'career pathway mentor guidance',
    destination: { type: 'service', id: 'svc-mentor' },
  },
  {
    id: 'skills-passport',
    title: 'Skills Passport',
    description: 'View and manage your self-reported skills and credential records.',
    category: 'Learning',
    icon: 'id-card-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-passport',
    status: 'Self-reported skills · no trusted issuer connected',
    searchTerms: 'skills credentials qualification passport',
    destination: { type: 'passport' },
  },
  {
    id: 'grant-applications',
    title: 'Grant Applications',
    description: 'Browse grant-related listings and funding information.',
    category: 'Funding',
    icon: 'document-text-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-2',
    status: 'No grant application service is connected',
    searchTerms: 'grant application discretionary funding',
    destination: { type: 'opportunities', category: 'Grants' },
  },
  {
    id: 'employer-services',
    title: 'Employer Services',
    description: 'Explore workforce-development information for employers.',
    category: 'Work',
    icon: 'people-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-employer',
    status: 'Prototype information · employer systems not connected',
    searchTerms: 'employer workforce services',
    destination: {
      type: 'notice',
      title: 'Skills Planning',
      message: 'WSP and ATR submission is not connected in this prototype.',
    },
  },
  {
    id: 'skills-planning',
    title: 'Skills Planning',
    description: 'Explore skills-planning information for agricultural workplaces.',
    category: 'Work',
    icon: 'bar-chart-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-employer',
    status: 'Prototype · WSP/ATR submission is not connected',
    searchTerms: 'skills planning WSP ATR',
    destination: { type: 'service', id: 'svc-employer' },
  },
  {
    id: 'support-centre',
    title: 'Support Centre',
    description: 'Get account-help information and platform guidance.',
    category: 'Work',
    icon: 'heart-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-intel',
    status: 'Prototype · support contact channel not connected',
    searchTerms: 'support help contact assistance',
    destination: {
      type: 'notice',
      title: 'Support Centre',
      message: 'A support contact channel is not connected in this prototype. Please contact your platform administrator for account help.',
    },
  },
];

const sdfDirectoryServices: DirectoryService[] = [
  {
    id: 'sdf-workforce-planning',
    title: 'Workforce Skills Planning',
    description: 'Assess employee skills gaps, manage WSP and ATR records, track training, and prepare reports.',
    category: 'Workforce planning',
    icon: 'people-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-employer',
    status: 'Organisation workspace · external WSP/ATR submission is not connected',
    searchTerms: 'workforce skills assessment needs gaps WSP ATR training progress report',
    destination: { type: 'workforce' },
  },
  {
    id: 'sdf-programmes',
    title: 'Programme Submissions',
    description: 'Submit skills development programmes and opportunities, then track approval outcomes.',
    category: 'Programmes',
    icon: 'document-text-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-opportunity',
    status: 'Submission and approval status tracked in MyAgriSETA',
    searchTerms: 'training programmes skills development opportunities submissions approval',
    destination: { type: 'employer-workspace', workspace: 'manage' },
  },
  {
    id: 'sdf-resources',
    title: 'Skills Development Resources',
    description: 'Access learning resources and training programme information for workforce planning.',
    category: 'Resources',
    icon: 'book-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-learn',
    status: 'Learning resources and listings · availability varies',
    searchTerms: 'skills development learning training resources',
    destination: { type: 'learning' },
  },
  {
    id: 'sdf-notifications',
    title: 'Submission Notifications',
    description: 'Review in-app updates about programme submissions and approval outcomes.',
    category: 'Updates',
    icon: 'notifications-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-intel',
    status: 'In-app notifications',
    searchTerms: 'notifications submissions approvals updates',
    destination: { type: 'notifications' },
  },
];

const farmerDirectoryServices: DirectoryService[] = [
  {
    id: 'farmer-advice',
    title: 'Agricultural Advice & Resources',
    description: 'Open practical farming guides and source-checked agricultural information.',
    category: 'Advice & resources',
    icon: 'book-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-learn',
    status: 'In-app resources · external sources are identified',
    searchTerms: 'farming advice crop farm water agriculture resources',
    destination: { type: 'learning', section: 'Resources' },
  },
  {
    id: 'farmer-advisor-ai',
    title: 'AgriAdvisor AI',
    description: 'AI agricultural guidance is not available in this prototype.',
    category: 'Advice & resources',
    icon: 'sparkles-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-intel',
    status: 'Planned · approved AI provider and safeguards are not configured',
    searchTerms: 'AI advisor agridadvisor artificial intelligence farming guidance',
    destination: {
      type: 'notice',
      title: 'AgriAdvisor AI is not available',
      message: 'An approved AI provider and agricultural safety safeguards have not been configured. Use the source-labelled farming resources instead.',
    },
  },
  {
    id: 'farmer-market',
    title: 'Agricultural Markets & Prices',
    description: 'Search current market information with its source, check date, and expiry.',
    category: 'Markets',
    icon: 'trending-up-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-market',
    status: 'Only source-checked, current records are shown',
    searchTerms: 'market prices commodities agricultural produce',
    destination: { type: 'market' },
  },
  {
    id: 'farmer-mentorship',
    title: 'AgriMentor',
    description: 'Browse verified mentor profiles, request an introduction, and track its status.',
    category: 'Mentorship',
    icon: 'people-circle-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-mentor',
    status: 'Requests reviewed by authorised staff',
    searchTerms: 'mentor mentorship introduction request status',
    destination: { type: 'mentors' },
  },
  {
    id: 'farmer-funding',
    title: 'Agricultural Funding & Grants',
    description: 'Find eligible funding opportunities and track in-app applications.',
    category: 'Funding & support',
    icon: 'wallet-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-2',
    status: 'Check each listing for eligibility and application terms',
    searchTerms: 'funding grants finance application',
    destination: { type: 'farmer-funding' },
  },
  {
    id: 'farmer-smme',
    title: 'AgriSMME Business Support',
    description: 'Explore agricultural business development and small-enterprise support listings.',
    category: 'Funding & support',
    icon: 'business-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-intel',
    status: 'Support listings · external provider integration is not connected',
    searchTerms: 'AgriSMME small business development support enterprise',
    destination: { type: 'opportunities', category: 'Business Support' },
  },
  {
    id: 'farmer-applications',
    title: 'Applications & Mentor Requests',
    description: 'Track submitted funding applications and review mentorship requests.',
    category: 'Mentorship',
    icon: 'document-text-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-opportunity',
    status: 'Application status is shown in MyAgriSETA',
    searchTerms: 'track application funding mentorship request status',
    destination: { type: 'applications' },
  },
  {
    id: 'farmer-notifications',
    title: 'Farming Announcements & Notifications',
    description: 'Review relevant announcements, application updates, and farming notifications.',
    category: 'Updates',
    icon: 'notifications-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-intel',
    status: 'In-app notifications',
    searchTerms: 'announcements farming notification updates',
    destination: { type: 'notifications' },
  },
  {
    id: 'farmer-passport',
    title: 'AgriSkills Passport',
    description: 'Record agricultural skills, training, qualifications, and practical experience.',
    category: 'Skills & records',
    icon: 'id-card-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-passport',
    status: 'Self-reported records · independent verification is not connected',
    searchTerms: 'skills passport farming experience training qualifications certificates',
    destination: { type: 'passport' },
  },
];

const employerDirectoryServices: DirectoryService[] = [
  {
    id: 'employer-profile',
    title: 'Employer Profile',
    description: 'Manage your organisation details and employer contact information.',
    category: 'Employer profile',
    icon: 'business-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-employer',
    status: 'Update your account profile',
    searchTerms: 'employer organisation business profile details',
    destination: { type: 'profile' },
  },
  {
    id: 'employer-opportunities',
    title: 'Jobs, Internships & Workplace Opportunities',
    description: 'Submit and manage vacancies, internships, and workplace opportunities.',
    category: 'Jobs & placements',
    icon: 'briefcase-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-opportunity',
    status: 'Submissions and approval outcomes tracked in MyAgriSETA',
    searchTerms: 'job vacancy employment internship workplace opportunity submit publish',
    destination: { type: 'employer-workspace', workspace: 'manage' },
  },
  {
    id: 'employer-recruitment',
    title: 'Applications & Recruitment',
    description: 'Review applicants for your own opportunities and update recruitment outcomes.',
    category: 'Recruitment',
    icon: 'people-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-employer',
    status: 'Access limited to applications for your own published opportunities',
    searchTerms: 'applications applicants candidates recruitment shortlist hire outcome',
    destination: { type: 'employer-workspace', workspace: 'applicants' },
  },
  {
    id: 'employer-passports',
    title: 'Applicant Skills Passports',
    description: 'Review skills and recorded credentials for applicants to your own opportunities.',
    category: 'Recruitment',
    icon: 'id-card-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-employer',
    status: 'Access is limited to applications for your own opportunities and is recorded',
    searchTerms: 'applicant passport skills qualifications credentials recruitment',
    destination: { type: 'employer-workspace', workspace: 'passports' },
  },
  {
    id: 'employer-funding',
    title: 'Employer Funding & Development Support',
    description: 'Access employer funding information and eligible support opportunities.',
    category: 'Funding & support',
    icon: 'wallet-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-employer',
    status: 'Official funding information; applications are handled by the funder',
    searchTerms: 'funding employer development grants support AgriSETA',
    destination: { type: 'employer-workspace', workspace: 'funding' },
  },
  {
    id: 'employer-notifications',
    title: 'Application & Approval Notifications',
    description: 'Review updates about applicants, opportunity submissions, and approval outcomes.',
    category: 'Updates',
    icon: 'notifications-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-intel',
    status: 'In-app notifications',
    searchTerms: 'application approval notification recruitment update',
    destination: { type: 'notifications' },
  },
];

const providerDirectoryServices: DirectoryService[] = [
  {
    id: 'provider-profile',
    title: 'Training Provider Profile',
    description: 'Manage your provider details and submit profile updates for administrator review.',
    category: 'Provider profile',
    icon: 'business-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-provider',
    status: 'Profile changes require administrator review',
    searchTerms: 'training provider profile organisation location description',
    destination: { type: 'provider-tools' },
  },
  {
    id: 'provider-programmes',
    title: 'Courses & Skills Programmes',
    description: 'Submit courses, learnerships, skills development programmes, and training services.',
    category: 'Programmes',
    icon: 'school-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-provider',
    status: 'Listings are visible after administrator review and approval',
    searchTerms: 'course training learnership skills development programme training service partnership',
    destination: { type: 'opportunities' },
  },
  {
    id: 'provider-documents',
    title: 'Accreditation & Supporting Documents',
    description: 'Attach accreditation evidence and supporting documents to programme submissions.',
    category: 'Supporting documents',
    icon: 'document-attach-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-provider',
    status: 'Attachments are available to authorised administrators for review',
    searchTerms: 'accreditation evidence supporting documents upload PDF JPG PNG',
    destination: { type: 'opportunities' },
  },
  {
    id: 'provider-funding',
    title: 'Training Funding Opportunities',
    description: 'Submit eligible training-related funding opportunities for administrator review.',
    category: 'Funding & support',
    icon: 'wallet-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-provider',
    status: 'Provider submissions require administrator approval',
    searchTerms: 'funding training grant skills programme',
    destination: { type: 'opportunities', category: 'Funding' },
  },
  {
    id: 'provider-submissions',
    title: 'Submission & Approval Tracking',
    description: 'Manage drafts, review feedback, approval decisions, and approved listings.',
    category: 'Programmes',
    icon: 'checkmark-done-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-provider',
    status: 'Review status and administrator feedback shown in your workspace',
    searchTerms: 'submission status approval approved publish manage',
    destination: { type: 'opportunities' },
  },
  {
    id: 'provider-notifications',
    title: 'Programme Notifications',
    description: 'Review notifications about programme submissions, review requests, and approvals.',
    category: 'Updates',
    icon: 'notifications-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-intel',
    status: 'In-app notifications',
    searchTerms: 'notifications submission approval updates',
    destination: { type: 'notifications' },
  },
];

const adminDirectoryServices: DirectoryService[] = [
  {
    id: 'admin-accounts',
    title: 'Account Status & User Management',
    description: 'Manage existing accounts, activate or deactivate access, and update account details.',
    category: 'Accounts & roles',
    icon: 'people-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-admin',
    status: 'Administrator-only account controls',
    searchTerms: 'users accounts activate deactivate status manage',
    destination: { type: 'admin', section: 'accounts' },
  },
  {
    id: 'admin-role-requests',
    title: 'Stakeholder Verification & Role Requests',
    description: 'Review legacy stakeholder role requests and assign authorised roles to existing accounts.',
    category: 'Accounts & roles',
    icon: 'person-add-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-admin',
    status: 'Role assignment follows server-managed permissions',
    searchTerms: 'stakeholder verification role request approval rejection',
    destination: { type: 'admin', section: 'roles' },
  },
  {
    id: 'admin-opportunity-review',
    title: 'Opportunity & Programme Review',
    description: 'Review submitted opportunities and programmes, and approve or reject submissions.',
    category: 'Opportunity review',
    icon: 'checkmark-done-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-admin',
    status: 'Review decisions and publication are managed in MyAgriSETA',
    searchTerms: 'submitted opportunities programmes approve reject review',
    destination: { type: 'opportunities', workspace: 'review' },
  },
  {
    id: 'admin-published-opportunities',
    title: 'Published Opportunities',
    description: 'Manage approved opportunity listings and their publication status.',
    category: 'Opportunity review',
    icon: 'briefcase-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-admin',
    status: 'Administrator opportunity workspace',
    searchTerms: 'published opportunities listings manage status',
    destination: { type: 'opportunities', workspace: 'published' },
  },
  {
    id: 'admin-learning',
    title: 'Learning Programmes & Course Materials',
    description: 'Create and manage learning programmes, publish course materials, and enrol existing users.',
    category: 'Learning',
    icon: 'school-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-admin',
    status: 'Learning administration workspace',
    searchTerms: 'learning programmes courses materials publish enrol existing users',
    destination: { type: 'learning', section: 'Learning administration' },
  },
  {
    id: 'admin-announcements',
    title: 'Announcements',
    description: 'Create and manage platform announcements for their intended audiences.',
    category: 'Platform content',
    icon: 'megaphone-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-admin',
    status: 'Administrator-managed announcements',
    searchTerms: 'announcements publish audience platform information',
    destination: { type: 'admin', section: 'announcements' },
  },
  {
    id: 'admin-agricultural-information',
    title: 'Agricultural Platform Information',
    description: 'Manage source-checked market information and agricultural mentorship directory records.',
    category: 'Platform content',
    icon: 'leaf-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-admin',
    status: 'Curated market and mentor records; other service content is not managed here',
    searchTerms: 'agricultural services platform information market prices mentor directory',
    destination: { type: 'admin', section: 'agricultural-information' },
  },
  {
    id: 'admin-applications',
    title: 'Application Review & Monitoring',
    description: 'Monitor submitted applications and update review outcomes.',
    category: 'Opportunity review',
    icon: 'clipboard-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-admin',
    status: 'Authorised application review queue',
    searchTerms: 'applications monitor submissions review status',
    destination: { type: 'review' },
  },
  {
    id: 'admin-reports-audit',
    title: 'Reports, Statistics & Audit Logs',
    description: 'View aggregate account, application, opportunity, and administrative activity reports.',
    category: 'Reports & security',
    icon: 'stats-chart-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-admin',
    status: 'Aggregate platform reports and administrator audit events',
    searchTerms: 'reports statistics audit logs administrator activities system',
    destination: { type: 'audit', section: 'reports' },
  },
  {
    id: 'admin-permissions',
    title: 'Roles, Permissions & Security',
    description: 'Review assigned role permissions and manage authorised account roles.',
    category: 'Reports & security',
    icon: 'shield-checkmark-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-admin',
    status: 'Permission rules are server-managed and are not editable in this workspace',
    searchTerms: 'permissions security roles access control settings',
    destination: { type: 'admin', section: 'permissions' },
  },
  {
    id: 'admin-platform-activity',
    title: 'Platform & User Activity',
    description: 'Review account activity and aggregate administrative events for a selected period.',
    category: 'Reports & security',
    icon: 'pulse-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-admin',
    status: 'User and administrative activity only; infrastructure performance monitoring is unavailable',
    searchTerms: 'platform performance user activity monitoring metrics',
    destination: { type: 'audit', section: 'activity' },
  },
];

export default function ServicesScreen() {
  const { session } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ServiceFilter>('All services');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const isLearner = session?.activeRole === 'learner';
  const isInternalStaff = session?.activeRole === 'internal_staff';
  const isSdf = session?.activeRole === 'sdf';
  const isFarmer = session?.activeRole === 'farmer';
  const isEmployer = session?.activeRole === 'employer';
  const isProvider = session?.activeRole === 'training_provider';
  const isAdministrator = session?.activeRole === 'administrator';

  useEffect(() => {
    let isCurrent = true;

    if (session?.activeRole === 'learner' || session?.activeRole === 'internal_staff' ||
        session?.activeRole === 'sdf' || session?.activeRole === 'farmer' ||
        session?.activeRole === 'employer' || session?.activeRole === 'training_provider' ||
        session?.activeRole === 'administrator') {
      return () => {
        isCurrent = false;
      };
    }

    apiFetch<{ services: Service[] }>('/services')
      .then((payload) => {
        if (isCurrent) {
          setServices(payload.services);
          setErrorMessage('');
        }
      })
      .catch(() => {
        if (isCurrent) {
          setErrorMessage('Services could not be loaded. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [retry, session]);

  const filtered = useMemo(
    () => {
      const availableIds = new Set(services.map((service) => service.id));
      const query = search.trim().toLowerCase();
      const role = session?.activeRole;
      const roleServices = role === 'learner'
        ? learnerDirectoryServices
        : role === 'internal_staff'
          ? staffDirectoryServices
          : role === 'sdf'
            ? sdfDirectoryServices
            : role === 'farmer'
              ? farmerDirectoryServices
              : role === 'employer'
                ? employerDirectoryServices
                : role === 'training_provider'
                  ? providerDirectoryServices
                  : role === 'administrator'
                    ? adminDirectoryServices
                    : directoryServices;
      const curatedServices = role === 'learner' || role === 'internal_staff' || role === 'sdf' || role === 'farmer' || role === 'employer' ||
        role === 'training_provider' || role === 'administrator';
      const availableServices = roleServices;
      return availableServices.filter((service) => {
        const roleCanAccess = curatedServices || availableIds.has(service.sourceId);
        const matchesSearch = !query ||
          `${service.title} ${service.description} ${service.searchTerms}`.toLowerCase().includes(query);
        const matchesFilter = activeFilter === 'All services' || service.category === activeFilter;
        return roleCanAccess && matchesSearch && matchesFilter;
      });
    },
    [activeFilter, search, services, session?.activeRole]
  );
  const filters = isLearner
    ? learnerServiceFilters
    : isInternalStaff
      ? staffServiceFilters
      : isSdf
        ? sdfServiceFilters
        : isFarmer
          ? farmerServiceFilters
          : isEmployer
            ? employerServiceFilters
            : isProvider
              ? providerServiceFilters
              : isAdministrator
                ? adminServiceFilters
                : serviceFilters;

  if (loading && !isLearner && !isInternalStaff && !isSdf && !isFarmer && !isEmployer && !isProvider && !isAdministrator) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headingBlock}>
          <Text style={styles.eyebrow}>
            {isLearner ? 'LEARNER SERVICES' : isInternalStaff ? 'INTERNAL STAFF' : isSdf ? 'SDF WORKSPACE' : isFarmer ? 'FARMER SERVICES' : isEmployer ? 'EMPLOYER SERVICES' : isProvider ? 'TRAINING PROVIDER' : isAdministrator ? 'ADMINISTRATION' : 'AGRICONNECT 360'}
          </Text>
          <Text style={styles.heading}>
            {isLearner
              ? 'Learning & opportunities'
              : isInternalStaff
                ? 'Review workspace'
                : isSdf
                    ? 'Skills development services'
                    : isFarmer
                      ? 'Agricultural services'
                      : isEmployer
                        ? 'Employer services'
                        : isProvider
                          ? 'Training provider services'
                          : isAdministrator
                            ? 'Administrator services'
                            : 'Explore services'}
          </Text>
          <Text style={styles.subheading}>
            {isLearner
              ? 'Agricultural learning, bursaries, learnerships, jobs, applications, and your skills passport.'
              : isInternalStaff
                ? 'Review applications, inspect supporting documents, record applicant-facing feedback, and track review status.'
                : isSdf
                  ? 'Organisation skills planning, programme submissions, resources, and updates.'
                  : isFarmer
                    ? 'Practical farming resources, markets, mentorship, funding, and business support.'
                    : isEmployer
                      ? 'Manage your organisation profile, opportunity submissions, recruitment, and notifications.'
                      : isProvider
                        ? 'Manage your provider profile, programme submissions, supporting documents, and approvals.'
                        : isAdministrator
                          ? 'Manage accounts, review submissions, oversee learning and platform content, and monitor reports and activity.'
                          : 'Everything you need to grow, in one place.'}
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={palette.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search services"
            placeholderTextColor="#839188"
            style={styles.search}
            accessibilityLabel="Search services"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear service search"
              onPress={() => setSearch('')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={palette.muted} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show all services"
              onPress={() => {
                setActiveFilter('All services');
                setSearch('');
              }}
              hitSlop={8}
            >
              <Ionicons name="options-outline" size={18} color={palette.primary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          style={styles.filterScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityLabel="Service categories"
        >
          {filters.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: item === activeFilter }}
              onPress={() => setActiveFilter(item)}
              style={[styles.filterChip, item === activeFilter && styles.filterChipSelected]}
            >
              <Text style={[styles.filterText, item === activeFilter && styles.filterTextSelected]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          persistentScrollbar
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={28} color={palette.danger} />
              <Text style={styles.empty}>{errorMessage}</Text>
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
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={28} color={palette.muted} />
              <Text style={styles.empty}>No services match your search.</Text>
            </View>
          ) : (
            filtered.map((service) => {
              return (
                <Pressable
                  key={service.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${service.title}. ${service.status}.`}
                  onPress={() => {
                    if (service.destination.type === 'learning') {
                      router.push({
                        pathname: '/learning',
                        params: service.destination.section
                          ? { section: service.destination.section }
                          : session?.activeRole === 'administrator'
                            ? { section: 'Learning administration' }
                            : {},
                      });
                    } else if (service.destination.type === 'farmer-funding') {
                      router.push('/farmer-funding');
                    } else if (service.destination.type === 'opportunities') {
                      router.push({
                        pathname: '/opportunities',
                        params: {
                          ...(service.destination.category ? { category: service.destination.category } : {}),
                          ...(service.destination.workspace ? { workspace: service.destination.workspace } : {}),
                        },
                      });
                    } else if (service.destination.type === 'employer-workspace') {
                      router.push({
                        pathname: '/opportunities',
                        params: { workspace: service.destination.workspace },
                      });
                    } else if (service.destination.type === 'service') {
                      router.push({ pathname: '/service', params: { id: service.destination.id } });
                    } else if (service.destination.type === 'passport') {
                      router.push('/passport');
                    } else if (service.destination.type === 'workforce') {
                      router.push('/sdf-workforce');
                    } else if (service.destination.type === 'notifications') {
                      router.push('/notifications');
                    } else if (service.destination.type === 'market') {
                      router.push('/farmer-market');
                    } else if (service.destination.type === 'mentors') {
                      router.push('/farmer-mentors');
                    } else if (service.destination.type === 'applications') {
                      router.push('/applications');
                    } else if (service.destination.type === 'profile') {
                      router.push('/profile');
                    } else if (service.destination.type === 'provider-tools') {
                      router.push({ pathname: '/learning', params: { section: 'Provider tools' } });
                    } else if (service.destination.type === 'admin') {
                      router.push({
                        pathname: '/admin',
                        params: service.destination.section ? { section: service.destination.section } : {},
                      });
                    } else if (service.destination.type === 'review') {
                      router.push('/review');
                    } else if (service.destination.type === 'audit') {
                      router.push({
                        pathname: '/audit',
                        params: service.destination.section ? { section: service.destination.section } : {},
                      });
                    } else {
                      Alert.alert(service.destination.title, service.destination.message);
                    }
                  }}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: service.background }]}>
                    <Ionicons name={service.icon} size={19} color={service.color} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{service.title}</Text>
                    <Text style={styles.cardDescription} numberOfLines={2}>{service.description}</Text>
                    <Text style={styles.status}>{service.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color="#93A198" />
                </Pressable>
              );
            })
          )}

          {!errorMessage && (
            <View style={styles.guidanceCard}>
              <View style={styles.guidanceIcon}>
                <Ionicons name={isSdf || isFarmer ? 'leaf-outline' : isEmployer || isProvider ? 'business-outline' : 'heart-outline'} size={18} color={palette.primaryDark} />
              </View>
              <View style={styles.guidanceCopy}>
                  <Text style={styles.guidanceTitle}>
                    {isSdf
                      ? 'Need to update a workforce plan?'
                      : isFarmer
                        ? 'Looking for farming services?'
                        : isEmployer
                          ? 'Need to manage your opportunities?'
                          : isProvider
                            ? 'Need to manage your provider profile?'
                            : 'Not sure where to start?'}
                  </Text>
                  <Text style={styles.guidanceText}>
                    {isSdf
                      ? 'Open your organisation’s skills planning workspace.'
                      : isFarmer
                        ? 'Browse funding, mentorship, markets, and farming resources.'
                        : isEmployer
                          ? 'Create a job, internship, or workplace opportunity and track its approval status.'
                          : isProvider
                            ? 'Open provider tools to update your profile and manage course listings.'
                            : 'Browse opportunities available to your account.'}
                  </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isSdf
                    ? 'Open workforce skills planning'
                    : isFarmer
                      ? 'Open farming resources'
                      : isEmployer
                        ? 'Manage employer opportunities'
                        : isProvider
                          ? 'Open training provider tools'
                          : 'Browse opportunities'
                }
                onPress={() => router.push(
                  isSdf
                    ? '/sdf-workforce'
                    : isFarmer
                      ? '/farmer'
                      : isEmployer
                        ? { pathname: '/opportunities', params: { workspace: 'manage' } }
                      : isProvider
                        ? { pathname: '/learning', params: { section: 'Provider tools' } }
                        : '/opportunities'
                )}
                style={styles.guidanceAction}
              >
                <Ionicons name="arrow-forward" size={19} color={palette.primaryDark} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  container: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  headingBlock: { marginBottom: spacing.md },
  eyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  heading: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: palette.text },
  subheading: { fontSize: 13, lineHeight: 19, color: palette.muted, marginTop: 4 },
  searchWrap: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5EBE7',
  },
  search: { flex: 1, paddingVertical: spacing.sm, color: palette.text, fontSize: 13 },
  filterScroll: { height: 42, flexGrow: 0, flexShrink: 0 },
  filters: { alignItems: 'center', gap: spacing.xs },
  filterChip: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E3EAE5',
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
  },
  filterChipSelected: { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark },
  filterText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  filterTextSelected: { color: '#FFFFFF' },
  list: { paddingBottom: 96 },
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E8EEEA',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.78 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1 },
  cardTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  cardDescription: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  status: { color: palette.primaryDark, fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 3 },
  emptyState: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  empty: { color: palette.muted, marginTop: spacing.sm, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  retryButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  guidanceCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF3DB',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  guidanceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceCopy: { flex: 1 },
  guidanceTitle: { color: palette.text, fontSize: 11, fontWeight: '800' },
  guidanceText: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  guidanceAction: { padding: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});

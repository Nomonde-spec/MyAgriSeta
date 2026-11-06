import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api';

type StoredDocument = {
  filename: string;
  mimeType: string;
  data: string;
};

export async function downloadApplicationDocument(
  applicationId: string,
  documentId: string,
  filename: string,
  mimeType: string
) {
  const { document } = await apiFetch<{ document: StoredDocument }>(
    `/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}`
  );
  await downloadStoredDocument(document, filename, mimeType);
}

export async function downloadOpportunityDocument(
  opportunityId: string,
  documentId: string,
  filename: string,
  mimeType: string
) {
  const { document } = await apiFetch<{ document: StoredDocument }>(
    `/admin/opportunities/${encodeURIComponent(opportunityId)}/documents/${encodeURIComponent(documentId)}`
  );
  await downloadStoredDocument(document, filename, mimeType);
}

async function downloadStoredDocument(document: StoredDocument, filename: string, mimeType: string) {
  const safeFilename = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  if (Platform.OS === 'web') {
    const bytes = Uint8Array.from(atob(document.data), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = safeFilename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('Temporary file storage is unavailable on this device.');
  }
  const uri = `${FileSystem.cacheDirectory}${Date.now()}-${safeFilename}`;
  await FileSystem.writeAsStringAsync(uri, document.data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('This device cannot open or share downloaded documents.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Open application document' });
}

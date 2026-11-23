import { FIELD_LIMITS, validateResumeFile } from '../utils/validation';

// Target Google Drive folder configured for Verto Bizserv resume uploads
export const RESUME_DRIVE_FOLDER_ID = 'YOUR_RESUME_FOLDER_ID';
export const RESUME_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/my-drive';

export class DriveAuthRequiredError extends Error {
  constructor(
    message = 'Connect your document storage vault to upload resumes.'
  ) {
    super(message);
    this.name = 'DriveAuthRequiredError';
  }
}

export function buildDriveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

/**
 * Builds a clean, identifiable resume filename for storage inside the shared Google Drive folder.
 */
export function buildDriveResumeFileName(originalName: string, candidateName?: string): string {
  const trimmedOrig = originalName.trim() || 'resume.pdf';
  const dotIdx = trimmedOrig.lastIndexOf('.');
  const rawExt = dotIdx > 0 ? trimmedOrig.slice(dotIdx).toLowerCase() : '.pdf';
  const ext = /^\.[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : '.pdf';
  const baseOrig = (dotIdx > 0 ? trimmedOrig.slice(0, dotIdx) : trimmedOrig)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

  const cleanCandidate = (candidateName || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const parts = [cleanCandidate || baseOrig || 'Candidate_Resume', dateStamp];
  if (cleanCandidate && baseOrig && !baseOrig.toLowerCase().includes(cleanCandidate.toLowerCase())) {
    parts.splice(1, 0, baseOrig.slice(0, 32));
  }

  return `${parts.join('_')}${ext}`.slice(0, FIELD_LIMITS.resumeFileNameMax);
}

interface DriveUploadResponse {
  id: string;
  name?: string;
  webViewLink?: string;
}

/**
 * Uploads a validated PDF/DOC/DOCX resume file directly into the designated Verto Bizserv
 * Google Drive folder using Google Drive API v3 multipart upload.
 */
export async function uploadResumeToGoogleDrive(
  file: File,
  options: {
    accessToken: string | null;
    candidateName?: string;
    folderId?: string;
    onTokenInvalid?: () => void;
  },
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; fileName: string; storagePath: string }> {
  const check = validateResumeFile(file);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid resume file.');
  }

  const token = options.accessToken?.trim();
  if (!token) {
    throw new DriveAuthRequiredError();
  }

  const folderId = options.folderId || RESUME_DRIVE_FOLDER_ID;
  const uploadFileName = buildDriveResumeFileName(file.name, options.candidateName);
  const mimeType = file.type || 'application/octet-stream';

  const metadata = {
    name: uploadFileName,
    parents: [folderId],
    mimeType,
  };

  const boundary = `verto_bizserv_resume_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const multipartBody = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    xhr.upload.onprogress = (evt) => {
      if (onProgress && evt.lengthComputable && evt.total > 0) {
        onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading resume document. Please try again.'));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as DriveUploadResponse;
          if (!parsed.id) {
            reject(new Error('Storage vault did not return a file identifier for the uploaded resume.'));
            return;
          }
          if (onProgress) onProgress(100);
          resolve({
            downloadUrl: parsed.webViewLink || buildDriveFileViewUrl(parsed.id),
            fileName: (parsed.name || uploadFileName).slice(0, FIELD_LIMITS.resumeFileNameMax),
            storagePath: `gdrive:${parsed.id}`,
          });
        } catch {
          reject(new Error('Unexpected response from storage vault after upload.'));
        }
        return;
      }

      if (xhr.status === 401) {
        options.onTokenInvalid?.();
        reject(
          new DriveAuthRequiredError(
            'Your storage session expired. Click "Connect Storage" to continue uploading.'
          )
        );
        return;
      }

      let apiMessage = '';
      try {
        const errJson = JSON.parse(xhr.responseText) as { error?: { message?: string } };
        apiMessage = errJson?.error?.message || '';
      } catch {
        // ignore JSON parse errors
      }

      if (xhr.status === 404) {
        reject(
          new Error(
            'Could not access the target storage vault. Verify your account has write permissions.'
          )
        );
        return;
      }

      if (xhr.status === 403) {
        if (apiMessage.toLowerCase().includes('insufficient') || apiMessage.toLowerCase().includes('scope')) {
          options.onTokenInvalid?.();
          reject(
            new DriveAuthRequiredError(
              'Document upload permission is required. Click "Connect Storage" and approve access.'
            )
          );
          return;
        }
        reject(
          new Error(
            apiMessage
              ? `Storage permission denied: ${apiMessage}`
              : 'Permission denied when uploading to the document vault. Ensure your account has write access.'
          )
        );
        return;
      }

      reject(
        new Error(
          apiMessage
            ? `Document upload failed (${xhr.status}): ${apiMessage}`
            : `Document upload failed with status ${xhr.status}.`
        )
      );
    };

    xhr.send(multipartBody);
  });
}

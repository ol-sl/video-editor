/**
 * Download helper utilities with File System Access API and fallback
 */

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window;
}

/**
 * Get a file handle for saving (must be called from user gesture)
 */
export async function getSaveFileHandle(filename: string): Promise<any> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'Video Files',
          accept: {
            'video/mp4': ['.mp4'],
            'video/webm': ['.webm'],
            'video/quicktime': ['.mov'],
          },
        },
      ],
    });
    return handle;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Download cancelled by user');
    }
    throw error;
  }
}

/**
 * Download a blob using File System Access API or fallback
 * If fileHandle is provided, uses it directly (avoids user gesture requirement)
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  onProgress?: (progress: number) => void,
  fileHandle?: any
): Promise<void> {
  if (fileHandle) {
    return writeToFileHandle(fileHandle, blob, onProgress);
  } else if (isFileSystemAccessSupported()) {
    return downloadWithFileSystemAccess(blob, filename, onProgress);
  } else {
    return downloadWithBlobUrl(blob, filename);
  }
}

/**
 * Write blob to an existing file handle
 */
async function writeToFileHandle(
  handle: any,
  blob: Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const writable = await handle.createWritable();

    // Write in chunks to show progress
    const totalSize = blob.size;
    let written = 0;

    const reader = blob.stream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await writable.write(value);
      written += value.length;

      if (onProgress) {
        onProgress((written / totalSize) * 100);
      }
    }

    await writable.close();
  } catch (error: any) {
    throw error;
  }
}

/**
 * Download using File System Access API (preferred method)
 */
async function downloadWithFileSystemAccess(
  blob: Blob,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    // Request file save location from user
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'Video Files',
          accept: {
            'video/mp4': ['.mp4'],
            'video/webm': ['.webm'],
          },
        },
      ],
    });

    // Create a writable stream
    const writable = await handle.createWritable();

    // Write in chunks to show progress
    const totalSize = blob.size;
    let written = 0;

    const reader = blob.stream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await writable.write(value);
      written += value.length;

      if (onProgress) {
        onProgress((written / totalSize) * 100);
      }
    }

    await writable.close();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Download cancelled by user');
    }
    throw error;
  }
}

/**
 * Download using blob URL (fallback method)
 */
function downloadWithBlobUrl(blob: Blob, filename: string): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Revoke after a delay to ensure download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve();
    }, 100);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get suggested filename for export
 */
export function getSuggestedFilename(format: 'mp4' | 'webm' | 'mov'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  return `video-edit-${timestamp}.${format}`;
}

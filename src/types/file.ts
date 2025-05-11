export interface FileMetadata {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  size: number;
  type: string;
  createdAt: string;
  password?: string;
  expiresAt?: string;
  qrCode: string;
  downloadCount: number;
  maxDownloads?: number;
  customUrl?: string;
  description?: string;
}

export interface CatboxUploadDailyStat {
  date: string;
  uploads: number;
  totalSize: number;
  successRate: number;
}

export interface CatboxRecentUpload {
  id: number;
  url: string;
  filename: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  success: boolean;
  uploadDuration: number | null;
}

export interface CatboxUploadStatsResponse {
  totalUploads: number;
  totalSize: number;
  successRate: number;
  averageDuration: number;
  uploadsByDay: CatboxUploadDailyStat[];
  recentUploads: CatboxRecentUpload[];
  lastUploadAt: string | null;
  streakDays: number;
}

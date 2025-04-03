// 画像データの型定義
export interface ImageData {
  id: string;
  original_name?: string;
  display_name?: string;  // 表示用のファイル名を追加
  video_name?: string;    // 元の動画名を追加
  path: string;
  frame_number?: number;
  classification?: 'yes' | 'no' | null;
}

// タスク状態の型定義
export interface TaskStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    frames: ImageData[];
    total_frames: number;
  };
  error?: string;
}

// 分類データの型定義
export interface ClassificationData {
  image_id: string;
  classification: 'yes' | 'no';
}
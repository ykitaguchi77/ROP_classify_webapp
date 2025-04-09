import axios, { AxiosProgressEvent } from 'axios';

// 環境に応じたAPIベースURLを設定
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
console.log(`API Base URL: ${API_BASE_URL}`);

// APIクライアントのインスタンス作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ファイルアップロード用の設定
const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// 進捗更新コールバックの型定義
type ProgressCallback = (progress: number | null) => void;

// 画像をアップロードする関数
export const uploadImages = async (files: File[], onProgress: ProgressCallback) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  try {
    const response = await uploadClient.post('/upload-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    onProgress(null); // 完了したらnullを通知
    return response.data;
  } catch (error) {
    console.error('Error uploading images:', error);
    onProgress(null); // エラー時もnullを通知
    throw error;
  }
};

// 動画からフレームを抽出する関数
export const extractFrames = async (file: File, onProgress: ProgressCallback) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await uploadClient.post('/extract-frames', formData, {
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    // フレーム抽出自体はバックグラウンドタスクなので、ここではアップロード完了 = 進捗完了と見なさない
    // タスク開始後に別途ポーリングで進捗を見るため、ここでは完了通知はしない
    // onProgress(null);
    return response.data;
  } catch (error) {
    console.error('Error extracting frames:', error);
    onProgress(null); // エラー時はnullを通知
    throw error;
  }
};

// タスクのステータスを取得する関数
export const getTaskStatus = async (taskId: string) => {
  try {
    const response = await apiClient.get(`/task-status/${taskId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting task status:', error);
    throw error;
  }
};

// 分類結果を保存する関数
export interface ClassificationData {
  image_id: string;
  classification: 'yes' | 'no';
}

export const saveClassifications = async (classifications: ClassificationData[]) => {
  try {
    // CSVデータを直接Blobとして受け取る
    const response = await apiClient.post('/save-classifications', 
      { classifications },
      { responseType: 'blob' } // レスポンスタイプをblobに指定
    );
    return response.data; // Blobデータが返る
  } catch (error) {
    console.error('Error saving classifications / downloading CSV:', error);
    throw error;
  }
};

// CSVから分類データを読み込む関数
export const loadCSV = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await uploadClient.post('/load-csv', formData);
    return response.data;
  } catch (error) {
    console.error('Error loading CSV:', error);
    throw error;
  }
};

// 画像をダウンロードする関数
export const downloadImages = async (images: any[]) => {
  try {
    // Blobとして受け取るための設定
    const response = await apiClient.post('/download-images', { images: images }, {
      responseType: 'blob'
    });
    
    // Blobからダウンロードリンクを作成
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'downloaded_images.zip');
    
    // ダウンロードをトリガー
    document.body.appendChild(link);
    link.click();
    
    // クリーンアップ
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error downloading images:', error);
    throw error;
  }
};

export default apiClient;
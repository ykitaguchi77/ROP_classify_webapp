import axios from 'axios';

// APIクライアントの設定
const API_BASE_URL = 'http://localhost:8000';

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

// 画像をアップロードする関数
export const uploadImages = async (files: File[]) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  try {
    const response = await uploadClient.post('/upload-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};

// 動画からフレームを抽出する関数
export const extractFrames = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await uploadClient.post('/extract-frames', formData);
    return response.data;
  } catch (error) {
    console.error('Error extracting frames:', error);
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
    const response = await apiClient.post('/save-classifications', {
      classifications,
    });
    return response.data;
  } catch (error) {
    console.error('Error saving classifications:', error);
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
    const response = await apiClient.post('/download-images', images, {
      responseType: 'blob'
    });
    
    // Blobからダウンロードリンクを作成
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'classified_images.zip');
    
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
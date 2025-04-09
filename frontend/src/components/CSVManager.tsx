import React, { useState, useRef } from 'react';
import { Button, Box, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import { saveClassifications, loadCSV, downloadImages, ClassificationData } from '../api/apiClient';
import { ImageData } from '../types';

interface CSVManagerProps {
  images: ImageData[];
  onCsvLoaded: (classifications: ClassificationData[]) => void;
}

const CSVManager: React.FC<CSVManagerProps> = ({ images, onCsvLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleExportCSV = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 分類済みの画像のみを抽出
      const classifiedImages = images.filter(
        img => img.classification === 'yes' || img.classification === 'no'
      );
      
      if (classifiedImages.length === 0) {
        setError('分類済みの画像がありません');
        return;
      }
      
      // APIリクエスト用のデータに変換
      const classifications: ClassificationData[] = classifiedImages.map(img => ({
        image_id: img.display_name || img.original_name || img.id,
        classification: img.classification as 'yes' | 'no',
      }));
      
      // APIを呼び出してCSVデータをBlobとして取得
      const blob = await saveClassifications(classifications);
      
      // Blobからダウンロードリンクを作成してクリック
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'classifications.csv');
      document.body.appendChild(link);
      link.click();
      
      // 後片付け
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('CSVファイルがダウンロードされました');
      
    } catch (err: any) {
      setError(err.message || 'CSVのエクスポート/ダウンロードに失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  // 画像をダウンロードする関数
  const handleDownloadImages = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (images.length === 0) {
        setError('ダウンロードする画像がありません');
        return;
      }
      
      // ダウンロード対象の画像情報を作成
      const imagesToDownload = images.map(img => ({
        path: img.path,
        display_name: img.display_name || img.original_name || img.path.split('/').pop(),
        video_name: img.video_name || '' // 元の動画名がある場合はそれをフォルダ名として使用
      }));
      
      // APIを呼び出して画像をダウンロード
      await downloadImages(imagesToDownload);
      setSuccess('画像が正常にダウンロードされました');
      
    } catch (err: any) {
      setError(err.message || '画像のダウンロードに失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        setError('CSVファイルを選択してください');
        return;
      }
      
      // APIを呼び出してCSVを読み込み
      const result = await loadCSV(file);
      onCsvLoaded(result.classifications);
      setSuccess('分類データが正常に読み込まれました');
      
    } catch (err: any) {
      setError(err.message || 'CSVの読み込みに失敗しました');
    } finally {
      setLoading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        分類データの管理
      </Typography>
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleExportCSV}
          disabled={loading || images.length === 0}
        >
          分類結果をCSVに出力
        </Button>
        
        <Button
          variant="outlined"
          component="label"
          disabled={loading}
        >
          CSVから分類結果を読み込み
          <input
            type="file"
            hidden
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportCSV}
          />
        </Button>
        
        <Button
          variant="contained" 
          color="secondary"
          onClick={handleDownloadImages}
          disabled={loading || images.length === 0}
        >
          すべての画像をダウンロード
        </Button>
      </Box>
      
      <Typography variant="caption" display="block" sx={{ mt: 2 }}>
        分類済み画像: {images.filter(img => img.classification !== null).length} / {images.length}
      </Typography>
    </Paper>
  );
};

export default CSVManager;
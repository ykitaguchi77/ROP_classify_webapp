import React, { useState, useRef } from 'react';
import { Button, CircularProgress, Typography, Box, Paper } from '@mui/material';
import { uploadImages, extractFrames } from '../api/apiClient';

interface FileUploaderProps {
  onImagesUploaded: (images: any[]) => void;
  onFramesExtracted: (taskId: string) => void;
  onReset?: () => void;  // リセット機能を追加
  hasImages?: boolean;   // 画像があるかどうかのフラグ
}

const FileUploader: React.FC<FileUploaderProps> = ({ onImagesUploaded, onFramesExtracted, onReset, hasImages = false }) => {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    setError(null);
    
    try {
      // ファイルタイプで分類
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      const videoFiles = files.filter(file => file.type.startsWith('video/'));
      
      if (imageFiles.length > 0) {
        // 画像ファイルをアップロード
        const result = await uploadImages(imageFiles);
        onImagesUploaded(result.images);
      }
      
      if (videoFiles.length > 0 && videoFiles.length === 1) {
        // 動画ファイルからフレームを抽出（現時点では1つの動画のみ対応）
        const videoFile = videoFiles[0];
        const result = await extractFrames(videoFile);
        onFramesExtracted(result.task_id);
      }
    } catch (err: any) {
      setError(err.message || 'ファイルのアップロードに失敗しました');
    } finally {
      setLoading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 3,
      }}
    >
      <Typography variant="h6" gutterBottom>
        ファイルをアップロード
      </Typography>
      
      <Box
        sx={{
          border: '2px dashed',
          borderColor: dragging ? 'primary.main' : 'grey.400',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          backgroundColor: dragging ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
          transition: 'all 0.2s',
          mb: 2,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Typography>
              ファイルをドラッグ＆ドロップするか、クリックして選択してください
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              対応形式: 画像(JPG, PNG, BMP), 動画(MP4, AVI, MOV, MKV)
            </Typography>
          </>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            component="label"
            disabled={loading}
          >
            画像をアップロード
            <input
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/bmp"
              ref={fileInputRef}
              onChange={handleFileInputChange}
            />
          </Button>
          
          <Button
            variant="contained"
            component="label"
            disabled={loading}
          >
            動画をアップロード
            <input
              type="file"
              hidden
              accept="video/mp4,video/avi,video/quicktime,video/x-matroska"
              ref={fileInputRef}
              onChange={handleFileInputChange}
            />
          </Button>
        </Box>
        
        {hasImages && onReset && (
          <Button
            variant="contained"
            color="error"
            onClick={onReset}
            disabled={loading}
          >
            画像をリセット
          </Button>
        )}
      </Box>
      
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Paper>
  );
};

export default FileUploader;
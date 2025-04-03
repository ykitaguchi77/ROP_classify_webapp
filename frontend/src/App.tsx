import React, { useState, useEffect } from 'react';
import { Container, Typography, CssBaseline, Box, AppBar, Toolbar, Button } from '@mui/material';
import FileUploader from './components/FileUploader';
import ClassificationInterface from './components/ClassificationInterface';
import TaskProgress from './components/TaskProgress';
import CSVManager from './components/CSVManager';
import { getTaskStatus } from './api/apiClient';
import { ImageData, TaskStatus, ClassificationData } from './types';
import './App.css';

function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);

  // 画像をアップロードした時のハンドラー
  const handleImagesUploaded = (uploadedImages: ImageData[]) => {
    setImages(prev => [...prev, ...uploadedImages]);
  };

  // フレーム抽出タスクが開始された時のハンドラー
  const handleFramesExtracted = (taskId: string) => {
    setCurrentTaskId(taskId);
  };

  // 画像の分類を更新するハンドラー
  const handleClassify = (imageId: string, classification: 'yes' | 'no') => {
    setImages(prev => 
      prev.map(img => 
        img.id === imageId 
          ? { ...img, classification } 
          : img
      )
    );
  };

  // CSVからデータを読み込んだ時のハンドラー
  const handleCsvLoaded = (classifications: ClassificationData[]) => {
    // 既存の画像データに分類情報を適用
    setImages(prev => 
      prev.map(img => {
        // 表示名またはオリジナル名またはIDで分類情報を探す
        const displayName = img.display_name || img.original_name;
        const classification = classifications.find(c => 
          (displayName && c.image_id === displayName) || c.image_id === img.id
        );
        
        if (classification) {
          return { ...img, classification: classification.classification };
        }
        return img;
      })
    );
  };
  
  // 画像をリセットするハンドラー
  const handleResetImages = () => {
    // 確認ダイアログを表示
    if (window.confirm('画像をすべてリセットしますか？この操作は元に戻せません。')) {
      setImages([]);
      setCurrentTaskId(null);
      setTaskStatus(null);
    }
  };

  // タスクステータスを定期的にポーリング
  useEffect(() => {
    if (!currentTaskId) return;

    const checkTaskStatus = async () => {
      try {
        const status = await getTaskStatus(currentTaskId);
        setTaskStatus(status);

        // タスクが完了したら、抽出されたフレームを画像リストに追加
        if (status.status === 'completed' && status.result) {
          setImages(prev => [...prev, ...status.result.frames]);
          // タスクIDをクリアして、同じフレームが複数回追加されないようにする
          setCurrentTaskId(null);
        }
      } catch (error) {
        console.error('Failed to check task status:', error);
      }
    };

    // 初回チェック
    checkTaskStatus();

    // ポーリング間隔を設定（2秒ごと）
    const intervalId = setInterval(checkTaskStatus, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentTaskId]);

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">
            動画/画像 手動分類ツール
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ my: 2 }}>
          <FileUploader 
            onImagesUploaded={handleImagesUploaded} 
            onFramesExtracted={handleFramesExtracted}
            onReset={handleResetImages}
            hasImages={images.length > 0}
          />
          
          {currentTaskId && taskStatus && (
            <TaskProgress taskStatus={taskStatus} />
          )}
          
          <CSVManager 
            images={images} 
            onCsvLoaded={handleCsvLoaded} 
          />
          
          <ClassificationInterface 
            images={images} 
            onClassify={handleClassify} 
          />
        </Box>
      </Container>
    </>
  );
}

export default App;

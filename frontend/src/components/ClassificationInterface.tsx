import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, Paper, CircularProgress, Stack, Slider } from '@mui/material';
import { ImageData } from '../types';

interface ClassificationInterfaceProps {
  images: ImageData[];
  onClassify: (imageId: string, classification: 'yes' | 'no') => void;
}

const ClassificationInterface: React.FC<ClassificationInterfaceProps> = ({ images, onClassify }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const currentImage = images[currentIndex];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // キーボードショートカット
    switch (event.key) {
      case 'ArrowLeft':
        // 左矢印キー：前の画像
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'ArrowRight':
        // 右矢印キー：次の画像
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : prev));
        break;
      case 'y':
      case 'Y':
        // Yキー：「Yes」に分類
        if (currentImage) {
          onClassify(currentImage.id, 'yes');
          // 次の画像に自動的に移動
          if (currentIndex < images.length - 1) {
            setCurrentIndex(prev => prev + 1);
          }
        }
        break;
      case 'n':
      case 'N':
        // Nキー：「No」に分類
        if (currentImage) {
          onClassify(currentImage.id, 'no');
          // 次の画像に自動的に移動
          if (currentIndex < images.length - 1) {
            setCurrentIndex(prev => prev + 1);
          }
        }
        break;
      default:
        break;
    }
  }, [currentImage, images.length, onClassify]);

  useEffect(() => {
    // キーボードイベントリスナーを設定
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleClassify = (classification: 'yes' | 'no') => {
    if (currentImage) {
      onClassify(currentImage.id, classification);
      // 分類後に自動的に次の画像に進む（オプション）
      if (currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  // 画像の分類状態に基づいて境界線の色を決定
  const getBorderColor = (classification: 'yes' | 'no' | null | undefined) => {
    if (classification === 'yes') return 'success.main';
    if (classification === 'no') return 'error.main';
    return 'grey.300';
  };

  if (images.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">
          画像がアップロードされていません
        </Typography>
        <Typography variant="body2">
          画像をアップロードするか、動画からフレームを抽出してください
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        画像分類インターフェース
      </Typography>
      
      <Box sx={{ position: 'relative', textAlign: 'center', mb: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : currentImage ? (
          <Box
            component="img"
            src={`http://localhost:8000/${currentImage.path}`}
            alt={`Image ${currentIndex + 1}`}
            sx={{
              maxWidth: '100%',
              maxHeight: '60vh',
              border: 3,
              borderColor: getBorderColor(currentImage.classification),
              borderRadius: 1,
            }}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        ) : null}
        
        <Typography variant="body2" sx={{ mt: 1 }}>
          {currentIndex + 1} / {images.length}
        </Typography>
        
        {currentImage && (
          <Typography variant="caption" display="block">
            {currentImage.display_name || currentImage.original_name || `画像 ${currentIndex + 1}`}
          </Typography>
        )}
      </Box>
      
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          color="success"
          onClick={() => handleClassify('yes')}
          sx={{ py: 1.5, flex: 1 }}
        >
          Yes (Y)
        </Button>
        <Button
          fullWidth
          variant="contained"
          color="error"
          onClick={() => handleClassify('no')}
          sx={{ py: 1.5, flex: 1 }}
        >
          No (N)
        </Button>
      </Stack>
      
      {/* スライダーを追加 */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="caption" gutterBottom>
          画像ナビゲーション
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: '40px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              sx={{ minWidth: '36px', p: '4px' }}
            >
              ←
            </Button>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Slider
              value={currentIndex}
              min={0}
              max={images.length - 1}
              step={1}
              onChange={(_, value) => setCurrentIndex(value as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value + 1}/${images.length}`}
              marks={images.map((img, idx) => ({
                value: idx,
                label: img.classification === 'yes' ? '✓' :
                       img.classification === 'no' ? '✗' : ''
              }))}
            />
          </Box>
          <Box sx={{ width: '40px', textAlign: 'right' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
              sx={{ minWidth: '36px', p: '4px' }}
            >
              →
            </Button>
          </Box>
        </Stack>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption">
          ショートカット: Y=Yes, N=No, ←=前の画像, →=次の画像
        </Typography>
      </Box>
    </Paper>
  );
};

export default ClassificationInterface;
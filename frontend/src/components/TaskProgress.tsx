import React from 'react';
import { Box, LinearProgress, Typography, Paper, Alert } from '@mui/material';
import { TaskStatus } from '../types';

interface TaskProgressProps {
  taskStatus: TaskStatus | null;
}

const TaskProgress: React.FC<TaskProgressProps> = ({ taskStatus }) => {
  if (!taskStatus) {
    return null;
  }

  const getStatusMessage = () => {
    switch (taskStatus.status) {
      case 'queued':
        return 'キューに追加されました...';
      case 'processing':
        return 'フレーム抽出中...';
      case 'completed':
        return 'フレーム抽出が完了しました';
      case 'failed':
        return '処理に失敗しました';
      default:
        return '処理中...';
    }
  };

  const getProgressValue = () => {
    return taskStatus.progress * 100;
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        動画処理状況
      </Typography>
      
      {taskStatus.status === 'failed' ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          エラーが発生しました: {taskStatus.error || '不明なエラー'}
        </Alert>
      ) : (
        <>
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={getProgressValue()} 
              color={taskStatus.status === 'completed' ? 'success' : 'primary'}
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">
              {getStatusMessage()}
            </Typography>
            <Typography variant="body2">
              {Math.round(getProgressValue())}%
            </Typography>
          </Box>
          
          {taskStatus.status === 'completed' && taskStatus.result && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              抽出したフレーム数: {taskStatus.result.total_frames}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
};

export default TaskProgress;
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import zipfile
import io
from typing import List, Optional
import os
import cv2
import uuid
import shutil
import tempfile
import csv
from pydantic import BaseModel

app = FastAPI(title="ROP Classification API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では具体的なオリジンを指定する
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 一時ディレクトリを作成
os.makedirs("temp", exist_ok=True)
os.makedirs("output", exist_ok=True)

# 静的ファイルをマウント
app.mount("/temp", StaticFiles(directory="temp"), name="temp")
app.mount("/output", StaticFiles(directory="output"), name="output")

# タスク状態を管理する辞書
tasks = {}

class TaskStatus(BaseModel):
    id: str
    status: str
    progress: float
    result: Optional[dict] = None
    error: Optional[str] = None

class ClassificationData(BaseModel):
    image_id: str
    classification: str  # "yes" or "no"

class ClassificationList(BaseModel):
    classifications: List[ClassificationData]

@app.get("/")
def read_root():
    return {"message": "ROP Classification API"}

@app.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    """複数の画像ファイルをアップロード"""
    results = []
    
    for file in files:
        # ファイル拡張子を検証
        filename = file.filename
        name, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        if ext not in ['.jpg', '.jpeg', '.png', '.bmp']:
            continue
            
        # 一意のIDを生成しつつ、オリジナルファイル名を保持
        file_id = str(uuid.uuid4())
        # ファイル名から不適切な文字を除去
        safe_name = ''.join(c for c in name if c.isalnum() or c in ['-', '_'])
        
        # 保存ファイル名を作成（オリジナル名を保持しながら一意性を確保）
        save_filename = f"{safe_name}-{file_id[:8]}{ext}"
        file_path = f"temp/{save_filename}"
        
        # 画像を保存
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        results.append({
            "id": file_id,
            "original_name": filename,
            "display_name": filename,  # 表示用の名前を追加
            "path": file_path
        })
    
    return JSONResponse(content={"images": results})

@app.post("/extract-frames")
async def extract_frames(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """動画からフレームを抽出するバックグラウンドタスクを開始"""
    # ファイル拡張子を検証
    filename = file.filename
    name, ext = os.path.splitext(filename)
    ext = ext.lower()
    
    if ext not in ['.mp4', '.avi', '.mov', '.mkv']:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    # ファイル名から不適切な文字を除去
    safe_name = ''.join(c for c in name if c.isalnum() or c in ['-', '_'])
    
    # 一時ファイルに保存
    task_id = str(uuid.uuid4())
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    temp_file_path = temp_file.name
    
    try:
        shutil.copyfileobj(file.file, temp_file)
        temp_file.close()
        
        # タスク状態を初期化
        tasks[task_id] = TaskStatus(
            id=task_id,
            status="queued",
            progress=0.0
        )
        
        # バックグラウンドでフレーム抽出を実行
        background_tasks.add_task(
            process_video, 
            temp_file_path, 
            task_id,
            safe_name
        )
        
        return {"task_id": task_id}
    
    except Exception as e:
        # エラー発生時は一時ファイルを削除
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=str(e))

def process_video(video_path: str, task_id: str, video_name: str):
    """動画からフレームを抽出するバックグラウンド処理"""
    try:
        # タスク状態を更新
        tasks[task_id].status = "processing"
        tasks[task_id].progress = 0.0
        
        # 出力ディレクトリを作成
        output_dir = f"output/{task_id}"
        os.makedirs(output_dir, exist_ok=True)
        
        # 動画を開く
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception("Failed to open video file")
        
        # 総フレーム数を取得
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            raise Exception("Invalid video file or no frames detected")
        
        # フレームレート取得
        fps = cap.get(cv2.CAP_PROP_FPS)
        # すべてのフレームを抽出する
        frame_interval = 1
        
        # フレーム抽出
        frames_extracted = 0
        frame_count = 0
        extracted_frames = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            # 指定間隔でフレームを保存
            if frame_count % frame_interval == 0:
                frame_id = str(uuid.uuid4())
                
                # フレーム番号をゼロ埋め
                frame_num_padded = f"{frames_extracted:04d}"
                
                # ファイル名を作成: 動画名-0001.jpg のような形式
                frame_filename = f"{video_name}-{frame_num_padded}.jpg"
                frame_path = f"{output_dir}/{frame_filename}"
                
                cv2.imwrite(frame_path, frame)
                
                extracted_frames.append({
                    "id": frame_id,
                    "path": frame_path,
                    "frame_number": frame_count,
                    "display_name": frame_filename,  # 表示用ファイル名を追加
                    "video_name": video_name  # 元の動画名を追加
                })
                
                frames_extracted += 1
            
            # 進捗状況を更新
            frame_count += 1
            progress = min(0.99, frame_count / total_frames)
            tasks[task_id].progress = progress
        
        # 後処理
        cap.release()
        
        # 一時ファイルを削除
        if os.path.exists(video_path):
            os.unlink(video_path)
        
        # タスク完了
        tasks[task_id].status = "completed"
        tasks[task_id].progress = 1.0
        tasks[task_id].result = {
            "frames": extracted_frames,
            "total_frames": frames_extracted
        }
        
    except Exception as e:
        # エラー処理
        tasks[task_id].status = "failed"
        tasks[task_id].error = str(e)
        
        # 一時ファイルと出力ディレクトリを削除
        if os.path.exists(video_path):
            os.unlink(video_path)

@app.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """タスクの状態を取得"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return tasks[task_id]

@app.post("/download-images")
async def download_images(image_paths: List[dict]):
    """指定された画像をZIPファイルとして圧縮してダウンロード"""
    # 一時的なメモリバッファを作成してZIPファイルを生成
    zip_buffer = io.BytesIO()
    
    # 画像を動画名でグループ化する
    video_groups = {}
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for item in image_paths:
            image_path = item.get("path", "")
            display_name = item.get("display_name", "")
            video_name = item.get("video_name", "")
            
            # パスが存在し、ファイルが存在する場合のみ追加
            if image_path and os.path.exists(image_path):
                # 表示名がある場合はそれを使用、なければパスからファイル名を抽出
                file_name = display_name or os.path.basename(image_path)
                
                # 動画名が指定されている場合は、そのフォルダ内に配置
                if video_name:
                    archive_path = f"{video_name}/{file_name}"
                else:
                    archive_path = file_name
                
                # ZIPファイルにファイルを追加
                zip_file.write(image_path, archive_path)
    
    # バッファの先頭に戻す
    zip_buffer.seek(0)
    
    # ファイルをストリーミングレスポンスとして返す
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=classified_images.zip"
        }
    )

@app.post("/save-classifications")
async def save_classifications(data: ClassificationList):
    """分類結果を保存"""
    try:
        # 一意のファイル名を生成
        file_id = str(uuid.uuid4())
        file_path = f"output/classification_{file_id}.csv"
        
        # CSVに保存
        with open(file_path, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['image_id', 'classification'])
            for item in data.classifications:
                writer.writerow([item.image_id, item.classification])
        
        return {"file_id": file_id, "path": file_path}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/load-csv")
async def load_csv(file: UploadFile = File(...)):
    """CSVから分類結果を読み込み"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        # 一時ファイルに保存
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        temp_file_path = temp_file.name
        
        shutil.copyfileobj(file.file, temp_file)
        temp_file.close()
        
        # CSVを読み込み
        classifications = []
        with open(temp_file_path, mode='r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                classifications.append({
                    "image_id": row.get('image_id', ''),
                    "classification": row.get('classification', '')
                })
        
        # 一時ファイルを削除
        os.unlink(temp_file_path)
        
        return {"classifications": classifications}
    
    except Exception as e:
        # エラー発生時は一時ファイルを削除
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
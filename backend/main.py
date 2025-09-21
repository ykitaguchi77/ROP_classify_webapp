from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
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
from google.cloud import storage
import logging
from urllib.parse import urlparse
import requests  # added

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(title="ROP Classification API")

# Cloud Storageクライアントの初期化
storage_client = None
bucket_name = None
bucket = None
use_cloud_storage = False

try:
    storage_client = storage.Client()
    logging.info("Storage client initialized successfully.")
    bucket_name = os.environ.get("STORAGE_BUCKET_NAME", "rop-classify-files")
    logging.info(f"STORAGE_BUCKET_NAME from env: {bucket_name}")
    use_cloud_storage_str = os.environ.get("USE_CLOUD_STORAGE", "False")
    logging.info(f"USE_CLOUD_STORAGE string from env: {use_cloud_storage_str}")
    use_cloud_storage = use_cloud_storage_str.lower() == "true"
    logging.info(f"use_cloud_storage boolean value: {use_cloud_storage}")
except Exception as e:
    logging.error(f"Failed to initialize storage client: {e}", exc_info=True)

if use_cloud_storage and storage_client:
    logging.info(f"Attempting to get bucket: {bucket_name}")
    try:
        bucket = storage_client.bucket(bucket_name)
        logging.info(f"Bucket '{bucket_name}' retrieved successfully.")
    except Exception as e:
        logging.error(f"Failed to get bucket '{bucket_name}': {e}", exc_info=True)
elif not storage_client:
    logging.warning("Storage client is None, cannot get bucket.")
else:
    logging.info("use_cloud_storage is False, skipping bucket initialization.")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rop-frontend-xvhio54riq-an.a.run.app",  # 新しいフロントエンドURL
        "http://localhost:3000"  # 開発環境
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 一時ディレクトリを作成
os.makedirs("temp", exist_ok=True)
os.makedirs("output", exist_ok=True)

# 静的ファイルをマウント（ローカル開発用）
app.mount("/temp", StaticFiles(directory="temp"), name="temp")
app.mount("/output", StaticFiles(directory="output"), name="output")

# Cloud Storage操作のためのヘルパー関数
def save_file_to_storage(local_file_path, blob_name):
    """ファイルをCloud Storageに保存し、公開URLを返す"""
    logging.info(f"save_file_to_storage called. use_cloud_storage: {use_cloud_storage}, bucket is None: {bucket is None}")
    # GCSが無効、またはbucketオブジェクトが初期化されていない場合はローカルパスを返す
    if not use_cloud_storage or not bucket:
        logging.warning("Cloud Storage is disabled or bucket not initialized. Returning local path: {local_file_path}")
        # Cloud Run環境ではこのローカルパスは外部からアクセスできない
        return local_file_path

    try:
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(local_file_path)
        # オブジェクトを公開状態にする (均一アクセス制御のため不要、削除する)
        # blob.make_public()
        logging.info(f"Uploaded {local_file_path} to gs://{bucket_name}/{blob_name}. Public access relies on bucket IAM.")
        return blob.public_url # 公開URLを返す (IAM設定で公開されている前提)
    except Exception as e:
        logging.error(f"Failed to upload to GCS: {e}", exc_info=True) # エラーメッセージ修正
        return f"gs://{bucket_name}/{blob_name}" # エラーが発生したことを示す代替パス

def get_file_from_storage(blob_name, local_file_path):
    """Cloud Storageからファイルを取得"""
    if not use_cloud_storage:
        return local_file_path # ローカル開発では常にローカルパスを返す
    
    blob = bucket.blob(blob_name)
    blob.download_to_filename(local_file_path)
    return local_file_path

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

class ImageDownloadInfo(BaseModel):
    path: str # これは GCS URL になる
    display_name: str
    video_name: Optional[str] = None # オプション

class ImageDownloadList(BaseModel):
    images: List[ImageDownloadInfo]

@app.get("/")
def read_root():
    return {"message": "ROP Classification API"}

@app.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    """複数の画像ファイルをアップロードし、GCSの公開URLを返す"""
    results = []
    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)

    for file in files:
        filename = file.filename
        name, ext = os.path.splitext(filename)
        ext = ext.lower()

        if ext not in ['.jpg', '.jpeg', '.png', '.bmp']:
            logging.warning(f"Skipping unsupported file format: {filename}")
            continue

        file_id = str(uuid.uuid4())
        safe_name = ''.join(c for c in name if c.isalnum() or c in ['-', '_'])
        local_filename = f"{safe_name}-{file_id[:8]}{ext}"
        local_file_path = os.path.join(temp_dir, local_filename)
        # GCS上のパス（例: images/ファイル名）
        blob_name = f"images/{local_filename}"

        try:
            # ローカル一時ファイルに保存
            with open(local_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logging.info(f"Saved uploaded file temporarily to {local_file_path}")

            # GCS にアップロードして公開 URL を取得
            public_url = save_file_to_storage(local_file_path, blob_name)

            results.append({
                "id": file_id,
                "original_name": filename,
                "display_name": filename,
                "path": public_url # GCSの公開URLを返す
            })
        except Exception as e:
            logging.error(f"Error processing file {filename}: {e}", exc_info=True)
        finally:
            # ローカル一時ファイルを削除
            if os.path.exists(local_file_path):
                try:
                    os.remove(local_file_path)
                    logging.info(f"Removed temporary file {local_file_path}")
                except OSError as e:
                    logging.error(f"Error removing temporary file {local_file_path}: {e}")

    # 一時ディレクトリ自体は残しておく（他のリクエストで使用する可能性があるため）
    # 必要であれば、古いファイルを定期的に削除する仕組みを検討
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
    """動画からフレームを抽出するバックグラウンド処理 (GCS対応)"""
    output_dir = None # finally で使うためにスコープを外に出す
    cap = None      # finally で使うためにスコープを外に出す
    try:
        # タスク状態を更新
        tasks[task_id].status = "processing"
        tasks[task_id].progress = 0.0
        logging.info(f"Starting video processing for task {task_id}, video: {video_name}")

        # フレームの一時保存ディレクトリを作成
        output_dir = os.path.join("output", task_id) # パス結合をos.path.joinに変更
        os.makedirs(output_dir, exist_ok=True)

        # 動画を開く
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception("Failed to open video file")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            raise Exception("Invalid video file or no frames detected")

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = 1 # すべてのフレームを抽出
        frames_extracted_count = 0
        frame_count = 0
        extracted_frames_metadata = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % frame_interval == 0:
                frame_id = str(uuid.uuid4())
                frame_num_padded = f"{frames_extracted_count:04d}"
                frame_filename = f"{video_name}-{frame_num_padded}.jpg"
                frame_local_path = os.path.join(output_dir, frame_filename)
                frame_blob_name = f"frames/{task_id}/{frame_filename}"

                # ローカルに一時保存
                if not cv2.imwrite(frame_local_path, frame):
                    logging.warning(f"Failed to write frame {frame_local_path}")
                    # フレーム書き込み失敗時はスキップ？ エラー処理検討
                    frame_count += 1
                    continue

                # GCS にアップロードして公開 URL を取得
                frame_public_url = save_file_to_storage(frame_local_path, frame_blob_name)

                extracted_frames_metadata.append({
                    "id": frame_id,
                    "path": frame_public_url, # GCS公開URL
                    "frame_number": frame_count,
                    "display_name": frame_filename,
                    "video_name": video_name
                })

                # ローカル一時フレームを削除
                if os.path.exists(frame_local_path):
                    try:
                        os.remove(frame_local_path)
                    except OSError as e:
                         logging.error(f"Error removing temporary frame {frame_local_path}: {e}")

                frames_extracted_count += 1

            frame_count += 1
            progress = min(0.99, frame_count / total_frames)
            tasks[task_id].progress = progress

        # タスク完了
        tasks[task_id].status = "completed"
        tasks[task_id].progress = 1.0
        tasks[task_id].result = {"frames": extracted_frames_metadata}
        logging.info(f"Video processing completed for task {task_id}. Extracted {frames_extracted_count} frames.")

    except Exception as e:
        logging.error(f"Error processing video for task {task_id}: {e}", exc_info=True)
        tasks[task_id].status = "failed"
        tasks[task_id].error = str(e)
    finally:
        # リソース解放と一時ファイル/ディレクトリ削除
        if cap is not None and cap.isOpened():
            cap.release()
        if os.path.exists(video_path):
            try:
                os.unlink(video_path)
                logging.info(f"Removed temporary video file {video_path}")
            except OSError as e:
                logging.error(f"Error removing temporary video file {video_path}: {e}")
        if output_dir is not None and os.path.exists(output_dir):
            try:
                shutil.rmtree(output_dir)
                logging.info(f"Removed temporary frame directory {output_dir}")
            except OSError as e:
                logging.error(f"Error removing temporary frame directory {output_dir}: {e}")

@app.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """タスクの状態を取得"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return tasks[task_id]

@app.post("/download-images")
async def download_images_as_zip(data: ImageDownloadList):
    """指定されたURLの画像をダウンロードし、Zipファイルとして返す。
    まずは http(s) で直接取得を試み、失敗時のみ Storage API にフォールバック（storage.googleapis.com のみ）。
    成否を manifest.txt に記録。
    """
    images_to_download = data.images
    logging.info(f"Received request to download {len(images_to_download)} images.")

    if not images_to_download:
        raise HTTPException(status_code=400, detail="No image data provided")

    zip_buffer = io.BytesIO()
    failed: list[str] = []
    included: list[str] = []

    def _safe_name(name: str) -> str:
        return ''.join(c for c in name if c.isalnum() or c in ['-', '_', '.', ' ']) or 'file'

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for image_info in images_to_download:
            url = image_info.path
            disp_name = image_info.display_name or ''
            parsed = urlparse(url)
            content_bytes: bytes | None = None
            source_note = ""
            try:
                # 1) HTTP(S) での直接取得
                if parsed.scheme in ("http", "https"):
                    try:
                        r = requests.get(url, timeout=30)
                        if r.status_code == 200 and r.content:
                            content_bytes = r.content
                            source_note = url
                        else:
                            raise ValueError(f"HTTP {r.status_code}")
                    except Exception as http_err:
                        # 2) storage.googleapis.com の場合のみ Storage API フォールバック
                        if parsed.netloc == 'storage.googleapis.com' and storage_client is not None:
                            path_str = parsed.path.lstrip('/')
                            if '/' in path_str:
                                bucket_from_url, object_name = path_str.split('/', 1)
                                try:
                                    blob = storage_client.bucket(bucket_from_url).blob(object_name)
                                    content_bytes = blob.download_as_bytes()
                                    source_note = f"gcs://{bucket_from_url}/{object_name} (fallback)"
                                except Exception as gcs_err:
                                    raise ValueError(f"GCS fallback failed: {gcs_err}")
                            else:
                                raise ValueError("Invalid GCS path (no object)")
                        else:
                            raise http_err
                else:
                    raise ValueError("Unsupported URL scheme")

                # 書き込みパス
                base_name = disp_name or os.path.basename(parsed.path) or 'image'
                base_name = _safe_name(base_name)
                zip_path = base_name
                if image_info.video_name:
                    safe_video = _safe_name(image_info.video_name)
                    zip_path = os.path.join(safe_video, base_name)

                zipf.writestr(zip_path, content_bytes)
                included.append(f"OK: {zip_path} <- {source_note}")

            except Exception as e:
                failed.append(f"NG: {disp_name or url} ({e})")
                logging.error(f"Failed to add {url}: {e}", exc_info=True)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=downloaded_images.zip"},
    )

@app.post("/save-classifications")
async def save_classifications(data: ClassificationList):
    """分類データを受け取り、CSVファイル（Shift_JIS）としてレスポンスを返す"""
    classifications = data.classifications
    logging.info(f"Received {len(classifications)} classifications to generate CSV.")

    if not classifications:
        raise HTTPException(status_code=400, detail="No classifications data provided")

    try:
        # CSV（テキスト）を生成
        text_io = io.StringIO()
        writer = csv.writer(text_io)
        writer.writerow(['image_id', 'classification'])
        for item in classifications:
            writer.writerow([item.image_id, item.classification])

        # Shift_JIS（cp932）にエンコード
        csv_bytes = text_io.getvalue().encode('cp932', errors='ignore')
        bytes_io = io.BytesIO(csv_bytes)
        bytes_io.seek(0)

        return StreamingResponse(
            bytes_io,
            media_type="text/csv; charset=Shift_JIS",
            headers={"Content-Disposition": "attachment; filename=classifications.csv"},
        )
    except Exception as e:
        logging.error(f"Error generating CSV: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate CSV file")

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
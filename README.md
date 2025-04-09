# ROP 画像分類ツール - Web版

## プロジェクト概要

このプロジェクトは、動画からフレームを抽出し、それらの画像をROP（未熟児網膜症）診断のために「Yes」または「No」に手動で分類するためのWebアプリケーションです。Google Cloud Run 上にデプロイされています。

## 機能

- 動画ファイルのアップロードとフレーム抽出
- 複数画像ファイルのアップロードと表示
- 画像の「Yes」「No」による手動分類
- 分類結果のCSV出力
- CSVからの分類結果の読み込み（作業再開機能）
- アップロード済み画像のZipダウンロード
- キーボードショートカットによる操作性向上

## 技術スタック

### フロントエンド
- React + TypeScript
- Material-UI

### バックエンド
- Python + FastAPI
- OpenCV（動画処理）

### インフラ・デプロイ
- Google Cloud Run (アプリケーションホスティング)
- Google Cloud Build (Dockerイメージビルド)
- Google Cloud Storage (画像・フレームデータ保存)
- Google Artifact Registry (Dockerイメージレジストリ)
- Docker
- Nginx (フロントエンド静的ファイル配信)

## アプリケーションへのアクセス

デプロイ済みのアプリケーションは、各環境に割り当てられた Cloud Run の URL でアクセスできます。

- **フロントエンド:** (デプロイ先の Cloud Run URL)
- **バックエンドAPI:** (デプロイ先の Cloud Run URL - 通常、フロントエンド経由で利用)

---

## ローカル開発環境セットアップ

### 前提条件
- Google Cloud SDK (`gcloud` コマンド) - 認証やデプロイに必要
- Docker (ローカルビルド・テスト用、Cloud Build を使う場合は必須ではない)
- Node.js (18.x 推奨)
- Python (3.11以上)
- uv (Pythonパッケージマネージャー)

### バックエンドセットアップ (ローカル)

1. リポジトリをクローンする
```bash
git clone https://github.com/ykitaguchi77/ROP_classify_webapp.git
cd ROP_classify_webapp
```

2. 仮想環境を作成する
```bash
uv venv
source .venv/bin/activate
```

3. 必要なパッケージをインストールする
```bash
cd backend
uv pip install -r requirements.txt
```
   * **注意:** ローカル実行時、`main.py` はデフォルトで Google Cloud Storage に接続しようとします。認証情報がない場合や接続したくない場合は、`main.py` 内の GCS 関連処理を一時的にコメントアウトするか、環境変数 `USE_CLOUD_STORAGE=false` を設定して起動する必要があります。

### フロントエンドセットアップ (ローカル)

1. 必要なパッケージをインストールする
```bash
cd ../frontend # ルートディレクトリから移動する場合
npm install
```

## ローカルでの起動・停止

### バックエンドの起動 (ローカル)
```bash
./start_backend.sh
# または backend ディレクトリで直接 uvicorn を実行
# (例: 環境変数を設定して起動)
# cd backend
# USE_CLOUD_STORAGE=false uvicorn main:app --reload --port 8000
```

### フロントエンドの起動 (ローカル)
```bash
./start_frontend.sh
# または frontend ディレクトリで直接 npm start を実行
# cd frontend
# npm start
```

ローカル環境でのアクセスURL：
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000

### アプリケーションの停止 (ローカル)

#### 起動したターミナルで停止する場合
実行中のターミナルウィンドウで `Ctrl+C` を押すことで、サーバーを停止できます。

#### プロセスを強制終了する場合
バックエンド（ポート8000）の終了:
```bash
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

フロントエンド（ポート3000）の終了:
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

## 使い方 (Web アプリケーション)

1. フロントエンドURL (デプロイ先の Cloud Run URL) にアクセスします。
2. 「ファイルをアップロード」セクションで「画像をアップロード」または「動画をアップロード」ボタンをクリックしてファイルを選択します。
3. 画像分類インターフェースで、表示されている画像を「Yes」または「No」に分類します。
4. 画像ナビゲーションのスライダー、左右のボタン、またはキーボードショートカット（左右矢印キー、Y/Nキー）で操作します。
5. 「分類データの管理」セクションで、「分類結果をCSVに出力」ボタンをクリックしてCSVファイルを保存できます。
6. 「CSVから分類結果を読み込み」ボタンをクリックして以前の作業を再開できます。
7. 「すべての画像をダウンロード」ボタンで、アップロード・抽出された画像を Zip ファイルとしてダウンロードできます。

## Cloud Run へのデプロイ概要

1. **Google Cloud プロジェクト設定:**
   - `gcloud` コマンドでプロジェクト (`rop-classifier`) を設定します。
   - 必要な API (Cloud Run, Cloud Build, Artifact Registry, Cloud Storage) を有効にします。
2. **GCS バケットの準備:**
   - 画像/フレーム保存用の GCS バケット (`rop-classify-files`) を作成します。
   - バケットの権限を設定し、公開アクセスを有効にし、`allUsers` に `ストレージ オブジェクト閲覧者` ロールを付与します。
3. **IAM 権限の設定:**
   - Cloud Run サービスアカウント (`[PROJECT_NUMBER]-compute@...`) に `ストレージ管理者` (または `ストレージ オブジェクト管理者`) ロールを付与します。
   - Cloud Build サービスアカウント (`[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`) に `Artifact Registry 書き込み` および `ログ書き込み` ロールを付与します。
4. **バックエンドのビルドとデプロイ:**
   - `backend` ディレクトリで `gcloud builds submit --tag ... .` を実行して Docker イメージをビルドし、Artifact Registry にプッシュします。
   - `gcloud run deploy rop-backend --image ...` を実行して Cloud Run にデプロイします。環境変数 (`USE_CLOUD_STORAGE`, `STORAGE_BUCKET_NAME`) やリソース (CPU/メモリ) を設定します。
5. **フロントエンドのビルドとデプロイ:**
   - `frontend` ディレクトリで `gcloud builds submit --config cloudbuild.yaml .` を実行して Docker イメージをビルドし、Artifact Registry にプッシュします (`cloudbuild.yaml` でバックエンド URL を環境変数として渡します)。
   - `gcloud run deploy rop-frontend --image ...` を実行して Cloud Run にデプロイします。

## ディレクトリ構造

```
ROP_classify_webapp/
├── frontend/               # Reactフロントエンド
│   ├── public/             # 静的ファイル
│   ├── src/                # ソースコード
│   ├── cloudbuild.yaml     # Cloud Build 設定ファイル
│   ├── Dockerfile          # Frontend Dockerfile
│   ├── nginx.conf          # Nginx 設定ファイル
│   ├── package.json        # npm パッケージ定義
│   └── ...
├── backend/                # FastAPIバックエンド
│   ├── main.py             # メインアプリケーション
│   ├── Dockerfile          # Backend Dockerfile
│   ├── requirements.txt    # Python パッケージ定義
│   ├── temp/               # 一時ファイル (ローカル実行時)
│   └── output/             # 出力ファイル (ローカル実行時)
│   └── run.sh              # 起動スクリプト (旧)
├── .gitignore
├── README.md               # このファイル
├── start_backend.sh        # バックエンド起動スクリプト (ローカル用)
├── start_frontend.sh       # フロントエンド起動スクリプト (ローカル用)
└── todo-list.md            # TODOリスト (例)
```
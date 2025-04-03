# ROP 画像分類ツール - Web版

## プロジェクト概要

このプロジェクトは、動画からフレームを抽出し、それらの画像をROP（未熟児網膜症）診断のために「Yes」または「No」に手動で分類するためのWebアプリケーションです。

## 機能

- 動画ファイルのアップロードとフレーム抽出
- 複数画像ファイルのアップロードと表示
- 画像の「Yes」「No」による手動分類
- 分類結果のCSV出力
- CSVからの分類結果の読み込み（作業再開機能）
- キーボードショートカットによる操作性向上

## 技術スタック

### フロントエンド
- React + TypeScript
- Material-UI

### バックエンド
- Python + FastAPI
- OpenCV（動画処理）

## セットアップ方法

### 前提条件
- Node.js (16.x以上)
- Python (3.11以上)
- uv (Pythonパッケージマネージャー)

### バックエンドセットアップ

1. リポジトリをクローンする
```
git clone https://github.com/yourusername/ROP_classify_webapp.git
cd ROP_classify_webapp
```

2. 仮想環境を作成する
```
uv venv
source .venv/bin/activate
```

3. 必要なパッケージをインストールする
```
cd backend
uv pip install fastapi uvicorn python-multipart opencv-python
```

### フロントエンドセットアップ

1. 必要なパッケージをインストールする
```
cd frontend
npm install
```

## アプリケーションの起動・停止

### バックエンドの起動
```
./start_backend.sh
```

### フロントエンドの起動
```
./start_frontend.sh
```

アプリケーションは以下のURLでアクセスできます：
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000

### アプリケーションの停止

#### 起動したターミナルで停止する場合
実行中のターミナルウィンドウで `Ctrl+C` を押すことで、サーバーを停止できます。

#### プロセスを強制終了する場合
すでに実行中のサーバーを終了したい場合や、ターミナルが閉じられてしまった場合は次のコマンドを使用します：

バックエンド（ポート8000）の終了:
```bash
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

フロントエンド（ポート3000）の終了:
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

## 使い方

1. 「画像をアップロード」または「動画をアップロード」ボタンをクリックしてファイルを選択
2. 画像分類インターフェースで、表示されている画像を「Yes」または「No」に分類
3. 左右の矢印キーで前後の画像に移動、「Y」キーまたは「N」キーで分類可能
4. 「分類結果をCSVに出力」ボタンをクリックしてCSVファイルを保存
5. 「CSVから分類結果を読み込み」ボタンをクリックして以前の作業を再開

## ディレクトリ構造

```
ROP_classify_webapp/
├── frontend/          # Reactフロントエンド
│   ├── src/           # ソースコード
│   └── public/        # 静的ファイル
├── backend/           # FastAPIバックエンド
│   ├── main.py        # メインアプリケーション
│   ├── run.sh         # 起動スクリプト
│   ├── temp/          # 一時ファイル
│   └── output/        # 出力ファイル
├── .venv/             # Python仮想環境
├── start_backend.sh   # バックエンド起動スクリプト
├── start_frontend.sh  # フロントエンド起動スクリプト
└── README.md          # このファイル
```
FROM node:18 AS build

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm install

# APIベースURLをビルド引数として受け取る
ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

# ソースコードのコピーとビルド
COPY . .
RUN npm run build

# Nginxベースのイメージを使用して静的ファイルを配信
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
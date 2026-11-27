# 沖繩大翅鯨之旅（Okinawa Whale Trip）

iDiving 沖繩大翅鯨之旅隨行手冊 Web App，使用 React 19、TypeScript、Vite 與 Tailwind CSS v4 建置。

## 主要功能

- **行程與雙團切換**：完整 4 天行程時間軸、集合資訊與日落時間。
- **那霸與慶良間互動地圖**：支援拖曳、縮放與景點標記資訊。
- **即時日圓換算計算機**：快速雙向換算 JPY / TWD。
- **個人行前裝備清單**：支援認領成員身份、自訂待辦項目與進度統計。
- **成員互動與頭像裁切**：成員小人互動區、頭像拍照／裁切上傳。
- **追鯨小遊戲與排行榜**：計時連擊小遊戲與最高分紀錄。
- **離線可用／雲端同步**：預設使用瀏覽器 `localStorage` 即可離線運作；設定 Firebase 環境變數後自動啟用多人即時雲端同步。

## 本機開發

需求環境：Node.js 20+

```bash
# 1. 安裝相依套件
npm install

# 2. 啟動開發伺服器 (http://localhost:3000)
npm run dev

# 3. 型別檢查
npm run lint

# 4. 建置正式版 (輸出至 dist/)
npm run build
```

## 選用：啟用 Firebase 多人即時同步

若不需要跨裝置多人同步，可略過此步驟（App 會自動使用本機 `localStorage`）。

1. 複製 `.env.example` 為 `.env.local` 並填入你的 Firebase Web App 設定值。
2. 於 Firebase Console 啟用 **Authentication → Anonymous（匿名登入）** 與 **Cloud Firestore**。
3. 可參考專案內的 `firestore.rules` 設定 Firestore 安全規則。

## 部署至 GitHub Pages

本專案已內建 `.github/workflows/deploy.yml`：

1. 將專案推送至 GitHub 的 `main` 分支。
2. 到 GitHub Repository 的 **Settings → Pages**，將 **Source** 設為 **GitHub Actions**。
3. （選用）若要啟用 Firebase 同步，請到 **Settings → Secrets and variables → Actions → Variables** 新增 `.env.example` 中的 `VITE_FIREBASE_*` 變數。
4. 每次推送至 `main` 分支時，GitHub Actions 會自動建置並發布至 GitHub Pages。

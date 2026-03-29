# 🗺️ 口袋名單 — 我們的秘密基地

夫妻 / 家人共用的口袋名單 Web App，即時同步、共同編輯。

---

## ✨ 功能

- 📍 新增、編輯、刪除地點
- 🔄 即時同步（Firebase Firestore）
- 👥 家庭群組 + 邀請碼加入
- ⊞ 卡片模式 / 列表模式切換
- 🔍 搜尋 + 三層篩選（地區 × 分類 × 標籤）
- ✅ 已造訪標記
- 📤 匯出 JSON 備份
- 📥 匯入 JSON 還原
- 🗺️ Google Maps 一鍵導航
- 🔗 IG/Threads 推薦來源連結

---

## 🚀 快速開始

### 第一步：建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點「新增專案」，任意取名（如：pocket-list）
3. **停用** Google Analytics（簡化設定）
4. 建立完成後，點左側「**Firestore Database**」→「建立資料庫」→ 選「正式模式」→ 選擇亞洲區（asia-east1）
5. 點左側「**Authentication**」→「開始使用」→「登入方式」→ 啟用「**Google**」

### 第二步：取得設定金鑰

1. 在 Firebase Console 左上角，點「專案總覽」旁的齒輪 ⚙️ →「專案設定」
2. 往下滑到「你的應用程式」→ 點「</> 網頁」圖示
3. 輸入應用程式名稱（隨意）→ 點「繼續」
4. 複製 `firebaseConfig` 物件中的所有值

### 第三步：填入設定

開啟 `js/config.js`，將預設值換成你剛才複製的內容：

```js
export const firebaseConfig = {
  apiKey: "AIzaSy...",           // 你的 API Key
  authDomain: "my-app.firebaseapp.com",
  projectId: "my-app",
  storageBucket: "my-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

### 第四步：設定 Firestore 安全規則

在 Firebase Console → Firestore → 「規則」分頁，貼上以下規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 使用者只能讀寫自己的資料
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 群組：成員才能讀寫
    match /groups/{groupId} {
      allow read: if request.auth != null && 
        resource.data.members.hasAny([request.auth.uid]);
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        resource.data.members.hasAny([request.auth.uid]);

      // 地點子集合
      match /places/{placeId} {
        allow read, write: if request.auth != null &&
          get(/databases/$(database)/documents/groups/$(groupId)).data.members.hasAny([request.auth.uid]);
      }
    }

    // 邀請碼查詢（任何已登入者可讀 groups）
    match /groups/{groupId} {
      allow read: if request.auth != null;
    }
  }
}
```

### 第五步：部署到 GitHub Pages

```bash
# 1. 建立 GitHub Repo（Public）
# 2. 上傳所有檔案
git init
git add .
git commit -m "🗺️ 口袋名單初始版本"
git remote add origin https://github.com/你的帳號/pocket-list.git
git push -u origin main

# 3. 在 GitHub → Settings → Pages → Branch: main → Save
```

完成！你的網址會是：`https://你的帳號.github.io/pocket-list/`

### 第六步：設定 Firebase 授權網域

Firebase Console → Authentication → Settings → 授權網域 → 新增你的 GitHub Pages 網址

---

## 👥 邀請老公加入

1. 用你的 Google 帳號登入
2. 點右上角 ⚙️ 設定
3. 複製「邀請碼」（6 位英數字）
4. 傳給老公
5. 老公在登入頁輸入邀請碼 → 加入 → 共享同一份口袋名單 🎉

---

## 📁 檔案結構

```
pocket-list/
├── index.html          # 登入頁
├── pages/
│   └── app.html        # 主應用（需登入）
├── css/
│   └── style.css       # 全站樣式
├── js/
│   ├── config.js       # ⚠️ Firebase 設定（需修改）
│   ├── auth.js         # 登入/群組相關
│   └── data.js         # 資料操作
└── README.md
```

---

## 🔐 安全說明

- `js/config.js` 中的 Firebase API Key 可以公開在前端
- 真正的安全性靠 **Firestore 安全規則** 控制
- 每個使用者只能存取自己所在群組的資料

---

Made with ☕ for 口袋名單

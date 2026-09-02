# Chay Vane local tren Windows

File nay ghi cach tu chay project Vane trong repo nay.

## 1. Yeu cau

- Windows + PowerShell
- Node.js da cai san
- npm da cai san
- Repo nam tai:

```powershell
C:\Users\Admin\Desktop\GIT CLONE\Vane
```

Kiem tra Node/npm:

```powershell
node -v
npm -v
```

## 2. Vao thu muc project

```powershell
cd "C:\Users\Admin\Desktop\GIT CLONE\Vane"
```

## 3. Cai dependencies

Neu `node_modules` chua co, chay:

```powershell
npm install
```

Neu `node_modules` da co, co the bo qua buoc nay.

## 4. Chay development server

```powershell
npm run dev
```

Neu thanh cong, terminal se hien dai loai:

```text
Next.js 16.2.2 (Turbopack)
- Local: http://localhost:3000
Ready
```

Mo trinh duyet:

```text
http://localhost:3000
```

## 5. Chay production local

Dung khi muon test gan voi deploy hon:

```powershell
npm run build
npm run start
```

Mo:

```text
http://localhost:3000
```

## 6. Cau hinh Vane

Vane luu cau hinh tai:

```text
data/config.json
```

Cac field quan trong:

```json
{
  "setupComplete": true,
  "modelProviders": [],
  "search": {
    "searxngURL": ""
  }
}
```

Neu `setupComplete` la `false`, Vane se hien setup wizard.
Neu `setupComplete` la `true`, Vane vao thang chat.

## 7. Cau hinh OpenRouter/DeepSeek

Provider OpenRouter dung provider type `openai`, vi OpenRouter tuong thich OpenAI API.

Base URL:

```text
https://openrouter.ai/api/v1
```

Model chat:

```text
deepseek/deepseek-v4-flash
```

Vi du provider trong `data/config.json`:

```json
{
  "id": "openrouter-deepseek",
  "name": "OpenRouter DeepSeek",
  "type": "openai",
  "config": {
    "apiKey": "YOUR_OPENROUTER_API_KEY",
    "baseURL": "https://openrouter.ai/api/v1"
  },
  "chatModels": [
    {
      "name": "DeepSeek V4 Flash",
      "key": "deepseek/deepseek-v4-flash"
    }
  ],
  "embeddingModels": [],
  "hash": "openrouter-deepseek-manual"
}
```

Khong commit API key len Git.
Neu API key tung bi lo, revoke key cu va tao key moi tren OpenRouter.

## 8. Cau hinh embedding local

Vane can embedding model cho search/upload/RAG. Co the dung Transformers local:

```json
{
  "id": "local-transformers-embeddings",
  "name": "Transformers",
  "type": "transformers",
  "config": {},
  "chatModels": [],
  "embeddingModels": [
    {
      "name": "all-MiniLM-L6-v2",
      "key": "Xenova/all-MiniLM-L6-v2"
    }
  ],
  "hash": "local-transformers-manual"
}
```

Lan dau dung embedding model co the can tai model tu HuggingFace. Neu mang bi chan, embedding co the loi.

## 9. Cau hinh SearXNG de search web

Neu chi chat voi model, co the de trong:

```json
"search": {
  "searxngURL": ""
}
```

Neu muon web search/discover, can SearXNG chay rieng va set URL, vi du:

```json
"search": {
  "searxngURL": "http://localhost:4000"
}
```

SearXNG can bat JSON output trong settings.

## 10. Restart app sau khi sua config

Sau khi sua `data/config.json`, can restart server.

Dung `Ctrl + C` trong terminal dang chay `npm run dev`, roi chay lai:

```powershell
npm run dev
```

Neu server dang chay ngam va port 3000 bi chiem:

```powershell
netstat -ano | findstr :3000
```

Lay PID cuoi dong `LISTENING`, roi stop:

```powershell
Stop-Process -Id <PID> -Force
```

Sau do chay lai:

```powershell
npm run dev
```

## 11. Loi thuong gap

### Setup cu hien lai

Kiem tra:

```powershell
Get-Content data\config.json
```

Dam bao:

```json
"setupComplete": true
```

Neu file JSON loi, Vane co the overwrite ve default. Hay dam bao file la JSON hop le va UTF-8 khong BOM.

### Loi `Invalid URL` o `/api/discover`

Nguyen nhan: `search.searxngURL` dang rong.

Fix: cau hinh SearXNG URL, hoac khong dung trang Discover/web search.

### Khong co chat model

Kiem tra `modelProviders` co provider chat khong:

```powershell
Invoke-WebRequest http://localhost:3000/api/providers -UseBasicParsing
```

Can it nhat 1 provider co `chatModels`.

### Khong co embedding model

Can it nhat 1 provider co `embeddingModels`, thuong la Transformers local.

### Git bao dubious ownership

Neu can dung git trong repo:

```powershell
git config --global --add safe.directory "C:/Users/Admin/Desktop/GIT CLONE/Vane"
```

## 12. Lenh nhanh

Chay dev:

```powershell
cd "C:\Users\Admin\Desktop\GIT CLONE\Vane"
npm run dev
```

Build production:

```powershell
npm run build
```

Start production sau build:

```powershell
npm run start
```

Mo app:

```text
http://localhost:3000
```

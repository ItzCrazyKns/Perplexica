## Hướng dẫn cấu hình LLM cho Perplexica (config.toml)

⚠️ **BẮT BUỘC**: Perplexica không thể chạy nếu thiếu config.toml hoặc không có API key LLM hợp lệ.

---

## Tại sao cần config.toml?

Perplexica là công cụ tìm kiếm AI-powered cần **Large Language Model (LLM)** để:
- Hiểu câu hỏi của người dùng
- Tạo query tìm kiếm thông minh
- Tổng hợp kết quả từ SearXNG
- Tạo câu trả lời có ngữ cảnh

**Không có LLM API key → ứng dụng không hoạt động.**

---

## Các bước cấu hình nhanh

### 1) Copy từ sample

```bash
cp sample.config.toml config.toml
```

### 2) Chọn LLM provider và lấy API key

#### Option 1: Groq (Khuyến nghị - Miễn phí, nhanh)

1. Truy cập: https://console.groq.com/
2. Đăng ký tài khoản (miễn phí)
3. Vào **API Keys** → **Create API Key**
4. Copy key bắt đầu bằng `gsk_...`

**config.toml:**
```toml
[MODELS.GROQ]
API_KEY = "gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models available**: Llama 3.1 70B, Llama 3.1 8B, Mixtral 8x7B, Gemma 2 9B

---

#### Option 2: Google Gemini (Miễn phí tier)

1. Truy cập: https://aistudio.google.com/apikey
2. Đăng nhập Google
3. Click **Get API key** → **Create API key**
4. Copy key

**config.toml:**
```toml
[MODELS.GEMINI]
API_KEY = "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models available**: Gemini 1.5 Flash, Gemini 1.5 Pro

---

#### Option 3: OpenAI (Trả phí - chất lượng cao)

1. Truy cập: https://platform.openai.com/api-keys
2. Đăng ký và nạp credit (tối thiểu $5)
3. Tạo API key
4. Copy key bắt đầu bằng `sk-proj-...`

**config.toml:**
```toml
[MODELS.OPENAI]
API_KEY = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models available**: GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo

---

#### Option 4: Anthropic Claude (Trả phí)

1. Truy cập: https://console.anthropic.com/
2. Đăng ký và nạp credit
3. Vào **API Keys** → **Create Key**
4. Copy key bắt đầu bằng `sk-ant-...`

**config.toml:**
```toml
[MODELS.ANTHROPIC]
API_KEY = "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models available**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku

---

#### Option 5: DeepSeek (Rẻ - $0.14/1M tokens)

1. Truy cập: https://platform.deepseek.com/
2. Đăng ký và nạp credit (chấp nhận $1)
3. Vào **API Keys** → **Create API Key**
4. Copy key

**config.toml:**
```toml
[MODELS.DEEPSEEK]
API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Models available**: DeepSeek Chat, DeepSeek Coder

---

#### Option 6: Custom OpenAI-compatible API

Nếu bạn có API tương thích OpenAI (ví dụ: ZhipuAI, Together AI, Fireworks AI...):

**config.toml:**
```toml
[MODELS.CUSTOM_OPENAI]
API_KEY = "your-api-key-here"
API_URL = "https://api.provider.com/v1"
MODEL_NAME = "model-name"
```

Ví dụ với ZhipuAI:
```toml
[MODELS.CUSTOM_OPENAI]
API_KEY = "7864229fc2c1456691354b14fc0bf409.xxxxx"
API_URL = "https://open.bigmodel.cn/api/paas/v4"
MODEL_NAME = "glm-4"
```

---

#### Option 7: Ollama (Self-hosted - Miễn phí hoàn toàn)

Nếu bạn chạy Ollama local hoặc trên server riêng:

**config.toml:**
```toml
[MODELS.OLLAMA]
API_URL = "http://host.docker.internal:11434"  # Nếu Ollama chạy trên host machine
# Hoặc: "http://your-ollama-server:11434"
```

**Lưu ý**: Cần cài Ollama và pull model trước (ví dụ: `ollama pull llama3.1:8b`)

---

### 3) Cấu hình SearXNG endpoint

Nếu dùng Docker Compose (mặc định):
```toml
[API_ENDPOINTS]
SEARXNG = "http://searxng:8080"
```

Nếu SearXNG chạy riêng:
```toml
[API_ENDPOINTS]
SEARXNG = "http://your-searxng-server:8080"
```

---

### 4) Config.toml tối thiểu hoàn chỉnh

```toml
[GENERAL]
SIMILARITY_MEASURE = "cosine"

[MODELS.GROQ]
API_KEY = "gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[API_ENDPOINTS]
SEARXNG = "http://searxng:8080"
```

Hoặc nếu dùng nhiều providers (ứng dụng sẽ cho phép chọn):

```toml
[GENERAL]
SIMILARITY_MEASURE = "cosine"

[MODELS.OPENAI]
API_KEY = "sk-proj-xxxxxxxxxxxxxxxx"

[MODELS.GROQ]
API_KEY = "gsk_xxxxxxxxxxxxxxxx"

[MODELS.ANTHROPIC]
API_KEY = "sk-ant-xxxxxxxxxxxxxxxx"

[MODELS.GEMINI]
API_KEY = "AIzaSyxxxxxxxxxxxxxxxx"

[API_ENDPOINTS]
SEARXNG = "http://searxng:8080"
```

---

## Kiểm tra config.toml

```bash
# Đảm bảo có ít nhất 1 API_KEY không rỗng
cat config.toml | grep API_KEY | grep -v '""'

# Output mong muốn (ví dụ):
# API_KEY = "gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Deploy config.toml lên EC2

### Nếu deploy bằng Docker Compose thủ công:
```bash
scp -i ~/.ssh/your-key.pem ./config.toml ubuntu@<EC2-IP>:/opt/Perplexica/
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2-IP> "sudo systemctl restart perplexica"
```

### Nếu deploy bằng CloudFormation:
```bash
# Sau khi stack CREATE_COMPLETE
INSTANCE_IP=$(aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text)

scp -i ~/.ssh/perplexica-key.pem ./config.toml ubuntu@$INSTANCE_IP:/opt/Perplexica/
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP "sudo systemctl restart perplexica"
```

---

## Troubleshooting

### Lỗi: "No LLM provider configured"
- Kiểm tra config.toml có tồn tại: `ls -la /opt/Perplexica/config.toml`
- Kiểm tra có API key: `cat /opt/Perplexica/config.toml | grep API_KEY`
- Đảm bảo ít nhất 1 provider có key hợp lệ

### Lỗi: "Invalid API key"
- Kiểm tra key không bị thừa/thiếu ký tự
- Kiểm tra key chưa hết hạn/bị revoke
- Thử tạo key mới từ console provider

### Lỗi: "Rate limit exceeded"
- Groq free tier: 30 requests/minute
- OpenAI: tùy plan (tier 1: 500 RPM)
- Đợi 1 phút hoặc nâng cấp plan

### Lỗi: "Cannot connect to SearXNG"
- Kiểm tra SearXNG container đang chạy: `docker ps | grep searxng`
- Kiểm tra network: `docker network ls | grep perplexica`
- Nếu SearXNG external, kiểm tra firewall/URL

---

## So sánh LLM providers

| Provider | Miễn phí? | Giá (nếu trả phí) | Tốc độ | Chất lượng | Khuyến nghị |
|----------|-----------|-------------------|--------|------------|-------------|
| **Groq** | ✅ Có (với giới hạn) | N/A | ⚡ Rất nhanh | ⭐⭐⭐⭐ Tốt | **Tốt nhất cho free** |
| **Gemini** | ✅ Có (free tier) | $0.35/1M tokens | 🚀 Nhanh | ⭐⭐⭐⭐ Tốt | **Tốt cho free** |
| **DeepSeek** | ❌ Không | $0.14/1M tokens | 🚀 Nhanh | ⭐⭐⭐⭐⭐ Rất tốt | **Rẻ nhất trả phí** |
| **OpenAI** | ❌ Không | $0.15–$10/1M | 🐢 Trung bình | ⭐⭐⭐⭐⭐ Xuất sắc | Chất lượng cao |
| **Anthropic** | ❌ Không | $3–$15/1M | 🐢 Trung bình | ⭐⭐⭐⭐⭐ Xuất sắc | Reasoning tốt |
| **Ollama** | ✅ Miễn phí | N/A | 🐢 Phụ thuộc GPU | ⭐⭐⭐ OK | Self-hosted |

---

## Khuyến nghị cuối cùng

1. **Bắt đầu**: dùng **Groq** (miễn phí, nhanh, đủ tốt)
2. **Nâng cao**: dùng **DeepSeek** (rẻ nhất, chất lượng cao)
3. **Production**: dùng **OpenAI GPT-4o-mini** hoặc **Claude 3.5 Sonnet**
4. **Self-hosted**: dùng **Ollama** với Llama 3.1 8B (cần GPU)

**Lưu ý**: Bạn có thể cấu hình nhiều providers cùng lúc và chọn trong UI của Perplexica.



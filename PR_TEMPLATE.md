# PR创建信息

## 分支已推送成功 ✅
- 分支名：`feature/khartoum-api-extension`
- PR链接：https://github.com/Zhongshan9810/Perplexica/pull/new/feature/khartoum-api-extension

## PR标题
```
[Khartoum] 实现新闻批量接收和法律风险分析API
```

## PR描述（复制以下内容）
```markdown
## 完成内容
- [x] 创建 /api/news/batch 端点用于接收爬虫批量数据
- [x] 实现 GET 方法返回最新10条新闻（支持筛选和分页）
- [x] 创建 /api/legal-risk/analyze 端点用于企业风险分析
- [x] 实现风险评分算法（0-100分）和风险等级分类
- [x] 自动生成风险因素分析和建议
- [x] 使用内存存储实现数据暂存（后续迁移至PostgreSQL）
- [x] 编写测试脚本和使用示例

## 测试结果
### News API测试命令：
```bash
# POST 批量新闻数据
curl -X POST http://localhost:3000/api/news/batch \
  -H "Content-Type: application/json" \
  -d '{
    "source": "test_crawler",
    "articles": [
      {
        "title": "Breaking: Tech Company Update",
        "content": "Content here...",
        "category": "Technology"
      }
    ]
  }'

# GET 最新新闻
curl http://localhost:3000/api/news/batch
```

### Legal Risk API测试命令：
```bash
# POST 风险分析
curl -X POST http://localhost:3000/api/legal-risk/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "TestCorp Inc.",
    "industry": "Financial Services",
    "dataPoints": {
      "employees": 25,
      "yearFounded": 2022
    }
  }'
```

### 预期响应：
- News API: 返回处理成功消息和存储的文章列表
- Risk API: 返回风险评分(0-100)、风险等级、分类评估和建议

## 运行方法
```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 执行测试脚本查看示例
node test-apis.js

# 4. 使用curl命令测试API（服务器需在3000端口运行）
```

## 文件变更
- `src/app/api/news/batch/route.ts` - 新闻批量API
- `src/app/api/legal-risk/analyze/route.ts` - 法律风险分析API
- `test-apis.js` - 测试脚本
- `API_DELIVERY_SUMMARY.md` - 交付文档
```
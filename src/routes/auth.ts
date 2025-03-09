import express from 'express';
import logger from '../utils/logger';
import { getAuthSecret } from '../config';
import { generateToken } from '../middleware/auth';

const router = express.Router();

// 预设的密码，实际应用中应该从环境变量或配置文件中获取
const AUTH_PASSWORD = getAuthSecret();

router.post('/verify', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: '密码不能为空' });
    }
    
    if (password === AUTH_PASSWORD) {
      // 生成JWT令牌
      const token = generateToken();
      return res.status(200).json({ 
        message: '验证成功',
        token: token 
      });
    } else {
      return res.status(401).json({ message: '密码错误' });
    }
  } catch (err: any) {
    logger.error(`认证错误: ${err.message}`);
    return res.status(500).json({ message: '服务器错误' });
  }
});

// 验证令牌是否有效的端点
router.get('/verify-token', (req, res) => {
  try {
    // 令牌验证已经在中间件中完成，如果能到达这里，说明令牌有效
    return res.status(200).json({ valid: true });
  } catch (err: any) {
    logger.error(`令牌验证错误: ${err.message}`);
    return res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
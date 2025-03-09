import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getAuthSecret } from '../config';
import logger from '../utils/logger';

// 扩展Express的Request类型，添加用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        authenticated: boolean;
      };
    }
  }
}

/**
 * 验证JWT令牌的中间件
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 从请求头获取令牌
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN格式
  
  // 如果没有令牌
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  
  try {
    // 验证令牌
    const secret = getAuthSecret();
    const decoded = jwt.verify(token, secret);
    
    // 将用户信息添加到请求对象中
    req.user = {
      authenticated: true
    };
    
    next();
  } catch (err: any) {
    logger.error(`令牌验证失败: ${err.message}`);
    return res.status(403).json({ message: '无效的认证令牌' });
  }
};

/**
 * 生成JWT令牌
 */
export const generateToken = (): string => {
  const secret = getAuthSecret();
  // 令牌有效期为7天
  return jwt.sign({ authenticated: true }, secret, { expiresIn: '7d' });
}; 
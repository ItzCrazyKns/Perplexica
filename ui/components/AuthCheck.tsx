'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 检查用户是否已经通过认证
    const authToken = localStorage.getItem('authToken');
    
    // 如果当前路径是认证页面，不需要重定向
    if (pathname === '/auth') {
      setIsAuthenticated(true);
      return;
    }
    
    // 如果未认证且不在认证页面，重定向到认证页面
    if (!authToken) {
      router.push('/auth');
      setIsAuthenticated(false);
    } else {
      // 验证令牌有效性
      checkTokenValidity(authToken);
    }
  }, [pathname, router]);

  // 验证令牌有效性
  const checkTokenValidity = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-token`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        // 令牌无效，清除存储并重定向到登录页
        localStorage.removeItem('authToken');
        router.push('/auth');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('验证令牌时出错:', error);
      setIsAuthenticated(true); // 网络错误时暂时允许访问
    }
  };

  // 如果认证状态尚未确定，显示加载状态
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-primary dark:bg-dark-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 如果在认证页面或已认证，显示子组件
  return <>{children}</>;
}
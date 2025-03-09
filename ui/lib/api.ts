/**
 * API请求工具函数，自动处理认证令牌
 */

// 基本API请求函数
export async function fetchWithToken(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 从本地存储获取令牌
  const token = localStorage.getItem('authToken');
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  // 发送请求
  return fetch(url, {
    ...options,
    headers,
  });
}

// GET请求
export async function get<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithToken(url, {
    method: 'GET',
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }
  
  return response.json();
}

// POST请求
export async function post<T>(
  url: string, 
  data: any, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithToken(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }
  
  return response.json();
}

// PUT请求
export async function put<T>(
  url: string, 
  data: any, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithToken(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }
  
  return response.json();
}

// DELETE请求
export async function del<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithToken(url, {
    method: 'DELETE',
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }
  
  return response.json();
}

// 获取完整API URL
export function getApiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
} 
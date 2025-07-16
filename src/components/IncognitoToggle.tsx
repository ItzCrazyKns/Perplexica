'use client';

import { EyeOff, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface IncognitoToggleProps {
  className?: string;
  showLabel?: boolean;
}

const IncognitoToggle = ({ className = '', showLabel = true }: IncognitoToggleProps) => {
  const [isIncognito, setIsIncognito] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 初始化無痕模式狀態
  useEffect(() => {
    // 檢查URL參數
    const incognitoParam = searchParams.get('incognito');
    if (incognitoParam !== null) {
      const incognitoValue = incognitoParam === 'true';
      setIsIncognito(incognitoValue);
      localStorage.setItem('incognitoMode', incognitoValue.toString());
      return;
    }

    // 檢查localStorage
    const savedIncognito = localStorage.getItem('incognitoMode');
    if (savedIncognito !== null) {
      setIsIncognito(savedIncognito === 'true');
    }
  }, [searchParams]);

  const toggleIncognito = () => {
    const newIncognitoState = !isIncognito;
    setIsIncognito(newIncognitoState);
    
    // 保存到localStorage
    localStorage.setItem('incognitoMode', newIncognitoState.toString());
    
    // 更新URL參數
    const params = new URLSearchParams(searchParams.toString());
    if (newIncognitoState) {
      params.set('incognito', 'true');
    } else {
      params.delete('incognito');
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });

    // 觸發自定義事件，通知其他組件無痕模式狀態變化
    window.dispatchEvent(new CustomEvent('incognitoModeChanged', { 
      detail: { isIncognito: newIncognitoState } 
    }));
  };

  return (
    <button
      onClick={toggleIncognito}
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
        isIncognito
          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50'
          : 'bg-light-secondary dark:bg-dark-secondary text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200'
      } ${className}`}
      title={isIncognito ? 'Turn off Incognito Mode' : 'Turn on Incognito Mode'}
    >
      {isIncognito ? (
        <EyeOff size={16} />
      ) : (
        <Eye size={16} />
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {isIncognito ? 'Incognito Mode: ON' : 'Incognito Mode: OFF'}
        </span>
      )}
    </button>
  );
};

export default IncognitoToggle;

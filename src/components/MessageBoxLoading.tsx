import { FC } from 'react';

const MessageBoxLoading: FC = () => {
  return (
    <div className="flex flex-col space-y-4 w-full lg:w-9/12 bg-light-primary dark:bg-dark-primary rounded-lg py-6">
      <div className="flex items-center px-6">
        {/* Dynamic spinning circle with variable blue segment - smaller size */}
        <div className="relative w-4 h-4">
          {/* Gray background circle */}
          <div className="absolute w-full h-full rounded-full border-2 border-gray-300 dark:border-gray-700" />
          
          {/* Teal spinning segment (Pro color) */}
          <div 
            className="absolute w-full h-full rounded-full animate-spin"
            style={{
              borderRadius: '50%',
              borderTop: '2px solid #2DD4BF',
              borderRight: '2px solid transparent',
              borderBottom: '2px solid transparent',
              borderLeft: '2px solid transparent',
              animation: 'spin 1s linear infinite, arcGrow 2s ease-in-out infinite'
            }}
          />
        </div>
        
        {/* Custom animation for growing/shrinking arc */}
        <style jsx>{`
          @keyframes arcGrow {
            0%, 100% { 
              border-top-width: 2px;
              border-top-color: #2DD4BF;
              border-right-width: 2px;
              border-right-color: transparent;
            }
            50% { 
              border-top-width: 2px;
              border-top-color: #2DD4BF;
              border-right-width: 2px;
              border-right-color: #2DD4BF;
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default MessageBoxLoading;

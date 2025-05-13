import React from "react";

const BalanceIcon: React.FC = () => (
  <svg
    width="111"
    height="32"
    viewBox="0 0 111 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-8 w-auto"
  >
    <rect x="0.5" y="0.5" width="110" height="31" rx="15.5" fill="white" />
    <rect x="0.5" y="0.5" width="110" height="31" rx="15.5" stroke="#E4E4E4" />
    <text
      x="40"
      y="21"
      fill="#000"
      fontSize="14"
      fontWeight="bold"
      fontFamily="sans-serif"
    >
      £125.99
    </text>
    <circle cx="93" cy="16" r="10" fill="#ccc" />
    <circle cx="93" cy="13" r="3" fill="#999" />
  </svg>
);

export default BalanceIcon;

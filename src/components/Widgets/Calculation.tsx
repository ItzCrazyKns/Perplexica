'use client';

import { Calculator, Equal } from 'lucide-react';

type CalculationWidgetProps = {
  expression: string;
  result: number;
};

const Calculation = ({ expression, result }: CalculationWidgetProps) => {
  return (
    <div className="rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 p-3 bg-light-100/50 dark:bg-dark-100/50 border-b border-light-200 dark:border-dark-200">
        <div className="rounded-full p-1.5 bg-light-100 dark:bg-dark-100">
          <Calculator className="w-4 h-4 text-black/70 dark:text-white/70" />
        </div>
        <span className="text-sm font-medium text-black dark:text-white">
          Calculation
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs text-black/50 dark:text-white/50 font-medium">
              Expression
            </span>
          </div>
          <div className="bg-light-100 dark:bg-dark-100 rounded-md p-2.5 border border-light-200 dark:border-dark-200">
            <code className="text-sm text-black dark:text-white font-mono break-all">
              {expression}
            </code>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Equal className="w-3.5 h-3.5 text-black/50 dark:text-white/50" />
            <span className="text-xs text-black/50 dark:text-white/50 font-medium">
              Result
            </span>
          </div>
          <div className="bg-gradient-to-br from-light-100 to-light-secondary dark:from-dark-100 dark:to-dark-secondary rounded-md p-4 border-2 border-light-200 dark:border-dark-200">
            <div className="text-4xl font-bold text-black dark:text-white font-mono tabular-nums">
              {result.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calculation;

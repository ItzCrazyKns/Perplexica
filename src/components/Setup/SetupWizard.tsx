'use client';

import { useEffect, useRef, useState } from 'react';
import { UIConfigSections } from '@/lib/config/types';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SetupConfig from './SetupConfig';

const STEPS = ['Welcome', 'Connections', 'Models'] as const;

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SetupWizard = ({
  configSections,
}: {
  configSections: UIConfigSections;
}) => {
  const [setupState, setSetupState] = useState(1);
  const setupRef = useRef<HTMLDivElement | null>(null);

  /* The step wrapper keeps a constant key, so it does not remount when the
  user moves between Connections and Models (remounting would reset
  SetupConfig's provider state). That also means the enter animation only runs
  once, so onAnimationComplete cannot move focus on later step changes. Move
  focus here instead so keyboard users do not lose it when the previous step's
  controls unmount. The initial 1 -> 2 mount is handled by onAnimationComplete
  (the wrapper mounts only after the intro's exit completes). */
  useEffect(() => {
    if (setupState <= 1) return;
    setupRef.current?.focus();
  }, [setupState]);

  return (
    <div className="bg-light-primary dark:bg-dark-primary fixed inset-0 overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Wordmark + step progress */}
        <header className="shrink-0 flex flex-col items-center pt-6 md:pt-10 select-none">
          <span className="text-sm md:text-base font-semibold tracking-tight text-black dark:text-white">
            Vane<span className="text-[#24A0ED]">.</span>
          </span>

          <div
            className="w-full max-w-[320px] px-6 mt-6 md:mt-8"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={setupState}
            aria-label={`Step ${setupState} of ${STEPS.length}: ${STEPS[setupState - 1]}`}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {STEPS.map((label, index) => (
                <div
                  key={label}
                  className={`h-1 rounded-full transition-colors duration-500 ${
                    index + 1 <= setupState
                      ? 'bg-[#24A0ED]'
                      : 'bg-light-200 dark:bg-dark-200'
                  }`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {STEPS.map((label, index) => (
                <span
                  key={label}
                  className={`text-center text-[10px] font-medium uppercase tracking-widest transition-colors duration-500 ${
                    index + 1 <= setupState
                      ? 'text-black/70 dark:text-white/70'
                      : 'text-black/60 dark:text-white/60'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Step content */}
        <main className="flex-1 flex items-center justify-center w-full px-4 sm:px-6 py-6 md:py-10">
          <AnimatePresence mode="wait" initial={false}>
            {setupState === 1 ? (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease },
                }}
                exit={{
                  opacity: 0,
                  y: -12,
                  transition: { duration: 0.3, ease },
                }}
                className="flex flex-col items-center text-center max-w-sm"
              >
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-black dark:text-white">
                  Welcome to
                  <span className="text-[#24A0ED]"> Vane</span>
                </h1>
                <p className="mt-3 text-sm md:text-base text-black/60 dark:text-white/60">
                  Web search, reimagined. Connect a model provider to finish
                  setting up.
                </p>
                <button
                  onClick={() => setSetupState(2)}
                  className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-[#24A0ED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e8fd1] active:scale-[0.98] transition-all duration-150"
                >
                  Get started
                  <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="setup"
                ref={setupRef}
                tabIndex={-1}
                initial={{ opacity: 0, y: 16 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease },
                }}
                exit={{
                  opacity: 0,
                  y: -16,
                  transition: { duration: 0.3, ease },
                }}
                onAnimationComplete={() => setupRef.current?.focus()}
                className="w-full max-w-[46rem] focus:outline-none"
              >
                <SetupConfig
                  configSections={configSections}
                  setupState={setupState}
                  setSetupState={setSetupState}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default SetupWizard;

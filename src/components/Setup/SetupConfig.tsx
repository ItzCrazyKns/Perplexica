import {
  ConfigModelProvider,
  UIConfigField,
  UIConfigSections,
} from '@/lib/config/types';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AddProvider from '../Settings/Sections/Models/AddProviderDialog';
import ModelProvider from '../Settings/Sections/Models/ModelProvider';
import ModelSelect from '@/components/Settings/Sections/Models/ModelSelect';
import Loader from '@/components/ui/Loader';

const SetupConfig = ({
  configSections,
  setupState,
  setSetupState,
}: {
  configSections: UIConfigSections;
  setupState: number;
  setSetupState: (state: number) => void;
}) => {
  const [providers, setProviders] = useState<ConfigModelProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  // Admin account state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminCreating, setAdminCreating] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to fetch providers');

        const data = await res.json();
        setProviders(data.providers || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast.error('Failed to load providers');
      } finally {
        setIsLoading(false);
      }
    };

    if (setupState === 2) {
      fetchProviders();
    }
  }, [setupState]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    if (adminPassword.length < 6) {
      setAdminError('Password must be at least 6 characters');
      return;
    }

    if (adminPassword !== adminConfirm) {
      setAdminError('Passwords do not match');
      return;
    }

    setAdminCreating(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAdminError(data.message || 'Failed to create admin account');
        return;
      }

      // Auto-login after creating admin
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
        }),
      });

      if (!loginRes.ok) {
        setAdminError('Admin created but auto-login failed. Please log in manually.');
        setSetupState(2);
        return;
      }

      setSetupState(2);
    } catch {
      setAdminError('Network error. Please try again.');
    } finally {
      setAdminCreating(false);
    }
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      const res = await fetch('/api/config/setup-complete', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to complete setup');

      window.location.href = '/';
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error('Failed to complete setup');
      setIsFinishing(false);
    }
  };

  const visibleProviders = providers.filter(
    (p) => p.name.toLowerCase() !== 'transformers',
  );
  const hasProviders =
    visibleProviders.filter((p) => p.chatModels.length > 0).length > 0;

  return (
    <div className="w-[95vw] md:w-[80vw] lg:w-[65vw] mx-auto px-2 sm:px-4 md:px-6 flex flex-col space-y-6">
      {/* Step 1: Create Admin Account */}
      {setupState === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                Create Admin Account
              </p>
              <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                Set up your admin account to manage Vane
              </p>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4 max-w-sm mx-auto">
              <div>
                <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                  minLength={2}
                  className="w-full px-3 py-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 transition-colors"
                  placeholder="Enter admin username"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 transition-colors"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={adminConfirm}
                  onChange={(e) => setAdminConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 transition-colors"
                  placeholder="Confirm password"
                />
              </div>

              {adminError && (
                <p className="text-red-500 text-xs text-center">{adminError}</p>
              )}

              <button
                type="submit"
                disabled={adminCreating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-[0.98] transition-all duration-200 font-medium text-sm disabled:opacity-60"
              >
                {adminCreating ? <Loader size="sm" /> : 'Create Account & Continue'}
                {!adminCreating && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {/* Step 2: Configure Providers */}
      {setupState === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, delay: 0.1 },
          }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  Manage Connections
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Add connections to access AI models
                </p>
              </div>
              <AddProvider
                modelProviders={configSections.modelProviders}
                setProviders={setProviders}
              />
            </div>

            <div className="space-y-3 md:space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 md:py-12">
                  <p className="text-xs sm:text-sm text-black/50 dark:text-white/50">
                    Loading providers...
                  </p>
                </div>
              ) : visibleProviders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                  <p className="text-xs sm:text-sm font-medium text-black/70 dark:text-white/70">
                    No connections configured
                  </p>
                  <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-1">
                    Click &quot;Add Connection&quot; above to get started
                  </p>
                </div>
              ) : (
                visibleProviders.map((provider) => (
                  <ModelProvider
                    key={`provider-${provider.id}`}
                    fields={
                      (configSections.modelProviders.find(
                        (f) => f.key === provider.type,
                      )?.fields ?? []) as UIConfigField[]
                    }
                    modelProvider={provider}
                    setProviders={setProviders}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 border-t border-light-200 dark:border-dark-200">
            <button
              onClick={() => setSetupState(1)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setSetupState(3)}
              disabled={!hasProviders || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-[0.98] transition-all text-xs sm:text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Select Models */}
      {setupState === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, delay: 0.1 },
          }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  Select models
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Select models which you wish to use.
                </p>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <ModelSelect providers={providers} type="chat" />
              <ModelSelect providers={providers} type="embedding" />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 border-t border-light-200 dark:border-dark-200">
            <button
              onClick={() => setSetupState(2)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleFinish}
              disabled={!hasProviders || isLoading || isFinishing}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-[0.98] transition-all text-xs sm:text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isFinishing ? 'Finishing...' : 'Finish'}
              {!isFinishing && <Check className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SetupConfig;

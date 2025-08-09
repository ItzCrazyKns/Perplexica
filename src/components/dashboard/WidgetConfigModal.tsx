'use client';

import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
  Switch,
} from '@headlessui/react';
import { X, Plus, Trash2, Play, Save, Brain } from 'lucide-react';
import { Fragment, useState, useEffect } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ModelSelector from '@/components/MessageInputActions/ModelSelector';
import ToolSelector from '@/components/MessageInputActions/ToolSelector';
import { WidgetConfig, Source } from '@/lib/types/widget';

// Helper function to replace date/time variables in prompts on the client side
const replaceDateTimeVariables = (prompt: string): string => {
  let processedPrompt = prompt;

  // Replace UTC datetime
  if (processedPrompt.includes('{{current_utc_datetime}}')) {
    const utcDateTime = new Date().toISOString();
    processedPrompt = processedPrompt.replace(
      /\{\{current_utc_datetime\}\}/g,
      utcDateTime,
    );
  }

  // Replace local datetime
  if (processedPrompt.includes('{{current_local_datetime}}')) {
    const now = new Date();
    const localDateTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    ).toISOString();
    processedPrompt = processedPrompt.replace(
      /\{\{current_local_datetime\}\}/g,
      localDateTime,
    );
  }

  return processedPrompt;
};

interface WidgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WidgetConfig) => void;
  editingWidget?: WidgetConfig | null;
}

const WidgetConfigModal = ({
  isOpen,
  onClose,
  onSave,
  editingWidget,
}: WidgetConfigModalProps) => {
  const [config, setConfig] = useState<WidgetConfig>({
    title: '',
    sources: [{ url: '', type: 'Web Page' }],
    prompt: '',
    provider: 'openai',
    model: 'gpt-4',
    refreshFrequency: 60,
    refreshUnit: 'minutes',
  });

  const [previewContent, setPreviewContent] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  } | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [showThinking, setShowThinking] = useState(false);

  // Update config when editingWidget changes
  useEffect(() => {
    if (editingWidget) {
      setConfig({
        title: editingWidget.title,
        sources: editingWidget.sources,
        prompt: editingWidget.prompt,
        provider: editingWidget.provider,
        model: editingWidget.model,
        refreshFrequency: editingWidget.refreshFrequency,
        refreshUnit: editingWidget.refreshUnit,
      });
      setSelectedModel({
        provider: editingWidget.provider,
        model: editingWidget.model,
      });
      setSelectedTools(editingWidget.tool_names || []);
    } else {
      // Reset to default values for new widget
      setConfig({
        title: '',
        sources: [{ url: '', type: 'Web Page' }],
        prompt: '',
        provider: 'openai',
        model: 'gpt-4',
        refreshFrequency: 60,
        refreshUnit: 'minutes',
      });
      setSelectedModel({
        provider: 'openai',
        model: 'gpt-4',
      });
      setSelectedTools([]);
    }
  }, [editingWidget]);

  // Update config when model selection changes
  useEffect(() => {
    if (selectedModel) {
      setConfig((prev) => ({
        ...prev,
        provider: selectedModel.provider,
        model: selectedModel.model,
      }));
    }
  }, [selectedModel]);

  const handleSave = () => {
    if (!config.title.trim() || !config.prompt.trim()) {
      return; // TODO: Add proper validation feedback
    }

    // Filter out sources with empty or whitespace-only URLs
    const filteredConfig = {
      ...config,
      sources: config.sources.filter((s) => s.url.trim()),
      tool_names: selectedTools,
    };

    onSave(filteredConfig);
    handleClose();
  };

  const handleClose = () => {
    setPreviewContent(''); // Clear preview content when closing
    onClose();
  };

  const handlePreview = async () => {
    if (!config.prompt.trim()) {
      setPreviewContent('Please enter a prompt before running preview.');
      return;
    }

    setIsPreviewLoading(true);
    try {
      // Replace date/time variables on the client side
      const processedPrompt = replaceDateTimeVariables(config.prompt);

      const response = await fetch('/api/dashboard/process-widget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sources: config.sources.filter((s) => s.url.trim()), // Only send sources with URLs
          prompt: processedPrompt,
          provider: config.provider,
          model: config.model,
          tool_names: selectedTools,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPreviewContent(result.content);
      } else {
        setPreviewContent(
          `**Preview Error:** ${result.error || 'Unknown error occurred'}\n\n${result.content || ''}`,
        );
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewContent(
        `**Network Error:** Failed to connect to the preview service.\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const addSource = () => {
    setConfig((prev) => ({
      ...prev,
      sources: [...prev.sources, { url: '', type: 'Web Page' }],
    }));
  };

  const removeSource = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index),
    }));
  };

  const updateSource = (index: number, field: keyof Source, value: string) => {
    setConfig((prev) => ({
      ...prev,
      sources: prev.sources.map((source, i) =>
        i === index ? { ...source, [field]: value } : source,
      ),
    }));
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-fg/75" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full lg:max-w-[85vw]  transform overflow-hidden rounded-2xl bg-surface p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium leading-6 text-fg flex items-center justify-between"
                >
                  {editingWidget ? 'Edit Widget' : 'Create New Widget'}
                  <button
                    onClick={handleClose}
                    className="p-1 hover:bg-surface-2 rounded"
                  >
                    <X size={20} />
                  </button>
                </DialogTitle>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Configuration */}
                  <div className="space-y-4">
                    {/* Widget Title */}
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">
                        Widget Title
                      </label>
                      <input
                        type="text"
                        value={config.title}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-surface-2 rounded-md bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Enter widget title..."
                      />
                    </div>

                    {/* Source URLs */}
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">
                        Source URLs
                      </label>
                      <div className="space-y-2">
                        {config.sources.map((source, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="url"
                              value={source.url}
                              onChange={(e) =>
                                updateSource(index, 'url', e.target.value)
                              }
                              className="flex-1 px-3 py-2 border border-surface-2 rounded-md bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                              placeholder="https://example.com"
                            />
                            <select
                              value={source.type}
                              onChange={(e) =>
                                updateSource(
                                  index,
                                  'type',
                                  e.target.value as Source['type'],
                                )
                              }
                              className="px-3 py-2 border border-surface-2 rounded-md bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="Web Page">Web Page</option>
                              <option value="HTTP Data">HTTP Data</option>
                            </select>
                            {config.sources.length > 1 && (
                              <button
                                onClick={() => removeSource(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={addSource}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-surface-2 rounded"
                        >
                          <Plus size={16} />
                          Add Source
                        </button>
                      </div>
                    </div>

                    {/* LLM Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">
                        LLM Prompt
                      </label>
                      <textarea
                        value={config.prompt}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            prompt: e.target.value,
                          }))
                        }
                        rows={8}
                        className="w-full px-3 py-2 border border-surface-2 rounded-md bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Enter your prompt here..."
                      />
                    </div>

                    {/* Provider and Model Selection */}
                    <div>
                      <label className="block text-sm font-medium text-fg mb-2">
                        Model & Provider
                      </label>
                      <ModelSelector
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                        truncateModelName={false}
                        showModelName={true}
                      />
                      <p className="text-xs text-fg/60 mt-1">
                        Select the AI model and provider to process your widget
                        content
                      </p>
                    </div>

                    {/* Tool Selection */}
                    <div>
                      <label className="block text-sm font-medium text-fg mb-2">
                        Available Tools
                      </label>
                      <ToolSelector
                        selectedToolNames={selectedTools}
                        onSelectedToolNamesChange={setSelectedTools}
                      />
                      <p className="text-xs text-fg/60 mt-1">
                        Select tools to assist the AI in processing your widget.
                        Your model must support tool calling.
                      </p>
                    </div>

                    {/* Refresh Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">
                        Refresh Frequency
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={config.refreshFrequency}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              refreshFrequency: parseInt(e.target.value) || 1,
                            }))
                          }
                          className="flex-1 px-3 py-2 border border-surface-2 rounded-md bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <select
                          value={config.refreshUnit}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              refreshUnit: e.target.value as
                                | 'minutes'
                                | 'hours',
                            }))
                          }
                          className="px-3 py-2 border border-surface-2 rounded-md bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Preview */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-fg">Preview</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Brain size={16} className="text-fg/70" />
                          <span className="text-sm text-fg/80">Thinking</span>
                          <Switch
                            checked={showThinking}
                            onChange={setShowThinking}
                            className="bg-surface border border-surface-2 relative inline-flex h-5 w-10 sm:h-6 sm:w-11 items-center rounded-full"
                          >
                            <span className="sr-only">Show thinking tags</span>
                            <span
                              className={`${
                                showThinking
                                  ? 'translate-x-6 bg-purple-600'
                                  : 'translate-x-1 bg-fg/50'
                              } inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full transition-all duration-200`}
                            />
                          </Switch>
                        </div>
                        <button
                          onClick={handlePreview}
                          disabled={isPreviewLoading}
                          className="flex items-center gap-2 px-3 py-2 bg-accent text-white rounded hover:bg-accent-700 disabled:opacity-50"
                        >
                          <Play size={16} />
                          {isPreviewLoading ? 'Loading...' : 'Run Preview'}
                        </button>
                      </div>
                    </div>

                    <div className="h-80 p-4 border border-surface-2 rounded-md bg-surface overflow-y-auto max-w-full">
                      {previewContent ? (
                        <div className="prose prose-sm max-w-full">
                          <MarkdownRenderer
                            showThinking={showThinking}
                            content={previewContent}
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-fg/50 italic">
                          Click &quot;Run Preview&quot; to see how your widget
                          will look
                        </div>
                      )}
                    </div>

                    {/* Variable Legend */}
                    <div className="text-xs text-fg/70">
                      <h5 className="font-medium mb-2">Available Variables:</h5>
                      <div className="space-y-1">
                        <div>
                          <code className="bg-surface-2 px-1 rounded">
                            {'{{current_utc_datetime}}'}
                          </code>{' '}
                          - Current UTC date and time
                        </div>
                        <div>
                          <code className="bg-surface-2 px-1 rounded">
                            {'{{current_local_datetime}}'}
                          </code>{' '}
                          - Current local date and time
                        </div>
                        <div>
                          <code className="bg-surface-2 px-1 rounded">
                            {'{{source_content_1}}'}
                          </code>{' '}
                          - Content from first source
                        </div>
                        <div>
                          <code className="bg-surface-2 px-1 rounded">
                            {'{{source_content_2}}'}
                          </code>{' '}
                          - Content from second source
                        </div>
                        <div>
                          <code className="bg-surface-2 px-1 rounded">
                            {'{{source_content_...}}'}
                          </code>{' '}
                          - Content from nth source
                        </div>
                        <div>
                          <code className="bg-surface-2 px-1 rounded">
                            {'{{location}}'}
                          </code>{' '}
                          - Your current location
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-fg bg-surface hover:bg-surface-2 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-700 rounded-md"
                  >
                    <Save size={16} />
                    {editingWidget ? 'Update Widget' : 'Create Widget'}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default WidgetConfigModal;

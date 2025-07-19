'use client';

import { Plus, RefreshCw, Download, Upload, LayoutDashboard, Layers, List } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import WidgetConfigModal from '@/components/dashboard/WidgetConfigModal';
import WidgetDisplay from '@/components/dashboard/WidgetDisplay';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { Widget, WidgetConfig } from '@/lib/types';

const DashboardPage = () => {
  const {
    widgets,
    isLoading,
    addWidget,
    updateWidget,
    deleteWidget,
    refreshWidget,
    refreshAllWidgets,
    exportDashboard,
    importDashboard,
    settings,
    updateSettings,
  } = useDashboard();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);  const handleAddWidget = () => {
    setEditingWidget(null);
    setShowAddModal(true);
  };

  const handleEditWidget = (widget: Widget) => {
    setEditingWidget(widget);
    setShowAddModal(true);
  };

  const handleSaveWidget = (widgetConfig: WidgetConfig) => {
    if (editingWidget) {
      // Update existing widget
      updateWidget(editingWidget.id, widgetConfig);
    } else {
      // Add new widget
      addWidget(widgetConfig);
    }
    setShowAddModal(false);
    setEditingWidget(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingWidget(null);
  };

  const handleDeleteWidget = (widgetId: string) => {
    deleteWidget(widgetId);
  };

  const handleRefreshWidget = (widgetId: string) => {
    refreshWidget(widgetId, true); // Force refresh when manually triggered
  };

  const handleRefreshAll = () => {
    refreshAllWidgets();
  };

  const handleExport = async () => {
    try {
      const configJson = await exportDashboard();
      await navigator.clipboard.writeText(configJson);
      // TODO: Add toast notification for success
      console.log('Dashboard configuration copied to clipboard');
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Add toast notification for error
    }
  };

  const handleImport = async () => {
    try {
      const configJson = await navigator.clipboard.readText();
      await importDashboard(configJson);
      // TODO: Add toast notification for success
      console.log('Dashboard configuration imported successfully');
    } catch (error) {
      console.error('Import failed:', error);
      // TODO: Add toast notification for error
    }
  };

  const handleToggleProcessingMode = () => {
    updateSettings({ parallelLoading: !settings.parallelLoading });
  };

  // Empty state component
  const EmptyDashboard = () => (
    <div className="col-span-2 flex justify-center items-center min-h-[400px]">
      <Card className="w-96 text-center">
        <CardHeader>
          <CardTitle>Welcome to your Dashboard</CardTitle>
          <CardDescription>
            Create your first widget to get started with personalized information
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Widgets let you fetch content from any URL and process it with AI to show exactly what you need.
          </p>
        </CardContent>
        
        <CardFooter className="justify-center">
          <button 
            onClick={handleAddWidget}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200 flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Create Your First Widget</span>
          </button>
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header matching other pages */}
      <div className="flex flex-col pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <LayoutDashboard />
            <h1 className="text-3xl font-medium p-2">Dashboard</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefreshAll}
              className="p-2 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded-lg transition duration-200"
              title="Refresh All Widgets"
            >
              <RefreshCw size={18} className="text-black dark:text-white" />
            </button>
            
            <button
              onClick={handleToggleProcessingMode}
              className="p-2 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded-lg transition duration-200"
              title={`Switch to ${settings.parallelLoading ? 'Sequential' : 'Parallel'} Processing`}
            >
              {settings.parallelLoading ? (
                <Layers size={18} className="text-black dark:text-white" />
              ) : (
                <List size={18} className="text-black dark:text-white" />
              )}
            </button>
            
            <button
              onClick={handleExport}
              className="p-2 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded-lg transition duration-200"
              title="Export Dashboard Configuration"
            >
              <Download size={18} className="text-black dark:text-white" />
            </button>
            
            <button
              onClick={handleImport}
              className="p-2 hover:bg-light-secondary dark:hover:bg-dark-secondary rounded-lg transition duration-200"
              title="Import Dashboard Configuration"
            >
              <Upload size={18} className="text-black dark:text-white" />
            </button>
            
            <button
              onClick={handleAddWidget}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition duration-200"
              title="Add New Widget"
            >
              <Plus size={18} className="text-white" />
            </button>
          </div>
        </div>
        <hr className="border-t border-[#2B2C2C] my-4 w-full" />
      </div>

      {/* Main content area */}
      <div className="flex-1 pb-20 lg:pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
            </div>
          </div>
        ) : widgets.length === 0 ? (
          <EmptyDashboard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-min">
            {widgets.map((widget) => (
              <WidgetDisplay
                key={widget.id}
                widget={widget}
                onEdit={handleEditWidget}
                onDelete={handleDeleteWidget}
                onRefresh={handleRefreshWidget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Widget Configuration Modal */}
      <WidgetConfigModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onSave={handleSaveWidget}
        editingWidget={editingWidget}
      />
    </div>
  );
};

export default DashboardPage;

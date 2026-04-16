'use client';

import { useEffect, useState } from 'react';
import SetupWizard from './SetupWizard';

export default function SetupWrapper() {
  const [configSections, setConfigSections] = useState<any>(null);

  useEffect(() => {
    fetch('/api/config/sections')
      .then((res) => res.json())
      .then((data) => setConfigSections(data.sections))
      .catch(console.error);
  }, []);

  if (!configSections) return null;

  return <SetupWizard configSections={configSections} />;
}

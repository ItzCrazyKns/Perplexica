import React from 'react';

interface Props {
  status: {
    loaded: boolean;
    model: string;
    loadingProgress: number;
  };
}

const ModelStatus: React.FC<Props> = ({ status }) => {
  if (status.loaded) {
    return (
      <span className="sp-model-status sp-model-status--ready">
        &#x25CF; {status.model} ready
      </span>
    );
  }

  if (status.loadingProgress > 0 && status.loadingProgress < 1) {
    return (
      <span className="sp-model-status sp-model-status--loading">
        Loading {Math.round(status.loadingProgress * 100)}%
      </span>
    );
  }

  return (
    <span className="sp-model-status sp-model-status--heuristics">
      &#x25CF; Heuristics mode
    </span>
  );
};

export default ModelStatus;

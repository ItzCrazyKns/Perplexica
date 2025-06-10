let isErrorSuppressionActive = false;

export const suppressTokenCountingMessages = () => {
  // Prevent multiple initializations
  if (isErrorSuppressionActive) {
    return;
  }

  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args.join(' ');

    // Skip warnings related to token counting
    if (
      message.includes('Failed to calculate number of tokens') ||
      message.includes('Unknown model')
    ) {
      return;
    }

    originalWarn.apply(console, args);
  };

  const originalError = console.error;
  console.error = (...args) => {
    const message = args.join(' ');

    // Ignore JSDom errors related to CSS parsing
    if (message.includes('Could not parse CSS stylesheet')) {
      return;
    }

    originalError.apply(console, args);
  };

  isErrorSuppressionActive = true;
};

// Auto-initialize error suppression when this module is imported (server-side only)
if (typeof window === 'undefined') {
  suppressTokenCountingMessages();
}

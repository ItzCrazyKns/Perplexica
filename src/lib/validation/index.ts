export const validFocusModes = [
  'webSearch',
  'academicSearch',
  'writingAssistant',
  'wolframAlphaSearch',
  'youtubeSearch',
  'redditSearch',
] as const;

export const isValidFocusMode = (focusMode: string): boolean => {
  return validFocusModes.includes(focusMode as typeof validFocusModes[number]);
};

import { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transcribeWithGrok } from '@/lib/grok';

/**
 * VoiceInput component with voice recognition icon
 * Shows animated voice icon bars when recording (stable animation)
 */
const VoiceInput = ({
  message,
  setMessage,
}: {
  message: string;
  setMessage: (text: string) => void;
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone permission denied', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream
        ?.getTracks()
        .forEach((track) => track.stop());
    }
  };

  const handleStop = async () => {
    setRecording(false);
    setTranscribing(true);
    console.log('Starting transcription...');

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

    try {
      const text = await transcribeWithGrok(blob);
      console.log('Transcription completed:', text);
      if (text) {
        // Append to existing message with proper spacing
        const newMessage = message.trim()
          ? `${message.trim()} ${text.trim()}`
          : text.trim();
        setMessage(newMessage);
      }
    } catch (err) {
      console.error('Transcription failed', err);
    } finally {
      setTranscribing(false);
      console.log('Transcription finished');
    }
  };

  // Voice recognition icon component
  const VoiceIcon = () => (
    <div className="flex items-end justify-center space-x-1">
      <div className="w-1 bg-[#24A0ED] rounded-full voice-bar-1" />
      <div className="w-1 bg-[#24A0ED] rounded-full voice-bar-2" />
      <div className="w-1 bg-[#24A0ED] rounded-full voice-bar-3" />
    </div>
  );

  return (
    <div className="flex items-center">
      {!recording ? (
        <button
          type="button"
          aria-label="Start voice input"
          onClick={startRecording}
          className="p-2 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200 hover:scale-105"
        >
          <Mic size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      ) : (
        <div className="flex items-center space-x-2 bg-[#24A0ED]/10 rounded-xl px-3 py-2">
          {/* Voice recognition icon */}
          <VoiceIcon />

          {/* Stop recording button */}
          <button
            type="button"
            aria-label="Stop recording"
            onClick={stopRecording}
            className="p-1 rounded-md hover:bg-red-500/20 transition-colors duration-200"
          >
            <Square size={16} className="text-red-500 fill-red-500" />
          </button>
        </div>
      )}

      {/* Subtle transcription indicator */}
      {transcribing && (
        <div className="ml-2 flex items-center space-x-1">
          <div className="w-4 h-4 border-2 border-gray-300/40 dark:border-gray-500/40 border-t-[#24A0ED] rounded-full animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            transcribing...
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;

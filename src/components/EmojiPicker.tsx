'use client';

const EMOJIS = [
  '😀', '🤔', '😎', '🤖', '🥳', '😍', '🧠', '👋',
  '🚀', '💡', '📚', '🔧', '💼', '📌', '🖥️', '🔬',
  '🌍', '🔥', '🌱', '⭐', '🌙', '☀️', '🌊', '🍀',
  '🎯', '⚡', '🧪', '📈', '❤️', '🎨', '🏆', '🔑',
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const EmojiPicker = ({ value, onChange }: EmojiPickerProps) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${
              value === emoji
                ? 'bg-[#24A0ED]/20 ring-2 ring-[#24A0ED]'
                : 'bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED] text-center text-xl"
        placeholder="✏️"
        maxLength={4}
      />
    </div>
  );
};

export default EmojiPicker;

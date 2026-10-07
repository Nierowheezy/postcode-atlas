import React from 'react';
import { useTheme, Theme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { Sun, Moon, Laptop } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { value: 'system', label: 'System', icon: <Laptop className="w-3.5 h-3.5" /> },
  ];

  const handleSelect = (val: Theme, label: string) => {
    setTheme(val);
    showToast({
      title: `${label} Mode Active`,
      description: val === 'system' ? 'Synced with system appearance' : `Switched to ${label.toLowerCase()} theme`,
      type: 'info',
    });
  };

  return (
    <div
      className="flex items-center bg-[#F3F4F6] dark:bg-[#1F2937] p-0.5 rounded-md border border-[#E5E7EB] dark:border-[#374151] select-none"
      role="group"
      aria-label="Theme selection"
    >
      {options.map((opt) => {
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value, opt.label)}
            className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs font-semibold'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
            }`}
            title={`${opt.label} mode`}
            aria-label={`${opt.label} theme`}
            aria-pressed={isActive}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
};

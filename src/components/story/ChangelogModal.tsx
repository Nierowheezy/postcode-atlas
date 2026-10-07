import React, { useMemo } from 'react';
import { X, GitCommitHorizontal } from 'lucide-react';
// The changelog ships inside the bundle, so release notes are readable
// offline and without a network round trip.
import rawChangelog from '../../../CHANGELOG.md?raw';
import { APP_VERSION } from '../../lib/version';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Renders the top section of CHANGELOG.md.
 *
 * A full CommonMark renderer would be overkill here and would add a runtime
 * dependency for a document we control. This handles the subset the changelog
 * actually uses: headings, links, inline code, bold, and list items.
 */
function renderMarkdown(markdown: string): React.ReactNode[] {
  const lines = markdown.split('\n');
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${key++}`} className="my-2 space-y-1.5 pl-4 list-disc">
          {list}
        </ul>
      );
      list = [];
    }
  };

  const inline = (text: string): React.ReactNode[] =>
    text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((part, i) => {
      if (part.startsWith('`')) {
        return (
          <code key={i} className="font-mono text-[11px] bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-stone-800 dark:text-stone-200">
            {part.slice(2, -2)}
          </strong>
        );
      }
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        return (
          <a
            key={i}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            {link[1]}
          </a>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const sizes: Record<number, string> = {
        1: 'text-base font-semibold mt-4 mb-2 first:mt-0',
        2: 'text-sm font-semibold mt-5 mb-2',
        3: 'text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mt-4 mb-1.5',
        4: 'text-xs font-semibold mt-3 mb-1.5',
      };
      out.push(
        <p key={key++} className={sizes[level] ?? sizes[4]}>
          {inline(heading[2])}
        </p>
      );
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushList();
      out.push(<hr key={key++} className="my-4 border-stone-200 dark:border-stone-700" />);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      list.push(
        <li key={key++} className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">
          {inline(bullet[1])}
        </li>
      );
      continue;
    }

    flushList();
    out.push(
      <p key={key++} className="text-xs leading-relaxed text-stone-600 dark:text-stone-400 my-1.5">
        {inline(line)}
      </p>
    );
  }

  flushList();
  return out;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const content = useMemo(() => renderMarkdown(rawChangelog), []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-stone-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111827] rounded-xl border border-stone-200 dark:border-stone-700 shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto font-sans"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Release notes"
      >
        <div className="flex items-start justify-between pb-3 border-b border-stone-100 dark:border-stone-700 sticky top-0 bg-white dark:bg-[#111827]">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-stone-900 dark:text-white flex items-center gap-1.5">
              <GitCommitHorizontal className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              What&rsquo;s new
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
              v{APP_VERSION} &middot; github.com/Nierowheezy/postcode-atlas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-3">{content}</div>
      </div>
    </div>
  );
};
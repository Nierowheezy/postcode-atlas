import React, { useState } from 'react';
import { Target, CheckCircle2, ChevronRight, Play } from 'lucide-react';
import { PostcodeLocation } from '../../types/postcode';
import { ModalSurface } from '../ui/ModalSurface';

interface PostcodeHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartHunt: (targetCode: string, hint: string) => void;
  activeTarget: string | null;
  hasFound: boolean;
  score: number;
  attempts: number;
  onSelectDiscoveryPoint: (point: PostcodeLocation) => void;
}

const HUNT_CHALLENGES = [
  {
    id: 'hunt-1',
    code: 'LA-11-A12-AK-08',
    hint: 'Lagos · Ikeja (Near Ipodo Street)',
    coords: [6.596577, 3.342144] as [number, number],
    difficulty: 'Standard',
  },
  {
    id: 'hunt-2',
    code: 'FC-02-D43-LG-01',
    hint: 'Abuja FCT · Central Business District (Infrastructure Bank)',
    coords: [9.057977, 7.493727] as [number, number],
    difficulty: 'Intermediate',
  },
  {
    id: 'hunt-3',
    code: 'LA-08-A12-EE-01',
    hint: 'Lagos · Victoria Island (Adeola Odeku Street)',
    coords: [6.428235, 3.422026] as [number, number],
    difficulty: 'Advanced',
  },
  {
    id: 'hunt-4',
    code: 'KN-31-A08-FJ-33',
    hint: 'Kano · Nasarawa LGA (Hotoron Arewa)',
    coords: [12.002151, 8.591997] as [number, number],
    difficulty: 'Expert',
  },
];

export const PostcodeHuntModal: React.FC<PostcodeHuntModalProps> = ({
  isOpen,
  onClose,
  onStartHunt,
  activeTarget,
  hasFound,
  score,
  attempts,
}) => {
  const [selectedChallenge, setSelectedChallenge] = useState(HUNT_CHALLENGES[0]);

  return (
    <ModalSurface
      open={isOpen}
      onClose={onClose}
      label="Postcode Hunt"
      placement="center"
      desktopSize="md:max-w-md"
      header={
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-tight text-stone-900 dark:text-white">
            Postcode Hunt
          </h3>
        </div>
      }
    >
      {/* The shell body has no padding of its own and the shell caps the sheet
          height, so this card gains the scroll region it never had. */}
      <div className="p-4 text-stone-900 dark:text-white select-none">
        {hasFound ? (
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-900 dark:text-white">Target Discovered</div>
              <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 mt-1">{activeTarget}</div>
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">
              Score: +{score} pts · {attempts} attempts
            </div>
            <button
              onClick={() => {
                const next = HUNT_CHALLENGES[(HUNT_CHALLENGES.findIndex((c) => c.code === activeTarget) + 1) % HUNT_CHALLENGES.length];
                setSelectedChallenge(next);
                onStartHunt(next.code, next.hint);
                onClose();
              }}
              className="mt-2 px-4 py-2 text-xs font-medium bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-lg hover:bg-stone-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              Next Challenge
            </button>
          </div>
        ) : activeTarget ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-1.5 font-mono text-xs">
              <div className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Target Postcode
              </div>
              <div className="text-base font-bold text-stone-900 dark:text-white tracking-wider">
                {activeTarget}
              </div>
              <div className="text-[11px] text-stone-600 dark:text-stone-400 font-sans pt-1 border-t border-stone-200 dark:border-stone-700">
                Hint: {selectedChallenge?.hint}
              </div>
            </div>

            <div className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-sans">
              Navigate the interactive map into the specified state and LGA. Zoom to building-level to find and select this exact addressable digital postcode.
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-700">
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                Attempts: {attempts}
              </span>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-stone-900 dark:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-md transition-colors cursor-pointer"
              >
                Resume Exploration
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Test your spatial intuition of Nigeria's digital addressing system. Pick an official 11-character postcode target, locate its administrative zone on the map, and pinpoint the building.
            </p>

            <div className="space-y-2">
              <div className="text-[11px] font-mono text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Select Mission
              </div>
              {HUNT_CHALLENGES.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChallenge(ch)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                    selectedChallenge.id === ch.id
                      ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/10'
                      : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 bg-stone-50/50 dark:bg-stone-800/50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-mono font-semibold text-stone-900 dark:text-white">
                      {ch.code}
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">{ch.hint}</div>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                    {ch.difficulty}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  onStartHunt(selectedChallenge.code, selectedChallenge.hint);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Hunt</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalSurface>
  );
};

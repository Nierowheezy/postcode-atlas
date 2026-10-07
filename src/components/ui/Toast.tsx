import React from 'react';
import { useToast } from '../../hooks/useToast';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none select-none max-w-sm w-full px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-center gap-2.5 px-3 py-2 bg-[#111827]/95 text-white backdrop-blur-md rounded-lg border border-[#374151] shadow-lg text-xs font-sans max-w-full"
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
            )}
            {toast.type === 'info' && (
              <Info className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
            )}

            <div className="truncate">
              <span className="font-medium text-white">{toast.title}</span>
              {toast.description && (
                <span className="text-[#9CA3AF] ml-1.5 font-normal">
                  {toast.description}
                </span>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#9CA3AF] hover:text-white p-0.5 rounded transition-colors ml-1 cursor-pointer"
              aria-label="Close notification"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

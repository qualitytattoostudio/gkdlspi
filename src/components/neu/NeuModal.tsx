import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NeuCard } from './NeuCard';
import { AnimatePresence, motion } from 'framer-motion';

interface NeuModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function NeuModal({ isOpen, onClose, title, children, className }: NeuModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neu-bg/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-lg z-10"
          >
            <NeuCard className={cn("p-6 md:p-8 flex flex-col max-h-[90vh]", className)}>
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-xl font-display font-bold text-neu-fg">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-neu-bg shadow-neu-small hover:shadow-neu-lifted active:shadow-neu-inset transition-all text-neu-muted hover:text-red-500"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto pr-2 pb-2 scrollbar-hide flex-1">
                {children}
              </div>
            </NeuCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

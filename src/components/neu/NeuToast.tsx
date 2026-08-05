'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore, Toast } from '@/store/toastStore';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playClick } from '@/lib/audio';

const ToastIcon = ({ type }: { type: Toast['type'] }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="text-neu-accent" size={20} />;
    case 'error':
      return <XCircle className="text-red-500" size={20} />;
    case 'warning':
      return <AlertCircle className="text-amber-500" size={20} />;
    case 'info':
      return <Info className="text-neu-accent-secondary" size={20} />;
  }
};

const ToastItem = ({ toast }: { toast: Toast }) => {
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className="bg-neu-bg border border-neu-muted/10 shadow-neu-lifted rounded-2xl p-4 flex items-start gap-3 w-[350px] max-w-[calc(100vw-32px)]"
    >
      <div className="shrink-0 mt-0.5">
        <ToastIcon type={toast.type} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-neu-fg">{toast.title}</h4>
        {toast.message && <p className="text-xs text-neu-muted mt-1">{toast.message}</p>}
      </div>
      <button
        onClick={() => {
          playClick();
          removeToast(toast.id);
        }}
        className="text-neu-muted hover:text-neu-fg transition-colors p-1"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

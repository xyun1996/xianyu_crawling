'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认删除',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="bg-card border border-border rounded-lg p-0 max-w-sm w-full shadow-lg backdrop:bg-ink/30"
      onClose={onCancel}
    >
      <div className="p-5">
        <h3 className="text-base font-semibold text-ink mb-2">{title}</h3>
        <p className="text-sm text-muted mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-1.5 text-sm border border-border rounded-md text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-sm rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '删除中…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

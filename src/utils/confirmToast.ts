import toast from 'react-hot-toast';
import React from 'react';

interface ConfirmToastOptions {
  duration?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  isDangerous?: boolean;
}

export function confirmToast(
  title: string,
  message: string,
  onConfirm: () => void,
  options: ConfirmToastOptions = {}
): string {
  const {
    duration = 10000,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmClassName = options.isDangerous
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white',
  } = options;

  return toast(
    (t) =>
      React.createElement(
        'div',
        null,
        React.createElement('p', { className: 'font-medium' }, title),
        React.createElement('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mt-1' }, message),
        React.createElement(
          'div',
          { className: 'flex gap-2 mt-3' },
          React.createElement(
            'button',
            {
              className: `px-3 py-1 text-sm rounded ${confirmClassName}`,
              onClick: () => {
                onConfirm();
                toast.dismiss(t.id);
              },
            },
            confirmLabel
          ),
          React.createElement(
            'button',
            {
              className: 'px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600',
              onClick: () => {
                toast.dismiss(t.id);
              },
            },
            cancelLabel
          )
        )
      ),
    { duration }
  );
}

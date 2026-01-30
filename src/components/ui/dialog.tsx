'use client';

import * as React from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = React.useState(open ?? false);

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { open: isOpen, onOpenChange: handleOpenChange } as any)
          : child
      )}
    </div>
  );
}

export function DialogTrigger({ asChild, children, onClick }: any) {
  return (
    <div onClick={onClick}>
      {children}
    </div>
  );
}

export function DialogContent({ className, children }: any) {
  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className || ''}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ children }: any) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({ children }: any) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function DialogDescription({ children }: any) {
  return <p className="text-sm text-gray-600">{children}</p>;
}

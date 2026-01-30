'use client';

import * as React from 'react';

export function Table({ children, className }: any) {
  return (
    <table className={`w-full border-collapse ${className || ''}`}>
      {children}
    </table>
  );
}

export function TableHeader({ children, className }: any) {
  return (
    <thead className={`bg-gray-100 ${className || ''}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: any) {
  return (
    <tbody className={className || ''}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className }: any) {
  return (
    <tr className={`border-b ${className || ''}`}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className }: any) {
  return (
    <th className={`text-left px-4 py-2 font-semibold ${className || ''}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className }: any) {
  return (
    <td className={`px-4 py-2 ${className || ''}`}>
      {children}
    </td>
  );
}

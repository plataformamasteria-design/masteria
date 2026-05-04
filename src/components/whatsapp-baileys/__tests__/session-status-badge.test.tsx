/* @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SessionStatusBadge } from '../session-status-badge';

describe('SessionStatusBadge', () => {
  it('should render connected status', () => {
    render(<SessionStatusBadge status="connected" />);
    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('should render connecting status', () => {
    render(<SessionStatusBadge status="connecting" />);
    expect(screen.getByText('Conectando')).toBeInTheDocument();
  });

  it('should render disconnected status', () => {
    render(<SessionStatusBadge status="disconnected" />);
    expect(screen.getByText('Desconectado')).toBeInTheDocument();
  });

  it('should render failed status', () => {
    render(<SessionStatusBadge status="failed" />);
    expect(screen.getByText('Falhou')).toBeInTheDocument();
  });

  it('should render qr status as connecting', () => {
    render(<SessionStatusBadge status="qr" />);
    expect(screen.getByText('Conectando')).toBeInTheDocument();
  });

  it('should render unknown status', () => {
    render(<SessionStatusBadge status="unknown" />);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});

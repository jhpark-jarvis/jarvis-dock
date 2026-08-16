import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the accessible application shell and its empty states', () => {
    render(<App />);

    expect(
      screen.getByRole('main', { name: 'Dock 작업 공간' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Dock', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: '문서' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '새 문서' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '미리보기' }),
    ).toBeInTheDocument();
    expect(screen.getByText('열어 둔 문서가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('미리볼 문서가 없습니다.')).toBeInTheDocument();
  });

  it('keeps the command, document selection, and editor in keyboard focus order', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();
    expect(
      screen.getByRole('button', { name: '명령 팔레트 열기' }),
    ).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '폴더 선택' })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('textbox', { name: 'Markdown 편집기' }),
    ).toHaveFocus();
  });

  it('shows loading and error messages as distinct accessible states', () => {
    const { rerender } = render(<App state="loading" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '문서 목록을 준비하고 있습니다.',
    );

    rerender(<App state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '문서 목록을 불러오지 못했습니다.',
    );
  });
});

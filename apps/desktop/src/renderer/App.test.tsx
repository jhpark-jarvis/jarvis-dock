import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the Dock title and its product description', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Dock', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Local Markdown developer workspace'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dock' })).toBeInTheDocument();
  });
});

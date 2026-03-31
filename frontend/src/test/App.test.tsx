import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

describe('LoginPage smoke test', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });
});

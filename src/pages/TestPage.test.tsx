import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TestPage from './TestPage'

vi.mock('#hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-123' } },
    loading: false,
  }),
}))

vi.mock('#data/corpus', () => ({
  // Single-word corpus makes the generated text fully deterministic.
  getCorpus: vi.fn().mockResolvedValue(['halo']),
}))

const saveSessionMock = vi.fn().mockResolvedValue(undefined)
vi.mock('#lib/sessions', () => ({
  saveSession: (...args: unknown[]) => saveSessionMock(...args),
}))

vi.mock('#lib/wordStats', () => ({
  fetchWordStats: vi.fn().mockResolvedValue([]),
}))

describe('TestPage', () => {
  beforeEach(() => {
    saveSessionMock.mockClear()
  })

  it('completes a typing test and saves the session', async () => {
    const user = userEvent.setup()
    render(<TestPage />)

    const input = await screen.findByPlaceholderText(
      'Mulai mengetik di sini...',
    )

    // Corpus is mocked to always return "halo", 20 times.
    const targetText = new Array(20).fill('halo').join(' ')
    await user.type(input, targetText)

    await waitFor(() => {
      expect(screen.getByText(/WPM/)).toBeInTheDocument()
    })
    expect(saveSessionMock).toHaveBeenCalledTimes(1)
    expect(saveSessionMock.mock.calls[0][0]).toMatchObject({
      userId: 'user-123',
      mode: 'normal',
      language: 'id',
    })
  })
})

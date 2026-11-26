import { describe, expect, it, vi } from 'vitest'

import { isNewerVersion, startSpaceUpdateListener } from './realtime-space-notice'

describe('isNewerVersion (STORY-20, D-086)', () => {
  it('treats the same instant written with +00:00 and Z as unchanged', () => {
    expect(
      isNewerVersion('2026-11-26T17:00:00.123456+00:00', '2026-11-26T17:00:00.123456Z'),
    ).toBe(false)
  })

  it('detects a microsecond change on the same millisecond', () => {
    expect(
      isNewerVersion('2026-11-26T17:00:00.123456Z', '2026-11-26T17:00:00.123457Z'),
    ).toBe(true)
  })

  it('treats missing or unreadable timestamps as changed so N9 is not the only guard', () => {
    expect(isNewerVersion('2026-11-26T17:00:00Z', null)).toBe(true)
    expect(isNewerVersion('2026-11-26T17:00:00Z', 'not-a-date')).toBe(true)
  })
})

describe('startSpaceUpdateListener (STORY-20, D-086)', () => {
  it('awaits realtime.setAuth() before subscribing so RLS receives the admin JWT', async () => {
    const order: string[] = []
    let resolveAuth!: () => void
    const authReady = new Promise<void>((resolve) => {
      resolveAuth = () => {
        order.push('setAuth')
        resolve()
      }
    })
    let handler: ((payload: { new: unknown }) => void) | null = null
    const fakeChannel = { id: 'chan-1' }
    const removeChannel = vi.fn().mockResolvedValue('ok')
    const supabase = {
      realtime: { setAuth: vi.fn(() => authReady) },
      channel: vi.fn(() => {
        order.push('channel')
        return {
          on: vi.fn((_type, _filter, cb) => {
            handler = cb
            return {
              subscribe: vi.fn(() => {
                order.push('subscribe')
                return fakeChannel
              }),
            }
          }),
        }
      }),
      removeChannel,
    }

    const onUpdate = vi.fn()
    const stop = startSpaceUpdateListener(supabase, onUpdate)

    expect(supabase.channel).not.toHaveBeenCalled()

    resolveAuth()
    await Promise.resolve()
    await Promise.resolve()

    expect(order).toEqual(['setAuth', 'channel', 'subscribe'])
    handler!({ new: { id: 'space-1', updated_at: '2026-11-26T17:00:01Z' } })
    expect(onUpdate).toHaveBeenCalledWith({
      id: 'space-1',
      updated_at: '2026-11-26T17:00:01Z',
    })

    stop()
    expect(removeChannel).toHaveBeenCalledWith(fakeChannel)
  })

  it('does not subscribe if unmounted before setAuth() resolves', async () => {
    let resolveAuth!: () => void
    const authReady = new Promise<void>((resolve) => {
      resolveAuth = resolve
    })
    const channel = vi.fn()
    const removeChannel = vi.fn()
    const supabase = {
      realtime: { setAuth: vi.fn(() => authReady) },
      channel,
      removeChannel,
    }

    const stop = startSpaceUpdateListener(supabase, vi.fn())
    stop()
    resolveAuth()
    await Promise.resolve()
    await Promise.resolve()

    expect(channel).not.toHaveBeenCalled()
    expect(removeChannel).not.toHaveBeenCalled()
  })
})

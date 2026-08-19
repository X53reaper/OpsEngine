describe('rate-limiter', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      const { checkRateLimit } = await import('../services/security.service')

      const result = checkRateLimit('test-key-1', 10, 60000)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.resetAt).toBeInstanceOf(Date)
    })

    it('should reject requests over the limit', async () => {
      const { checkRateLimit } = await import('../services/security.service')

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit('test-key-2', 5, 60000)
      }

      // Next request should be rejected
      const result = checkRateLimit('test-key-2', 5, 60000)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset counter after window expires', async () => {
      const { checkRateLimit } = await import('../services/security.service')

      // Use a very short window
      checkRateLimit('test-key-3', 2, 1) // 1ms window

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 10))

      const result = checkRateLimit('test-key-3', 2, 1)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    })

    it('should track remaining count correctly', async () => {
      const { checkRateLimit } = await import('../services/security.service')

      const r1 = checkRateLimit('test-key-4', 3, 60000)
      expect(r1.remaining).toBe(2)

      const r2 = checkRateLimit('test-key-4', 3, 60000)
      expect(r2.remaining).toBe(1)

      const r3 = checkRateLimit('test-key-4', 3, 60000)
      expect(r3.remaining).toBe(0)

      const r4 = checkRateLimit('test-key-4', 3, 60000)
      expect(r4.allowed).toBe(false)
      expect(r4.remaining).toBe(0)
    })

    it('should isolate different keys', async () => {
      const { checkRateLimit } = await import('../services/security.service')

      // Exhaust key A
      for (let i = 0; i < 3; i++) {
        checkRateLimit('key-a', 3, 60000)
      }

      // Key B should still be allowed
      const resultB = checkRateLimit('key-b', 3, 60000)
      expect(resultB.allowed).toBe(true)
      expect(resultB.remaining).toBe(2)
    })

    it('should return valid resetAt date', async () => {
      const { checkRateLimit } = await import('../services/security.service')

      const before = Date.now()
      const result = checkRateLimit('test-key-5', 10, 60000)
      const after = Date.now()

      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before + 60000)
      expect(result.resetAt.getTime()).toBeLessThanOrEqual(after + 60000)
    })
  })
})

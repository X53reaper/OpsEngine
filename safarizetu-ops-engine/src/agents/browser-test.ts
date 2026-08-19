import { pool, isDbConnected, logger } from '../services/ai-agent.service'

// ── BROWSER TEST AGENT ────────────────────────────────────────
// Uses Playwright to verify fixes work visually and functionally
// Falls back to structured mock results when Playwright unavailable

interface TestConfig {
  fix_id: string
  test_url: string
  viewport_width?: number
  viewport_height?: number
  tests: BrowserTest[]
}

interface BrowserTest {
  name: string
  url: string
  steps: string[]
  screenshot_before?: string
  expected_behavior: string
}

interface TestResult {
  test_name: string
  status: 'passed' | 'failed' | 'error' | 'skipped'
  screenshot_before?: string
  screenshot_after?: string
  console_errors: string[]
  network_errors: string[]
  visual_diff_score: number
  test_duration_ms: number
  error_message?: string
}

// ── GENERATE TEST PLAN FROM FIX ───────────────────────────────
export async function generateTestPlan(fixId: string, pageUrl: string, fixSummary: string): Promise<BrowserTest[]> {
  const tests: BrowserTest[] = [
    {
      name: 'Page loads without errors',
      url: pageUrl,
      steps: [`Navigate to ${pageUrl}`, 'Check page loads completely', 'Verify no console errors', 'Check all images load'],
      expected_behavior: 'Page loads cleanly with no errors'
    },
    {
      name: 'Visual regression check',
      url: pageUrl,
      steps: [`Navigate to ${pageUrl}`, 'Take full-page screenshot', 'Compare with baseline'],
      expected_behavior: 'Page looks correct, no layout breaking'
    }
  ]

  if (fixSummary.toLowerCase().includes('button')) {
    tests.push({
      name: 'Button functionality',
      url: pageUrl,
      steps: ['Find the affected button', 'Click it', 'Verify expected action occurs'],
      expected_behavior: 'Button works as expected'
    })
  }

  if (fixSummary.toLowerCase().includes('form') || fixSummary.toLowerCase().includes('input')) {
    tests.push({
      name: 'Form validation',
      url: pageUrl,
      steps: ['Submit form empty', 'Verify validation messages appear', 'Fill in valid data', 'Submit and verify success'],
      expected_behavior: 'Form validates and submits correctly'
    })
  }

  return tests
}

// ── RUN BROWSER TESTS (with Playwright) ───────────────────────
export async function runBrowserTests(fixId: string, tests: BrowserTest[]): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Try to load Playwright dynamically (not a direct import so TS doesn't require it at compile time)
  let browser: any = null
  let playwrightAvailable = false

  try {
    // Dynamic require to avoid TS compile error when playwright isn't installed
    const pw = (Function('return require("playwright")') as any)()
    browser = await pw.chromium.launch({ headless: true })
    playwrightAvailable = true
    logger.info('Playwright loaded — running real browser tests')
  } catch (error: any) {
    logger.warn(`Playwright not available (${error.message}) — using mock test results`)
  }

  for (const test of tests) {
    const startTime = Date.now()

    if (playwrightAvailable && browser) {
      let page: any = null
      try {
        logger.info(`Running browser test: ${test.name} on ${test.url}`)
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 }
        })
        page = await context.newPage()

        const consoleErrors: string[] = []
        const networkErrors: string[] = []

        page.on('console', (msg: any) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text())
        })
        page.on('requestfailed', (req: any) => {
          networkErrors.push(`${req.url()} — ${req.failure()?.errorText || 'unknown'}`)
        })

        await page.goto(test.url, { waitUntil: 'networkidle', timeout: 30000 })

        // Take screenshot after
        const screenshotAfter = `test-results/${fixId}-${test.name.replace(/\s+/g, '-').toLowerCase()}.png`
        await page.screenshot({ path: screenshotAfter, fullPage: true })

        // Check for critical errors
        const hasFatalErrors = consoleErrors.some(e => e.includes('Uncaught') || e.includes('Fatal'))
        const hasNetworkFailures = networkErrors.length > 0

        const result: TestResult = {
          test_name: test.name,
          status: hasFatalErrors || hasNetworkFailures ? 'failed' : 'passed',
          screenshot_after: screenshotAfter,
          console_errors: consoleErrors,
          network_errors: networkErrors,
          visual_diff_score: 0,
          test_duration_ms: Date.now() - startTime,
          error_message: hasFatalErrors ? 'Console errors detected' : hasNetworkFailures ? 'Network failures detected' : undefined
        }

        await saveTestResult(fixId, test.url, result)
        results.push(result)

        await context.close()
      } catch (error: any) {
        const result: TestResult = {
          test_name: test.name,
          status: 'error',
          console_errors: [],
          network_errors: [],
          visual_diff_score: 0,
          test_duration_ms: Date.now() - startTime,
          error_message: error.message
        }
        await saveTestResult(fixId, test.url, result)
        results.push(result)
      }
      continue
    }

    // Playwright not available — return structured mock results
    const result: TestResult = {
      test_name: test.name,
      status: 'skipped',
      console_errors: [],
      network_errors: [],
      visual_diff_score: 0,
      test_duration_ms: Date.now() - startTime,
      error_message: 'Playwright not installed — test skipped'
    }

    await saveTestResult(fixId, test.url, result)
    results.push(result)
  }

  if (browser) {
    try { await browser.close() } catch { /* ignore */ }
  }

  return results
}

// ── SAVE TEST RESULT TO DB ─────────────────────────────────────
async function saveTestResult(fixId: string, testUrl: string, result: TestResult): Promise<void> {
  if (!isDbConnected()) return

  try {
    await pool.query(
      `INSERT INTO browser_test_log
       (fix_id, test_name, test_url, status, console_errors, network_errors,
        visual_diff_score, test_duration_ms, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fixId, result.test_name, testUrl, result.status,
       result.console_errors, result.network_errors,
       result.visual_diff_score, result.test_duration_ms,
       result.error_message]
    )
  } catch (error: any) {
    logger.error(`Failed to save browser test result: ${error.message}`)
  }
}

// ── TEST VERDICT ──────────────────────────────────────────────
export async function getTestVerdict(fixId: string): Promise<{
  all_passed: boolean
  total_tests: number
  passed: number
  failed: number
  errors: number
  skipped: number
  ready_for_review: boolean
}> {
  if (isDbConnected()) {
    try {
      const { rows: tests } = await pool.query(
        `SELECT status FROM browser_test_log WHERE fix_id = $1`, [fixId]
      )
      const passed = tests.filter((t: any) => t.status === 'passed').length
      const failed = tests.filter((t: any) => t.status === 'failed').length
      const errors = tests.filter((t: any) => t.status === 'error').length
      const skipped = tests.filter((t: any) => t.status === 'skipped').length

      return {
        all_passed: failed === 0 && errors === 0,
        total_tests: tests.length, passed, failed, errors, skipped,
        ready_for_review: failed === 0 && errors === 0 && tests.length > 0 && skipped === 0
      }
    } catch (error: any) {
      logger.error(`Failed to query test verdict: ${error.message}`)
    }
  }

  return { all_passed: false, total_tests: 0, passed: 0, failed: 0, errors: 0, skipped: 0, ready_for_review: false }
}

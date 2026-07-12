import { test, expect } from '../fixtures'
import { url } from '../helpers'

test.describe('Students - Create student', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(adminEmail, adminPassword)
  })

  test('should create a new student successfully', async ({ page }) => {
    await page.goto(url('/students'))
    await page.waitForSelector('.page-header')

    // Click create button
    await page.getByRole('button', { name: /nuevo estudiante/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill form using placeholders and labels
    const dialog = page.getByRole('dialog')
    
    // Fill required fields
    await dialog.locator('input[required]').nth(0).fill('Test')
    await dialog.locator('input[required]').nth(1).fill('Student')
    await dialog.locator('input[required]').nth(2).fill('TI')
    await dialog.locator('input[required]').nth(3).fill('1234567890')
    await dialog.locator('input[type="date"]').fill('2010-01-15')
    
    // Select gender
    await dialog.locator('select').nth(0).selectOption('masculino')

    // Submit
    await dialog.getByRole('button', { name: /guardar/i }).click()

    // Wait for success feedback or dialog to close
    await page.waitForTimeout(2000)
    
    // Check if dialog closed (success) or error message appears
    const dialogStillOpen = await dialog.isVisible().catch(() => false)
    if (dialogStillOpen) {
      // Check for error message
      const errorMessage = await page.getByText(/No fue posible|Revisa los datos/).textContent().catch(() => null)
      if (errorMessage) {
        throw new Error(`Form submission failed: ${errorMessage}`)
      }
    }
    
    // Verify student was created by checking if dialog closed
    await expect(dialog).not.toBeVisible()
  })
})

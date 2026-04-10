/**
 * Wolvercote webapp — end-to-end tests.
 * Run: npm run test:e2e
 */
import { test, expect } from '@playwright/test'

test.describe('page shell', () => {
  test('loads and shows the app title', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-header-name')).toBeVisible()
    await expect(page.getByText('Bacterial Genome Organisation Visualiser')).toBeVisible()
  })

  test('shows GitHub link in header', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: 'GitHub' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /github\.com/)
  })

  test('opens About modal and shows authors', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'About' }).click()
    await expect(page.getByText('Centre for Genomic Pathogen Surveillance')).toBeVisible()
    await expect(page.getByText('Nabil-Fareed Alikhan')).toBeVisible()
    await expect(page.getByText('Julio Diaz Caballero')).toBeVisible()
    // Close it
    await page.keyboard.press('Escape')
    // or click overlay
  })

  test('About modal closes on overlay click', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'About' }).click()
    await expect(page.getByText('Centre for Genomic Pathogen Surveillance')).toBeVisible()
    await page.locator('.builder-modal-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.getByText('Centre for Genomic Pathogen Surveillance')).not.toBeVisible()
  })
})

test.describe('text editor', () => {
  test('shows SVG diagram for valid input', async ({ page }) => {
    await page.goto('/')
    const textarea = page.locator('.wolvercote-editor')
    await textarea.fill('()chr1')
    await expect(page.locator('.svg-viewer circle')).toBeVisible()
  })

  test('shows validation error for invalid input', async ({ page }) => {
    await page.goto('/')
    const textarea = page.locator('.wolvercote-editor')
    await textarea.fill('(unclosed')
    await expect(page.locator('.validation-error')).toBeVisible()
  })

  test('shows no error for valid nested format', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('{ { {}blaKPC-2 }Tn4401 }pKpQIL')
    await expect(page.locator('.validation-error')).not.toBeVisible()
    await expect(page.locator('.svg-viewer svg')).toBeVisible()
  })

  test('example buttons load their format strings', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Two cells' }).click()
    const val = await page.locator('.wolvercote-editor').inputValue()
    expect(val).toContain(';')
    // Two-cell format should produce at least two circles
    const count = await page.locator('.svg-viewer circle').count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('Download SVG button is enabled for valid input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('()chr1')
    const btn = page.getByRole('button', { name: 'Download SVG' })
    await expect(btn).not.toBeDisabled()
  })

  test('Download SVG button is disabled for invalid input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('(bad')
    const btn = page.getByRole('button', { name: 'Download SVG' })
    await expect(btn).toBeDisabled()
  })
})

test.describe('interactive builder', () => {
  test('switching to builder tab shows the builder', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await expect(page.getByText('Cell 1')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add element' })).toBeVisible()
  })

  test('adding a chromosome updates the text editor', async ({ page }) => {
    await page.goto('/')
    // Start with blank text
    await page.locator('.wolvercote-editor').fill('')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await page.getByRole('button', { name: '+ Add element' }).click()
    // Select Chromosome, type a label
    await page.locator('.builder-modal-select').selectOption('chromosome')
    await page.locator('.builder-modal-input').fill('myChromosome')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    // Switch back to text tab to verify
    await page.getByRole('button', { name: 'Text editor' }).click()
    const val = await page.locator('.wolvercote-editor').inputValue()
    expect(val).toContain('myChromosome')
  })

  test('adding a plasmid shows Add inside button', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    await page.locator('.builder-modal-input').fill('pBAD')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('button', { name: /Add inside pBAD/ })).toBeVisible()
  })

  test('can nest an element inside a plasmid', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    // Add plasmid
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    await page.locator('.builder-modal-input').fill('pKpQIL')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    // Add transposon inside plasmid
    await page.getByRole('button', { name: /Add inside pKpQIL/ }).click()
    await page.locator('.builder-modal-select').selectOption('transposon')
    await page.locator('.builder-modal-input').fill('Tn4401')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    // Verify nested element appears
    await expect(page.locator('.builder-label-btn').filter({ hasText: 'Tn4401' })).toBeVisible()
    // Switch to text and verify Wolvercote string
    await page.getByRole('button', { name: 'Text editor' }).click()
    const val = await page.locator('.wolvercote-editor').inputValue()
    expect(val).toContain('Tn4401')
    expect(val).toContain('pKpQIL')
  })

  test('text → builder sync when switching tabs', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('()chromosome1,{}plasmidA')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await expect(page.locator('.builder-label-btn').filter({ hasText: 'chromosome1' })).toBeVisible()
    await expect(page.locator('.builder-label-btn').filter({ hasText: 'plasmidA' })).toBeVisible()
  })

  test('clicking a label opens edit modal', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('()myChromosome')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await page.locator('.builder-label-btn').filter({ hasText: 'myChromosome' }).click()
    await expect(page.getByText('Edit element')).toBeVisible()
    await expect(page.locator('.builder-modal-input')).toHaveValue('myChromosome')
  })

  test('editing a label updates the format string', async ({ page }) => {
    await page.goto('/')
    await page.locator('.wolvercote-editor').fill('()oldName')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await page.locator('.builder-label-btn').filter({ hasText: 'oldName' }).click()
    await page.locator('.builder-modal-input').fill('newName')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'Text editor' }).click()
    const val = await page.locator('.wolvercote-editor').inputValue()
    expect(val).toContain('newName')
    expect(val).not.toContain('oldName')
  })

  test('can add a second cell', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Interactive builder' }).click()
    await page.getByRole('button', { name: '+ Add cell' }).click()
    await expect(page.getByText('Cell 2')).toBeVisible()
  })
})

test.describe('import tab', () => {
  test('import tab shows file upload widget', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Import GenBank / GFF' }).click()
    // FileUpload component should be visible
    await expect(page.locator('.upload-row')).toBeVisible()
  })
})

import { describe, expect, it } from 'vitest'
import { profileUpdateSchema } from './profile'

describe('profileUpdateSchema', () => {
  it('passes validation with valid full_name and valid phone_number', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'James Niño Mandawe',
      phone_number: '+63 (912) 345-6789',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.full_name).toBe('James Niño Mandawe')
      expect(result.data.phone_number).toBe('+63 (912) 345-6789')
    }
  })

  it('passes validation when phone_number is empty or omitted', () => {
    const resultEmpty = profileUpdateSchema.safeParse({
      full_name: 'James Mandawe',
      phone_number: '',
    })
    expect(resultEmpty.success).toBe(true)

    const resultOmitted = profileUpdateSchema.safeParse({
      full_name: 'James Mandawe',
    })
    expect(resultOmitted.success).toBe(true)
  })

  it('trims whitespace from full_name and phone_number', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: '  James Mandawe  ',
      phone_number: '  09123456789  ',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.full_name).toBe('James Mandawe')
      expect(result.data.phone_number).toBe('09123456789')
    }
  })

  it('fails validation when full_name is empty or whitespace only', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: '   ',
      phone_number: '09123456789',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'full_name')
      expect(issue?.message).toBe('Full name is required')
    }
  })

  it('fails validation when full_name exceeds 100 characters', () => {
    const longName = 'A'.repeat(101)
    const result = profileUpdateSchema.safeParse({
      full_name: longName,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'full_name')
      expect(issue?.message).toBe('Full name must not exceed 100 characters')
    }
  })

  it('fails validation when phone_number exceeds 20 characters', () => {
    const longPhone = '1'.repeat(21)
    const result = profileUpdateSchema.safeParse({
      full_name: 'James Mandawe',
      phone_number: longPhone,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'phone_number')
      expect(issue?.message).toBe('Phone number must not exceed 20 characters')
    }
  })

  it('fails validation when phone_number contains invalid characters', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'James Mandawe',
      phone_number: '0912-ABC-5678',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'phone_number')
      expect(issue?.message).toBe('Invalid phone number format')
    }
  })
})

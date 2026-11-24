import { describe, expect, it } from 'vitest'

import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_REPORT_NOTE_MAX_LENGTH,
  deleteReviewSchema,
  editReviewSchema,
  postReviewSchema,
  reportReviewSchema,
  reviewCommentSchema,
  reviewListSchema,
  reviewRatingSchema,
  reviewReportNoteSchema,
} from './review'

const spaceId = 'e0000000-0000-4000-8000-000000000001'
const reservationId = '10000000-0000-4000-8000-000000000001'
const reviewId = '20000000-0000-4000-8000-000000000001'

describe('reviewRatingSchema', () => {
  it('accepts whole numbers 1 through 5 as form strings or numbers', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(reviewRatingSchema.parse(String(n))).toBe(n)
      expect(reviewRatingSchema.parse(` ${n} `)).toBe(n)
      expect(reviewRatingSchema.parse(n)).toBe(n)
    }
  })

  it('rejects out-of-range, decimal, empty, and non-numeric values', () => {
    for (const bad of [
      0,
      '0',
      6,
      '6',
      -1,
      '-1',
      3.5,
      '3.5',
      '',
      '   ',
      'five',
      '4px',
      null,
      undefined,
      true,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(
        reviewRatingSchema.safeParse(bad).success,
        `expected failure for ${String(bad)}`,
      ).toBe(false)
    }
  })
})

describe('reviewCommentSchema and reviewReportNoteSchema', () => {
  it('trims comments, converts empty or missing values to null, and caps at 500 characters', () => {
    expect(reviewCommentSchema.parse(undefined)).toBeNull()
    expect(reviewCommentSchema.parse(null)).toBeNull()
    expect(reviewCommentSchema.parse('')).toBeNull()
    expect(reviewCommentSchema.parse('   \n\t  ')).toBeNull()
    expect(reviewCommentSchema.parse('  Quiet and bright.  ')).toBe('Quiet and bright.')
    expect(
      reviewCommentSchema.parse(`  ${'a'.repeat(REVIEW_COMMENT_MAX_LENGTH)}  `),
    ).toBe('a'.repeat(REVIEW_COMMENT_MAX_LENGTH))

    expect(
      reviewCommentSchema.safeParse('a'.repeat(REVIEW_COMMENT_MAX_LENGTH + 1)).success,
    ).toBe(false)
    expect(reviewCommentSchema.safeParse(123).success).toBe(false)
  })

  it('trims report notes, converts empty or missing values to null, and caps at 300 characters', () => {
    expect(reviewReportNoteSchema.parse(undefined)).toBeNull()
    expect(reviewReportNoteSchema.parse(null)).toBeNull()
    expect(reviewReportNoteSchema.parse('   ')).toBeNull()
    expect(reviewReportNoteSchema.parse('  Contains a spam URL.  ')).toBe(
      'Contains a spam URL.',
    )
    expect(reviewReportNoteSchema.parse('n'.repeat(REVIEW_REPORT_NOTE_MAX_LENGTH))).toBe(
      'n'.repeat(REVIEW_REPORT_NOTE_MAX_LENGTH),
    )

    expect(
      reviewReportNoteSchema.safeParse('n'.repeat(REVIEW_REPORT_NOTE_MAX_LENGTH + 1))
        .success,
    ).toBe(false)
  })
})

describe('postReviewSchema', () => {
  it('parses form-string ratings and normalizes optional comment', () => {
    expect(
      postReviewSchema.parse({
        spaceId,
        reservationId,
        quietness: '5',
        wifiReliability: '4',
        cleanliness: '4',
        comfort: '3',
        comment: '  Great coffee and fast Wi-Fi.  ',
      }),
    ).toEqual({
      spaceId,
      reservationId,
      quietness: 5,
      wifiReliability: 4,
      cleanliness: 4,
      comfort: 3,
      comment: 'Great coffee and fast Wi-Fi.',
    })

    expect(
      postReviewSchema.parse({
        spaceId,
        reservationId,
        quietness: '5',
        wifiReliability: '5',
        cleanliness: '5',
        comfort: '5',
        comment: '   ',
      }).comment,
    ).toBeNull()
  })

  it('rejects invalid ids, missing ratings, or comments over 500 characters', () => {
    expect(
      postReviewSchema.safeParse({
        spaceId: 'not-a-uuid',
        reservationId,
        quietness: '5',
        wifiReliability: '4',
        cleanliness: '4',
        comfort: '3',
      }).success,
    ).toBe(false)

    expect(
      postReviewSchema.safeParse({
        spaceId,
        reservationId: 'bad',
        quietness: '5',
        wifiReliability: '4',
        cleanliness: '4',
        comfort: '3',
      }).success,
    ).toBe(false)

    expect(
      postReviewSchema.safeParse({
        spaceId,
        reservationId,
        quietness: '5',
        wifiReliability: '',
        cleanliness: '4',
        comfort: '3',
      }).success,
    ).toBe(false)

    expect(
      postReviewSchema.safeParse({
        spaceId,
        reservationId,
        quietness: '5',
        wifiReliability: '4',
        cleanliness: '4',
        comfort: '3',
        comment: 'x'.repeat(501),
      }).success,
    ).toBe(false)
  })
})

describe('editReviewSchema and deleteReviewSchema', () => {
  it('validates editReviewSchema with reviewId, spaceId, ratings, and optional comment', () => {
    expect(
      editReviewSchema.parse({
        spaceId,
        reviewId,
        quietness: '4',
        wifiReliability: '3',
        cleanliness: '5',
        comfort: '4',
        comment: '',
      }),
    ).toEqual({
      spaceId,
      reviewId,
      quietness: 4,
      wifiReliability: 3,
      cleanliness: 5,
      comfort: 4,
      comment: null,
    })

    expect(
      editReviewSchema.safeParse({
        spaceId,
        reviewId: 'not-a-uuid',
        quietness: '4',
        wifiReliability: '3',
        cleanliness: '5',
        comfort: '4',
      }).success,
    ).toBe(false)
  })

  it('validates deleteReviewSchema with spaceId and reviewId', () => {
    expect(deleteReviewSchema.parse({ spaceId, reviewId })).toEqual({ spaceId, reviewId })
    expect(deleteReviewSchema.safeParse({ spaceId, reviewId: 'bad' }).success).toBe(false)
  })
})

describe('reportReviewSchema', () => {
  it('accepts each of the four reasons and trims the optional note', () => {
    for (const reason of ['spam', 'offensive', 'not_about_space', 'other'] as const) {
      expect(
        reportReviewSchema.parse({
          spaceId,
          reviewId,
          reason,
          note: '  Relevant context.  ',
        }),
      ).toEqual({
        spaceId,
        reviewId,
        reason,
        note: 'Relevant context.',
      })
    }

    expect(
      reportReviewSchema.parse({
        spaceId,
        reviewId,
        reason: 'spam',
        note: '   ',
      }).note,
    ).toBeNull()
  })

  it('rejects unknown reasons and notes over 300 characters', () => {
    expect(
      reportReviewSchema.safeParse({
        spaceId,
        reviewId,
        reason: 'fake',
      }).success,
    ).toBe(false)

    expect(
      reportReviewSchema.safeParse({
        spaceId,
        reviewId,
        reason: 'other',
        note: 'n'.repeat(301),
      }).success,
    ).toBe(false)
  })
})

describe('reviewListSchema', () => {
  it('accepts allowed sort and shown counts', () => {
    expect(reviewListSchema.parse({ sort: 'newest', reviews: '10' })).toEqual({
      sort: 'newest',
      reviews: 10,
    })
    expect(reviewListSchema.parse({ sort: 'highest', reviews: '30' })).toEqual({
      sort: 'highest',
      reviews: 30,
    })
    expect(reviewListSchema.parse({ sort: 'lowest', reviews: '50' })).toEqual({
      sort: 'lowest',
      reviews: 50,
    })
    expect(reviewListSchema.parse({ sort: 'highest', reviews: 20 })).toEqual({
      sort: 'highest',
      reviews: 20,
    })
    expect(
      reviewListSchema.parse({ sort: ['lowest', 'highest'], reviews: ['40', '10'] }),
    ).toEqual({
      sort: 'lowest',
      reviews: 40,
    })
  })

  it('falls back to defaults (newest, 10) for missing or invalid params', () => {
    expect(reviewListSchema.parse({})).toEqual({ sort: 'newest', reviews: 10 })
    expect(reviewListSchema.parse({ sort: 'best', reviews: '25' })).toEqual({
      sort: 'newest',
      reviews: 10,
    })
    expect(reviewListSchema.parse({ sort: 'highest', reviews: '60' })).toEqual({
      sort: 'highest',
      reviews: 10,
    })
    expect(reviewListSchema.parse({ sort: 'lowest', reviews: '0' })).toEqual({
      sort: 'lowest',
      reviews: 10,
    })
    expect(reviewListSchema.parse({ sort: 'lowest', reviews: '-10' })).toEqual({
      sort: 'lowest',
      reviews: 10,
    })
    expect(reviewListSchema.parse({ sort: '', reviews: 'abc' })).toEqual({
      sort: 'newest',
      reviews: 10,
    })
    expect(reviewListSchema.parse({ sort: undefined, reviews: undefined })).toEqual({
      sort: 'newest',
      reviews: 10,
    })
  })
})

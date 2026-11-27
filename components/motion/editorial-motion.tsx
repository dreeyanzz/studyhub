'use client'

import type { ReactNode } from 'react'
import {
  MotionConfig,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'framer-motion'

export const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const

export const EDITORIAL_SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.9,
}

export const GENTLE_SPRING: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
}

export const SNAPPY_TWEEN: Transition = {
  type: 'tween',
  duration: 0.22,
  ease: EDITORIAL_EASE,
}

/**
 * Wraps public routes in Framer Motion's MotionConfig so `prefers-reduced-motion`
 * is respected globally alongside component-level `useReducedMotion()` checks.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

interface EditorialRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  immediate?: boolean
}

/**
 * GPU-accelerated entrance reveal (opacity + translateY) with reduced-motion fallback.
 * Use `immediate` for above-the-fold hero elements; defaults to scroll-triggered reveal.
 */
export function EditorialReveal({
  children,
  className,
  delay = 0,
  y = 18,
  immediate = false,
}: EditorialRevealProps) {
  const prefersReducedMotion = useReducedMotion()
  const offset = prefersReducedMotion ? 0 : y
  const duration = prefersReducedMotion ? 0.01 : 0.56

  if (immediate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: offset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration,
          delay: prefersReducedMotion ? 0 : delay,
          ease: EDITORIAL_EASE,
        }}
        className={className}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{
        duration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: EDITORIAL_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface EditorialStaggerProps {
  children: ReactNode
  className?: string
  stagger?: number
  delayChildren?: number
  immediate?: boolean
  as?: 'div' | 'ol' | 'ul' | 'dl'
}

export function EditorialStagger({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0.04,
  immediate = false,
  as = 'div',
}: EditorialStaggerProps) {
  const prefersReducedMotion = useReducedMotion()

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : stagger,
        delayChildren: prefersReducedMotion ? 0 : delayChildren,
      },
    },
  }

  const Component =
    as === 'ol'
      ? motion.ol
      : as === 'ul'
        ? motion.ul
        : as === 'dl'
          ? motion.dl
          : motion.div

  if (immediate) {
    return (
      <Component
        variants={variants}
        initial="hidden"
        animate="visible"
        className={className}
      >
        {children}
      </Component>
    )
  }

  return (
    <Component
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 'some' }}
      className={className}
    >
      {children}
    </Component>
  )
}

interface EditorialStaggerItemProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
  y?: number
}

export function EditorialStaggerItem({
  children,
  className,
  as = 'div',
  y = 16,
}: EditorialStaggerItemProps) {
  const prefersReducedMotion = useReducedMotion()

  const variants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0.01 : 0.48,
        ease: EDITORIAL_EASE,
      },
    },
  }

  const Component = as === 'li' ? motion.li : motion.div

  return (
    <Component variants={variants} className={className}>
      {children}
    </Component>
  )
}

interface EditorialInteractiveProps {
  children: ReactNode
  className?: string
  lift?: number
}

/**
 * Tactile micro-interaction wrapper for buttons, cards, and chips.
 * Uses GPU-only transform without shifting layout bounds.
 */
export function EditorialInteractive({
  children,
  className,
  lift = -2,
}: EditorialInteractiveProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: lift }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={EDITORIAL_SPRING}
      className={className}
    >
      {children}
    </motion.div>
  )
}

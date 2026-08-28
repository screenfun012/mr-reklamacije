import { cva, type VariantProps } from 'class-variance-authority'

/** Brand secondary — transparent fill, 1.5px primary border, red-50 wash on hover. */
const brandSecondary =
  'border-[1.5px] border-primary bg-transparent text-primary shadow-none hover:bg-[var(--mr-red-50-wash)] hover:text-primary dark:text-white dark:hover:bg-[var(--mr-surface-raised)] dark:hover:text-white'

const brandDisabled =
  'disabled:pointer-events-none disabled:bg-[var(--mr-disabled-bg)] disabled:text-[var(--mr-disabled-text)] disabled:border-[var(--mr-disabled-bg)] disabled:opacity-100 disabled:shadow-none'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[color,background-color,border-color,transform] active:scale-[0.99]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    brandDisabled,
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground shadow-none',
          'hover:bg-[var(--mr-primary-hover)] active:bg-[var(--mr-primary-active)]',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground shadow-none',
          'hover:bg-[#c0241a] active:bg-[#a81f15]',
        ],
        outline: brandSecondary,
        secondary: brandSecondary,
        ghost: [
          'bg-transparent text-primary shadow-none',
          'hover:bg-[var(--mr-red-50-wash)] hover:text-primary active:bg-[var(--mr-red-50-wash)]',
          'dark:text-white dark:hover:bg-[var(--mr-surface-raised)] dark:hover:text-white dark:active:bg-[var(--mr-surface-raised)]',
          // `brandDisabled` fills a disabled button — right for a solid button, wrong for a ghost:
          // it paints a grey box where there was nothing, so the ONE action you cannot take becomes
          // the loudest thing in the row. On the admin engine-types screen every row is blocked
          // from hard-delete, so the whole action column was a column of grey squares (seen
          // 2026-08-19, only after the neighbouring red buttons became quiet icons).
          // `link` has carried this same line for the same reason; ghost was simply missed.
          'disabled:bg-transparent disabled:border-transparent',
        ],
        link: [
          'bg-transparent text-primary underline-offset-4 shadow-none hover:underline',
          'disabled:bg-transparent disabled:border-transparent',
        ],
      },
      size: {
        default: 'h-10 px-4 text-base',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>

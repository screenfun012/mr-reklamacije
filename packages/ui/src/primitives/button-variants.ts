import { cva, type VariantProps } from 'class-variance-authority'

/** Brand secondary — transparent fill, 1.5px primary border, red-50 wash on hover. */
const brandSecondary =
  'border-[1.5px] border-primary bg-transparent text-primary shadow-none hover:bg-[var(--mr-red-50-wash)] dark:text-white dark:hover:bg-[var(--mr-red-50-wash)]'

const brandDisabled =
  'disabled:pointer-events-none disabled:bg-[var(--mr-disabled-bg)] disabled:text-[var(--mr-disabled-text)] disabled:border-[var(--mr-disabled-bg)] disabled:opacity-100 disabled:shadow-none'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors',
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
          'hover:bg-[var(--mr-red-50-wash)] active:bg-[var(--mr-red-50-wash)]',
          'dark:text-white dark:hover:bg-[var(--mr-red-50-wash)]',
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

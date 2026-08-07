import * as React from 'react'
import { Button, type ButtonProps } from './Button'

/** An icon-only action. The accessible label is intentionally required. */
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  'aria-label': string
  children: React.ReactNode
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, type = 'button', ...props }, ref) => (
    <Button ref={ref} type={type} size="icon" className={className} {...props} />
  )
)
IconButton.displayName = 'IconButton'

/** A compact, labeled action for a toolbar or panel action row. */
export interface ToolbarButtonProps extends Omit<ButtonProps, 'size'> {
  size?: 'default' | 'sm' | 'xs'
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, size = 'sm', type = 'button', ...props }, ref) => (
    <Button ref={ref} type={type} size={size} className={className} {...props} />
  )
)
ToolbarButton.displayName = 'ToolbarButton'

export { IconButton, ToolbarButton }

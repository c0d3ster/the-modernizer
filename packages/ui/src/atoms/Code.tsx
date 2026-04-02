import type { JSX, ReactNode } from 'react'

export const Code = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): JSX.Element => {
  return <code className={className}>{children}</code>
}

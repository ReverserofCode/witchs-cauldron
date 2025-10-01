import { ElementType, ReactNode } from 'react'

interface ContainerProps {
  as?: ElementType
  children: ReactNode
  className?: string
}

export function Container({ as: Component = 'div', children, className }: ContainerProps) {
  const classes = ['mx-auto w-full max-w-6xl px-6 sm:px-8']
  if (className) {
    classes.push(className)
  }

  return <Component className={classes.join(' ')}>{children}</Component>
}

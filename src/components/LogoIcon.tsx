// React Imports
import type { SVGAttributes } from 'react'

/** Modular BFG mark: a luminous top plane over two connected foundation blocks. */
const BFG_LIME = '#7CFF00'
const BFG_GRAPHITE = '#1F2933'

const LogoIcon = ({ surface = 'auto', ...props }: SVGAttributes<SVGElement> & { surface?: 'auto' | 'dark' }) => {
  const foundation = surface === 'dark' ? '#CBD5E1' : BFG_GRAPHITE
  return (
    <svg width='1.5em' height='1em' viewBox='0 0 36 24' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      {/* Bright top plane: the extensible platform layer. */}
      <path d='M2 5.5 18 0l16 5.5-16 7L2 5.5Z' fill={BFG_LIME} />
      {/* Two foundation planes: connected workspaces and services. */}
      <path d='M2 5.5 18 12.5V24L2 17.5V5.5Z' className='bfg-logo-foundation' fill={foundation} />
      <path d='m18 12.5 16-7v12L18 24V12.5Z' className='bfg-logo-foundation' fill={foundation} opacity='.82' />
      {/* Negative-space joint keeps the mark legible at small sizes. */}
      <path d='M18 7.4 25.8 4 29 5.1 18 9.9 7 5.1 10.2 4 18 7.4Z' fill='#0B1117' opacity='.28' />
    </svg>
  )
}

export default LogoIcon

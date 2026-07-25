import logo from '../../assets/devdesk-logo-top-left-transparent.png'
import { cn } from '../../lib/utils'

interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <div className={cn('inline-flex items-center', className)}>
      <img
        src={logo}
        alt="DevDesk logo"
        className="pointer-events-none h-full w-auto select-none object-contain brightness-110 saturate-125 drop-shadow-[0_0_14px_rgba(34,211,238,0.22)]"
        draggable={false}
      />
    </div>
  )
}

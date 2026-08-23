import { useEffect, useState } from 'react'
import { subscribeLoader } from '../../utils/loaderState'

export function GlobalLoader() {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    return subscribeLoader(setIsLoading)
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 z-50 h-1 w-full overflow-hidden bg-primary/20">
      <div className="h-full w-full animate-[indeterminate_1.5s_infinite_linear] bg-primary origin-left" 
           style={{ 
             animationName: 'indeterminate',
             backgroundSize: '200% 100%' 
           }} 
      />
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%) scaleX(0.2); }
          50% { transform: translateX(0) scaleX(0.5); }
          100% { transform: translateX(100%) scaleX(0.2); }
        }
      `}</style>
    </div>
  )
}

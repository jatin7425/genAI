import { useEffect, useState, useCallback } from 'react'

export function useInfiniteScroll(
  onLoadMore: () => void,
  hasMore: boolean,
  isLoading: boolean,
  rootMargin = '100px'
) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries
      if (target.isIntersecting && hasMore && !isLoading) {
        onLoadMore()
      }
    },
    [onLoadMore, hasMore, isLoading]
  )

  useEffect(() => {
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin,
      threshold: 0,
    })

    observer.observe(element)
    return () => {
      if (element) observer.unobserve(element)
    }
  }, [element, handleObserver, rootMargin])

  return setElement
}


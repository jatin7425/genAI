import { AppRouter } from './router'
import { GlobalLoader } from './components/layout/GlobalLoader'
import { ToastHost } from './components/layout/ToastHost'

export default function App() {
  return (
    <>
      <GlobalLoader />
      <AppRouter />
      <ToastHost />
    </>
  )
}

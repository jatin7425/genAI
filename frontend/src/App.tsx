import { AppRouter } from './router'
import { GlobalLoader } from './components/layout/GlobalLoader'

export default function App() {
  return (
    <>
      <GlobalLoader />
      <AppRouter />
    </>
  )
}

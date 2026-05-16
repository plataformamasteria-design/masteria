import * as React from "react"

const MOBILE_BREAKPOINT = 768 // Alterado para md para sincronizar com Tailwind

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const checkDevice = (): void => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    checkDevice();
    window.addEventListener("resize", checkDevice);

    return (): void => window.removeEventListener("resize", checkDevice)
  }, [])

  return isMobile
}

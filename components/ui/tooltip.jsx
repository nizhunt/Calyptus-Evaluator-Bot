import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// Hook to detect mobile devices
const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return isMobile;
};

// Context for sharing tooltip state
const TooltipContext = React.createContext(null);

function TooltipProvider({ delayDuration = 0, ...props }) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ children, ...props }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  const contextValue = React.useMemo(
    () => ({
      isMobile,
      open,
      setOpen,
    }),
    [isMobile, open],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <TooltipContext.Provider value={contextValue}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          open={isMobile ? open : undefined}
          onOpenChange={isMobile ? setOpen : undefined}
          {...props}
        >
          {children}
        </TooltipPrimitive.Root>
      </TooltipContext.Provider>
    </TooltipProvider>
  );
}

function TooltipTrigger({ className, onClick, asChild, ...props }) {
  const context = React.useContext(TooltipContext);

  const handleClick = (e) => {
    if (context?.isMobile) {
      e.preventDefault();
      context.setOpen(!context.open);
    }
    onClick?.(e);
  };

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      asChild={asChild}
      {...props}
      onClick={context?.isMobile ? handleClick : onClick}
      className={cn(
        !asChild &&
          "m-0 flex h-4 w-auto items-center bg-transparent p-0",
        className,
      )}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  arrowClassName,
  ...props
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "origin-(--radix-tooltip-content-transform-origin) v3-main-shadow z-50 w-fit rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className={cn(
            "z-50 fill-white stroke-gray-200 [stroke-width:1px]",
            arrowClassName,
          )}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

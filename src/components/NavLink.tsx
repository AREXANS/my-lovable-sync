import { Link, useRouterState } from "@tanstack/react-router";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<React.ComponentProps<typeof Link>, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const isActive = typeof to === "string" && pathname === to;
    return (
      <Link
        ref={ref}
        to={to}
        className={cn(className, isActive && activeClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

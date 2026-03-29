import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export const MobileLayout = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto min-h-screen max-w-lg bg-background">
    <main className="pb-20">{children}</main>
    <BottomNav />
  </div>
);

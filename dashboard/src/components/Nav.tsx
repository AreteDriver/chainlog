"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Nav() {
  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-white">
            ChainLog
          </Link>
          <div className="flex gap-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link
              href="/verify"
              className="hover:text-white transition-colors"
            >
              Verify
            </Link>
          </div>
        </div>
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
        />
      </div>
    </nav>
  );
}

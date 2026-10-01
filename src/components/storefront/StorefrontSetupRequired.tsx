'use client'

import Link from 'next/link'

/** Shown when the current workspace has not finished its public site setup. */
export default function StorefrontSetupRequired() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          This workspace is not ready yet
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Finish setting up this workspace before sharing this site with visitors.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          If you manage this workspace, open Admin to complete the setup.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Open workspace admin
        </Link>
      </div>
    </div>
  )
}

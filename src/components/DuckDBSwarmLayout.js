import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router';
import { 
  ServerIcon, 
  HomeIcon, 
  CodeBracketSquareIcon, 
  CloudIcon,
  CircleStackIcon,
  PlayIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline'

export default function DuckDBSwarmLayout({ children }) {
  const router = useRouter();
  
  // Helper function to check if a route is active
  const isActive = (path) => {
    return router.pathname.startsWith(path);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <div className="flex items-center">
                <ServerIcon className="h-8 w-8 text-indigo-600" aria-hidden="true" />
                <span className="ml-2 text-xl font-bold text-indigo-600">DuckDB Swarm</span>
              </div>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul className="-mx-2 space-y-1">
                    <li>
                      <Link
                        href="/admin/duckdb-swarm/dashboard"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/dashboard') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <HomeIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/dashboard') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/duckdb-swarm/pipelines"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/pipelines') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <PlayIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/pipelines') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        Pipelines
                      </Link>
                    </li>

                    <li>
                      <Link
                        href="/admin/duckdb-swarm/simple"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/simple') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <ServerIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/simple') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        Servidores
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/duckdb-swarm/storage"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/storage') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <CloudIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/storage') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        Almacenamiento
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/duckdb-swarm/evidence"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/evidence') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <ChartBarIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/evidence') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        Evidence.dev
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/duckdb-swarm/powerbi"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/powerbi') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <TableCellsIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/powerbi') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        PowerBI
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/duckdb-swarm/settings"
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          isActive('/admin/duckdb-swarm/settings') 
                            ? 'bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Cog6ToothIcon
                          className={`h-6 w-6 shrink-0 ${
                            isActive('/admin/duckdb-swarm/settings') 
                              ? 'text-indigo-600' 
                              : 'text-gray-400 group-hover:text-indigo-600'
                          }`}
                          aria-hidden="true"
                        />
                        Configuración
                      </Link>
                    </li>
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-72 flex-1">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
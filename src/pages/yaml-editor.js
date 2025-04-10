import { Title } from "@tremor/react"
import { useRouter } from "next/router"
import Head from 'next/head'
import Link from "next/link"

export default function YAMLEditor() {
  const router = useRouter()

  const goToHome = () => {
    router.push('/')
  }

  return (
    <>
      <Head>
        <title>SAGE YAML Editor</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
      </Head>
      
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b py-4 shadow-sm">
          <div className="container mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-7 w-7 text-indigo-600 mr-2" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                <rect x="9" y="9" width="6" height="6"></rect>
                <line x1="9" y1="2" x2="9" y2="4"></line>
                <line x1="15" y1="2" x2="15" y2="4"></line>
                <line x1="9" y1="20" x2="9" y2="22"></line>
                <line x1="15" y1="20" x2="15" y2="22"></line>
                <line x1="20" y1="9" x2="22" y2="9"></line>
                <line x1="20" y1="14" x2="22" y2="14"></line>
                <line x1="2" y1="9" x2="4" y2="9"></line>
                <line x1="2" y1="14" x2="4" y2="14"></line>
              </svg>
              <h1 className="text-xl md:text-2xl font-semibold">SAGE YAML Editor</h1>
            </div>
            <button 
              onClick={goToHome}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:text-indigo-600 focus:outline-none"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-2" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Volver a SAGE
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex p-4 md:p-6">
          <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="border-b border-gray-200 px-4 py-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Editor de YAML</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={() => alert('Funcionalidad de importar YAML próximamente disponible')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-1" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m16 16-4-4-4 4" />
                  </svg>
                  Importar
                </button>
                <button 
                  onClick={() => alert('Funcionalidad de exportar YAML próximamente disponible')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-1" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m8 17 4 4 4-4" />
                  </svg>
                  Exportar
                </button>
              </div>
            </div>
            <div className="p-6 md:p-8">
              <div className="text-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="rounded-md bg-blue-50 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5 text-blue-400" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">Información</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          La versión completa del editor YAML estará disponible próximamente. 
                          Mientras tanto, puedes utilizar YAML Studio para tus necesidades de edición YAML.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-4">
                  YAML Editor próximamente
                </h2>
                <p className="text-base text-gray-500 mb-12">
                  Estamos trabajando para ofrecerte una experiencia de edición YAML más potente e intuitiva. 
                  La integración completa del nuevo YAML Editor estará disponible en breve.
                </p>
                
                <div className="mt-8 flex justify-center">
                  <div className="inline-flex rounded-md shadow">
                    <Link 
                      href="/studio" 
                      className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Ir a YAML Studio
                    </Link>
                  </div>
                  <div className="ml-3 inline-flex">
                    <button
                      onClick={goToHome}
                      className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50"
                    >
                      Volver al dashboard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
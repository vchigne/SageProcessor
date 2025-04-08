import { BuildingOfficeIcon } from '@heroicons/react/24/outline'

export default function UnderConstruction() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-gray-600">
      <BuildingOfficeIcon className="w-24 h-24 mb-4 animate-bounce" />
      <h2 className="text-2xl font-semibold mb-2">Página en Construcción</h2>
      <p className="text-center max-w-md mb-4">
        Estamos trabajando arduamente para traerte una experiencia excepcional.
        ¡Vuelve pronto!
      </p>
      <div className="w-full max-w-md h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-600 rounded-full animate-progress" 
             style={{width: '70%'}} />
      </div>
    </div>
  )
}

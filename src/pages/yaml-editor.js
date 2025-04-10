import { Title } from "@tremor/react"
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function YAMLEditor() {
  const router = useRouter()
  
  useEffect(() => {
    // Redireccionar al usuario directamente a la carpeta yaml_editor
    window.location.href = "/yaml_editor/"
  }, [])

  return (
    <div className="p-6 yaml-editor">
      <Title className="text-xl md:text-2xl lg:text-3xl">YAML Editor</Title>
      <div className="mt-6">
        <p>Redireccionando al YAML Editor...</p>
      </div>
    </div>
  )
}
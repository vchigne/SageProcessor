import { Title } from "@tremor/react"
import { YAMLStudioConfigPanel } from '@/components/Settings/YAMLStudioConfigPanel'

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <Title>Configuración General</Title>
      <YAMLStudioConfigPanel />
    </div>
  )
}
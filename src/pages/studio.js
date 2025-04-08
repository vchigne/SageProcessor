import { YAMLStudioForm } from '@/components/YAMLStudio/YAMLStudioForm'
import { Title } from "@tremor/react"

export default function YAMLStudio() {
  return (
    <div className="p-6 yaml-studio">
      <Title className="text-xl md:text-2xl lg:text-3xl">YAML Studio</Title>
      <div className="mt-6">
        <YAMLStudioForm />
      </div>
    </div>
  )
}
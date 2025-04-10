import { Title } from "@tremor/react"

export default function YAMLEditor() {
  return (
    <div className="p-6 yaml-editor">
      <Title className="text-xl md:text-2xl lg:text-3xl">YAML Editor</Title>
      <div className="mt-6">
        <iframe 
          src="/yaml_editor/index.html" 
          className="w-full h-[80vh] border border-gray-200 rounded-lg"
          title="YAML Editor"
        />
      </div>
    </div>
  )
}
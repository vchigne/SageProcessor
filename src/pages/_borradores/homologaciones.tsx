import Layout from "../../components/Layout";
import { Title, Card, Text } from "@tremor/react";

export default function HomologacionesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <Title className="mb-8">Homologaciones</Title>
      
      <Card className="mt-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center max-w-2xl w-full">
            <div className="mb-4 text-6xl">🚧</div>
            <h2 className="text-2xl font-bold text-yellow-800 mb-4">Sección en Construcción</h2>
            <p className="text-yellow-700 mb-6">
              Estamos trabajando en implementar las funcionalidades de homologaciones. 
              Esta sección estará disponible próximamente.
            </p>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full w-3/4"></div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Progreso: 75%</p>
          </div>
        </div>
      </Card>
      
      <Card className="mt-8">
        <Title className="text-lg">¿Qué son las homologaciones?</Title>
        <Text className="mt-2">
          Las homologaciones permiten establecer reglas de validación y transformación para
          los archivos procesados por SAGE. Estas reglas facilitan la estandarización de 
          formatos y garantizan la calidad de los datos antes de su procesamiento.
        </Text>
        
        <Title className="text-lg mt-6">Características previstas:</Title>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li className="text-gray-600">Definición de reglas de validación personalizadas</li>
          <li className="text-gray-600">Mapeo de campos entre diferentes estructuras de datos</li>
          <li className="text-gray-600">Transformaciones de formato automáticas</li>
          <li className="text-gray-600">Plantillas de homologación reutilizables</li>
          <li className="text-gray-600">Historial de modificaciones y versiones</li>
        </ul>
      </Card>
    </div>
  );
}

HomologacionesPage.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};
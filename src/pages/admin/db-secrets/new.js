import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { 
  Card, 
  Title, 
  Text,
  Button,
  TextInput,
  Select,
  SelectItem,
  Textarea,
  Grid,
  Col,
  Switch
} from '@tremor/react';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';

const tipoServidorOptions = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'duckdb', label: 'DuckDB' }
];

const credentialFields = {
  postgresql: [
    { name: 'host', label: 'Host', type: 'text', required: true },
    { name: 'port', label: 'Puerto', type: 'number', required: true, defaultValue: '5432' },
    { name: 'user', label: 'Usuario', type: 'text', required: true },
    { name: 'password', label: 'Contraseña', type: 'password', required: true },
    { name: 'ssl', label: 'Usar SSL', type: 'boolean', required: false }
  ],
  mysql: [
    { name: 'host', label: 'Host', type: 'text', required: true },
    { name: 'port', label: 'Puerto', type: 'number', required: true, defaultValue: '3306' },
    { name: 'user', label: 'Usuario', type: 'text', required: true },
    { name: 'password', label: 'Contraseña', type: 'password', required: true },
    { name: 'ssl', label: 'Usar SSL', type: 'boolean', required: false }
  ],
  sqlserver: [
    { name: 'server', label: 'Servidor', type: 'text', required: true },
    { name: 'port', label: 'Puerto', type: 'number', required: true, defaultValue: '1433' },
    { name: 'user', label: 'Usuario', type: 'text', required: true },
    { name: 'password', label: 'Contraseña', type: 'password', required: true },
    { name: 'encrypt', label: 'Cifrar conexión', type: 'boolean', required: false, defaultValue: true }
  ],
  duckdb: [
    { name: 'path', label: 'Ruta del archivo', type: 'text', required: false, placeholder: ':memory:' },
    { name: 'read_only', label: 'Solo lectura', type: 'boolean', required: false }
  ]
};

export default function NewDBSecret() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo_servidor: 'postgresql',
    activo: true,
    credenciales: {}
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleTipoChange = (value) => {
    setFormData({
      ...formData,
      tipo_servidor: value,
      credenciales: {} // Reset credentials when server type changes
    });
  };

  const handleCredentialChange = (name, value) => {
    setFormData({
      ...formData,
      credenciales: {
        ...formData.credenciales,
        [name]: value
      }
    });
  };

  const handleToggle = (name, checked) => {
    if (name === 'activo') {
      setFormData({
        ...formData,
        activo: checked
      });
    } else {
      // For credential toggles
      handleCredentialChange(name, checked);
    }
  };

  const validateForm = () => {
    if (!formData.nombre) {
      toast.error('El nombre es obligatorio');
      return false;
    }
    
    if (!formData.tipo_servidor) {
      toast.error('El tipo de servidor es obligatorio');
      return false;
    }
    
    // Check required credential fields
    const fields = credentialFields[formData.tipo_servidor] || [];
    for (const field of fields) {
      if (field.required && !formData.credenciales[field.name]) {
        toast.error(`El campo "${field.label}" es obligatorio`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/admin/db-secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el secreto');
      }
      
      toast.success('Secreto creado correctamente');
      router.push('/admin/db-secrets');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear el secreto');
    } finally {
      setLoading(false);
    }
  };

  const renderCredentialFields = () => {
    const fields = credentialFields[formData.tipo_servidor] || [];
    
    return fields.map((field) => {
      if (field.type === 'boolean') {
        return (
          <Col key={field.name} span={12}>
            <div className="mt-4">
              <Switch
                id={`cred-${field.name}`}
                name={field.name}
                checked={formData.credenciales[field.name] ?? field.defaultValue ?? false}
                onChange={(checked) => handleToggle(field.name, checked)}
              />
              <label htmlFor={`cred-${field.name}`} className="ml-2">
                {field.label}
              </label>
            </div>
          </Col>
        );
      }
      
      return (
        <Col key={field.name} span={6}>
          <TextInput
            type={field.type}
            name={field.name}
            placeholder={field.placeholder || ''}
            value={formData.credenciales[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCredentialChange(field.name, e.target.value)}
            required={field.required}
            label={field.label}
            className="mt-4"
          />
        </Col>
      );
    });
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Secretos de Bases de Datos', href: '/admin/db-secrets' },
          { label: 'Nuevo Secreto', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Nuevo Secreto de Base de Datos</Title>
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2 mt-4 sm:mt-0">
            <Button
              variant="light"
              icon={ArrowLeftIcon}
              onClick={() => router.back()}
            >
              Volver
            </Button>
          </div>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <Grid numCols={12} className="gap-6">
              <Col span={6}>
                <TextInput
                  name="nombre"
                  label="Nombre"
                  placeholder="Nombre del servidor"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </Col>
              
              <Col span={6}>
                <Select 
                  name="tipo_servidor"
                  label="Tipo de Servidor"
                  value={formData.tipo_servidor}
                  onValueChange={handleTipoChange}
                  required
                >
                  {tipoServidorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
              </Col>
              
              <Col span={12}>
                <Textarea
                  name="descripcion"
                  label="Descripción"
                  placeholder="Descripción del servidor"
                  value={formData.descripcion}
                  onChange={handleChange}
                />
              </Col>
              
              <Col span={12}>
                <div className="mt-2">
                  <Switch
                    id="activo"
                    name="activo"
                    checked={formData.activo}
                    onChange={(checked) => handleToggle('activo', checked)}
                  />
                  <label htmlFor="activo" className="ml-2">
                    Activo
                  </label>
                </div>
              </Col>
              
              <Col span={12}>
                <Text className="font-semibold text-lg mt-4">Credenciales</Text>
              </Col>
              
              {renderCredentialFields()}
              
              <Col span={12} className="mt-6">
                <div className="flex justify-end space-x-4">
                  <Button
                    variant="secondary"
                    onClick={() => router.back()}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={CheckIcon}
                    loading={loading}
                  >
                    Guardar
                  </Button>
                </div>
              </Col>
            </Grid>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
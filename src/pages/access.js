import { useState } from 'react'
import { 
  Title, 
  TabGroup, 
  TabList, 
  Tab, 
  TabPanels, 
  TabPanel,
  Card,
  Text,
  Badge,
  Button,
  TextInput,
  Grid,
  Select,
  SelectItem,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@tremor/react"
import { 
  UserIcon,
  ShieldCheckIcon,
  KeyIcon,
  ClockIcon,
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

const usuarios = [
  { id: 1, nombre: "Admin User", email: "admin@sage.com", rol: "Administrador", estado: "activo", ultimoAcceso: "Hace 5 minutos" },
  { id: 2, nombre: "Juan Pérez", email: "jperez@org.com", rol: "Editor", estado: "activo", ultimoAcceso: "Hace 1 hora" },
  { id: 3, nombre: "Ana García", email: "agarcia@org.com", rol: "Visualizador", estado: "inactivo", ultimoAcceso: "Hace 2 días" },
]

const roles = [
  { id: 1, nombre: "Administrador", descripcion: "Acceso total al sistema", permisos: ["crear", "editar", "eliminar", "configurar"] },
  { id: 2, nombre: "Editor", descripcion: "Puede crear y editar contenido", permisos: ["crear", "editar"] },
  { id: 3, nombre: "Visualizador", descripcion: "Solo puede ver contenido", permisos: ["ver"] },
]

const historialAccesos = [
  { id: 1, usuario: "Admin User", accion: "Login exitoso", timestamp: "2024-03-10 14:30:00", ip: "192.168.1.100" },
  { id: 2, usuario: "Juan Pérez", accion: "Actualización de perfil", timestamp: "2024-03-10 13:15:00", ip: "192.168.1.101" },
  { id: 3, usuario: "Sistema", accion: "Backup automático", timestamp: "2024-03-10 12:00:00", ip: "localhost" },
]

const UsuariosPanel = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <Text>Gestión de Usuarios</Text>
      <Button icon={PlusCircleIcon} size="sm">
        Nuevo Usuario
      </Button>
    </div>

    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nombre</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
            <TableHeaderCell>Rol</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Último Acceso</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell>{usuario.nombre}</TableCell>
              <TableCell>{usuario.email}</TableCell>
              <TableCell>
                <Badge color="blue">{usuario.rol}</Badge>
              </TableCell>
              <TableCell>
                <Badge color={usuario.estado === "activo" ? "green" : "red"}>
                  {usuario.estado}
                </Badge>
              </TableCell>
              <TableCell>{usuario.ultimoAcceso}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button icon={PencilIcon} variant="light" size="xs">
                    Editar
                  </Button>
                  <Button icon={TrashIcon} variant="light" color="red" size="xs">
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  </div>
)

const RolesPanel = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <Text>Gestión de Roles</Text>
      <Button icon={PlusCircleIcon} size="sm">
        Nuevo Rol
      </Button>
    </div>

    <Grid numItems={1} numItemsMd={2} numItemsLg={3} className="gap-6">
      {roles.map((rol) => (
        <Card key={rol.id} className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <Text className="font-medium">{rol.nombre}</Text>
              <Text className="text-sm text-gray-500">{rol.descripcion}</Text>
            </div>
            <Button variant="light" size="xs">Editar</Button>
          </div>

          <div className="space-y-2">
            <Text className="text-sm">Permisos:</Text>
            <div className="flex flex-wrap gap-2">
              {rol.permisos.map((permiso) => (
                <Badge key={permiso} color="blue">{permiso}</Badge>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </Grid>
  </div>
)

const HistorialPanel = () => (
  <div className="space-y-6">
    <Text>Historial de Accesos</Text>

    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Usuario</TableHeaderCell>
            <TableHeaderCell>Acción</TableHeaderCell>
            <TableHeaderCell>Fecha y Hora</TableHeaderCell>
            <TableHeaderCell>IP</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {historialAccesos.map((acceso) => (
            <TableRow key={acceso.id}>
              <TableCell>{acceso.usuario}</TableCell>
              <TableCell>{acceso.accion}</TableCell>
              <TableCell>{acceso.timestamp}</TableCell>
              <TableCell>{acceso.ip}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  </div>
)

const ConfiguracionPanel = () => (
  <Card className="space-y-6">
    <Text>Configuración de Seguridad</Text>

    <div className="space-y-4">
      <div className="space-y-2">
        <Text>Política de Contraseñas</Text>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Text>Longitud mínima</Text>
            <TextInput type="number" value="8" className="w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Text>Expiración (días)</Text>
            <TextInput type="number" value="90" className="w-24" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Text>Sesión</Text>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Text>Tiempo máximo de inactividad (minutos)</Text>
            <TextInput type="number" value="30" className="w-24" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Text>Autenticación de dos factores</Text>
        <div className="flex items-center space-x-4">
          <Button size="sm" variant="secondary">Configurar 2FA</Button>
          <Button size="sm" variant="secondary">Gestionar Dispositivos</Button>
        </div>
      </div>
    </div>
  </Card>
)

export default function AccessControl() {
  const [selectedTab, setSelectedTab] = useState(0)

  return (
    <div className="p-6 space-y-6">
      <Title>Control de Acceso</Title>

      <TabGroup index={selectedTab} onIndexChange={setSelectedTab}>
        <TabList className="mt-8">
          <Tab icon={UserIcon}>Usuarios</Tab>
          <Tab icon={ShieldCheckIcon}>Roles</Tab>
          <Tab icon={ClockIcon}>Historial</Tab>
          <Tab icon={KeyIcon}>Configuración</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <UsuariosPanel />
          </TabPanel>
          <TabPanel>
            <RolesPanel />
          </TabPanel>
          <TabPanel>
            <HistorialPanel />
          </TabPanel>
          <TabPanel>
            <ConfiguracionPanel />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  )
}
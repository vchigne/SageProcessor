import { useState, useEffect } from 'react'
import { ResponsablesGrid } from '@/components/DataBoxes/ResponsablesGrid'
import { NewResponsableModal } from '@/components/DataBoxes/NewResponsableModal'
import { EditResponsableModal } from '@/components/DataBoxes/EditResponsableModal'

export default function ResponsablesPage() {
  const [responsables, setResponsables] = useState([])
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [currentResponsable, setCurrentResponsable] = useState(null)

  useEffect(() => {
    fetchResponsables()
  }, [])

  const fetchResponsables = async () => {
    try {
      const response = await fetch('/api/responsables')
      if (!response.ok) {
        throw new Error('Error fetching responsables')
      }
      const data = await response.json()
      setResponsables(data)
    } catch (error) {
      console.error('Error fetching responsables:', error)
    }
  }

  const handleCreateResponsable = async (data) => {
    try {
      const response = await fetch('/api/responsables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Error creating responsable')
      }

      await fetchResponsables()
      setIsNewModalOpen(false)
    } catch (error) {
      console.error('Error creating responsable:', error)
      throw error
    }
  }

  const handleUpdateResponsable = async (data) => {
    try {
      const response = await fetch(`/api/responsables/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el responsable')
      }

      await fetchResponsables()
      setIsEditModalOpen(false)
      setCurrentResponsable(null)
    } catch (error) {
      console.error('Error updating responsable:', error)
      throw error
    }
  }

  const handleDeleteResponsable = async (responsable) => {
    try {
      const response = await fetch(`/api/responsables/${responsable.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar el responsable')
      }

      await fetchResponsables()
    } catch (error) {
      console.error('Error deleting responsable:', error)
    }
  }

  const handleOpenEditModal = (responsable) => {
    setCurrentResponsable(responsable)
    setIsEditModalOpen(true)
    console.log('Editar responsable:', responsable)
  }

  return (
    <div>
      <ResponsablesGrid 
        responsables={responsables}
        onNewClick={() => setIsNewModalOpen(true)}
        onEditClick={handleOpenEditModal}
        onDeleteClick={handleDeleteResponsable}
      />
      <NewResponsableModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateResponsable}
      />
      <EditResponsableModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setCurrentResponsable(null)
        }}
        onSubmit={handleUpdateResponsable}
        responsableData={currentResponsable}
      />
    </div>
  )
}
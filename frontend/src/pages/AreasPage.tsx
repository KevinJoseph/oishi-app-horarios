import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Table,
  Text,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { createArea, deleteArea as deleteAreaApi, fetchAreas, updateArea, type AreaResponse } from '../api/areaApi';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

export function AreasPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const currentUser = useAuthStore((s) => s.currentUser);
  const selectedCompanyId = useAuthStore((s) => s.selectedGeoVictoriaCompanyId);
  const canEdit = currentUser?.role === 'super_administrador' || currentUser?.role === 'administrador';

  const [areas, setAreas] = useState<AreaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const [editing, setEditing] = useState<AreaResponse | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formOrder, setFormOrder] = useState(0);

  const colorByIndex = (index: number): string => {
    const palette = ['#90CDF4', '#63B3ED', '#4299E1', '#38B2AC', '#4FD1C5', '#76E4F7'];
    return palette[index % palette.length];
  };

  const loadAreas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAreas(selectedCompanyId);
      setAreas(data);
    } catch (err) {
      toast({ status: 'error', title: err instanceof Error ? err.message : 'Error al cargar áreas.' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, toast]);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const refreshStoreAreas = useCallback(async () => {
    try {
      const updated = await fetchAreas(selectedCompanyId);
      useAppStore.setState((state) => {
        const nextAreas = updated.map((a) => ({ code: a.code, label: a.label, order: a.order }));
        const nextCurrentAreaId =
          nextAreas.some((area) => area.code === state.currentAreaId)
            ? state.currentAreaId
            : (nextAreas[0]?.code ?? '');
        return {
          areas: nextAreas,
          currentAreaId: nextCurrentAreaId
        };
      });
    } catch { /* silent */ }
  }, [selectedCompanyId]);

  const openCreate = () => {
    setEditing(null);
    setFormLabel('');
    setFormOrder(areas.length);
    onOpen();
  };

  const openEdit = (area: AreaResponse) => {
    setEditing(area);
    setFormLabel(area.label);
    setFormOrder(area.order);
    onOpen();
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      toast({ status: 'warning', title: 'El nombre es obligatorio.' });
      return;
    }
    const duplicatedOrder = areas.find((area) => area.order === formOrder && area.code !== editing?.code);
    if (duplicatedOrder) {
      toast({ status: 'warning', title: 'Ya existe un área con ese número de orden.' });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateArea(editing.code, { label: formLabel.trim(), order: formOrder }, selectedCompanyId);
        toast({ status: 'success', title: 'Área actualizada.' });
      } else {
        const code = formLabel.trim().toLowerCase().replace(/\s+/g, '_');
        await createArea({ code, label: formLabel.trim(), order: formOrder }, selectedCompanyId);
        toast({ status: 'success', title: 'Área creada.' });
      }
      onClose();
      await loadAreas();
      await refreshStoreAreas();
    } catch (err) {
      toast({ status: 'error', title: err instanceof Error ? err.message : 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (deletingCode) return;
    setDeletingCode(code);
    try {
      await deleteAreaApi(code, selectedCompanyId);
      toast({ status: 'success', title: 'Área eliminada.' });
      await loadAreas();
      await refreshStoreAreas();
    } catch (err) {
      toast({ status: 'error', title: err instanceof Error ? err.message : 'Error al eliminar.' });
    } finally {
      setDeletingCode(null);
    }
  };

  return (
    <Box>
      <Card borderWidth="1px" borderColor="blackAlpha.100" bg="white" boxShadow="sm" rounded="2xl">
        <CardBody px={{ base: 4, md: 5 }} py={{ base: 4, md: 5 }}>
          <HStack justify="space-between" mb={4} align="center">
            <Badge
              px={3}
              py={1.5}
              rounded="md"
              colorScheme="blue"
              bg="blue.100"
              color="blue.800"
              fontSize="0.72rem"
              fontWeight="800"
              textTransform="uppercase"
            >
              Total de Areas: {loading ? '...' : areas.length}
            </Badge>
            {canEdit && (
              <Button colorScheme="blue" onClick={openCreate}>
                Nueva Area
              </Button>
            )}
          </HStack>
          <Box overflowX="auto">
            <Table size="sm" bg="white" minW="760px">
              <Thead>
                <Tr>
                  <Th>Orden</Th>
                  {/*<Th>Color</Th>*/}
                  <Th>Area</Th>
                  {canEdit && <Th>Acciones</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {loading && (
                  <Tr>
                    <Td colSpan={canEdit ? 3 : 2} textAlign="center" py={8} color="gray.500">
                      Cargando areas...
                    </Td>
                  </Tr>
                )}
                {!loading && areas.length === 0 && (
                  <Tr>
                    <Td colSpan={canEdit ? 3 : 2} textAlign="center" py={8} color="gray.500">
                      No hay areas registradas.
                    </Td>
                  </Tr>
                )}
                {!loading &&
                  areas.map((area, index) => (
                    <Tr key={area.code}>
                      <Td>
                        <Badge variant="subtle" colorScheme="blue" rounded="full" px={2.5} py={0.5}>
                          {area.order}
                        </Badge>
                      </Td>
                      {/*<Td>
                        <Box w={5} h={5} rounded="md" bg={colorByIndex(index)} borderWidth="1px" borderColor="blue.100" />
                      </Td>*/}
                      <Td>
                        <Text fontWeight="500">{area.label}</Text>
                      </Td>
                      {canEdit && (
                        <Td>
                          <HStack spacing={2}>
                            <Tooltip label="Editar" hasArrow>
                              <IconButton
                                aria-label="Editar"
                                icon={<FiEdit2 />}
                                size="xs"
                                variant="outline"
                                colorScheme="brand"
                                onClick={() => openEdit(area)}
                              />
                            </Tooltip>
                            <Tooltip label="Eliminar" hasArrow>
                              <IconButton
                                aria-label="Eliminar"
                                icon={<FiTrash2 />}
                                size="xs"
                                variant="outline"
                                colorScheme="brand"
                                isLoading={deletingCode === area.code}
                                onClick={() => handleDelete(area.code)}
                              />
                            </Tooltip>
                          </HStack>
                        </Td>
                      )}
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editing ? 'Editar Área' : 'Nueva Área'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={3}>
              <FormLabel fontSize="sm">Nombre</FormLabel>
              <Input
                size="sm"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="ej: Zona Salón"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Orden</FormLabel>
              <NumberInput size="sm" value={formOrder} min={0} onChange={(_, val) => setFormOrder(val || 0)}>
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" mr={2} onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" colorScheme="blue" isLoading={saving} onClick={handleSave}>
              {editing ? 'Actualizar' : 'Crear'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

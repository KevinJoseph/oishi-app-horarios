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
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronRight, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { createArea, deleteArea as deleteAreaApi, fetchAreas, updateArea, type AreaResponse } from '../api/areaApi';
import {
  createSubArea,
  deleteSubArea as deleteSubAreaApi,
  fetchAllSubAreas,
  updateSubArea,
  type SubAreaResponse
} from '../api/subAreaApi';
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

  // Sub-áreas: solo organizativas, no afectan la planificación de horarios.
  const subModal = useDisclosure();
  const [subAreas, setSubAreas] = useState<SubAreaResponse[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subParent, setSubParent] = useState<string | null>(null);
  const [subEditing, setSubEditing] = useState<SubAreaResponse | null>(null);
  const [subLabel, setSubLabel] = useState('');
  const [subOrder, setSubOrder] = useState(0);
  const [subSaving, setSubSaving] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  const subAreasByArea = useMemo(() => {
    const map: Record<string, SubAreaResponse[]> = {};
    for (const sub of subAreas) {
      (map[sub.areaCode] ??= []).push(sub);
    }
    return map;
  }, [subAreas]);

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

  const loadSubAreas = useCallback(async () => {
    try {
      setSubAreas(await fetchAllSubAreas(selectedCompanyId));
    } catch (err) {
      toast({ status: 'error', title: err instanceof Error ? err.message : 'Error al cargar sub-áreas.' });
    }
  }, [selectedCompanyId, toast]);

  useEffect(() => {
    loadAreas();
    loadSubAreas();
  }, [loadAreas, loadSubAreas]);

  const toggleExpanded = (code: string) => setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));

  const openCreateSub = (areaCode: string) => {
    setSubParent(areaCode);
    setSubEditing(null);
    setSubLabel('');
    setSubOrder((subAreasByArea[areaCode]?.length ?? 0) + 1);
    subModal.onOpen();
  };

  const openEditSub = (sub: SubAreaResponse) => {
    setSubParent(sub.areaCode);
    setSubEditing(sub);
    setSubLabel(sub.label);
    setSubOrder(sub.order);
    subModal.onOpen();
  };

  const handleSaveSub = async () => {
    if (!subParent) return;
    if (!subLabel.trim()) {
      toast({ status: 'warning', title: 'El nombre es obligatorio.' });
      return;
    }
    setSubSaving(true);
    try {
      if (subEditing) {
        await updateSubArea(subParent, subEditing.code, { label: subLabel.trim(), order: subOrder }, selectedCompanyId);
        toast({ status: 'success', title: 'Sub-área actualizada.' });
      } else {
        await createSubArea(subParent, { label: subLabel.trim(), order: subOrder }, selectedCompanyId);
        toast({ status: 'success', title: 'Sub-área creada.' });
      }
      setExpanded((prev) => ({ ...prev, [subParent]: true }));
      subModal.onClose();
      await loadSubAreas();
    } catch (err) {
      toast({ status: 'error', title: err instanceof Error ? err.message : 'Error al guardar.' });
    } finally {
      setSubSaving(false);
    }
  };

  const handleDeleteSub = async (sub: SubAreaResponse) => {
    if (deletingSubId) return;
    setDeletingSubId(sub.id);
    try {
      await deleteSubAreaApi(sub.areaCode, sub.code, selectedCompanyId);
      toast({ status: 'success', title: 'Sub-área eliminada.' });
      await loadSubAreas();
    } catch (err) {
      toast({ status: 'error', title: err instanceof Error ? err.message : 'Error al eliminar.' });
    } finally {
      setDeletingSubId(null);
    }
  };

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
      await loadSubAreas();
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
                  areas.map((area) => {
                    const subs = subAreasByArea[area.code] ?? [];
                    const isExpanded = !!expanded[area.code];
                    return (
                    <Fragment key={area.code}>
                    <Tr>
                      <Td>
                        <Badge variant="subtle" colorScheme="blue" rounded="full" px={2.5} py={0.5}>
                          {area.order}
                        </Badge>
                      </Td>
                      {/*<Td>
                        <Box w={5} h={5} rounded="md" bg={colorByIndex(index)} borderWidth="1px" borderColor="blue.100" />
                      </Td>*/}
                      <Td>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label={isExpanded ? 'Ocultar sub-áreas' : 'Ver sub-áreas'}
                            icon={isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                            size="xs"
                            variant="ghost"
                            onClick={() => toggleExpanded(area.code)}
                          />
                          <Text fontWeight="500">{area.label}</Text>
                          {subs.length > 0 && (
                            <Badge colorScheme="gray" rounded="full" fontSize="0.65rem">
                              {subs.length} sub-área{subs.length === 1 ? '' : 's'}
                            </Badge>
                          )}
                        </HStack>
                      </Td>
                      {canEdit && (
                        <Td>
                          <HStack spacing={2}>
                            <Tooltip label="Agregar sub-área" hasArrow>
                              <IconButton
                                aria-label="Agregar sub-área"
                                icon={<FiPlus />}
                                size="xs"
                                variant="outline"
                                colorScheme="brand"
                                onClick={() => openCreateSub(area.code)}
                              />
                            </Tooltip>
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
                    {isExpanded && subs.length === 0 && (
                      <Tr bg="gray.50">
                        <Td />
                        <Td colSpan={canEdit ? 2 : 1} pl={12} color="gray.500" fontSize="xs">
                          Sin sub-áreas.
                        </Td>
                      </Tr>
                    )}
                    {isExpanded &&
                      subs.map((sub) => (
                        <Tr key={sub.id} bg="gray.50">
                          <Td>
                            <Badge variant="outline" colorScheme="gray" rounded="full" px={2} ml={4}>
                              {area.order}.{sub.order}
                            </Badge>
                          </Td>
                          <Td pl={12}>
                            <Text fontSize="sm" color="gray.700">
                              ↳ {sub.label}
                            </Text>
                          </Td>
                          {canEdit && (
                            <Td>
                              <HStack spacing={2} pl={8}>
                                <Tooltip label="Editar sub-área" hasArrow>
                                  <IconButton
                                    aria-label="Editar sub-área"
                                    icon={<FiEdit2 />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="brand"
                                    onClick={() => openEditSub(sub)}
                                  />
                                </Tooltip>
                                <Tooltip label="Eliminar sub-área" hasArrow>
                                  <IconButton
                                    aria-label="Eliminar sub-área"
                                    icon={<FiTrash2 />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="brand"
                                    isLoading={deletingSubId === sub.id}
                                    onClick={() => handleDeleteSub(sub)}
                                  />
                                </Tooltip>
                              </HStack>
                            </Td>
                          )}
                        </Tr>
                      ))}
                    </Fragment>
                    );
                  })}
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

      <Modal isOpen={subModal.isOpen} onClose={subModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {subEditing ? 'Editar Sub-área' : 'Nueva Sub-área'}
            <Text fontSize="sm" fontWeight="400" color="gray.500">
              Área: {areas.find((a) => a.code === subParent)?.label ?? subParent}
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={3}>
              <FormLabel fontSize="sm">Nombre</FormLabel>
              <Input
                size="sm"
                value={subLabel}
                onChange={(e) => setSubLabel(e.target.value)}
                placeholder="ej: Cocina caliente"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Orden</FormLabel>
              <NumberInput size="sm" value={subOrder} min={0} onChange={(_, val) => setSubOrder(val || 0)}>
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" mr={2} onClick={subModal.onClose}>
              Cancelar
            </Button>
            <Button size="sm" colorScheme="blue" isLoading={subSaving} onClick={handleSaveSub}>
              {subEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

import {
  Badge,
  Box,
  Card,
  CardBody,
  CardHeader,
  HStack,
  Input,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchBukShifts, type BukRegisteredShift } from '../api/bukApi';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function BukShiftCatalogPage(): JSX.Element {
  const toast = useToast();
  const [shifts, setShifts] = useState<BukRegisteredShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBukShifts()
      .then(setShifts)
      .catch((error) => {
        toast({ status: 'error', title: error instanceof Error ? error.message : 'Error al cargar el catálogo.' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const filteredShifts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return shifts;
    return shifts.filter((shift) =>
      [shift.code, shift.name, shift.areaLabel, ...shift.recintoCodes].some((value) => value.toLowerCase().includes(term))
    );
  }, [shifts, search]);

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardHeader>
          <VStack align="stretch" spacing={1}>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Catálogo de turnos
            </Text>
            <Text color="gray.600">
              Turnos creados en BUK desde Migrar BUK. Cada horario conserva su código y se reutiliza en cualquier semana.
            </Text>
          </VStack>
        </CardHeader>
      </Card>

      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
            <Input
              size="sm"
              maxW={{ base: '100%', md: '320px' }}
              placeholder="Buscar por código, nombre, área o recinto"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Badge colorScheme="purple" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
              Turnos: {shifts.length}
            </Badge>
          </HStack>
          {loading ? (
            <Text color="gray.500">Cargando...</Text>
          ) : !filteredShifts.length ? (
            <Text color="gray.500">
              {shifts.length ? 'Ningún turno coincide con la búsqueda.' : 'Aún no se han exportado turnos a BUK.'}
            </Text>
          ) : (
            <Box overflowX="auto">
              <Table size="sm" bg="white" minW="900px">
                <Thead>
                  <Tr>
                    <Th>Código</Th>
                    <Th>Área</Th>
                    <Th>Nombre</Th>
                    <Th>Inicio</Th>
                    <Th>Fin</Th>
                    <Th>Nocturno</Th>
                    <Th>Recintos</Th>
                    <Th>Creado</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredShifts.map((shift) => (
                    <Tr key={shift.signature}>
                      <Td>
                        <Badge colorScheme="blue" textTransform="none">
                          {shift.code}
                        </Badge>
                      </Td>
                      <Td>{shift.areaLabel}</Td>
                      <Td>{shift.name}</Td>
                      <Td>{shift.start}</Td>
                      <Td>{shift.end}</Td>
                      <Td>{shift.nocturnal ? 'Si' : 'No'}</Td>
                      <Td>
                        <HStack spacing={1} flexWrap="wrap">
                          {shift.recintoCodes.length
                            ? shift.recintoCodes.map((code) => (
                                <Badge key={code} colorScheme="gray" textTransform="none">
                                  {code}
                                </Badge>
                              ))
                            : '-'}
                        </HStack>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.600">
                          {formatDate(shift.createdAt)}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}

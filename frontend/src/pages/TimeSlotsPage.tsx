import { Badge, Box, Card, CardBody, Text } from '@chakra-ui/react';
import { useAppStore } from '../store/useAppStore';

export function TimeSlotsPage(): JSX.Element {
  const timeSlots = useAppStore((state) => state.timeSlots);
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardBody>
        <Text fontWeight="600" mb={3}>
          Configuración de Horarios
        </Text>
        <Text fontSize="sm" color="gray.600" mb={4}>
          Actualmente se carga directamente en la Aplicación. Para modificarlo comunicarse con el programador.
        </Text>
        <Box display="flex" gap={2} flexWrap="wrap">
          {ordered.map((slot) => (
            <Badge key={slot.id} px={3} py={1} rounded="md">
              {slot.label}
            </Badge>
          ))}
        </Box>
      </CardBody>
    </Card>
  );
}

import { Box, Flex, Text } from '@chakra-ui/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function Topbar(): JSX.Element {
  return (
    <Box bg="whiteAlpha.900" backdropFilter="saturate(180%) blur(8px)" borderBottomWidth="1px" borderBottomColor="blackAlpha.100" px={6} py={3}>
      <Flex align="center" justify="space-between">
        <Text fontSize="md" fontWeight="700" color="gray.800">
          Planificación de Horarios
        </Text>
        <Text fontSize="sm" color="gray.500" textTransform="capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
        </Text>
      </Flex>
    </Box>
  );
}

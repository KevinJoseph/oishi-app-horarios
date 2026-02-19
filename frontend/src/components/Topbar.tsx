import { Box, Flex, HStack, Icon, Text } from '@chakra-ui/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiBell, FiCalendar } from 'react-icons/fi';

export function Topbar(): JSX.Element {
  return (
    <Box bg="white" borderBottomWidth="1px" borderBottomColor="#d8e0ea" px={{ base: 4, md: 8 }} py={4}>
      <Flex align="center" justify="space-between">
        <HStack spacing={3} color="gray.500" fontSize="sm" display={{ base: 'none', md: 'flex' }}>
          <Text>Inicio</Text>
          <Text>/</Text>
          <Text color="gray.700" fontWeight="600">
            Planificación
          </Text>
        </HStack>
        <HStack spacing={{ base: 3, md: 6 }}>
          <HStack spacing={2} color="gray.700">
            <Icon as={FiCalendar} />
            <Text fontSize="xs" fontWeight="600" display={{ base: 'block', md: 'none' }}>
              {format(new Date(), 'dd/MM/yyyy', { locale: es })}
            </Text>
            <Text fontSize="sm" textTransform="capitalize" fontWeight="600" display={{ base: 'none', md: 'block' }}>
              {format(new Date(), "EEEE, dd 'de' MMMM, yyyy", { locale: es })}
            </Text>
          </HStack>
          <Icon as={FiBell} color="gray.700" boxSize={5} display={{ base: 'none', md: 'block' }} />
        </HStack>
      </Flex>
    </Box>
  );
}

import { Box, Flex, Spinner, Text, VStack } from '@chakra-ui/react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell(): JSX.Element {
  const hydrated = useAppStore((state) => state.hydrated);
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!hydrated) {
    return (
      <VStack minH="100vh" justify="center" spacing={4}>
        <Spinner size="lg" />
        <Text color="gray.600">Cargando planificación...</Text>
      </VStack>
    );
  }

  return (
    <Flex direction={{ base: 'column', md: 'row' }} minH="100vh">
      <Sidebar />
      <Box flex={1} display="flex" flexDirection="column" minH="100vh" minW={0}>
        <Topbar />
        <Box flex="1" p={{ base: 3, md: 6 }} maxW="1200px" mx="auto" w="100%">
          <Outlet />
        </Box>
        <Flex
          bg="white"
          borderTopWidth="1px"
          borderTopColor="#d8e0ea"
          px={{ base: 4, md: 8 }}
          py={3}
          justify="space-between"
          align="center"
          fontSize="sm"
          color="gray.600"
          wrap="wrap"
          gap={3}
          display={{ base: 'none', md: 'flex' }}
        >
          <Text>
            Desarrollado por <Text as="span" color="black" fontWeight="700">Oishipartners</Text>
          </Text>
          <Flex gap={6}>
            <Text>Soporte</Text>
            <Text>Política de Privacidad</Text>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}

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
      <Box flex={1} display="flex" flexDirection="column" minH="100vh">
        <Topbar />
        <Box flex="1" p={{ base: 4, md: 6 }} maxW="1680px" mx="auto" w="100%">
          <Outlet />
        </Box>
        <Box
          mt="auto"
          py={3}
          px={{ base: 4, md: 6 }}
          w="100%"
          borderTop="1px solid"
          borderColor="gray.200"
        >
          <Text fontSize="xs" color="gray.400" textAlign="center">
            Desarrollado por{' '}
            <Text as="span" fontWeight="600" color="gray.600">
              Oishipartners
            </Text>
          </Text>
        </Box>
      </Box>
    </Flex>
  );
}

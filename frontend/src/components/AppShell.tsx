import { Box, Flex, Icon, IconButton, Progress, Text, Tooltip, VStack, useDisclosure } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { MdSupportAgent } from 'react-icons/md';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Sidebar } from './Sidebar';
import { TicketReportModal } from './TicketReportModal';
import { Topbar } from './Topbar';

function LoadingProgress(): JSX.Element {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Sin progreso real del servidor: avance simulado que desacelera hacia 95%.
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(95, prev + (95 - prev) * 0.06));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <VStack minH="100vh" justify="center" spacing={4}>
      <Progress
        value={progress}
        size="sm"
        w={{ base: '70%', md: '320px' }}
        borderRadius="full"
        colorScheme="blue"
        bg="gray.100"
        sx={{ '& > div': { transition: 'width 0.3s ease' } }}
      />
      <Text color="gray.600">Cargando planificación... {Math.round(progress)}%</Text>
    </VStack>
  );
}

export function AppShell(): JSX.Element {
  const hydrated = useAppStore((state) => state.hydrated);
  const initialize = useAppStore((state) => state.initialize);
  const ticketModal = useDisclosure();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!hydrated) {
    return <LoadingProgress />;
  }

  return (
    <Flex direction={{ base: 'column', md: 'row' }} minH="100vh">
      <Sidebar />
      <Box flex={1} display="flex" flexDirection="column" minH="100vh" minW={0}>
        <Topbar />
        <Box flex="1" p={{ base: 3, md: 6 }} maxW="none" mx={0} w="100%">
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
      <Tooltip label="Reportar incidencia" hasArrow placement="left">
        <IconButton
          aria-label="Reportar incidencia"
          icon={<Icon as={MdSupportAgent} boxSize={6} />}
          bg="green.500"
          color="white"
          _hover={{ bg: 'green.600' }}
          _active={{ bg: 'green.700' }}
          borderRadius="full"
          boxShadow="0 18px 40px rgba(47, 117, 246, 0.35)"
          position="fixed"
          right={{ base: 4, md: 6 }}
          bottom={{ base: 4, md: 6 }}
          zIndex={20}
          w="60px"
          h="60px"
          onClick={ticketModal.onOpen}
        />
      </Tooltip>
      <TicketReportModal isOpen={ticketModal.isOpen} onClose={ticketModal.onClose} />
    </Flex>
  );
}

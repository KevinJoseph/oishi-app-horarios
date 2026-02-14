import { Box, Flex } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell(): JSX.Element {
  return (
    <Flex direction={{ base: 'column', md: 'row' }} minH="100vh">
      <Sidebar />
      <Box flex={1}>
        <Topbar />
        <Box p={{ base: 4, md: 6 }}>
          <Outlet />
        </Box>
      </Box>
    </Flex>
  );
}

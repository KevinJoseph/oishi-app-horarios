import { Center, Spinner, Text, VStack } from '@chakra-ui/react';
import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export function RequireAuth(): JSX.Element {
  const initialized = useAuthStore((state) => state.initialized);
  const loading = useAuthStore((state) => state.loading);
  const currentUser = useAuthStore((state) => state.currentUser);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!initialized || loading) {
    return (
      <Center minH="100vh">
        <VStack spacing={4}>
          <Spinner size="lg" />
          <Text color="gray.600">Verificando sesión...</Text>
        </VStack>
      </Center>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

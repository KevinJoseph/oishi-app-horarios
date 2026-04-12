import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  Text,
  VStack,
  useToast
} from '@chakra-ui/react';
import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/http';
import { useAuthStore } from '../store/useAuthStore';

export function LoginPage(): JSX.Element {
  const toast = useToast();
  const currentUser = useAuthStore((state) => state.currentUser);
  const loading = useAuthStore((state) => state.loading);
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (): Promise<void> => {
    try {
      await login(username, password);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.';
      toast({
        status: 'error',
        title: message
      });
    }
  };

  if (currentUser) {
    return <Navigate to="/planning" replace />;
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Card maxW="430px" w="full">
        <CardBody p={{ base: 5, md: 8 }}>
          <VStack
            as="form"
            align="stretch"
            spacing={5}
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <Box textAlign="center">
              <Image
                src="/logo.svg"
                alt="Logo de OishiPartners"
                w="220px"
                maxW="70%"
                h="auto"
                mx="auto"
                mb={4}
                objectFit="contain"
              />
              <Heading size="md" mb={1}>
                Sistema de Planificación de Horarios
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Inicia sesión para gestionar turnos, colaboradores y cobertura semanal.
              </Text>
            </Box>

            <FormControl isRequired>
              <FormLabel>Usuario</FormLabel>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Contraseña</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    size="sm"
                    variant="ghost"
                    icon={showPassword ? <FiEyeOff /> : <FiEye />}
                    onClick={() => setShowPassword((value) => !value)}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>

            <Button isLoading={loading} type="submit">
              Ingresar
            </Button>
          </VStack>
        </CardBody>
      </Card>

      <Flex
        position="fixed"
        bottom={0}
        left={0}
        right={0}
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
      >
        <Text>© 2026 Oishipartners. Todos los derechos reservados.</Text>
        <Flex align="center" gap={2}>
          <Box w="8px" h="8px" rounded="full" bg="green.500" />
          <Text>Estado: Activo</Text>
        </Flex>
      </Flex>
    </Box>
  );
}

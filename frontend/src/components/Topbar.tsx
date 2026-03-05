import {
  Avatar,
  Box,
  Flex,
  HStack,
  Icon,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text
} from '@chakra-ui/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiLogOut, FiUser } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { AreaSelector } from './AreaSelector';

function getRoleLabel(role: string | undefined): string {
  if (role === 'administrador') return 'Administrador';
  if (role === 'supervisor') return 'Supervisor';
  return 'Lector';
}

export function Topbar(): JSX.Element {
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.loading);
  const hideAreaSelector = location.pathname.startsWith('/employees');

  return (
    <Box bg="white" borderBottomWidth="1px" borderBottomColor="#d8e0ea" px={{ base: 4, md: 8 }} py={4}>
      <Flex align="center" justify="space-between" gap={3}>
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
            <Text fontSize="xs" fontWeight="600" display={{ base: 'block', md: 'none' }} whiteSpace="nowrap">
              {format(new Date(), 'dd/MM/yyyy', { locale: es })}
            </Text>
            <Text
              fontSize="sm"
              textTransform="capitalize"
              fontWeight="600"
              display={{ base: 'none', md: 'block' }}
              whiteSpace="nowrap"
            >
              {format(new Date(), "EEEE, dd 'de' MMMM, yyyy", { locale: es })}
            </Text>
          </HStack>
          {hideAreaSelector ? null : (
            <HStack spacing={2}>
              <Text fontSize="xs" fontWeight="700" color="gray.600" textTransform="uppercase">
                Área
              </Text>
              <AreaSelector maxW={{ base: '140px', md: '170px' }} size="sm" />
            </HStack>
          )}
          <Menu placement="bottom-end">
            <MenuButton>
              <Avatar
                size="sm"
                name={currentUser?.name ?? currentUser?.username ?? 'Usuario'}
                icon={<FiUser />}
                bg="blue.500"
                color="white"
                cursor="pointer"
              />
            </MenuButton>
            <MenuList minW="210px">
              <Box px={2.5} py={1.5}>
                <Text fontSize="xs" color="gray.500">
                  Usuario
                </Text>
                <Text fontSize="sm" color="gray.800">
                  @{currentUser?.username ?? '-'}
                </Text>
              </Box>
              <Box px={2.5} py={1.5}>
                <Text fontSize="xs" color="gray.500">
                  Perfil
                </Text>
                <Text fontSize="sm" color="gray.800">
                  {getRoleLabel(currentUser?.role)}
                </Text>
              </Box>
              <MenuDivider />
              <MenuItem
                icon={<FiLogOut />}
                onClick={() => {
                  void logout();
                }}
                isDisabled={loading}
              >
                Cerrar sesión
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
    </Box>
  );
}

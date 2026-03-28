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
  Select,
  Text
} from '@chakra-ui/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { FiCalendar, FiLogOut, FiUser } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import { fetchGeoVictoriaCompanies, type GeoVictoriaCompany } from '../api/plannerApi';
import { useAuthStore } from '../store/useAuthStore';
import { AreaSelector } from './AreaSelector';

function getRoleLabel(role: string | undefined): string {
  if (role === 'administrador') return 'Administrador';
  if (role === 'supervisor') return 'Supervisor';
  return 'Lector';
}

function getCompanyLabel(company: GeoVictoriaCompany): string {
  return `${company.alias} - ${company.name}`;
}

export function Topbar(): JSX.Element {
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.loading);
  const selectedGeoVictoriaCompanyId = useAuthStore((state) => state.selectedGeoVictoriaCompanyId);
  const selectedGeoVictoriaCompanyLabel = useAuthStore((state) => state.selectedGeoVictoriaCompanyLabel);
  const setSelectedGeoVictoriaCompany = useAuthStore((state) => state.setSelectedGeoVictoriaCompany);
  const hideAreaSelector = location.pathname.startsWith('/employees');
  const [geoVictoriaCompanies, setGeoVictoriaCompanies] = useState<GeoVictoriaCompany[]>([]);
  const selectableGeoVictoriaCompanies = geoVictoriaCompanies.filter(
    (company) => company.alias.trim().toLowerCase() !== 'recibo'
  );

  useEffect(() => {
    fetchGeoVictoriaCompanies()
      .then((companies) => {
        setGeoVictoriaCompanies(companies);
      })
      .catch(() => {
        setGeoVictoriaCompanies([]);
      });
  }, []);

  useEffect(() => {
    if (!selectableGeoVictoriaCompanies.length) {
      return;
    }

    const selectedCompany = selectedGeoVictoriaCompanyId
      ? selectableGeoVictoriaCompanies.find((company) => company.companyId === selectedGeoVictoriaCompanyId) ?? null
      : null;

    if (selectedGeoVictoriaCompanyId && !selectedCompany) {
      setSelectedGeoVictoriaCompany(null, null);
      return;
    }

    if (!selectedGeoVictoriaCompanyId) {
      const defaultCompany =
        selectableGeoVictoriaCompanies.find((company) => company.alias.trim().toLowerCase() === 'canete') ??
        selectableGeoVictoriaCompanies[0] ??
        null;

      if (defaultCompany) {
        setSelectedGeoVictoriaCompany(defaultCompany.companyId, getCompanyLabel(defaultCompany));
      }

      return;
    }

    if (selectedCompany) {
      const expectedLabel = getCompanyLabel(selectedCompany);
      if (selectedGeoVictoriaCompanyLabel !== expectedLabel) {
        setSelectedGeoVictoriaCompany(selectedCompany.companyId, expectedLabel);
      }
    }
  }, [
    selectedGeoVictoriaCompanyId,
    selectedGeoVictoriaCompanyLabel,
    selectableGeoVictoriaCompanies,
    setSelectedGeoVictoriaCompany
  ]);

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
          {selectedGeoVictoriaCompanyLabel ? (
            <HStack spacing={2} bg="blue.50" px={3} py={1.5} rounded="md" borderWidth="1px" borderColor="blue.100">
              <Text fontSize="sm" color="blue.800" fontWeight="600" whiteSpace="nowrap">
                {selectedGeoVictoriaCompanyLabel}
              </Text>
            </HStack>
          ) : null}
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
              <Box px={2.5} py={1.5}>
                <Text fontSize="xs" color="gray.500" mb={1}>
                  Empresa
                </Text>
                <Select
                  size="sm"
                  value={selectedGeoVictoriaCompanyId ?? ''}
                  onChange={(event) => {
                    const nextCompanyId = event.target.value || null;
                    const nextCompany = geoVictoriaCompanies.find((company) => company.companyId === nextCompanyId) ?? null;
                    setSelectedGeoVictoriaCompany(nextCompanyId, nextCompany ? getCompanyLabel(nextCompany) : null);
                  }}
                >
                  <option value="">Seleccione una empresa</option>
                  {selectableGeoVictoriaCompanies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.alias} - {company.name}
                    </option>
                  ))}
                </Select>
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

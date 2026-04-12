import { Box, Flex, Icon, Image, Link, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { FiCalendar, FiGrid, FiLayers, FiMap, FiSend, FiSettings, FiShield, FiUsers } from 'react-icons/fi';
import { useAuthStore } from '../store/useAuthStore';

const links = [
  { to: '/employees', label: 'Colaboradores', icon: FiUsers },
  { to: '/planning', label: 'Planificación', icon: FiCalendar, end: true },
  { to: '/planning/weekly-overview', label: 'Vista General', icon: FiGrid },
  { to: '/roles', label: 'Zonas', icon: FiLayers },
  { to: '/areas', label: 'Áreas', icon: FiMap },
  { to: '/geo-migration', label: 'Migrar a Geo', icon: FiSend },
  { to: '/users', label: 'Usuarios', icon: FiShield },
  { to: '/settings/timeslots', label: 'Config. Horarios', icon: FiSettings }
];

export function Sidebar(): JSX.Element {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === 'super_administrador';
  const visibleLinks = isAdmin ? links : links.filter((link) => link.to !== '/users');

  return (
    <Box
      bg="white"
      borderRightWidth="1px"
      borderRightColor="#d8e0ea"
      w={{ base: '100%', md: '280px' }}
      minH={{ base: 'auto', md: '100vh' }}
      p={{ base: 3, md: 5 }}
      position={{ base: 'static', md: 'sticky' }}
      top={0}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      <Box>
        <Flex justify="center" align="center" mb={{ base: 3, md: 8 }} px={2}>
          <Image
            src="/logo.svg"
            alt="Logo de OishiPartners"
            w={{ base: '170px', md: '200px' }}
            maxW="100%"
            h="auto"
            objectFit="contain"
            display="block"
          />
        </Flex>
        <Flex
          direction={{ base: 'row', md: 'column' }}
          gap={2}
          wrap={{ base: 'nowrap', md: 'wrap' }}
          overflowX={{ base: 'auto', md: 'visible' }}
          pb={{ base: 1, md: 0 }}
        >
          {visibleLinks.map((link) => (
            <Link
              key={link.to}
              as={NavLink}
              to={link.to}
              end={link.end}
              _hover={{ textDecor: 'none', bg: '#eef4fb' }}
              _activeLink={{ bg: '#e6f2ff', color: '#1468b8', borderColor: '#bdd9f6' }}
              px={{ base: 3, md: 4 }}
              py={{ base: 2.5, md: 3 }}
              rounded="10px"
              borderWidth="1px"
              borderColor="transparent"
              display="flex"
              alignItems="center"
              gap={3}
              flexShrink={0}
            >
              <Icon as={link.icon} boxSize={5} />
              <Text fontSize="sm">{link.label}</Text>
            </Link>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}

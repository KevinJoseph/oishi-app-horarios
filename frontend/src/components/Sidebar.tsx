import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { FiCalendar, FiGrid, FiLayers, FiSend, FiSettings, FiShield, FiUsers } from 'react-icons/fi';
import { useAuthStore } from '../store/useAuthStore';

const links = [
  { to: '/employees', label: 'Colaboradores', icon: FiUsers },
  { to: '/planning', label: 'Planificación', icon: FiCalendar, end: true },
  { to: '/planning/weekly-overview', label: 'Vista General', icon: FiGrid },
  { to: '/roles', label: 'Leyenda / Zonas', icon: FiLayers },
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
        <Text
          fontSize={{ base: '1xl', md: '2xl' }}
          fontWeight="800"
          mb={{ base: 3, md: 8 }}
          color="#1f7ad0"
          letterSpacing="-0.03em"
        >
          OishiPartners
        </Text>
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

import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import { CalendarIcon, SettingsIcon } from '@chakra-ui/icons';
import { NavLink } from 'react-router-dom';
import { FiUsers, FiLayers, FiGrid } from 'react-icons/fi';

const links = [
  { to: '/planning', label: 'Planificación', icon: CalendarIcon },
  { to: '/employees', label: 'Empleados', icon: FiUsers },
  { to: '/roles', label: 'Leyenda / Zonas (Puestos)', icon: FiLayers },
  { to: '/settings/timeslots', label: 'Config. Horarios', icon: SettingsIcon },
  { to: '/planning/weekly-overview', label: 'Vista General Semanal', icon: FiGrid }
];

export function Sidebar(): JSX.Element {
  return (
    <Box
      bg="white"
      borderRightWidth="1px"
      w={{ base: '100%', md: '260px' }}
      minH={{ base: 'auto', md: '100vh' }}
      p={4}
      position={{ base: 'static', md: 'sticky' }}
      top={0}
    >
      <Text fontSize="lg" fontWeight="700" mb={5}>
        OishiPartners
      </Text>
      <Flex direction={{ base: 'row', md: 'column' }} gap={2} wrap="wrap">
        {links.map((link) => (
          <Link
            key={link.to}
            as={NavLink}
            to={link.to}
            _hover={{ textDecor: 'none', bg: 'gray.100' }}
            _activeLink={{ bg: 'blue.50', color: 'blue.700' }}
            px={3}
            py={2}
            rounded="md"
            display="flex"
            alignItems="center"
            gap={2}
          >
            <Icon as={link.icon} />
            <Text fontSize="sm">{link.label}</Text>
          </Link>
        ))}
      </Flex>
    </Box>
  );
}

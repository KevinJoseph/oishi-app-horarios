import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import { CalendarIcon, SettingsIcon } from '@chakra-ui/icons';
import { NavLink } from 'react-router-dom';
import { FiUsers, FiLayers, FiGrid } from 'react-icons/fi';

const links = [
  { to: '/employees', label: 'Colaboradores', icon: FiUsers },
  { to: '/planning', label: 'Planificación', icon: CalendarIcon, end: true },
  { to: '/planning/weekly-overview', label: 'Vista General', icon: FiGrid },
  { to: '/roles', label: 'Leyenda / Zonas', icon: FiLayers },
  { to: '/settings/timeslots', label: 'Config. Horarios', icon: SettingsIcon },
];

export function Sidebar(): JSX.Element {
  return (
    <Box
      bg="whiteAlpha.900"
      backdropFilter="saturate(180%) blur(10px)"
      borderRightWidth="1px"
      borderRightColor="blackAlpha.100"
      w={{ base: '100%', md: '260px' }}
      minH={{ base: 'auto', md: '100vh' }}
      p={5}
      position={{ base: 'static', md: 'sticky' }}
      top={0}
    >
      <Text fontSize="xl" fontWeight="800" mb={6} color="brand.800" letterSpacing="-0.01em">
        OishiPartners
      </Text>
      <Flex direction={{ base: 'row', md: 'column' }} gap={2} wrap="wrap">
        {links.map((link) => (
          <Link
            key={link.to}
            as={NavLink}
            to={link.to}
            end={link.end}
            _hover={{ textDecor: 'none', bg: 'blackAlpha.50' }}
            _activeLink={{ bg: 'brand.50', color: 'brand.700', borderColor: 'brand.200' }}
            px={3}
            py={2}
            rounded="md"
            borderWidth="1px"
            borderColor="transparent"
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
